const { getSecret, isDemoLoginEnabled, assertProductionConfig, isProduction } = require('../../lib/config');

const GOOD_PRODUCTION = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://user:pw@cluster.example.net/db',
  JWT_SECRET: 'f3c1d2e4a5b697887766554433221100ffeeddccbbaa99887766',
  SESSION_SECRET: '0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f506172839',
  CLIENT_URL: 'https://events.example.edu',
};

describe('getSecret', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('returns the configured value', () => {
    process.env.SOME_SECRET = 'configured';
    expect(getSecret('SOME_SECRET')).toBe('configured');
  });

  it('outside production, invents a long random secret and keeps it stable for the process', () => {
    delete process.env.MISSING_SECRET;
    const first = getSecret('MISSING_SECRET');
    expect(first).toMatch(/^[0-9a-f]{96}$/);
    expect(getSecret('MISSING_SECRET')).toBe(first);
  });

  it('gives different names different secrets, and never a value written in the source', () => {
    delete process.env.ONE;
    delete process.env.TWO;
    expect(getSecret('ONE')).not.toBe(getSecret('TWO'));
    expect(getSecret('ONE')).not.toMatch(/fallback|change-me/i);
  });

  it('refuses to start a secret-less production process', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEEDED_IN_PROD;
    expect(() => getSecret('NEEDED_IN_PROD')).toThrow(/NEEDED_IN_PROD must be set in production/);
  });
});

describe('isDemoLoginEnabled', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it.each([
    ['test', undefined, false],
    ['development', undefined, false],
    ['development', 'true', true],
    ['development', 'TRUE', false],
    ['development', '1', false],
    ['production', 'true', false],
  ])('NODE_ENV=%s ENABLE_DEMO_LOGIN=%s gives %s', (env, flag, expected) => {
    process.env.NODE_ENV = env;
    if (flag === undefined) delete process.env.ENABLE_DEMO_LOGIN;
    else process.env.ENABLE_DEMO_LOGIN = flag;
    expect(isDemoLoginEnabled()).toBe(expected);
  });
});

describe('isProduction', () => {
  it('is true only for NODE_ENV=production', () => {
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(isProduction()).toBe(true);
    process.env.NODE_ENV = 'staging';
    expect(isProduction()).toBe(false);
    process.env.NODE_ENV = saved;
  });
});

describe('assertProductionConfig', () => {
  it('does nothing outside production, even with nothing configured', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionConfig({})).not.toThrow();
  });

  it('accepts a complete production configuration', () => {
    expect(() => assertProductionConfig(GOOD_PRODUCTION)).not.toThrow();
  });

  it('lists every missing setting in one error', () => {
    expect.assertions(5);
    try {
      assertProductionConfig({ NODE_ENV: 'production' });
    } catch (error) {
      for (const name of ['MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET', 'CLIENT_URL']) {
        expect(error.message).toContain(`${name} is not set`);
      }
      expect(error.message).toMatch(/^Invalid production configuration/);
    }
  });

  it.each([
    ['too short', 'short'],
    ['the placeholder from .env.example', 'your_jwt_secret_key_change_in_production_def456uvw'],
    ['a copied fallback value', 'fallback-secret-change-me-and-make-it-long-enough'],
  ])('rejects a JWT secret that is %s', (_label, secret) => {
    expect(() => assertProductionConfig({ ...GOOD_PRODUCTION, JWT_SECRET: secret })).toThrow(/JWT_SECRET must be at least 32/);
  });

  it('rejects reusing one secret for both purposes', () => {
    expect(() => assertProductionConfig({ ...GOOD_PRODUCTION, SESSION_SECRET: GOOD_PRODUCTION.JWT_SECRET }))
      .toThrow(/must be different/);
  });

  it('rejects the demo login being switched on', () => {
    expect(() => assertProductionConfig({ ...GOOD_PRODUCTION, ENABLE_DEMO_LOGIN: 'true' })).toThrow(/ENABLE_DEMO_LOGIN/);
  });
});
