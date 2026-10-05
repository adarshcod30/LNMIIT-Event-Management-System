const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../models/User');
const { buildApp } = require('../helpers/app');
const { createUser, createAdmin, authHeader } = require('../helpers/factories');

const app = buildApp();

describe('profile', () => {
  it('returns the profile and updates only the fields a user may change', async () => {
    const student = await createUser('student', { profileComplete: false });

    const res = await request(app)
      .put('/api/users/profile')
      .set(authHeader(student))
      .send({
        name: 'Asha Rao',
        bio: 'I like graphs',
        department: 'CSE',
        // none of these may be changed by the user
        role: 'admin',
        email: 'someone-else@lnmiit.ac.in',
        isActive: false,
        eventsAttended: 99,
      });

    expect(res).toBeApiSuccess();
    const stored = await User.findById(student._id);
    expect(stored).toMatchObject({ name: 'Asha Rao', bio: 'I like graphs', department: 'CSE', profileComplete: true });
    expect(stored.role).toBe('student');
    expect(stored.email).toBe(student.email);
    expect(stored.isActive).toBe(true);
    expect(stored.eventsAttended).toBe(0);

    const profile = await request(app).get('/api/users/profile').set(authHeader(student));
    expect(profile.body.data.name).toBe('Asha Rao');
  });

  it('answers 400 for a value the schema refuses', async () => {
    const student = await createUser('student');
    const res = await request(app).put('/api/users/profile').set(authHeader(student)).send({ department: 'Astrology' });
    expect(res).toBeApiError(400);
  });

  it('requires a login', async () => {
    expect(await request(app).get('/api/users/profile')).toBeApiError(401);
  });
});

describe('GET /api/users/search', () => {
  it('finds active users by name, email or roll number, case-insensitively', async () => {
    const me = await createUser('student');
    await createUser('student', { name: 'Alice Wonder', rollNumber: '23UCS111' });
    await createUser('student', { name: 'Bob Builder', isActive: false });

    const byName = await request(app).get('/api/users/search?q=alice').set(authHeader(me));
    expect(byName.body.data.map((u) => u.name)).toEqual(['Alice Wonder']);
    const byRoll = await request(app).get('/api/users/search?q=23ucs111').set(authHeader(me));
    expect(byRoll.body.data).toHaveLength(1);
    const inactive = await request(app).get('/api/users/search?q=bob').set(authHeader(me));
    expect(inactive.body.data).toHaveLength(0);
  });

  it('does not return fields beyond what a directory needs', async () => {
    const me = await createUser('student');
    await createUser('student', { name: 'Alice Wonder', phone: '9999999999' });
    const res = await request(app).get('/api/users/search?q=alice').set(authHeader(me));
    expect(res.body.data[0]).not.toHaveProperty('phone');
    expect(res.body.data[0]).not.toHaveProperty('googleId');
  });

  it('needs at least two characters', async () => {
    const me = await createUser('student');
    expect(await request(app).get('/api/users/search?q=a').set(authHeader(me))).toBeApiError(400);
    expect(await request(app).get('/api/users/search').set(authHeader(me))).toBeApiError(400);
  });

  it('treats the query as text, not as a regular expression', async () => {
    const me = await createUser('student');
    await createUser('student', { name: 'Alice' });
    await createUser('student', { name: 'Bob' });

    const wildcard = await request(app).get('/api/users/search?q=.*').set(authHeader(me));
    expect(wildcard.body.data).toHaveLength(0);

    // an unbalanced pattern used to crash the query
    const broken = await request(app).get('/api/users/search?q=(((').set(authHeader(me));
    expect(broken).toBeApiSuccess();
    expect(broken.body.data).toHaveLength(0);
  });
});

describe('admin user management', () => {
  it('lists users with filters and a bounded page size, for the admin only', async () => {
    const admin = await createAdmin();
    await createUser('student', { name: 'Zed' });
    await createUser('faculty');
    await createUser('student', { isActive: false });

    const all = await request(app).get('/api/users').set(authHeader(admin));
    expect(all.body.pagination.total).toBe(4);
    expect((await request(app).get('/api/users?role=student').set(authHeader(admin))).body.pagination.total).toBe(2);
    expect((await request(app).get('/api/users?active=false').set(authHeader(admin))).body.pagination.total).toBe(1);
    expect((await request(app).get('/api/users?search=zed').set(authHeader(admin))).body.pagination.total).toBe(1);
    expect((await request(app).get('/api/users?limit=100000').set(authHeader(admin))).body.pagination.limit).toBeLessThanOrEqual(100);
    expect((await request(app).get('/api/users?search=(((').set(authHeader(admin)))).toBeApiSuccess();

    const student = await createUser('student');
    expect(await request(app).get('/api/users').set(authHeader(student))).toBeApiError(403);
  });

  it('changes a role, but only to a role the admin may hand out', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');

    const ok = await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(admin)).send({ role: 'faculty' });
    expect(ok.body.data.role).toBe('faculty');

    expect(await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(admin)).send({ role: 'admin' })).toBeApiError(400);
    expect(await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(admin)).send({ role: 'root' })).toBeApiError(400);
    expect(await request(app).patch(`/api/users/${new mongoose.Types.ObjectId()}/role`).set(authHeader(admin)).send({ role: 'student' })).toBeApiError(404);
    expect(await request(app).patch(`/api/users/${student._id}/role`).set(authHeader(student)).send({ role: 'faculty' })).toBeApiError(403);
  });

  it('will not demote the admin account', async () => {
    const admin = await createAdmin();
    const res = await request(app).patch(`/api/users/${admin._id}/role`).set(authHeader(admin)).send({ role: 'student' });
    expect(res).toBeApiError(403);
    expect((await User.findById(admin._id)).role).toBe('admin');
  });

  it('deactivates and reactivates a user, and the user is locked out while deactivated', async () => {
    const admin = await createAdmin();
    const student = await createUser('student');
    const headers = authHeader(student);

    const off = await request(app).patch(`/api/users/${student._id}/toggle-active`).set(authHeader(admin));
    expect(off.body.data.isActive).toBe(false);
    expect(await request(app).get('/api/auth/me').set(headers)).toBeApiError(403);

    const on = await request(app).patch(`/api/users/${student._id}/toggle-active`).set(authHeader(admin));
    expect(on.body.data.isActive).toBe(true);
    expect(await request(app).get('/api/auth/me').set(headers)).toBeApiSuccess();
  });

  it('never deactivates the admin and 404s for unknown users', async () => {
    const admin = await createAdmin();
    expect(await request(app).patch(`/api/users/${admin._id}/toggle-active`).set(authHeader(admin))).toBeApiError(403, /Cannot deactivate admin/);
    expect(await request(app).patch(`/api/users/${new mongoose.Types.ObjectId()}/toggle-active`).set(authHeader(admin))).toBeApiError(404);
  });
});
