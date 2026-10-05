// ================================================================
// models/Registration.js: Registration Model
// ================================================================
// Tracks event registrations. Enforces:
//   - No duplicate registrations (compound unique index)
//   - Waitlist management (auto-promotion on cancellation)
//   - QR code check-in (unique UUID per registration)
//   - Eligibility enforcement (server-side)
// ================================================================

const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    status: {
      type: String,
      enum: ['registered', 'waitlisted', 'cancelled', 'attended', 'disqualified'],
      default: 'registered',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['not_required', 'pending', 'paid', 'refunded'],
      default: 'not_required',
    },
    // Unique QR code for check-in
    checkInCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    // For multi-round tracking
    currentRound: {
      type: String,
      default: '',
    },
    // Waitlist priority (based on eventsAttended count)
    waitlistPriority: {
      type: Number,
      default: 0,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ---- Indexes ----
// Prevents duplicate registration: same user + same event
registrationSchema.index({ event: 1, user: 1 }, { unique: true });
registrationSchema.index({ event: 1, status: 1 });
registrationSchema.index({ user: 1 });

module.exports = mongoose.model('Registration', registrationSchema);
