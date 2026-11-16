const mongoose = require('mongoose');
const { ApiError } = require('../middleware/error');
const { isManagerOrAbove } = require('../middleware/auth');
const User = require('../models/User');
const Lead = require('../models/Lead');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertObjectId = (id, label = 'id') => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}`);
};

const isValidEmail = (v) => /^\S+@\S+\.\S+$/.test(v);

// Agents only see leads assigned to them; managers and super admins see all.
const leadScope = (user) => (isManagerOrAbove(user) ? {} : { assignedTo: user._id });

// Loads a lead and enforces record-level access.
const getAccessibleLead = async (id, user) => {
  assertObjectId(id, 'lead id');
  const lead = await Lead.findById(id);
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (!isManagerOrAbove(user) && String(lead.assignedTo) !== String(user._id)) {
    throw new ApiError(403, 'You do not have access to this lead');
  }
  return lead;
};

// Confirms an assignee exists and is active.
const getAssignableUser = async (id) => {
  assertObjectId(id, 'user id');
  const u = await User.findById(id);
  if (!u || !u.isActive) throw new ApiError(400, 'Assignee does not exist or is inactive');
  return u;
};

// Basic pagination from query string
const paginate = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

// Copy only whitelisted keys that are present in the body
const pick = (obj, keys) => keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

module.exports = { escapeRegex, assertObjectId, isValidEmail, leadScope, getAccessibleLead, getAssignableUser, paginate, pick };
