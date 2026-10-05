const request = require('supertest');
const mongoose = require('mongoose');
const Event = require('../../models/Event');
const Notification = require('../../models/Notification');
const { buildApp } = require('../helpers/app');
const {
  DAY,
  HOUR,
  createUser,
  createAdmin,
  createEvent,
  eventPayload,
  authHeader,
} = require('../helpers/factories');

const app = buildApp();
const titles = (res) => res.body.data.map((e) => e.title).sort();

describe('GET /api/events', () => {
  it('shows anonymous visitors only approved or ongoing public events', async () => {
    const faculty = await createUser('faculty');
    await createEvent(faculty, { title: 'Visible' });
    await createEvent(faculty, { title: 'Ongoing', status: 'ongoing' });
    await createEvent(faculty, { title: 'Draft', status: 'draft' });
    await createEvent(faculty, { title: 'Pending', status: 'pending_approval' });
    await createEvent(faculty, { title: 'Private', isPublic: false });
    await createEvent(faculty, { title: 'Done', status: 'completed' });

    const res = await request(app).get('/api/events');

    expect(res).toBeApiSuccess();
    expect(titles(res)).toEqual(['Ongoing', 'Visible']);
  });

  it('treats an outsider like an anonymous visitor', async () => {
    const faculty = await createUser('faculty');
    const outsider = await createUser('outsider');
    await createEvent(faculty, { title: 'Public' });
    await createEvent(faculty, { title: 'Private', isPublic: false });

    const res = await request(app).get('/api/events').set(authHeader(outsider));
    expect(titles(res)).toEqual(['Public']);
  });

  it('shows LNMIIT members completed and private events too, but never drafts', async () => {
    const faculty = await createUser('faculty');
    const student = await createUser('student');
    await createEvent(faculty, { title: 'Visible' });
    await createEvent(faculty, { title: 'Private', isPublic: false });
    await createEvent(faculty, { title: 'Done', status: 'completed' });
    await createEvent(faculty, { title: 'Draft', status: 'draft' });

    const res = await request(app).get('/api/events').set(authHeader(student));
    expect(titles(res)).toEqual(['Done', 'Private', 'Visible']);
  });

  it('lets only the admin filter by status', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');
    const faculty = await createUser('faculty');
    await createEvent(faculty, { title: 'Visible' });
    await createEvent(faculty, { title: 'Draft', status: 'draft' });

    const asAdmin = await request(app).get('/api/events?status=draft').set(authHeader(admin));
    const asStudent = await request(app).get('/api/events?status=draft').set(authHeader(student));

    expect(titles(asAdmin)).toEqual(['Draft']);
    expect(titles(asStudent)).toEqual(['Visible']);
  });

  it('filters by category, canonical venue and club', async () => {
    const faculty = await createUser('faculty');
    await createEvent(faculty, { title: 'Tech LT1', category: 'technical', canonicalVenue: 'LT-1', club: 'ACM' });
    await createEvent(faculty, { title: 'Culture LT2', category: 'cultural', canonicalVenue: 'LT-2', club: 'Dance' });

    expect(titles(await request(app).get('/api/events?category=cultural'))).toEqual(['Culture LT2']);
    expect(titles(await request(app).get('/api/events?venue=LT-1'))).toEqual(['Tech LT1']);
    expect(titles(await request(app).get('/api/events?club=Dance'))).toEqual(['Culture LT2']);
  });

  it('puts pinned events first, then orders by start time', async () => {
    const faculty = await createUser('faculty');
    await createEvent(faculty, { title: 'Later', startDateTime: new Date(Date.now() + 5 * DAY) });
    await createEvent(faculty, { title: 'Sooner', startDateTime: new Date(Date.now() + 1 * DAY) });
    await createEvent(faculty, { title: 'Pinned', isPinned: true, startDateTime: new Date(Date.now() + 9 * DAY) });

    const res = await request(app).get('/api/events');
    expect(res.body.data.map((e) => e.title)).toEqual(['Pinned', 'Sooner', 'Later']);
  });

  it('paginates and reports totals', async () => {
    const faculty = await createUser('faculty');
    for (let i = 0; i < 3; i += 1) await createEvent(faculty, { title: `E${i}` });

    const res = await request(app).get('/api/events?page=2&limit=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, pages: 2 });
  });

  it('caps an enormous page size and survives nonsense paging values', async () => {
    const huge = await request(app).get('/api/events?limit=100000');
    expect(huge.body.pagination.limit).toBeLessThanOrEqual(100);

    const nonsense = await request(app).get('/api/events?page=abc&limit=-5');
    expect(nonsense).toBeApiSuccess();
    expect(nonsense.body.pagination.page).toBe(1);
    expect(nonsense.body.pagination.limit).toBeGreaterThan(0);
  });
});

