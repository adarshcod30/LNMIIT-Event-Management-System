// ================================================================
// models/EventRequest.js: Student Event Request Model
// ================================================================
// Students cannot create events directly. They submit requests
// that go to admin for review. This model stores those requests.
// ================================================================

const mongoose = require('mongoose');

const eventRequestSchema = new mongoose.Schema(
  {
    // Who submitted the request
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Request type
    requestType: {
      type: String,
      enum: ['create', 'edit', 'delete'],
      required: true,
    },
    // If editing/deleting, reference the existing event
    existingEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },
    // Full event details (same structure as Event model)
    eventData: {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      eventType: { type: String, required: true },
      category: { type: String, required: true },
      venue: { type: String, trim: true },
      canonicalVenue: { type: String, trim: true },
      startDateTime: { type: Date, required: true },
      endDateTime: { type: Date, required: true },
      registrationDeadline: Date,
      eligibility: { type: String, default: 'all_lnmiit' },
      maxParticipants: { type: Number, default: 0 },
      isTeamEvent: { type: Boolean, default: false },
      minTeamSize: { type: Number, default: 1 },
      maxTeamSize: { type: Number, default: 1 },
      tags: [String],
      club: String,
      rules: String,
      contactEmail: String,
      contactPhone: String,
    },
    // Conflict warnings (populated by server during submission)
    conflictWarnings: [{
      type: { type: String },
      message: String,
      conflictingEvent: {
        title: String,
        venue: String,
        startDateTime: Date,
        endDateTime: Date,
      },
    }],
    // Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'modified'],
      default: 'pending',
      index: true,
    },
    // Admin review
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    // If approved, reference the created event
    createdEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  },
  {
    timestamps: true,
  }
);

// ---- Indexes ----
eventRequestSchema.index({ submittedBy: 1, status: 1 });

module.exports = mongoose.model('EventRequest', eventRequestSchema);
