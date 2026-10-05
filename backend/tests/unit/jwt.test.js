const jwt = require('jsonwebtoken');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../../lib/jwt');

const user = { _id: '507f1f77bcf86cd799439011', email: 'a@lnmiit.ac.in', role: 'faculty' };

afterEach(() => {
  jest.useRealTimers();
});

describe('tokens', () => {
  it('an access token carries who the user is and is typed as an access token', () => {
    const payload = verifyToken(generateAccessToken(user), 'access');
    expect(payload).toMatchObject({ userId: user._id, email: user.email, role: user.role, type: 'access' });
  });

  it('a refresh token carries only the user id', () => {
    const payload = verifyToken(generateRefreshToken(user), 'refresh');
    expect(payload).toMatchObject({ userId: user._id, type: 'refresh' });
    expect(payload.email).toBeUndefined();
    expect(payload.role).toBeUndefined();
  });

  it.each([
    ['an access token as a refresh token', generateAccessToken, 'refresh'],
    ['a refresh token as an access token', generateRefreshToken, 'access'],
  ])('refuses %s', (_label, make, asType) => {
    expect(() => verifyToken(make(user), asType)).toThrow(jwt.JsonWebTokenError);
  });

  it('refuses a call that does not say which type it expects', () => {
    expect(() => verifyToken(generateAccessToken(user))).toThrow(TypeError);
  });
});

describe('expiry', () => {
  it('accepts a token until it expires and not a second after (access: 15 minutes in the test config)', () => {
    jest.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') });
    const token = generateAccessToken(user);

    jest.setSystemTime(new Date('2030-01-01T00:14:59Z'));
    expect(() => verifyToken(token, 'access')).not.toThrow();

    jest.setSystemTime(new Date('2030-01-01T00:15:01Z'));
    expect(() => verifyToken(token, 'access')).toThrow(jwt.TokenExpiredError);
  });

  it('keeps a refresh token valid for days, long after the access token is gone', () => {
    jest.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') });
    const access = generateAccessToken(user);
    const refresh = generateRefreshToken(user);

    jest.setSystemTime(new Date('2030-01-06T00:00:00Z'));
    expect(() => verifyToken(access, 'access')).toThrow(jwt.TokenExpiredError);
    expect(() => verifyToken(refresh, 'refresh')).not.toThrow();

    jest.setSystemTime(new Date('2030-01-09T00:00:00Z'));
    expect(() => verifyToken(refresh, 'refresh')).toThrow(jwt.TokenExpiredError);
  });

  it('reads the lifetime from the environment at the moment of signing', () => {
    process.env.JWT_EXPIRE = '1h';
    try {
      const { exp, iat } = jwt.decode(generateAccessToken(user));
      expect(exp - iat).toBe(3600);
    } finally {
      process.env.JWT_EXPIRE = '15m';
    }
  });
});

describe('what a forger might try', () => {
  const payload = { userId: user._id, type: 'access' };

  it('rejects a token signed with another secret', () => {
    expect(() => verifyToken(jwt.sign(payload, 'other-secret'), 'access')).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects the same secret under a different algorithm, which closes algorithm confusion', () => {
    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS512' });
    expect(() => verifyToken(token, 'access')).toThrow(/invalid algorithm/);
  });

  it('rejects an unsigned token', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect(() => verifyToken(`${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`, 'access')).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects a token whose payload was edited after signing', () => {
    const [header, , signature] = generateAccessToken(user).split('.');
    const edited = Buffer.from(JSON.stringify({ ...payload, role: 'admin' })).toString('base64url');
    expect(() => verifyToken(`${header}.${edited}.${signature}`, 'access')).toThrow(/invalid signature/);
  });

  it.each([[''], ['abc'], ['a.b.c']])('rejects the malformed token %j', (token) => {
    expect(() => verifyToken(token, 'access')).toThrow(jwt.JsonWebTokenError);
  });
});
