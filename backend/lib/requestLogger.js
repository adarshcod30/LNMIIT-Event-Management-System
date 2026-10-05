// ================================================================
// lib/requestLogger.js: request ids and structured access logs
// ================================================================
// Every request gets an id (or keeps a sane one the caller sent), the id
// goes back in the X-Request-Id header and into every log line, so one
// failing request can be followed across the logs. Credentials are redacted.
// ================================================================

const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const SAFE_ID = /^[\w.-]{1,64}$/;

function defaultLevel() {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  return process.env.NODE_ENV === 'test' ? 'silent' : 'info';
}

function createRequestLogger({ logger } = {}) {
  const base = logger || pino({
    level: defaultLevel(),
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  });

  return pinoHttp({
    logger: base,
    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    // The default response serializer logs every header, which is noise. The
    // status code and timing are what a log reader needs.
    serializers: {
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}

module.exports = { createRequestLogger };
