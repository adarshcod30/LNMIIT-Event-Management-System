const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { buildApp } = require('../helpers/app');
const { createUser, createAdmin, authHeader, refreshTokenFor } = require('../helpers/factories');

const app = buildApp();
const ADMIN_PASSWORD = 'S3cure-admin-pass';

describe('POST /api/auth/admin/login', () => {
  it('returns tokens and the user for correct credentials', async () => {
    await createAdmin(ADMIN_PASSWORD);

    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@lnmiit.ac.in', password: ADMIN_PASSWORD });

    expect(res).toBeApiSuccess();
    expect(res.body.data.user.email).toBe('admin@lnmiit.ac.in');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('accepts the email in any letter case', async () => {
    await createAdmin(ADMIN_PASSWORD);
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'Admin@LNMIIT.ac.in', password: ADMIN_PASSWORD });
    expect(res).toBeApiSuccess();
  });

  it('rejects a wrong password with 401', async () => {
    await createAdmin(ADMIN_PASSWORD);
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@lnmiit.ac.in', password: 'nope' });
    expect(res).toBeApiError(401, /Invalid credentials/);
  });

  it('answers a missing admin account exactly like a wrong password', async () => {
    // A different status or message would tell an attacker whether the admin exists
    const missing = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@lnmiit.ac.in', password: 'whatever' });
    await createAdmin(ADMIN_PASSWORD);
    const wrong = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@lnmiit.ac.in', password: 'whatever' });

    expect(missing.status).toBe(401);
    expect(missing.body).toEqual(wrong.body);
  });

  it('refuses any other email on the admin route', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: '23ucs509@lnmiit.ac.in', password: 'x' });
    expect(res).toBeApiError(403, /admin only/);
  });

  it.each([
    ['no body', {}],
    ['no password', { email: 'admin@lnmiit.ac.in' }],
    ['no email', { password: 'x' }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await request(app).post('/api/auth/admin/login').send(body);
    expect(res).toBeApiError(400);
  });

  it.each([
    ['a number', 5],
    ['an array', ['admin@lnmiit.ac.in']],
    ['an object', { $gt: '' }],
  ])('returns 400, not a crash, when the email is %s', async (_label, email) => {
    const res = await request(app).post('/api/auth/admin/login').send({ email, password: 'x' });
    expect(res).toBeApiError(400);
  });
});

describe('POST /api/auth/demo-login', () => {
  const original = { flag: process.env.ENABLE_DEMO_LOGIN, env: process.env.NODE_ENV };

  afterEach(() => {
    if (original.flag === undefined) delete process.env.ENABLE_DEMO_LOGIN;
    else process.env.ENABLE_DEMO_LOGIN = original.flag;
    process.env.NODE_ENV = original.env;
  });

  it('does not exist unless it is explicitly switched on', async () => {
    const student = await createUser('student');
    const res = await request(app).post('/api/auth/demo-login').send({ email: student.email });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeUndefined();
  });

  it('logs a seeded user in when ENABLE_DEMO_LOGIN=true outside production', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';
    const student = await createUser('student');
    const res = await request(app).post('/api/auth/demo-login').send({ email: student.email });
    expect(res).toBeApiSuccess();
    expect(res.body.data.user.role).toBe('student');
  });

  it('is still off in production even when the flag is set', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';
    process.env.NODE_ENV = 'production';
    const student = await createUser('student');
    const res = await request(app).post('/api/auth/demo-login').send({ email: student.email });
    expect(res.status).toBe(404);
  });

  it('can never be used to become the admin, flag or not', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';
    await createAdmin(ADMIN_PASSWORD);
    const res = await request(app).post('/api/auth/demo-login').send({ email: 'admin@lnmiit.ac.in' });
    expect(res).toBeApiError(403, /admin/i);
    expect(res.body.data).toBeUndefined();
  });

  it('refuses deactivated users and unknown emails', async () => {
    process.env.ENABLE_DEMO_LOGIN = 'true';
    const gone = await createUser('student', { isActive: false });
    expect(await request(app).post('/api/auth/demo-login').send({ email: gone.email })).toBeApiError(403);
    expect(await request(app).post('/api/auth/demo-login').send({ email: 'nobody@lnmiit.ac.in' })).toBeApiError(404);
    expect(await request(app).post('/api/auth/demo-login').send({})).toBeApiError(400);
  });
});

