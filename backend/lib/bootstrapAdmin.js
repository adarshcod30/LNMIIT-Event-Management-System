// ================================================================
// lib/bootstrapAdmin.js: first-run admin account
// ================================================================
// If no admin exists, create admin@lnmiit.ac.in with mustChangePassword set,
// so the first login has to replace the initial password.
//
// The initial password comes from ADMIN_INITIAL_PASSWORD. When it is not set,
// a random one is generated and printed once. There is no default password
// in the source code, because the source is public.
// ================================================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ADMIN_EMAIL = 'admin@lnmiit.ac.in';

/** @returns {Promise<{created: boolean, generatedPassword?: string}>} */
async function bootstrapAdmin() {
  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log(' Admin account already exists');
      return { created: false };
    }

    const configured = process.env.ADMIN_INITIAL_PASSWORD;
    const password = configured || crypto.randomBytes(18).toString('base64url');

    await User.create({
      name: 'System Administrator',
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(password, 12),
      role: 'admin',
      mustChangePassword: true,
      isActive: true,
      profileComplete: true,
    });

    console.log(` Admin account created: ${ADMIN_EMAIL}`);
    if (configured) {
      console.log(' Initial password taken from ADMIN_INITIAL_PASSWORD (must be changed on first login)');
      return { created: true };
    }
    console.log(` Generated initial password (shown once, change it on first login): ${password}`);
    return { created: true, generatedPassword: password };
  } catch (error) {
    console.error(' Failed to bootstrap admin:', error.message);
    return { created: false };
  }
}

module.exports = { bootstrapAdmin, ADMIN_EMAIL };
