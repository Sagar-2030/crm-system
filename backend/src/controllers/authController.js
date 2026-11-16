const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('../middleware/error');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

exports.login = asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  const identifier = req.body?.identifier ?? req.body?.email;
  if (typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string') {
    throw new ApiError(400, 'A username or email and password are required');
  }

  const normalizedIdentifier = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
  }).select('+password +tokenVersion');
  // Same message for unknown user and wrong password to avoid account enumeration
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid username/email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been disabled');

  res.json({ token: signToken(user), user });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const name = req.body?.name;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new ApiError(400, 'Name is required and must be under 100 characters');
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { name: name.trim() } }, { new: true, runValidators: true });
  res.json({ user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }
  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!(await user.comparePassword(currentPassword || ''))) {
    throw new ApiError(401, 'Current password is incorrect');
  }
  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ message: 'Password updated', token: signToken(user) });
});
