// One in-memory MongoDB for the whole integration run. Each test file connects
// to its own database on it, so files can run in parallel without sharing data.
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  global.__MONGOD__ = mongod;
  process.env.MONGO_TEST_URI = mongod.getUri();
};
