// ================================================================
// app.js: Express application factory
// ================================================================
// Builds the Express app without touching the network or the
// database, so tests can mount it with Supertest. server.js owns
// everything with side effects: connecting to MongoDB, bootstrapping
// the admin account and listening on a port.
// ================================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const mongoose = require('mongoose');

const { createLimiters } = require('./middleware/rateLimiter');
const { createRequestLogger } = require('./lib/requestLogger');
const { getSecret, isProduction } = require('./lib/config');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const venueRoutes = require('./routes/venueRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const teamRoutes = require('./routes/teamRoutes');
const eventRequestRoutes = require('./routes/eventRequestRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const searchRoutes = require('./routes/searchRoutes');

// Registers the Google strategy when credentials are configured
require('./lib/passport');

/**
 * @param {Object}  [options]
 * @param {Object|null} [options.sessionStore] express-session store. Pass null
 *        for the in-memory store (tests); omit it to use MongoDB.
 * @param {Object}  [options.limits] overrides for the rate limiters,
 *        { generalMax, authMax }.
 * @param {Object}  [options.logger] a pino logger (tests pass one that writes
 *        to memory so they can assert on what was logged).
 */
function createApp(options = {}) {
  const app = express();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // Behind a reverse proxy the client IP is in X-Forwarded-For. Without this
  // every request looks like it comes from the proxy and shares one rate limit.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  }

  // First, so every later log line and error carries the request id
  app.use(createRequestLogger({ logger: options.logger }));

  // ---- Security Middleware ----
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://lh3.googleusercontent.com'],
        connectSrc: ["'self'", clientUrl],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Strips keys starting with $ or containing . from body, query and params,
  // so { "$gt": "" } cannot reach a Mongo query.
  app.use(mongoSanitize());

  app.use(cors({
    origin: clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ---- Sessions (used by the Google OAuth flow) ----
  const store = options.sessionStore === undefined
    ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions', ttl: 24 * 60 * 60 })
    : options.sessionStore || undefined;

  app.use(session({
    secret: getSecret('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // ---- Rate limiting ----
  const { generalLimiter, authLimiter } = createLimiters(options.limits);
  app.use('/api', generalLimiter);
  // Credential endpoints only, and only failed attempts count (see
  // rateLimiter.js). Limiting all of /api/auth would also throttle /auth/me,
  // which the front end calls on every page load.
  app.post(
    ['/api/auth/admin/login', '/api/auth/demo-login', '/api/auth/refresh', '/api/auth/admin/change-password'],
    authLimiter,
  );

  // ---- Routes ----
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/event-requests', eventRequestRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/search', searchRoutes);

  // Liveness: the process is up. Never touches the database, so a database
  // outage does not make the platform restart a healthy process.
  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'LNMIIT Event Hub API is running', timestamp: new Date().toISOString() });
  });

  // Readiness: the process can serve traffic, which needs the database.
  app.get('/api/health/ready', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      success: connected,
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  // ---- 404 then error handling ----
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
      if (req.log) req.log.error({ err }, 'unhandled error');
      else console.error('Unhandled error:', err.stack);
    }
    // 4xx errors from body parsing are safe to describe; 5xx never are in production
    let message = 'Internal server error';
    if (status < 500) message = err.expose ? err.message : 'Bad request';
    else if (!isProduction()) message = err.message;
    res.status(status).json({ success: false, error: message });
  });

  return app;
}

module.exports = { createApp };
