/**
 * auth.js - JWT Authentication Middleware
 * 
 * Verifies Bearer tokens to protect API endpoints and authenticate player identity.
 */
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Missing Bearer token.',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'puzzlequest_dev_secret_key_change_in_production_9988';

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { userId, username, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired session token. Please log in again.',
      code: 'TOKEN_EXPIRED_OR_INVALID'
    });
  }
}

// Optional auth: parses token if present, but allows guest access if absent
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'puzzlequest_dev_secret_key_change_in_production_9988';
    try {
      req.user = jwt.verify(token, secret);
    } catch (err) {
      // Ignore token error for optional auth
    }
  }
  next();
}

module.exports = {
  authMiddleware,
  optionalAuth
};
