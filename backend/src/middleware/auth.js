const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('./error');

// Verifies the JWT and attaches the current user to req.user
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findById(payload.id).select('+tokenVersion');
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled');
  if (payload.tokenVersion !== (user.tokenVersion || 0)) throw new ApiError(401, 'Session has expired. Sign in again.');

  req.user = user;
  next();
});

// Role-based gate: authorize('superadmin', 'manager')
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    next();
  };

const isManagerOrAbove = (user) => user.role === 'superadmin' || user.role === 'manager';

module.exports = { protect, authorize, isManagerOrAbove };
