const request = require('supertest');
const Event = require('../../models/Event');
const { buildApp } = require('../helpers/app');
const { createUser, createEvent, authHeader } = require('../helpers/factories');

const app = buildApp();

describe('HTTP hardening', () => {
  it('sets security headers on every response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured front end origin with credentials and nobody else', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const other = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  it('answers a CORS preflight for the front end', async () => {
    const res = await request(app)
      .options('/api/events')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });
});

describe('NoSQL injection', () => {
  it('does not let an operator object stand in for a value in a query string', async () => {
    const faculty = await createUser('faculty');
    await createEvent(faculty, { title: 'Tech', category: 'technical' });
    await createEvent(faculty, { title: 'Cultural', category: 'cultural' });

    // {$ne: 'technical'} would return 'Cultural'. The operator is stripped, what
    // is left is not a valid category, and the request is refused.
    const res = await request(app).get('/api/events?category[$ne]=technical');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('Cultural');
  });

  it('does not let a body operator bypass the admin password check', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@lnmiit.ac.in', password: { $ne: '' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.data).toBeUndefined();
  });
});

describe('error handling', () => {
  it('answers malformed JSON with a clean 400', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/auth/admin/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).not.toMatch(/at .*\.js/);
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res).toBeApiError(404, /not found/i);
  });

  it('does not leak internal error text in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prod = buildApp();
      jest.spyOn(Event, 'find').mockImplementation(() => {
        throw new Error('connection string mongodb://user:secret@host failed');
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(prod).get('/api/events');

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toMatch(/secret|mongodb:\/\//);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('shows the real message outside production, which is what a developer needs', async () => {
    jest.spyOn(Event, 'find').mockImplementation(() => {
      throw new Error('boom for the developer');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/boom/);
  });
});

describe('operations', () => {
  it('reports liveness without touching the database', async () => {
    const res = await request(app).get('/api/health');
    expect(res).toBeApiSuccess();
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it('reports readiness from the database connection', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res).toBeApiSuccess();
    expect(res.body.database).toBe('connected');
  });

  it('gives every response a request id, and echoes one the caller supplies', async () => {
    const generated = await request(app).get('/api/health');
    expect(generated.headers['x-request-id']).toMatch(/^[\w-]{8,}$/);

    const echoed = await request(app).get('/api/health').set('X-Request-Id', 'trace-abc-123');
    expect(echoed.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('replaces a hostile request id instead of reflecting it', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'x'.repeat(500));
    expect(res.headers['x-request-id'].length).toBeLessThanOrEqual(64);
  });

  it('applies the general rate limit across the API', async () => {
    const limited = buildApp({ limits: { generalMax: 3, authMax: 100 } });
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await request(limited).get('/api/health')).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    const blocked = await request(limited).get('/api/health');
    expect(blocked.body).toEqual({ success: false, error: 'Too many requests. Please try again later.' });
    expect(blocked.headers['ratelimit-limit']).toBeDefined();
  });

  it('counts clients separately when behind a trusted proxy', async () => {
    process.env.TRUST_PROXY = '1';
    try {
      const proxied = buildApp({ limits: { generalMax: 1, authMax: 100 } });
      const a1 = await request(proxied).get('/api/health').set('X-Forwarded-For', '203.0.113.1');
      const a2 = await request(proxied).get('/api/health').set('X-Forwarded-For', '203.0.113.1');
      const b1 = await request(proxied).get('/api/health').set('X-Forwarded-For', '203.0.113.2');
      expect([a1.status, a2.status, b1.status]).toEqual([200, 429, 200]);
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });
});

describe('authorisation sweep', () => {
  // Every state-changing or private route must refuse an anonymous caller
  it.each([
    ['post', '/api/events'],
    ['put', '/api/events/507f1f77bcf86cd799439011'],
    ['delete', '/api/events/507f1f77bcf86cd799439011'],
    ['patch', '/api/events/507f1f77bcf86cd799439011/status'],
    ['post', '/api/registrations'],
    ['get', '/api/registrations/my'],
    ['post', '/api/teams'],
    ['get', '/api/teams/my'],
    ['post', '/api/event-requests'],
    ['get', '/api/users/profile'],
    ['get', '/api/users'],
    ['get', '/api/notifications'],
    ['post', '/api/notifications/broadcast'],
    ['get', '/api/admin/dashboard'],
  ])('%s %s answers 401 without a token', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });
});

test('a logged-in student cannot reach any admin route', async () => {
  const student = await createUser('student');
  for (const path of ['/api/admin/dashboard', '/api/admin/analytics', '/api/admin/audit-logs', '/api/users', '/api/event-requests']) {
    expect((await request(app).get(path).set(authHeader(student))).status).toBe(403);
  }
});
