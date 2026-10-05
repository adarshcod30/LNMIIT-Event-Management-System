// ================================================================
// models/AuditLog.js: Admin Action Audit Log
// ================================================================
// Logs every admin action for accountability and audit trails.
// ================================================================

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      // e.g., 'event_approved', 'user_deactivated', 'role_changed'
    },
    targetType: {
      type: String,
      required: true,
      enum: ['event', 'user', 'registration', 'team', 'event_request', 'venue', 'system'],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    details: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ---- Indexes ----
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