describe('GET /api/events/:id', () => {
  it('returns an approved event to anyone', async () => {
    const faculty = await createUser('faculty');
    const event = await createEvent(faculty);
    const res = await request(app).get(`/api/events/${event._id}`);
    expect(res).toBeApiSuccess();
    expect(res.body.data.title).toBe('Seed Event');
  });

  it.each(['draft', 'pending_approval', 'rejected'])('hides a %s event from the public', async (status) => {
    const faculty = await createUser('faculty');
    const event = await createEvent(faculty, { status });
    expect(await request(app).get(`/api/events/${event._id}`)).toBeApiError(404);
  });

  it('shows an unapproved event to its organizer and to the admin only', async () => {
    const owner = await createUser('faculty');
    const other = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(owner, { status: 'pending_approval' });

    expect(await request(app).get(`/api/events/${event._id}`).set(authHeader(owner))).toBeApiSuccess();
    expect(await request(app).get(`/api/events/${event._id}`).set(authHeader(admin))).toBeApiSuccess();
    expect(await request(app).get(`/api/events/${event._id}`).set(authHeader(other))).toBeApiError(404);
  });

  it('hides a private event from visitors but not from members', async () => {
    const faculty = await createUser('faculty');
    const student = await createUser('student');
    const event = await createEvent(faculty, { isPublic: false });
    expect(await request(app).get(`/api/events/${event._id}`)).toBeApiError(404);
    expect(await request(app).get(`/api/events/${event._id}`).set(authHeader(student))).toBeApiSuccess();
  });

  it('answers 404 for an unknown id and 400 for a malformed one', async () => {
    expect(await request(app).get(`/api/events/${new mongoose.Types.ObjectId()}`)).toBeApiError(404);
    expect(await request(app).get('/api/events/not-an-id')).toBeApiError(400, /Invalid/);
  });
});

describe('POST /api/events', () => {
  it('lets faculty create an approved event owned by them, with the venue resolved', async () => {
    const faculty = await createUser('faculty');
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(faculty))
      .send(eventPayload({ venue: 'lecture hall 3' }));

    expect(res).toBeApiSuccess(201);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.organizer).toBe(String(faculty._id));
    expect(res.body.data.canonicalVenue).toBe('LT-3');
    expect(res.body.data.rawVenueInput).toBe('lecture hall 3');
    expect(String(res.body.data.approvedBy)).toBe(String(faculty._id));
  });

  it('is closed to students, outsiders and anonymous callers', async () => {
    const student = await createUser('student');
    const outsider = await createUser('outsider');
    expect(await request(app).post('/api/events').send(eventPayload())).toBeApiError(401);
    expect(await request(app).post('/api/events').set(authHeader(student)).send(eventPayload())).toBeApiError(403);
    expect(await request(app).post('/api/events').set(authHeader(outsider)).send(eventPayload())).toBeApiError(403);
  });

  it('rejects an event that starts in the past', async () => {
    const faculty = await createUser('faculty');
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(faculty))
      .send(eventPayload({ startDateTime: new Date(Date.now() - HOUR).toISOString() }));
    expect(res).toBeApiError(400, /past/);
  });

  it('rejects an event that ends before it starts', async () => {
    const faculty = await createUser('faculty');
    const start = Date.now() + 2 * DAY;
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(faculty))
      .send(eventPayload({
        startDateTime: new Date(start).toISOString(),
        endDateTime: new Date(start - HOUR).toISOString(),
      }));
    expect(res).toBeApiError(400, /end/i);
  });

  it.each([
    ['no start time', { startDateTime: undefined }],
    ['no end time', { endDateTime: undefined }],
    ['an unparseable start time', { startDateTime: 'next tuesday-ish' }],
    ['no title', { title: undefined }],
  ])('answers 400, not 500, for %s', async (_label, override) => {
    const faculty = await createUser('faculty');
    const res = await request(app).post('/api/events').set(authHeader(faculty)).send(eventPayload(override));
    expect(res).toBeApiError(400);
  });

  it('refuses an unknown venue and suggests close matches', async () => {
    const faculty = await createUser('faculty');
    const res = await request(app).post('/api/events').set(authHeader(faculty)).send(eventPayload({ venue: 'LT-99' }));
    expect(res).toBeApiError(400);
  });

  it('ignores fields the client must not control', async () => {
    const faculty = await createUser('faculty');
    const stranger = await createUser('faculty');
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(faculty))
      .send(eventPayload({
        organizer: String(stranger._id),
        registeredCount: 999,
        isPinned: true,
        status: 'rejected',
        approvedBy: String(stranger._id),
      }));

    expect(res).toBeApiSuccess(201);
    const stored = await Event.findById(res.body.data._id);
    expect(String(stored.organizer)).toBe(String(faculty._id));
    expect(stored.registeredCount).toBe(0);
    expect(stored.isPinned).toBe(false);
    expect(stored.status).toBe('approved');
    expect(String(stored.approvedBy)).toBe(String(faculty._id));
  });
});

