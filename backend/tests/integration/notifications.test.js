const request = require('supertest');
const Notification = require('../../models/Notification');
const { buildApp } = require('../helpers/app');
const { createUser, createAdmin, authHeader } = require('../helpers/factories');

const app = buildApp();
const note = (recipient, overrides = {}) =>
  Notification.create({ recipient: recipient._id, type: 'system_announcement', title: 'Hello', message: 'World', ...overrides });

describe('notifications', () => {
  it('lists only my notifications, newest first, with the unread count', async () => {
    const me = await createUser('student');
    const other = await createUser('student');
    await note(me, { title: 'older', createdAt: new Date('2030-01-01') });
    await note(me, { title: 'newer', createdAt: new Date('2030-02-01'), isRead: true });
    await note(other, { title: 'not mine' });

    const res = await request(app).get('/api/notifications').set(authHeader(me));

    expect(res.body.data.map((n) => n.title)).toEqual(['newer', 'older']);
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.pagination.total).toBe(2);
  });

  it('filters to unread and paginates with a bounded page size', async () => {
    const me = await createUser('student');
    await note(me, { isRead: true });
    await note(me);
    await note(me);

    const unread = await request(app).get('/api/notifications?unreadOnly=true').set(authHeader(me));
    expect(unread.body.data).toHaveLength(2);
    const paged = await request(app).get('/api/notifications?page=2&limit=2').set(authHeader(me));
    expect(paged.body.data).toHaveLength(1);
    const huge = await request(app).get('/api/notifications?limit=100000').set(authHeader(me));
    expect(huge.body.pagination.limit).toBeLessThanOrEqual(100);
  });

  it('answers a quick unread count', async () => {
    const me = await createUser('student');
    await note(me);
    await note(me, { isRead: true });
    const res = await request(app).get('/api/notifications/unread-count').set(authHeader(me));
    expect(res.body.data.count).toBe(1);
  });

  it('marks one of my notifications read but leaves someone else\'s alone', async () => {
    const me = await createUser('student');
    const other = await createUser('student');
    const mine = await note(me);
    const theirs = await note(other);

    await request(app).patch(`/api/notifications/${mine._id}/read`).set(authHeader(me));
    await request(app).patch(`/api/notifications/${theirs._id}/read`).set(authHeader(me));

    expect((await Notification.findById(mine._id)).isRead).toBe(true);
    expect((await Notification.findById(theirs._id)).isRead).toBe(false);
  });

  it('marks everything of mine read in one call', async () => {
    const me = await createUser('student');
    const other = await createUser('student');
    await note(me);
    await note(me);
    await note(other);

    await request(app).patch('/api/notifications/read-all').set(authHeader(me));

    expect(await Notification.countDocuments({ recipient: me._id, isRead: false })).toBe(0);
    expect(await Notification.countDocuments({ recipient: other._id, isRead: false })).toBe(1);
  });

  it('requires a login', async () => {
    expect(await request(app).get('/api/notifications')).toBeApiError(401);
  });
});

describe('POST /api/notifications/broadcast', () => {
  it('sends to every active user, or only to one role', async () => {
    const admin = await createAdmin();
    await createUser('student');
    await createUser('student');
    await createUser('faculty');
    await createUser('student', { isActive: false });

    const toStudents = await request(app)
      .post('/api/notifications/broadcast')
      .set(authHeader(admin))
      .send({ title: 'Fest', message: 'Starts Monday', targetRole: 'student' });
    expect(toStudents.body.message).toMatch(/2 users/);

    const toAll = await request(app)
      .post('/api/notifications/broadcast')
      .set(authHeader(admin))
      .send({ title: 'All hands', message: 'Hello', targetRole: 'all' });
    expect(toAll.body.message).toMatch(/4 users/);
    expect(await Notification.countDocuments({ type: 'system_announcement', title: 'All hands' })).toBe(4);
  });

  it('is admin only and needs a title and message', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');
    expect(await request(app).post('/api/notifications/broadcast').set(authHeader(student)).send({ title: 'x', message: 'y' })).toBeApiError(403);
    expect(await request(app).post('/api/notifications/broadcast').set(authHeader(admin)).send({ message: 'no title' })).toBeApiError(400);
    expect(await request(app).post('/api/notifications/broadcast').set(authHeader(admin)).send({ title: 'no message' })).toBeApiError(400);
  });
});