describe('token handling', () => {
  it('lets a valid access token read /api/auth/me and never exposes the password hash', async () => {
    const admin = await createAdmin(ADMIN_PASSWORD);
    const res = await request(app).get('/api/auth/me').set(authHeader(admin));
    expect(res).toBeApiSuccess();
    expect(res.body.data.user.email).toBe(admin.email);
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('rejects a request with no token', async () => {
    expect(await request(app).get('/api/auth/me')).toBeApiError(401, /Authentication required/);
  });

  it('rejects a refresh token presented as an access token', async () => {
    const student = await createUser('student');
    const res = await request(app)
      .get('/api/auth/me')
      .set({ Authorization: `Bearer ${refreshTokenFor(student)}` });
    expect(res).toBeApiError(401, /Invalid token/);
  });

  it('rejects an access token presented as a refresh token', async () => {
    const student = await createUser('student');
    const accessToken = authHeader(student).Authorization.split(' ')[1];
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: accessToken });
    expect(res).toBeApiError(401);
  });

  it('rejects an expired token with a clear message', async () => {
    const student = await createUser('student');
    const expired = jwt.sign({ userId: String(student._id), type: 'access' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${expired}` });
    expect(res).toBeApiError(401, /expired/i);
  });

  it('rejects a token signed with a different secret', async () => {
    const student = await createUser('student');
    const forged = jwt.sign({ userId: String(student._id), type: 'access' }, 'attacker-secret');
    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${forged}` });
    expect(res).toBeApiError(401, /Invalid token/);
  });

  it('rejects an unsigned (alg none) token', async () => {
    const student = await createUser('student');
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ userId: String(student._id), type: 'access' })).toString('base64url');
    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${header}.${body}.` });
    expect(res).toBeApiError(401);
  });

  it('rejects a valid token whose user has been deleted', async () => {
    const student = await createUser('student');
    const headers = authHeader(student);
    await User.deleteOne({ _id: student._id });
    expect(await request(app).get('/api/auth/me').set(headers)).toBeApiError(401);
  });

  it('turns away a deactivated user with 403 even though the token is valid', async () => {
    const student = await createUser('student');
    const headers = authHeader(student);
    await User.updateOne({ _id: student._id }, { isActive: false });
    expect(await request(app).get('/api/auth/me').set(headers)).toBeApiError(403, /deactivated/);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a working new pair for a valid refresh token', async () => {
    const student = await createUser('student');
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: refreshTokenFor(student) });
    expect(res).toBeApiSuccess();

    const me = await request(app)
      .get('/api/auth/me')
      .set({ Authorization: `Bearer ${res.body.data.accessToken}` });
    expect(me).toBeApiSuccess();
  });

  it('requires a token, rejects garbage, and refuses deactivated users', async () => {
    expect(await request(app).post('/api/auth/refresh').send({})).toBeApiError(400);
    expect(await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage' })).toBeApiError(401);

    const student = await createUser('student');
    const token = refreshTokenFor(student);
    await User.updateOne({ _id: student._id }, { isActive: false });
    expect(await request(app).post('/api/auth/refresh').send({ refreshToken: token })).toBeApiError(401);
  });
});

describe('POST /api/auth/admin/change-password', () => {
  it('changes the password, clears mustChangePassword and invalidates the old password', async () => {
    const admin = await createAdmin(ADMIN_PASSWORD, { mustChangePassword: true });

    const res = await request(app)
      .post('/api/auth/admin/change-password')
      .set(authHeader(admin))
      .send({ currentPassword: ADMIN_PASSWORD, newPassword: 'a-brand-new-password' });
    expect(res).toBeApiSuccess();

    const reloaded = await User.findById(admin._id);
    expect(reloaded.mustChangePassword).toBe(false);

    const oldLogin = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: admin.email, password: ADMIN_PASSWORD });
    const newLogin = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: admin.email, password: 'a-brand-new-password' });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it.each([
    ['the current password is wrong', { currentPassword: 'wrong', newPassword: 'a-brand-new-password' }, 401],
    ['the new password is shorter than 8 characters', { currentPassword: ADMIN_PASSWORD, newPassword: 'short' }, 400],
    ['a field is missing', { newPassword: 'a-brand-new-password' }, 400],
  ])('fails when %s', async (_label, body, status) => {
    const admin = await createAdmin(ADMIN_PASSWORD);
    const res = await request(app).post('/api/auth/admin/change-password').set(authHeader(admin)).send(body);
    expect(res).toBeApiError(status);
  });

  it('is closed to everyone who is not the admin', async () => {
    const faculty = await createUser('faculty');
    const res = await request(app)
      .post('/api/auth/admin/change-password')
      .set(authHeader(faculty))
      .send({ currentPassword: 'x', newPassword: 'a-brand-new-password' });
    expect(res).toBeApiError(403);
  });
});

describe('forced password change', () => {
  it('blocks an admin who has not changed the initial password from everything else', async () => {
    const admin = await createAdmin(ADMIN_PASSWORD, { mustChangePassword: true });
    const res = await request(app).get('/api/admin/dashboard').set(authHeader(admin));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('still lets that admin see who they are and change the password', async () => {
    const admin = await createAdmin(ADMIN_PASSWORD, { mustChangePassword: true });
    expect(await request(app).get('/api/auth/me').set(authHeader(admin))).toBeApiSuccess();
  });
});

describe('auth rate limiting', () => {
  it('locks out after repeated failed logins', async () => {
    const limited = buildApp({ limits: { generalMax: 1000, authMax: 3 } });
    await createAdmin(ADMIN_PASSWORD);
    const attempt = () =>
      request(limited).post('/api/auth/admin/login').send({ email: 'admin@lnmiit.ac.in', password: 'wrong' });

    const statuses = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  it('does not count successful logins against the limit', async () => {
    const limited = buildApp({ limits: { generalMax: 1000, authMax: 2 } });
    await createAdmin(ADMIN_PASSWORD);
    const login = () =>
      request(limited).post('/api/auth/admin/login').send({ email: 'admin@lnmiit.ac.in', password: ADMIN_PASSWORD });

    const statuses = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await login()).status);
    expect(statuses).toEqual([200, 200, 200, 200]);
  });

  it('does not throttle /api/auth/me, which the front end calls on every page load', async () => {
    const limited = buildApp({ limits: { generalMax: 1000, authMax: 2 } });
    const student = await createUser('student');
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await request(limited).get('/api/auth/me').set(authHeader(student))).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
  });
});

describe('POST /api/auth/logout', () => {
  it('succeeds without a session', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res).toBeApiSuccess();
  });
});
