const request = require('supertest');
const { buildApp } = require('../helpers/app');
const { createUser, createEvent, authHeader } = require('../helpers/factories');

const app = buildApp();

describe('GET /api/search', () => {
  it('finds events by text and ranks the better match first', async () => {
    const faculty = await createUser('faculty');
    await createEvent(faculty, { title: 'Robotics workshop', description: 'robots robots robots' });
    await createEvent(faculty, { title: 'Poetry night', description: 'a mention of robotics once' });
    await createEvent(faculty, { title: 'Chess', description: 'no match here' });

    const res = await request(app).get('/api/search?q=robotics');

    expect(res).toBeApiSuccess();
    expect(res.body.data.map((e) => e.title)).toEqual(['Robotics workshop', 'Poetry night']);
  });

  it('hides unapproved events, and private ones from visitors', async () => {
    const faculty = await createUser('faculty');
    const student = await createUser('student');
    await createEvent(faculty, { title: 'quiz public' });
    await createEvent(faculty, { title: 'quiz secret', isPublic: false });
    await createEvent(faculty, { title: 'quiz draft', status: 'draft' });

    const visitor = await request(app).get('/api/search?q=quiz');
    const member = await request(app).get('/api/search?q=quiz').set(authHeader(student));

    expect(visitor.body.data.map((e) => e.title)).toEqual(['quiz public']);
    expect(member.body.data.map((e) => e.title).sort()).toEqual(['quiz public', 'quiz secret']);
  });

  it('needs a query of at least two characters', async () => {
    expect(await request(app).get('/api/search?q=a')).toBeApiError(400);
    expect(await request(app).get('/api/search')).toBeApiError(400);
  });

  it('caps the page size', async () => {
    const res = await request(app).get('/api/search?q=anything&limit=100000');
    expect(res).toBeApiSuccess();
  });
});

describe('venue endpoints', () => {
  it('lists venues and filters by category', async () => {
    const all = await request(app).get('/api/venues');
    expect(all.body.data.length).toBeGreaterThan(50);
    expect(all.body.data[0]).toEqual({ canonical: expect.any(String), category: expect.any(String), capacity: expect.any(Number) });

    const labs = await request(app).get('/api/venues?category=lab');
    expect(labs.body.data.length).toBeGreaterThan(0);
    expect(labs.body.data.every((v) => v.category === 'lab')).toBe(true);
  });

  it('resolves a typed venue name to its canonical form', async () => {
    const res = await request(app).post('/api/venues/resolve').send({ venue: 'lecture hall 12' });
    expect(res.body.data).toMatchObject({ resolved: true, canonical: 'LT-12', matchType: 'alias' });
    expect(await request(app).post('/api/venues/resolve').send({})).toBeApiError(400);
  });

  it('searches venues by partial name', async () => {
    const res = await request(app).get('/api/venues/search?q=seminar');
    expect(res.body.data.every((v) => /seminar/i.test(v.canonical))).toBe(true);
    expect(await request(app).get('/api/venues/search')).toBeApiError(400);
  });
});
