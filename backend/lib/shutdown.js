// ================================================================
// lib/shutdown.js: stop accepting traffic, finish what is running, exit
// ================================================================
// Platforms stop a service with SIGTERM. Dropping connections mid-request
// loses writes, so the server first stops listening, lets in-flight
// requests finish, closes the database, and only force-exits if that
// takes longer than the grace period.
// ================================================================

function createShutdown({ server, closeDatabase, log = console, exit = process.exit, graceMs = 10000 }) {
  let shuttingDown = false;

  return async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received, shutting down`);

    const timer = setTimeout(() => {
      log.error(`Shutdown took longer than ${graceMs}ms, forcing exit`);
      exit(1);
    }, graceMs);
    timer.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await closeDatabase();
      clearTimeout(timer);
      exit(0);
    } catch (error) {
      log.error(`Shutdown failed: ${error.message}`);
      clearTimeout(timer);
      exit(1);
    }
  };
}

module.exports = { createShutdown };
