// ================================================================
// lib/audit.js: audit trail for administrative actions
// ================================================================

const AuditLog = require('../models/AuditLog');

/**
 * Record who did what to which record. A failure to write the log is reported
 * but never turns a successful action into an error for the admin.
 */
async function recordAudit(req, { action, targetType, targetId, details = '' }) {
  try {
    await AuditLog.create({
      adminId: req.user._id,
      action,
      targetType,
      targetId,
      details,
      ipAddress: req.ip || '',
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

module.exports = { recordAudit };
