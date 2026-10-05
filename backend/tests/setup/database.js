// Per-file database lifecycle for integration tests: connect once, empty every
// collection between tests so no test depends on another, disconnect at the end.
const mongoose = require('mongoose');
const crypto = require('crypto');

// In-memory MongoDB is fast, but the first test in a file pays for connecting
jest.setTimeout(30000);

beforeAll(async () => {
  const dbName = `eventhub_${crypto.randomBytes(6).toString('hex')}`;
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
  // Unique and text indexes must exist before tests rely on them
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
