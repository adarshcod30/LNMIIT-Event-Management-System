const { createApp } = require('../../app');

// A fresh app per call, with an in-memory session store and limits high enough
// that ordinary tests never trip them. Rate limit tests pass their own limits.
function buildApp(options = {}) {
  return createApp({
    sessionStore: null,
    limits: { generalMax: 100000, authMax: 100000 },
    ...options,
  });
}

module.exports = { buildApp };
