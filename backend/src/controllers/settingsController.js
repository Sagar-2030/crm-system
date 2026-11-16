const WorkspaceSetting = require('../models/WorkspaceSetting');
const { ApiError, asyncHandler } = require('../middleware/error');
const { pick, isValidEmail } = require('../utils/helpers');

const defaults = { key: 'workspace' };
exports.get = asyncHandler(async (_req, res) => {
  const settings = await WorkspaceSetting.findOneAndUpdate(defaults, { $setOnInsert: defaults }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ settings });
});

exports.update = asyncHandler(async (req, res) => {
  const data = pick(req.body || {}, ['companyName', 'website', 'supportEmail', 'phone', 'address', 'currency', 'timezone']);
  if (data.companyName !== undefined && (!String(data.companyName).trim() || String(data.companyName).length > 120)) throw new ApiError(400, 'Company name is required and must be under 120 characters');
  if (data.supportEmail && !isValidEmail(data.supportEmail)) throw new ApiError(400, 'Enter a valid support email');
  if (data.currency && !['USD', 'INR', 'EUR', 'GBP'].includes(data.currency)) throw new ApiError(400, 'Unsupported currency');
  if (data.timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: data.timezone }); }
    catch { throw new ApiError(400, 'Enter a valid IANA timezone, such as Asia/Kolkata'); }
  }
  const settings = await WorkspaceSetting.findOneAndUpdate(defaults, { $set: data, $setOnInsert: defaults }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  res.json({ settings });
});
