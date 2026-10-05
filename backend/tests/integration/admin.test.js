const request = require('supertest');
const AuditLog = require('../../models/AuditLog');
const User = require('../../models/User');
const { buildApp } = require('../helpers/app');
const { createUser, createAdmin, createEvent, createRegistration, eventPayload, authHeader } = require('../helpers/factories');

const app = buildApp();

describe('access control', () => {
  it.each(['/api/admin/dashboard', '/api/admin/analytics', '/api/admin/audit-logs', '/api/admin/export/users', '/api/admin/export/events'])(
    '%s is for the admin only',
    async (path) => {
      const faculty = await createUser('faculty');
      expect(await request(app).get(path)).toBeApiError(401);
      expect(await request(app).get(path).set(authHeader(faculty))).toBeApiError(403);
    },
  );
});

describe('GET /api/admin/dashboard', () => {
  it('summarises users, events, registrations and pending requests', async () => {
    const admin = await createAdmin();
    const faculty = await createUser('faculty');
    const student = await createUser('student');
    const event = await createEvent(faculty);
    await createEvent(faculty, { status: 'draft' });
    await createRegistration(event, student);

    const res = await request(app).get('/api/admin/dashboard').set(authHeader(admin));

    expect(res).toBeApiSuccess();
    expect(res.body.data.stats).toEqual({
      totalUsers: 3,
      totalEvents: 2,
      totalRegistrations: 1,
      pendingRequests: 0,
      activeEvents: 1,
    });
    expect(res.body.data.usersByRole).toEqual({ admin: 1, faculty: 1, student: 1 });
    expect(res.body.data.upcomingEvents).toHaveLength(1);
    expect(res.body.data.recentRegistrations).toHaveLength(1);
  });
});

describe('GET /api/admin/analytics', () => {
  it('groups events by category and venue and ranks events by registrations', async () => {
    const admin = await createAdmin();
    const faculty = await createUser('faculty');
    const busy = await createEvent(faculty, { title: 'Busy', category: 'technical', canonicalVenue: 'LT-1' });
    await createEvent(faculty, { title: 'Quiet', category: 'cultural', canonicalVenue: 'LT-1' });
    await createRegistration(busy, await createUser('student'));
    await createRegistration(busy, await createUser('student'));

    const res = await request(app).get('/api/admin/analytics').set(authHeader(admin));

    const { data } = res.body;
    expect(Object.fromEntries(data.eventsPerCategory.map((c) => [c._id, c.count]))).toEqual({ technical: 1, cultural: 1 });
    expect(data.topVenues).toEqual([{ _id: 'LT-1', count: 2 }]);
    expect(data.registrationsPerEvent[0]).toMatchObject({ title: 'Busy', count: 2 });
    expect(data.eventsPerMonth.length).toBeGreaterThan(0);
    expect(data.userGrowth.length).toBeGreaterThan(0);
  });
});

describe('exports', () => {
  it('exports users as CSV with safe cells', async () => {
    const admin = await createAdmin();
    await createUser('student', { name: '=cmd|\' /C calc\'!A0' });
    await createUser('student', { name: 'Quote "Man"' });

    const res = await request(app).get('/api/admin/export/users').set(authHeader(admin));

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split('\n')[0]).toBe('Name,Email,Role,Department,Roll Number,Active,Joined');
    expect(res.text).toContain('"Quote ""Man"""');
    expect(res.text).not.toMatch(/(^|,)"=cmd/m);
    expect(res.text).toContain('"\'=cmd');
  });

  it('exports events as CSV', async () => {
    const admin = await createAdmin();
    const faculty = await createUser('faculty');
    await createEvent(faculty, { title: '+SUM(1+1)' });

    const res = await request(app).get('/api/admin/export/events').set(authHeader(admin));

    expect(res.text.split('\n')[0]).toBe('Title,Category,Type,Venue,Start,End,Status,Organizer,Registrations');
    expect(res.text).toContain('"\'+SUM(1+1)"');
  });
});

describe('audit trail', () => {
  const logs = () => AuditLog.find().sort({ createdAt: 1 });

  it('records a role change with who did it, to whom and from where', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');

    await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(admin)).send({ role: 'faculty' });

    const [entry] = await logs();
    expect(entry).toMatchObject({ action: 'user.role_changed', targetType: 'user' });
    expect(String(entry.adminId)).toBe(String(admin._id));
    expect(String(entry.targetId)).toBe(String(student._id));
    expect(entry.details).toMatch(/student.*faculty/);
    expect(entry.ipAddress).toBeTruthy();
  });

  it('records deactivation, event status changes, request reviews and broadcasts', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');
    const faculty = await createUser('faculty');
    const event = await createEvent(faculty, { status: 'pending_approval' });

    await request(app).patch(`/api/users/${student._id}/toggle-active`).set(authHeader(admin));
    await request(app).patch(`/api/events/${event._id}/status`).set(authHeader(admin)).send({ status: 'approved' });
    await request(app).post('/api/notifications/broadcast').set(authHeader(admin)).send({ title: 'Hi', message: 'All' });
    const submitted = await request(app)
      .post('/api/event-requests')
      .set(authHeader(await createUser('student')))
      .send({ eventData: eventPayload() });
    await request(app)
      .patch(`/api/event-requests/${submitted.body.data._id}/review`)
      .set(authHeader(admin))
      .send({ action: 'reject', rejectionReason: 'No' });

    expect((await logs()).map((l) => l.action)).toEqual([
      'user.deactivated',
      'event.status_changed',
      'notification.broadcast',
      'event_request.rejected',
    ]);
  });

  it('records event deletion by the admin', async () => {
    const admin = await createAdmin();
    const event = await createEvent(await createUser('faculty'));
    await request(app).delete(`/api/events/${event._id}`).set(authHeader(admin));
    expect((await logs())[0]).toMatchObject({ action: 'event.deleted', targetType: 'event' });
  });

  it('does not log actions that failed or were refused', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');
    await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(admin)).send({ role: 'admin' });
    await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(student)).send({ role: 'faculty' });
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it('never blocks the action it is recording if the log write fails', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');
    jest.spyOn(AuditLog, 'create').mockRejectedValue(new Error('disk full'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(admin)).send({ role: 'faculty' });

    expect(res).toBeApiSuccess();
    expect((await User.findById(student._id)).role).toBe('faculty');
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/audit/i), expect.any(String));
  });

  it('lists the log newest first with a bounded page size', async () => {
    const admin = await createAdmin();
    await AuditLog.create({ adminId: admin._id, action: 'older', targetType: 'system', createdAt: new Date('2030-01-01') });
    await AuditLog.create({ adminId: admin._id, action: 'newer', targetType: 'system', createdAt: new Date('2030-02-01') });

    const res = await request(app).get('/api/admin/audit-logs').set(authHeader(admin));
    expect(res.body.data.map((l) => l.action)).toEqual(['newer', 'older']);
    expect(res.body.data[0].adminId.email).toBe(admin.email);

    const huge = await request(app).get('/api/admin/audit-logs?limit=100000').set(authHeader(admin));
    expect(huge.body.pagination.limit).toBeLessThanOrEqual(100);
  });
});