describe('venue conflicts on create', () => {
  let faculty;
  let existing;
  beforeEach(async () => {
    faculty = await createUser('faculty');
    existing = await createEvent(faculty, {
      title: 'Already booked',
      startDateTime: new Date(Date.now() + 3 * DAY),
    });
  });

  const overlapping = (overrides = {}) =>
    eventPayload({
      venue: 'LT-1',
      startDateTime: new Date(existing.startDateTime.getTime() + 30 * 60 * 1000).toISOString(),
      endDateTime: new Date(existing.endDateTime.getTime() + HOUR).toISOString(),
      ...overrides,
    });

  it('blocks faculty from double-booking a venue', async () => {
    const other = await createUser('faculty');
    const res = await request(app).post('/api/events').set(authHeader(other)).send(overlapping());
    expect(res).toBeApiError(409, /conflict/i);
    expect(res.body.conflicts.primaryConflict.conflicts[0].title).toBe('Already booked');
  });

  it('recognises the same venue under a different spelling', async () => {
    const other = await createUser('faculty');
    const res = await request(app).post('/api/events').set(authHeader(other)).send(overlapping({ venue: 'lecture theatre 1' }));
    expect(res.status).toBe(409);
  });

  it('allows back-to-back bookings where one ends exactly when the next starts', async () => {
    const other = await createUser('faculty');
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(other))
      .send(eventPayload({
        venue: 'LT-1',
        startDateTime: existing.endDateTime.toISOString(),
        endDateTime: new Date(existing.endDateTime.getTime() + HOUR).toISOString(),
      }));
    expect(res).toBeApiSuccess(201);
  });

  it('allows the same slot at a different venue', async () => {
    const other = await createUser('faculty');
    const res = await request(app).post('/api/events').set(authHeader(other)).send(overlapping({ venue: 'LT-2' }));
    expect(res).toBeApiSuccess(201);
  });

  it.each(['pending_approval', 'cancelled', 'rejected', 'draft'])('ignores a %s event when checking', async (status) => {
    await Event.updateOne({ _id: existing._id }, { status });
    const other = await createUser('faculty');
    const res = await request(app).post('/api/events').set(authHeader(other)).send(overlapping());
    expect(res).toBeApiSuccess(201);
  });

  it('makes the admin give a reason before overriding, then records it', async () => {
    const admin = await createAdmin();
    const refused = await request(app).post('/api/events').set(authHeader(admin)).send(overlapping());
    expect(refused).toBeApiError(409, /conflictOverrideReason/);

    const allowed = await request(app)
      .post('/api/events')
      .set(authHeader(admin))
      .send(overlapping({ conflictOverrideReason: 'Principal convocation takes priority' }));
    expect(allowed).toBeApiSuccess(201);
    expect(allowed.body.data.conflictOverrideReason).toBe('Principal convocation takes priority');
  });
});

