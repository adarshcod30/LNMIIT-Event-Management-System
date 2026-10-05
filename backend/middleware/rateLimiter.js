// ================================================================
// middleware/rateLimiter.js: Rate Limiting
// ================================================================
// Protects against brute-force attacks and API abuse.
// Different limits for general API vs auth endpoints.
// ================================================================

const rateLimit = require('express-rate-limit');

/**
 * Build a fresh pair of limiters. Each app gets its own counters, which keeps
 * test apps from sharing state and lets tests use tiny limits.
 */
function createLimiters({ generalMax = 100, authMax = 10 } = {}) {
  // General API rate limit: 100 requests per minute per IP
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: generalMax,
    message: {
      success: false,
      error: 'Too many requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Auth rate limit: 10 attempts per 15 minutes per IP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: authMax,
    // Only failed attempts count, so a user who logs in correctly is never
    // locked out, while someone guessing passwords is
    skipSuccessfulRequests: true,
    message: {
      success: false,
      error: 'Too many login attempts. Please try again after 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return { generalLimiter, authLimiter };
}

module.exports = { createLimiters, ...createLimiters() };
