const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { bootstrapAdmin } = require('../../lib/bootstrapAdmin');
const { buildApp } = require('../helpers/app');

afterEach(() => {
  delete process.env.ADMIN_INITIAL_PASSWORD;
});

describe('bootstrapAdmin', () => {
  it('creates the admin with the password from ADMIN_INITIAL_PASSWORD and forces a change', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'operator-chosen-password';

    const result = await bootstrapAdmin();

    expect(result.created).toBe(true);
    expect(result.generatedPassword).toBeUndefined();
    const admin = await User.findOne({ email: 'admin@lnmiit.ac.in' }).select('+password');
    expect(admin.role).toBe('admin');
    expect(admin.mustChangePassword).toBe(true);
    expect(await bcrypt.compare('operator-chosen-password', admin.password)).toBe(true);
  });

  it('never falls back to a password that is written in the source code', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'operator-chosen-password';
    await bootstrapAdmin();

    const res = await request(buildApp())
      .post('/api/auth/admin/login')
      .send({ email: 'admin@lnmiit.ac.in', password: 'adminlnmiit' });
    expect(res.status).toBe(401);
  });

  it('generates a strong random password when none is configured and returns it once', async () => {
    const first = await bootstrapAdmin();
    expect(first.created).toBe(true);
    expect(first.generatedPassword).toMatch(/^.{16,}$/);

    const admin = await User.findOne({ email: 'admin@lnmiit.ac.in' }).select('+password');
    expect(await bcrypt.compare(first.generatedPassword, admin.password)).toBe(true);
    expect(await bcrypt.compare('adminlnmiit', admin.password)).toBe(false);

    await User.deleteMany({});
    const second = await bootstrapAdmin();
    expect(second.generatedPassword).not.toBe(first.generatedPassword);
  });

  it('leaves an existing admin untouched', async () => {
    process.env.ADMIN_INITIAL_PASSWORD = 'operator-chosen-password';
    await bootstrapAdmin();
    const before = await User.findOne({ email: 'admin@lnmiit.ac.in' }).select('+password');

    process.env.ADMIN_INITIAL_PASSWORD = 'something-else-entirely';
    const again = await bootstrapAdmin();

    expect(again.created).toBe(false);
    const after = await User.findOne({ email: 'admin@lnmiit.ac.in' }).select('+password');
    expect(after.password).toBe(before.password);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });
});