describe('PUT /api/events/:id', () => {
  it('lets the organizer edit their own event', async () => {
    const owner = await createUser('faculty');
    const event = await createEvent(owner);
    const res = await request(app).put(`/api/events/${event._id}`).set(authHeader(owner)).send({ title: 'Renamed' });
    expect(res).toBeApiSuccess();
    expect(res.body.data.title).toBe('Renamed');
  });

  it('lets the admin edit any event and refuses other faculty', async () => {
    const owner = await createUser('faculty');
    const other = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(owner);

    expect(await request(app).put(`/api/events/${event._id}`).set(authHeader(other)).send({ title: 'Hijack' })).toBeApiError(403);
    expect(await request(app).put(`/api/events/${event._id}`).set(authHeader(admin)).send({ title: 'By admin' })).toBeApiSuccess();
    expect(await request(app).put(`/api/events/${event._id}`).send({ title: 'Anon' })).toBeApiError(401);
  });

  it('does not let an organizer approve their own rejected event or hand it to someone else', async () => {
    const owner = await createUser('faculty');
    const other = await createUser('faculty');
    const event = await createEvent(owner, { status: 'rejected', rejectionReason: 'Clashes with exams' });

    const res = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(owner))
      .send({
        title: 'Retitled',
        status: 'approved',
        organizer: String(other._id),
        registeredCount: 500,
        isPinned: true,
        rejectionReason: '',
      });

    expect(res).toBeApiSuccess();
    const stored = await Event.findById(event._id);
    expect(stored.title).toBe('Retitled');
    expect(stored.status).toBe('rejected');
    expect(String(stored.organizer)).toBe(String(owner._id));
    expect(stored.registeredCount).toBe(0);
    expect(stored.isPinned).toBe(false);
    expect(stored.rejectionReason).toBe('Clashes with exams');
  });

  it('re-resolves the venue when it changes and re-checks conflicts', async () => {
    const owner = await createUser('faculty');
    const rival = await createUser('faculty');
    const admin = await createAdmin();
    const start = new Date(Date.now() + 4 * DAY);
    await createEvent(rival, { canonicalVenue: 'LT-5', venue: 'LT-5', startDateTime: start });
    const mine = await createEvent(owner, { canonicalVenue: 'LT-6', venue: 'LT-6', startDateTime: start });

    const blocked = await request(app).put(`/api/events/${mine._id}`).set(authHeader(owner)).send({ venue: 'lt5' });
    expect(blocked).toBeApiError(409);

    const adminMove = await request(app).put(`/api/events/${mine._id}`).set(authHeader(admin)).send({ venue: 'lt5' });
    expect(adminMove).toBeApiSuccess();
    expect(adminMove.body.data.canonicalVenue).toBe('LT-5');

    const unknown = await request(app).put(`/api/events/${mine._id}`).set(authHeader(owner)).send({ venue: 'Moon base' });
    expect(unknown).toBeApiError(400);
  });

  it('answers 404 for a missing event and 400 for a malformed id', async () => {
    const admin = await createAdmin();
    expect(await request(app).put(`/api/events/${new mongoose.Types.ObjectId()}`).set(authHeader(admin)).send({})).toBeApiError(404);
    expect(await request(app).put('/api/events/xyz').set(authHeader(admin)).send({})).toBeApiError(400);
  });
});

describe('DELETE /api/events/:id', () => {
  it('lets the owner or the admin delete, and nobody else', async () => {
    const owner = await createUser('faculty');
    const other = await createUser('faculty');
    const admin = await createAdmin();
    const a = await createEvent(owner);
    const b = await createEvent(owner);

    expect(await request(app).delete(`/api/events/${a._id}`).set(authHeader(other))).toBeApiError(403);
    expect(await request(app).delete(`/api/events/${a._id}`).set(authHeader(owner))).toBeApiSuccess();
    expect(await request(app).delete(`/api/events/${b._id}`).set(authHeader(admin))).toBeApiSuccess();
    expect(await request(app).delete(`/api/events/${b._id}`).set(authHeader(admin))).toBeApiError(404);
  });
});

