// ================================================================
// server.js: process entry point
// ================================================================
// Loads configuration, connects to MongoDB, makes sure the admin
// account exists and starts listening. The Express app itself is
// built in app.js so that tests can use it without any of this.
// ================================================================

require('dotenv').config();

const mongoose = require('mongoose');
const { assertProductionConfig } = require('./lib/config');
const connectDB = require('./lib/db');
const { bootstrapAdmin } = require('./lib/bootstrapAdmin');
const { createShutdown } = require('./lib/shutdown');
const { createApp } = require('./app');

// A bad production configuration should stop here, with every problem listed
assertProductionConfig();

const PORT = process.env.PORT || 5001;

connectDB().then(async () => {
  await bootstrapAdmin();

  const server = createApp().listen(PORT, () => {
    console.log(`\n LNMIIT Event Hub API running on http://localhost:${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Frontend URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}\n`);
  });

  const shutdown = createShutdown({
    server,
    closeDatabase: () => mongoose.connection.close(),
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}).catch((err) => {
  console.error(' Failed to start server:', err.message);
  process.exit(1);
});
