// ================================================================
// models/Notification.js: Notification Model
// ================================================================
// In-app notifications for all users. Supports various types
// like event approvals, registration confirmations, team invites.
// ================================================================

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'event_approved', 'event_rejected', 'event_cancelled',
        'registration_confirmed', 'registration_cancelled',
        'waitlist_promoted', 'team_invite', 'team_invite_accepted',
        'team_invite_rejected', 'request_submitted', 'request_approved',
        'request_rejected', 'round_result_published', 'new_event_of_interest',
        'event_reminder', 'system_announcement', 'event_updated',
      ],
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    // Deep link to the relevant page
    link: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    // Reference to related entity
    relatedEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

// ---- Indexes ----
// Optimized for "get unread notifications for a user, newest first"
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