describe('PATCH /api/events/:id/status and /pin', () => {
  it('lets the admin approve an event and notifies the organizer', async () => {
    const owner = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(owner, { status: 'pending_approval' });

    const res = await request(app)
      .patch(`/api/events/${event._id}/status`)
      .set(authHeader(admin))
      .send({ status: 'approved' });

    expect(res).toBeApiSuccess();
    expect(res.body.data.status).toBe('approved');
    expect(String(res.body.data.approvedBy)).toBe(String(admin._id));
    const note = await Notification.findOne({ recipient: owner._id });
    expect(note.type).toBe('event_approved');
    expect(note.message).toContain('Seed Event');
  });

  it('records the reason when rejecting', async () => {
    const owner = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(owner, { status: 'pending_approval' });

    const res = await request(app)
      .patch(`/api/events/${event._id}/status`)
      .set(authHeader(admin))
      .send({ status: 'rejected', rejectionReason: 'Venue under maintenance' });

    expect(res.body.data.rejectionReason).toBe('Venue under maintenance');
    expect((await Notification.findOne({ recipient: owner._id })).type).toBe('event_rejected');
  });

  it('refuses a status that is not part of the workflow instead of storing it', async () => {
    const owner = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(owner);

    const res = await request(app).patch(`/api/events/${event._id}/status`).set(authHeader(admin)).send({ status: 'banana' });
    expect(res).toBeApiError(400);
    expect((await Event.findById(event._id)).status).toBe('approved');
  });

  it('is admin only, and 404s for a missing event', async () => {
    const owner = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(owner);
    expect(await request(app).patch(`/api/events/${event._id}/status`).set(authHeader(owner)).send({ status: 'cancelled' })).toBeApiError(403);
    expect(await request(app).patch(`/api/events/${new mongoose.Types.ObjectId()}/status`).set(authHeader(admin)).send({ status: 'cancelled' })).toBeApiError(404);
  });

  it('toggles the pin for the admin only', async () => {
    const owner = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(owner);

    expect(await request(app).patch(`/api/events/${event._id}/pin`).set(authHeader(owner))).toBeApiError(403);
    const on = await request(app).patch(`/api/events/${event._id}/pin`).set(authHeader(admin));
    const off = await request(app).patch(`/api/events/${event._id}/pin`).set(authHeader(admin));
    expect(on.body.data.isPinned).toBe(true);
    expect(off.body.data.isPinned).toBe(false);
  });
});

describe('GET /api/events/:id/ics', () => {
  it('returns a calendar file with CRLF line endings and the required fields', async () => {
    const owner = await createUser('faculty');
    const event = await createEvent(owner, {
      title: 'Intro to Jest',
      startDateTime: new Date('2031-03-04T05:06:07Z'),
      endDateTime: new Date('2031-03-04T07:06:07Z'),
    });

    const res = await request(app).get(`/api/events/${event._id}/ics`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.text).toContain('BEGIN:VCALENDAR\r\n');
    expect(res.text).toContain('DTSTART:20310304T050607Z\r\n');
    expect(res.text).toContain('DTEND:20310304T070607Z\r\n');
    expect(res.text).toContain('DTSTAMP:');
    expect(res.text).toContain('SUMMARY:Intro to Jest\r\n');
    expect(res.text.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes text so a title cannot inject calendar properties or break the file name', async () => {
    const owner = await createUser('faculty');
    const event = await createEvent(owner, {
      title: 'Fun, games; and\nATTENDEE:mailto:evil@example.com',
      description: 'line one\nline two',
    });

    const res = await request(app).get(`/api/events/${event._id}/ics`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('SUMMARY:Fun\\, games\; and\\nATTENDEE:mailto:evil@example.com\r\n');
    expect(res.text).not.toMatch(/\r\nATTENDEE:/);
    expect(res.headers['content-disposition']).toMatch(/filename="[A-Za-z0-9_.-]+\.ics"/);
  });

  it('does not hand out the calendar entry of an unapproved event', async () => {
    const owner = await createUser('faculty');
    const event = await createEvent(owner, { status: 'draft' });
    expect((await request(app).get(`/api/events/${event._id}/ics`)).status).toBe(404);
    expect((await request(app).get(`/api/events/${event._id}/ics`).set(authHeader(owner))).status).toBe(200);
  });

  it('answers 404 for an unknown event', async () => {
    expect((await request(app).get(`/api/events/${new mongoose.Types.ObjectId()}/ics`)).status).toBe(404);
  });
});
