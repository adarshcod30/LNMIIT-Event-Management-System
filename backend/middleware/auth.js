// ================================================================
// middleware/auth.js: authentication and authorization
// ================================================================
// Verifies JWT access tokens (or the Passport session) and enforces
// role-based access. Every protected route must use these.
// ================================================================

const { verifyToken } = require('../lib/jwt');
const User = require('../models/User');

/**
 * Build an authenticate middleware.
 * allowPasswordChange: let an admin who still has the initial password through,
 * which only the change-password and "who am I" routes should do.
 */
function buildAuthenticate({ allowPasswordChange = false } = {}) {
  return async (req, res, next) => {
    try {
      let user = null;

      // Method 1: JWT access token in the Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const decoded = verifyToken(authHeader.split(' ')[1], 'access');
        user = await User.findById(decoded.userId).select('-password');
      }

      // Method 2: Passport session (from Google OAuth)
      if (!user && req.user) {
        user = req.user;
      }

      // Method 3: session id stored directly
      if (!user && req.session && req.session.userId) {
        user = await User.findById(req.session.userId).select('-password');
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Please log in.',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Your account has been deactivated. Contact admin.',
        });
      }

      // An account still on its initial password may do nothing but change it
      if (user.mustChangePassword && !allowPasswordChange) {
        return res.status(403).json({
          success: false,
          code: 'PASSWORD_CHANGE_REQUIRED',
          error: 'You must change your password before using the system.',
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token expired. Please log in again.' });
      }
      if (error.name === 'JsonWebTokenError' || error.name === 'CastError') {
        return res.status(401).json({ success: false, error: 'Invalid token.' });
      }
      return res.status(500).json({ success: false, error: 'Authentication error.' });
    }
  };
}

const authenticate = buildAuthenticate();
authenticate.allowPasswordChange = buildAuthenticate({ allowPasswordChange: true });

/**
 * Restrict access to specific roles. Usage: authorize('admin', 'faculty').
 * Must come after authenticate.
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
    });
  }
  return next();
};

/**
 * Attach the user when a valid token is present, but never block the request.
 * For public routes that show more to logged-in users.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.split(' ')[1], 'access');
      user = await User.findById(decoded.userId).select('-password');
    } else if (req.user) {
      user = req.user;
    } else if (req.session && req.session.userId) {
      user = await User.findById(req.session.userId).select('-password');
    }
    // A deactivated account is treated as logged out
    req.user = user && user.isActive ? user : null;
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
