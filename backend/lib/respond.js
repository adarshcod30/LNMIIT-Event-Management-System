// ================================================================
// lib/respond.js: one place that turns a thrown error into a response
// ================================================================

const { isProduction } = require('./config');

/**
 * Validation and cast errors are the caller's mistake (400). Everything else
 * is ours (500), logged in full but described generically in production so
 * connection strings and stack details never reach a client.
 */
function sendError(res, error) {
  if (error && error.name === 'ValidationError') {
    const message = Object.values(error.errors || {}).map((e) => e.message).join('; ') || error.message;
    return res.status(400).json({ success: false, error: message });
  }
  if (error && error.name === 'CastError') {
    return res.status(400).json({ success: false, error: `Invalid value for ${error.path}` });
  }

  const log = res.req && res.req.log;
  if (log) log.error({ err: error }, 'request failed');
  else console.error('Request failed:', error && error.stack);

  return res.status(500).json({
    success: false,
    error: isProduction() ? 'Internal server error' : (error && error.message) || 'Internal server error',
  });
}

module.exports = { sendError };
