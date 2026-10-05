const request = require('supertest');
const mongoose = require('mongoose');
const pino = require('pino');
const { Writable } = require('stream');
const Registration = require('../../models/Registration');
const Team = require('../../models/Team');
const Event = require('../../models/Event');
const { buildApp } = require('../helpers/app');
const { createUser, createAdmin, createEvent, createRegistration, authHeader } = require('../helpers/factories');

describe('readiness', () => {
  it('reports ready while connected and turns unready, with 503, once the database is gone', async () => {
    const app = buildApp();
    expect(await request(app).get('/api/health/ready')).toBeApiSuccess();

    const dbName = mongoose.connection.name;
    await mongoose.disconnect();
    try {
      const down = await request(app).get('/api/health/ready');
      expect(down.status).toBe(503);
      expect(down.body).toMatchObject({ success: false, database: 'disconnected' });
      // liveness must stay green so the platform does not restart a healthy process
      expect((await request(app).get('/api/health')).status).toBe(200);
    } finally {
      await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
    }

    expect(await request(app).get('/api/health/ready')).toBeApiSuccess();
  });
});

describe('logging through the real app', () => {
  it('logs the request with its id and the authenticated route, without the token', async () => {
    const lines = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(JSON.parse(chunk.toString()));
        cb();
      },
    });
    const logger = pino({ level: 'info', redact: ['req.headers.authorization'] }, stream);
    const app = buildApp({ logger });
    const student = await createUser('student');
    const headers = authHeader(student);

    const res = await request(app).get('/api/auth/me').set(headers).set('X-Request-Id', 'trace-42');

    expect(res.status).toBe(200);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ req: { id: 'trace-42', url: '/api/auth/me' }, res: { statusCode: 200 } });
    expect(JSON.stringify(lines)).not.toContain(headers.Authorization.split(' ')[1]);
  });

  it('includes the request id on the line for a server error, so one failure can be traced', async () => {
    const lines = [];
    const stream = new Writable({ write(c, _e, cb) { lines.push(JSON.parse(c.toString())); cb(); } });
    const app = buildApp({ logger: pino({ level: 'info' }, stream) });
    jest.spyOn(Event, 'find').mockImplementation(() => { throw new Error('kaput'); });

    await request(app).get('/api/events').set('X-Request-Id', 'trace-500');

    const errors = lines.filter((l) => l.level === 50);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((l) => l.req.id === 'trace-500')).toBe(true);
    expect(errors.some((l) => l.err && /kaput/.test(l.err.message))).toBe(true);
  });
});

describe('deleting an event', () => {
  it('removes its registrations and teams with it, and leaves other events alone', async () => {
    const owner = await createUser('faculty');
    const admin = await createAdmin();
    const doomed = await createEvent(owner, { isTeamEvent: true });
    const kept = await createEvent(owner, { title: 'Kept' });
    const student = await createUser('student');
    await createRegistration(doomed, student);
    await createRegistration(kept, student);
    await Team.create({ event: doomed._id, name: 'Gone', captain: student._id, members: [student._id] });

    const res = await request(buildApp()).delete(`/api/events/${doomed._id}`).set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(await Registration.countDocuments({ event: doomed._id })).toBe(0);
    expect(await Team.countDocuments({ event: doomed._id })).toBe(0);
    expect(await Registration.countDocuments({ event: kept._id })).toBe(1);
  });
});
