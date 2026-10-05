// ================================================================
// lib/config.js: secrets and environment checks
// ================================================================
// Nothing in the codebase may fall back to a secret that is written in
// the source, because the source is public. In production a missing
// secret stops the process; elsewhere a random per-process secret is
// used, which is safe but means tokens do not survive a restart.
// ================================================================

const crypto = require('crypto');

const PLACEHOLDER = /(change[_-]?in[_-]?production|your_|example|fallback)/i;
const devSecrets = new Map();

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Read a secret from the environment.
 * Production: required. Anywhere else: a random value for this process.
 */
function getSecret(name) {
  const value = process.env[name];
  if (value) return value;
  if (isProduction()) {
    throw new Error(`${name} must be set in production`);
  }
  if (!devSecrets.has(name)) {
    devSecrets.set(name, crypto.randomBytes(48).toString('hex'));
  }
  return devSecrets.get(name);
}

/**
 * The demo login signs in as any seeded user without a password, so it has to
 * be an explicit opt-in and can never be on in production.
 */
function isDemoLoginEnabled() {
  return !isProduction() && process.env.ENABLE_DEMO_LOGIN === 'true';
}

/**
 * Called once at start-up. Throws one error listing everything that is wrong,
 * so a bad deployment fails immediately instead of on the first login.
 */
function assertProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;

  const problems = [];
  for (const name of ['MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET', 'CLIENT_URL']) {
    if (!env[name]) problems.push(`${name} is not set`);
  }
  for (const name of ['JWT_SECRET', 'SESSION_SECRET']) {
    const value = env[name];
    if (value && (value.length < 32 || PLACEHOLDER.test(value))) {
      problems.push(`${name} must be at least 32 random characters and not a placeholder`);
    }
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.SESSION_SECRET) {
    problems.push('JWT_SECRET and SESSION_SECRET must be different values');
  }
  if (env.ENABLE_DEMO_LOGIN === 'true') {
    problems.push('ENABLE_DEMO_LOGIN must not be set in production');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid production configuration:\n  - ${problems.join('\n  - ')}`);
  }
}

module.exports = { getSecret, isDemoLoginEnabled, assertProductionConfig, isProduction };
