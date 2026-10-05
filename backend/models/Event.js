// ================================================================
// models/Event.js: Event Model
// ================================================================
// The core entity of the system. Events can be created by admin
// or faculty (auto-approved), or requested by students (needs
// admin approval). Includes conflict detection via compound indexes.
// ================================================================

const mongoose = require('mongoose');

// Sub-schema for event rounds (prelims, mains, finals, etc.)
const roundSchema = new mongoose.Schema({
  roundName: { type: String, required: true, trim: true },
  roundVenue: { type: String, trim: true }, // Raw input
  canonicalVenue: { type: String, trim: true }, // Resolved venue
  roundStartDateTime: { type: Date, required: true },
  roundEndDateTime: { type: Date, required: true },
  maxAdvancing: { type: Number, default: 0 }, // How many advance to next round
  resultStatus: {
    type: String,
    enum: ['pending', 'published'],
    default: 'pending',
  },
  results: [{
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    score: Number,
    rank: Number,
    advanced: { type: Boolean, default: false },
  }],
}, { _id: true });

// Sub-schema for FAQs
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
}, { _id: true });

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      maxlength: 5000,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'coding_contest', 'hackathon', 'workshop', 'seminar', 'talk',
        'sports', 'cultural', 'fest', 'club_activity', 'general', 'other',
      ],
    },
    category: {
      type: String,
      required: true,
      enum: ['technical', 'cultural', 'sports', 'academic', 'administrative', 'other'],
    },
    // Who created this event
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coOrganizers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    // Venue information
    venue: { type: String, trim: true }, // Raw user input
    rawVenueInput: { type: String, trim: true }, // Preserved for audit
    canonicalVenue: {
      type: String,
      trim: true,
      index: true,
    },
    // Date/time
    startDateTime: {
      type: Date,
      required: [true, 'Start date/time is required'],
      index: true,
    },
    endDateTime: {
      type: Date,
      required: [true, 'End date/time is required'],
    },
    registrationDeadline: {
      type: Date,
    },
    // Eligibility
    eligibility: {
      type: String,
      required: true,
      enum: ['students_only', 'faculty_only', 'all_lnmiit', 'open_to_all'],
      default: 'all_lnmiit',
    },
    // Participation details
    maxParticipants: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    minTeamSize: { type: Number, default: 1 },
    maxTeamSize: { type: Number, default: 1 },
    isTeamEvent: { type: Boolean, default: false },
    // Multi-round support
    rounds: [roundSchema],
    // Tags and categorization
    tags: [{ type: String, trim: true }],
    club: {
      type: String,
      trim: true,
      default: '',
    },
    // Media
    banner: { type: String, default: '' }, // Image URL
    attachments: [{ type: String }], // File URLs
    // Status workflow
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'ongoing', 'completed', 'cancelled', 'rejected'],
      default: 'draft',
      index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String, default: '' },
    conflictOverrideReason: { type: String, default: '' },
    // Visibility
    isPublic: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: false }, // For registration
    // Counts (denormalized for performance)
    registeredCount: { type: Number, default: 0 },
    // Event details
    prizes: [{
      position: String,
      prize: String,
      amount: Number,
    }],
    sponsors: [{
      name: String,
      logo: String,
      website: String,
    }],
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    rules: { type: String, default: '' }, // Markdown string
    faqs: [faqSchema],
    // Department (for lab/lecture hall events)
    department: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// ---- Indexes for Conflict Detection ----
// Compound index enables fast conflict queries: same venue + overlapping time
eventSchema.index({ canonicalVenue: 1, startDateTime: 1, endDateTime: 1 });
eventSchema.index({ status: 1, startDateTime: 1 });
eventSchema.index({ organizer: 1, status: 1 });
eventSchema.index({ title: 'text', description: 'text', tags: 'text' }); // Full-text search
eventSchema.index({ category: 1 });
eventSchema.index({ eligibility: 1 });

module.exports = mongoose.model('Event', eventSchema);
