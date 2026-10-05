// Runs before every test file. Tests never read backend/.env: every value the
// app needs is set here, so a developer's real secrets cannot leak into a test
// and a missing .env cannot break one.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-for-hs256-signing';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
delete process.env.ENABLE_DEMO_LOGIN;
delete process.env.ADMIN_INITIAL_PASSWORD;
delete process.env.TRUST_PROXY;

// The app logs startup chatter through console.log; keep test output readable.
// Set TEST_VERBOSE=1 to see it.
if (!process.env.TEST_VERBOSE) {
  console.log = () => {};
  console.info = () => {};
}
