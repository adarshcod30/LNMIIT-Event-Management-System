jest.mock('../../models/User');

const User = require('../../models/User');
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth');
const { generateAccessToken, generateRefreshToken } = require('../../lib/jwt');

const user = { _id: '507f1f77bcf86cd799439011', email: 'a@lnmiit.ac.in', role: 'student', isActive: true };

const mockRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};
const withUser = (found) => User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(found) });
const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });

describe('authenticate', () => {
  it('attaches the user and continues for a valid access token', async () => {
    withUser({ ...user });
    const req = bearer(generateAccessToken(user));
    const next = jest.fn();

    await authenticate(req, mockRes(), next);

    expect(User.findById).toHaveBeenCalledWith(user._id);
    expect(req.user).toMatchObject({ email: user.email });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to a Passport session user when there is no token', async () => {
    const req = { headers: {}, user: { ...user } };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('falls back to the user id stored in the session', async () => {
    withUser({ ...user });
    const req = { headers: {}, session: { userId: user._id } };
    const next = jest.fn();
    await authenticate(req, mockRes(), next);
    expect(User.findById).toHaveBeenCalledWith(user._id);
    expect(next).toHaveBeenCalled();
  });

  it('answers 401 when nobody is logged in', async () => {
    const res = mockRes();
    const next = jest.fn();
    await authenticate({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 401 when the token is valid but the user no longer exists', async () => {
    withUser(null);
    const res = mockRes();
    await authenticate(bearer(generateAccessToken(user)), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('answers 403 for a deactivated account', async () => {
    withUser({ ...user, isActive: false });
    const res = mockRes();
    const next = jest.fn();
    await authenticate(bearer(generateAccessToken(user)), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('turns a refresh token away', async () => {
    const res = mockRes();
    await authenticate(bearer(generateRefreshToken(user)), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid token.' });
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('answers 500 rather than throwing when the database fails', async () => {
    User.findById.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();
    await authenticate(bearer(generateAccessToken(user)), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('holds back an admin on the initial password, except where allowPasswordChange is used', async () => {
    withUser({ ...user, role: 'admin', mustChangePassword: true });
    const blocked = mockRes();
    const next = jest.fn();
    await authenticate(bearer(generateAccessToken(user)), blocked, next);
    expect(blocked.status).toHaveBeenCalledWith(403);
    expect(blocked.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();

    withUser({ ...user, role: 'admin', mustChangePassword: true });
    await authenticate.allowPasswordChange(bearer(generateAccessToken(user)), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('authorize', () => {
  it('lets a listed role through', () => {
    const next = jest.fn();
    authorize('admin', 'faculty')({ user: { role: 'faculty' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('answers 403 and names the roles when the role is not listed', () => {
    const res = mockRes();
    const next = jest.fn();
    authorize('admin', 'faculty')({ user: { role: 'student' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe('Access denied. Required role(s): admin, faculty. Your role: student');
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 401 when authenticate has not run', () => {
    const res = mockRes();
    authorize('admin')({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('optionalAuth', () => {
  it('attaches the user when the token is good', async () => {
    withUser({ ...user });
    const req = bearer(generateAccessToken(user));
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    expect(req.user).toMatchObject({ email: user.email });
    expect(next).toHaveBeenCalled();
  });

  it.each([
    ['a refresh token', () => bearer(generateRefreshToken(user))],
    ['garbage', () => bearer('garbage')],
    ['no credentials', () => ({ headers: {} })],
  ])('continues anonymously for %s', async (_label, makeReq) => {
    const req = makeReq();
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('treats a deactivated account as anonymous', async () => {
    withUser({ ...user, isActive: false });
    const req = bearer(generateAccessToken(user));
    await optionalAuth(req, mockRes(), jest.fn());
    expect(req.user).toBeNull();
  });

  it('uses a Passport session user or a stored session id when there is no token', async () => {
    const viaPassport = { headers: {}, user: { ...user } };
    await optionalAuth(viaPassport, mockRes(), jest.fn());
    expect(viaPassport.user).toMatchObject({ email: user.email });

    withUser({ ...user });
    const viaSession = { headers: {}, session: { userId: user._id } };
    await optionalAuth(viaSession, mockRes(), jest.fn());
    expect(viaSession.user).toMatchObject({ email: user.email });
  });
});
