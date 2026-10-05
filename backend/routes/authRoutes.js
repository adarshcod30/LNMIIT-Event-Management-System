// ================================================================
// routes/authRoutes.js: authentication routes
// ================================================================
// Google OAuth login, admin local login, token refresh, logout and the
// current user. The demo login exists for local development only.
// ================================================================

const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../lib/jwt');
const { validateEmail } = require('../lib/roleClassifier');
const { isDemoLoginEnabled } = require('../lib/config');
const { authenticate } = require('../middleware/auth');
const { sendError } = require('../lib/respond');

const ADMIN_EMAIL = 'admin@lnmiit.ac.in';
// Compared against when the admin account does not exist, so a missing account
// and a wrong password take the same time and give the same answer
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

// ---- Google OAuth ----

// GET /api/auth/google: start the Google OAuth flow
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// GET /api/auth/google/callback: Google redirects back here
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      req.session.userId = user._id;

      const redirectUrl = new URL(`${process.env.CLIENT_URL}/auth/callback`);
      redirectUrl.searchParams.set('token', accessToken);
      redirectUrl.searchParams.set('refreshToken', refreshToken);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=server_error`);
    }
  });

// ---- Admin local login ----
// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Email and password must be text.' });
    }

    // Only admin@lnmiit.ac.in can use this route
    if (email.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        error: 'This login route is for admin only. Please use Google OAuth.',
      });
    }

    const admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    const isMatch = await bcrypt.compare(password, (admin && admin.password) || DUMMY_HASH);
    if (!admin || !isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, error: 'Your account has been deactivated. Contact admin.' });
    }

    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    admin.lastLogin = new Date();
    await admin.save();

    req.session.userId = admin._id;

    return res.json({
      success: true,
      data: {
        user: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          mustChangePassword: admin.mustChangePassword,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---- Admin change password ----
// POST /api/auth/admin/change-password
router.post('/admin/change-password', authenticate.allowPasswordChange, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admin can change admin password.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      return res.status(400).json({ success: false, error: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
    }

    const admin = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    admin.password = await bcrypt.hash(newPassword, 12);
    admin.mustChangePassword = false;
    await admin.save();

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---- Demo login (local development only) ----
// POST /api/auth/demo-login signs in as a seeded user with no password.
// It does not exist unless ENABLE_DEMO_LOGIN=true outside production, and it
// can never sign in as the admin.
router.post('/demo-login', async (req, res) => {
  if (!isDemoLoginEnabled()) {
    return res.status(404).json({ success: false, error: 'Route not found' });
  }

  try {
    const { email } = req.body;
    if (!isNonEmptyString(email)) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found. Run the seed script first.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, error: 'The admin account must sign in with its password.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account is deactivated.' });
    }

    const { valid, error } = validateEmail(user.email);
    if (!valid) {
      return res.status(403).json({ success: false, error });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.lastLogin = new Date();
    await user.save();

    req.session.userId = user._id;

    return res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          department: user.department,
          mustChangePassword: user.mustChangePassword || false,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---- Token refresh ----
// POST /api/auth/refresh: trade a refresh token for a new pair
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token required.' });
  }

  try {
    const decoded = verifyToken(refreshToken, 'refresh');
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token.' });
    }

    return res.json({
      success: true,
      data: { accessToken: generateAccessToken(user), refreshToken: generateRefreshToken(user) },
    });
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired refresh token.' });
  }
});

// ---- Current user ----
// GET /api/auth/me
router.get('/me', authenticate.allowPasswordChange, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// ---- Logout ----
// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const finish = () => res.json({ success: true, message: 'Logged out successfully.' });
  if (!req.session) return finish();
  return req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    finish();
  });
});

module.exports = router;
