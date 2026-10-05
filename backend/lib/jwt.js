// ================================================================
// lib/jwt.js: JWT utilities
// ================================================================
// Access tokens last minutes to hours and authorise API calls. Refresh
// tokens last days and can only be exchanged for a new pair. Each token
// carries a type, and verification insists on the type it expects, so a
// stolen refresh token cannot be used as a bearer token and vice versa.
// ================================================================

const jwt = require('jsonwebtoken');
const { getSecret } = require('./config');

const ALGORITHM = 'HS256';

const accessExpiry = () => process.env.JWT_EXPIRE || '24h';
const refreshExpiry = () => process.env.JWT_REFRESH_EXPIRE || '7d';

function generateAccessToken(user) {
  return jwt.sign(
    { userId: String(user._id), email: user.email, role: user.role, type: 'access' },
    getSecret('JWT_SECRET'),
    { algorithm: ALGORITHM, expiresIn: accessExpiry() },
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: String(user._id), type: 'refresh' },
    getSecret('JWT_SECRET'),
    { algorithm: ALGORITHM, expiresIn: refreshExpiry() },
  );
}

/**
 * Verify a token and return its payload.
 * Throws JsonWebTokenError / TokenExpiredError if the signature, algorithm,
 * expiry or token type is wrong.
 *
 * @param {string} token
 * @param {'access' | 'refresh'} expectedType
 */
function verifyToken(token, expectedType) {
  if (expectedType !== 'access' && expectedType !== 'refresh') {
    throw new TypeError('verifyToken needs an expected token type');
  }
  const payload = jwt.verify(token, getSecret('JWT_SECRET'), { algorithms: [ALGORITHM] });
  if (payload.type !== expectedType) {
    throw new jwt.JsonWebTokenError('wrong token type');
  }
  return payload;
}

module.exports = { generateAccessToken, generateRefreshToken, verifyToken };
