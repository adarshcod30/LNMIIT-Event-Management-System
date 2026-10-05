const express = require('express');
const request = require('supertest');
const pino = require('pino');
const { Writable } = require('stream');
const { createLimiters } = require('../../middleware/rateLimiter');
const { createRequestLogger } = require('../../lib/requestLogger');
const { createShutdown } = require('../../lib/shutdown');
const { recordAudit } = require('../../lib/audit');
const AuditLog = require('../../models/AuditLog');

describe('createLimiters', () => {
  const appWith = (limiter) => {
    const app = express();
    app.use(limiter);
    app.get('/', (req, res) => res.json({ ok: true }));
    app.post('/login', (req, res) => res.status(req.query.fail ? 401 : 200).json({}));
    return app;
  };

  it('uses 100 requests a minute by default, then answers 429 in the API\'s error shape', async () => {
    const { generalLimiter } = createLimiters();
    const app = appWith(generalLimiter);

    let last;
    for (let i = 0; i < 100; i += 1) last = await request(app).get('/');
    expect(last.status).toBe(200);
    expect(last.headers['ratelimit-limit']).toBe('100');
    expect(last.headers['ratelimit-remaining']).toBe('0');

    const blocked = await request(app).get('/');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, error: 'Too many requests. Please try again later.' });
  });

  it('gives every call its own counters', async () => {
    const a = appWith(createLimiters({ generalMax: 1 }).generalLimiter);
    const b = appWith(createLimiters({ generalMax: 1 }).generalLimiter);
    expect((await request(a).get('/')).status).toBe(200);
    expect((await request(a).get('/')).status).toBe(429);
    expect((await request(b).get('/')).status).toBe(200);
  });

  it('counts only failed attempts on the auth limiter', async () => {
    const app = appWith(createLimiters({ authMax: 2 }).authLimiter);
    const statuses = [];
    for (const path of ['/login', '/login', '/login', '/login?fail=1', '/login?fail=1', '/login?fail=1']) {
      statuses.push((await request(app).post(path)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 401, 401, 429]);
  });

  it('explains an auth lock-out in terms a user understands', async () => {
    const app = appWith(createLimiters({ authMax: 1 }).authLimiter);
    await request(app).post('/login?fail=1');
    const blocked = await request(app).post('/login?fail=1');
    expect(blocked.body.error).toMatch(/Too many login attempts.*15 minutes/);
  });
});

describe('request logger', () => {
  const capture = () => {
    const lines = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(JSON.parse(chunk.toString()));
        cb();
      },
    });
    const logger = pino({ level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie'] }, stream);
    const app = express();
    app.use(createRequestLogger({ logger }));
    app.get('/api/health', (req, res) => res.json({}));
    app.get('/ok', (req, res) => res.json({}));
    app.get('/missing', (req, res) => res.status(404).json({}));
    app.get('/boom', (req, res) => res.status(500).json({}));
    return { app, lines };
  };

  it('logs one structured line per request with its id, status and timing', async () => {
    const { app, lines } = capture();
    const res = await request(app).get('/ok').set('X-Request-Id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 30, req: { id: 'abc-123', method: 'GET', url: '/ok' }, res: { statusCode: 200 } });
    expect(lines[0].responseTime).toEqual(expect.any(Number));
  });

  it('never writes a credential to the log', async () => {
    const { app, lines } = capture();
    await request(app).get('/ok').set('Authorization', 'Bearer super-secret-token').set('Cookie', 'sid=secret-cookie');
    const text = JSON.stringify(lines);
    expect(text).not.toContain('super-secret-token');
    expect(text).not.toContain('secret-cookie');
    expect(lines[0].req.headers.authorization).toBe('[Redacted]');
  });

  it('logs client errors as warnings and server errors as errors', async () => {
    const { app, lines } = capture();
    await request(app).get('/missing');
    await request(app).get('/boom');
    expect(lines.map((l) => l.level)).toEqual([40, 50]);
  });

  it('does not log the health check, which a platform calls every few seconds', async () => {
    const { app, lines } = capture();
    await request(app).get('/api/health');
    expect(lines).toHaveLength(0);
  });

  it('generates an id when none is sent and replaces an unsafe one', async () => {
    const { app } = capture();
    const generated = await request(app).get('/ok');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const unsafe = await request(app).get('/ok').set('X-Request-Id', 'bad id with spaces');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('createShutdown', () => {
  const setup = ({ closeServer = (cb) => cb(), closeDatabase = jest.fn().mockResolvedValue() } = {}) => {
    const server = { close: jest.fn(closeServer) };
    const exit = jest.fn();
    const log = { info: jest.fn(), error: jest.fn() };
    const shutdown = createShutdown({ server, closeDatabase, log, exit, graceMs: 5000 });
    return { server, closeDatabase, exit, log, shutdown };
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops listening, closes the database, then exits cleanly, in that order', async () => {
    const order = [];
    const { shutdown, exit } = setup({
      closeServer: (cb) => { order.push('server'); cb(); },
      closeDatabase: jest.fn(async () => { order.push('database'); }),
    });
    exit.mockImplementation(() => order.push('exit'));

    await shutdown('SIGTERM');

    expect(order).toEqual(['server', 'database', 'exit']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('runs only once, however many signals arrive', async () => {
    const { shutdown, server, exit } = setup();
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT'), shutdown('SIGTERM')]);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('exits with 1 if closing fails', async () => {
    const { shutdown, exit, log } = setup({ closeDatabase: jest.fn().mockRejectedValue(new Error('db stuck')) });
    await shutdown('SIGTERM');
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('db stuck'));
  });

  it('forces an exit when in-flight requests never finish within the grace period', async () => {
    jest.useFakeTimers();
    const { shutdown, exit, log } = setup({ closeServer: () => {} }); // never calls back
    shutdown('SIGTERM');

    jest.advanceTimersByTime(4999);
    expect(exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2);
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('forcing exit'));
  });
});

describe('recordAudit', () => {
  it('writes who, what, to which record and from where', async () => {
    const spy = jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    await recordAudit(
      { user: { _id: 'admin-id' }, ip: '203.0.113.9' },
      { action: 'user.deactivated', targetType: 'user', targetId: 'target-id', details: 'a@b.c' },
    );
    expect(spy).toHaveBeenCalledWith({
      adminId: 'admin-id',
      action: 'user.deactivated',
      targetType: 'user',
      targetId: 'target-id',
      details: 'a@b.c',
      ipAddress: '203.0.113.9',
    });
  });

  it('copes with a request that has no ip', async () => {
    const spy = jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    await recordAudit({ user: { _id: 'a' } }, { action: 'x', targetType: 'system' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '', details: '' }));
  });

  it('reports a failed write on the console and resolves instead of throwing', async () => {
    jest.spyOn(AuditLog, 'create').mockRejectedValue(new Error('disk full'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordAudit({ user: { _id: 'a' } }, { action: 'x', targetType: 'system' })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith('Audit log write failed:', 'disk full');
  });
});
