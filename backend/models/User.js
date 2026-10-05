// ================================================================
// models/User.js: User Model
// ================================================================
// Stores all users: admin, faculty, students, and outsiders.
// Role is determined by email pattern (see lib/roleClassifier.js).
// Passwords are only stored for admin (bcrypt hashed, 12 rounds).
// Google OAuth users don't have passwords.
// ================================================================

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      // Only required for admin (local login)
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'faculty', 'student', 'outsider'],
      required: true,
      index: true,
    },
    googleId: {
      type: String,
      sparse: true, // Allows null values while maintaining uniqueness
    },
    avatar: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      enum: ['CSE', 'ECE', 'EE', 'MME', 'Physics', 'Mathematics', 'HSS', 'Other', ''],
      default: '',
    },
    rollNumber: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      maxlength: 500,
      default: '',
    },
    // Clubs/tags the user follows (for notifications)
    followedClubs: [{
      type: String,
      trim: true,
    }],
    // Admin-specific fields
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
    // Track attendance count for waitlist priority
    eventsAttended: {
      type: Number,
      default: 0,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ---- Indexes ----
userSchema.index({ name: 'text', email: 'text' }); // For search

// ---- Instance Methods ----
// Never return password in JSON responses
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
