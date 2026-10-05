// ================================================================
// lib/db.js: MongoDB Connection
// ================================================================
// Connects to MongoDB Atlas using the URI from environment variables.
// Uses Mongoose for object modeling. Connection is reused across
// the application: we only connect once on server startup.
// ================================================================

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These options ensure stable connections
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(` MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(` MongoDB connection error: ${error.message}`);
    // Don't log the full URI (contains credentials)
    process.exit(1);
  }
};

module.exports = connectDB;
