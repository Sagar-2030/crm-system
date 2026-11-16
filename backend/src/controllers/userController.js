const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { ApiError, asyncHandler } = require('../middleware/error');
const { assertObjectId, isValidEmail, pick } = require('../utils/helpers');
const { escapeRegex } = require('../utils/helpers');

// Managers may only manage agents; super admins may manage everyone.
const canManageRole = (actor, role) => actor.role === 'superadmin' || role === 'agent';

// Lightweight list used by assignment dropdowns (managers and super admins)
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role && ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (req.query.active === 'true') filter.isActive = true;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { department: rx }, { jobTitle: rx }];
  }
  // Managers do not see super admin accounts
  if (req.user.role === 'manager') filter.role = { $in: ['manager', 'agent'] };
  const users = await User.find(filter).sort({ name: 1 });
  res.json({ users });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'agent', department, jobTitle, monthlySalesTarget } = req.body || {};
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required');
  if (!isValidEmail(email)) throw new ApiError(400, 'Invalid email address');
  if (typeof password !== 'string' || password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
  if (!ROLES.includes(role)) throw new ApiError(400, 'Invalid role');
  if (!canManageRole(req.user, role)) throw new ApiError(403, 'You can only create Salesman/Agent accounts');

  if (monthlySalesTarget !== undefined && (!Number.isFinite(Number(monthlySalesTarget)) || Number(monthlySalesTarget) < 0)) throw new ApiError(400, 'Monthly target must be a non-negative number');
  const user = await User.create({ name, email, password, role, department, jobTitle, monthlySalesTarget });
  res.status(201).json({ user });
});

exports.update = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'user id');
  const target = await User.findById(req.params.id).select('+tokenVersion');
  if (!target) throw new ApiError(404, 'User not found');
  if (!canManageRole(req.user, target.role)) throw new ApiError(403, 'You cannot modify this account');

  const updates = pick(req.body || {}, ['name', 'role', 'isActive', 'department', 'jobTitle', 'monthlySalesTarget']);
  if (updates.monthlySalesTarget !== undefined && (!Number.isFinite(Number(updates.monthlySalesTarget)) || Number(updates.monthlySalesTarget) < 0)) throw new ApiError(400, 'Monthly target must be a non-negative number');
  if (updates.role !== undefined) {
    if (!ROLES.includes(updates.role)) throw new ApiError(400, 'Invalid role');
    if (!canManageRole(req.user, updates.role)) throw new ApiError(403, 'You cannot assign this role');
  }
  if (String(target._id) === String(req.user._id)) {
    if (updates.role !== undefined && updates.role !== target.role) throw new ApiError(400, 'You cannot change your own role');
    if (updates.isActive === false) throw new ApiError(400, 'You cannot disable your own account');
  }
  if (req.body.password) {
    if (typeof req.body.password !== 'string' || req.body.password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }
    target.password = req.body.password;
    target.tokenVersion = (target.tokenVersion || 0) + 1;
  }

  Object.assign(target, updates);
  await target.save();
  res.json({ user: target });
});
