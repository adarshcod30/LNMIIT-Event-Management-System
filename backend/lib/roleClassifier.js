// ================================================================
// lib/roleClassifier.js: Email-Based Role Classification
// ================================================================
// Classifies users into roles based on their email pattern.
// This is the SINGLE SOURCE OF TRUTH for role assignment.
// All classification happens server-side: never trust client claims.
//
// Rules:
//   admin@lnmiit.ac.in        → admin (unique, only one)
//   ^\d{2}[a-zA-Z]{3}\d{3}@   → student (e.g., 23ucs509@lnmiit.ac.in)
//   *@lnmiit.ac.in (other)    → faculty (e.g., vikas.bajpai@lnmiit.ac.in)
//   anything else              → outsider
// ================================================================

/**
 * Classify a user's role based on their email address.
 * @param {string} email - The user's email address
 * @returns {'admin' | 'faculty' | 'student' | 'outsider' | 'unrecognised'}
 */
const classifyRole = (email) => {
  if (!email || typeof email !== 'string') {
    return 'unrecognised';
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Exactly one @. "x@evil.com?@lnmiit.ac.in" has a first part that looks like a
  // faculty name and a last part that looks like LNMIIT, and is neither.
  if (normalizedEmail.split('@').length !== 2) {
    return 'unrecognised';
  }

  // Rule 1: Check if it's the admin email
  if (normalizedEmail === 'admin@lnmiit.ac.in') {
    return 'admin';
  }

  // Rule 2: Check if it's an LNMIIT institutional email
  if (normalizedEmail.endsWith('@lnmiit.ac.in')) {
    const localPart = normalizedEmail.split('@')[0];

    // Student pattern: exactly 2 digits + 3 letters + 3 digits
    // Examples: 23ucs509, 22ece101, 21mec045
    const studentPattern = /^\d{2}[a-z]{3}\d{3}$/;

    if (studentPattern.test(localPart)) {
      return 'student';
    }

    // If it's @lnmiit.ac.in but doesn't match student pattern or admin,
    // it's faculty. But we should validate it's a reasonable email format.
    // Faculty examples: vikas.bajpai, vikasbajpai, john
    if (localPart.length > 0 && /^[a-z][a-z0-9._-]*$/.test(localPart)) {
      return 'faculty';
    }

    // If it's @lnmiit.ac.in but matches neither student nor faculty pattern
    return 'unrecognised';
  }

  // Rule 3: Any non-LNMIIT email is an outsider
  return 'outsider';
};

/**
 * Validate that an email is allowed in the system.
 * Blocks unrecognised institutional emails.
 * @param {string} email
 * @returns {{ valid: boolean, role: string, error?: string }}
 */
const validateEmail = (email) => {
  const role = classifyRole(email);

  if (role === 'unrecognised') {
    return {
      valid: false,
      role,
      error: 'Unrecognised institutional email. Please contact the administrator.',
    };
  }

  return { valid: true, role };
};

module.exports = { classifyRole, validateEmail };
