const Lead = require('../models/Lead');
const Task = require('../models/Task');
const Contact = require('../models/Contact');
const Activity = require('../models/Activity');
const { STAGES, SOURCES, MANUAL_ACTIVITY_TYPES } = require('../config/constants');
const { ApiError, asyncHandler } = require('../middleware/error');
const { isManagerOrAbove } = require('../middleware/auth');
const {
  escapeRegex,
  assertObjectId,
  isValidEmail,
  leadScope,
  getAccessibleLead,
  getAssignableUser,
  paginate,
  pick,
} = require('../utils/helpers');

const validateLeadFields = (data) => {
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim())) {
    throw new ApiError(400, 'Lead name is required');
  }
  if (data.email && !isValidEmail(data.email)) throw new ApiError(400, 'Invalid email address');
  if (data.stage !== undefined && !STAGES.includes(data.stage)) throw new ApiError(400, `Stage must be one of: ${STAGES.join(', ')}`);
  if (data.source !== undefined && !SOURCES.includes(data.source)) throw new ApiError(400, `Source must be one of: ${SOURCES.join(', ')}`);
  if (data.dealValue !== undefined && (!Number.isFinite(Number(data.dealValue)) || Number(data.dealValue) < 0)) throw new ApiError(400, 'Deal value must be a non-negative number');
  if (data.probability !== undefined && (!Number.isFinite(Number(data.probability)) || Number(data.probability) < 0 || Number(data.probability) > 100)) throw new ApiError(400, 'Probability must be between 0 and 100');
  if (data.expectedCloseDate !== undefined && data.expectedCloseDate && Number.isNaN(new Date(data.expectedCloseDate).getTime())) throw new ApiError(400, 'Expected close date is invalid');
  if (data.priority !== undefined && !['Low', 'Medium', 'High'].includes(data.priority)) throw new ApiError(400, 'Priority must be Low, Medium, or High');
};

const ensureCustomerForLead = async (lead, user) => {
  const access = isManagerOrAbove(user) ? {} : { createdBy: user._id };
  let contact = await Contact.findOne({ lead: lead._id, ...access });
  if (!contact && lead.email) contact = await Contact.findOne({ email: lead.email, ...access });
  if (!contact) {
    contact = await Contact.create({ name: lead.name, email: lead.email, phone: lead.phone, organization: lead.organization, lead: lead._id, assignedTo: lead.assignedTo, createdBy: user._id, category: 'Customer', status: 'Active', lifetimeValue: lead.dealValue || 0 });
  } else if (!contact.lead) {
    contact.lead = lead._id;
    await contact.save();
  }
  return contact;
};

exports.list = asyncHandler(async (req, res) => {
  const { q, stage, source, assignedTo, priority, from, to } = req.query;
  const filter = { ...leadScope(req.user) };

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { organization: rx }, { email: rx }, { phone: rx }];
  }
  if (stage) {
    if (!STAGES.includes(stage)) throw new ApiError(400, 'Invalid stage filter');
    filter.stage = stage;
  }
  if (source) {
    if (!SOURCES.includes(source)) throw new ApiError(400, 'Invalid source filter');
    filter.source = source;
  }
  if (priority) {
    if (!['Low', 'Medium', 'High'].includes(priority)) throw new ApiError(400, 'Invalid priority filter');
    filter.priority = priority;
  }
  if (assignedTo && isManagerOrAbove(req.user)) {
    if (assignedTo === 'unassigned') filter.assignedTo = null;
    else {
      assertObjectId(assignedTo, 'assignee id');
      filter.assignedTo = assignedTo;
    }
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const { page, limit, skip } = paginate(req.query);
  const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, value: { dealValue: -1 }, closeDate: { expectedCloseDate: 1 }, probability: { probability: -1 } };
  const sort = sortMap[req.query.sort] || sortMap.newest;
  const [leads, total] = await Promise.all([
    Lead.find(filter).populate('assignedTo', 'name email').sort(sort).skip(skip).limit(limit),
    Lead.countDocuments(filter),
  ]);
  res.json({ leads, total, page, pages: Math.ceil(total / limit) });
});

// Full set (no pagination) for the pipeline board
exports.board = asyncHandler(async (req, res) => {
  const leads = await Lead.find(leadScope(req.user)).populate('assignedTo', 'name').sort({ updatedAt: -1 }).limit(500);
  res.json({ leads });
});

exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body || {}, ['name', 'email', 'phone', 'organization', 'source', 'stage', 'notes', 'dealValue', 'probability', 'expectedCloseDate', 'priority']);
  if (!data.name) throw new ApiError(400, 'Lead name is required');
  validateLeadFields(data);
  if (data.email && await Lead.exists({ ...leadScope(req.user), email: data.email.toLowerCase() })) throw new ApiError(409, 'A lead with this email already exists in your workspace');

  // Agents own the leads they create; managers may assign at creation.
  let assignee = req.user._id;
  if (isManagerOrAbove(req.user) && req.body.assignedTo) {
    assignee = (await getAssignableUser(req.body.assignedTo))._id;
  } else if (isManagerOrAbove(req.user)) {
    assignee = undefined;
  }

  const lead = await Lead.create({ ...data, assignedTo: assignee, createdBy: req.user._id, ...(data.stage === 'Converted' ? { convertedAt: new Date() } : {}) });
  await Activity.create({ lead: lead._id, user: req.user._id, type: 'created', notes: 'Lead created' });
  await lead.populate('assignedTo', 'name email');
  res.status(201).json({ lead });
});

exports.importMany = asyncHandler(async (req, res) => {
  const rows = req.body && req.body.leads;
  if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(400, 'Provide at least one lead to import');
  if (rows.length > 500) throw new ApiError(400, 'You can import up to 500 leads at a time');

  const documents = [];
  const errors = [];
  const seenEmails = new Set();
  const importedEmails = rows
    .map((row) => (row && typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''))
    .filter(Boolean);
  const existingEmails = new Set(
    (await Lead.find({ ...leadScope(req.user), email: { $in: importedEmails } }).distinct('email')).map((email) => email.toLowerCase())
  );

  rows.forEach((row, index) => {
    const rowNumber = Number.isInteger(row && row.rowNumber) && row.rowNumber >= 2 ? row.rowNumber : index + 2;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push({ row: rowNumber, message: 'Each row must contain lead fields' });
      return;
    }

    const data = pick(row, ['name', 'email', 'phone', 'organization', 'source', 'stage', 'notes', 'dealValue', 'probability', 'expectedCloseDate', 'priority']);
    Object.keys(data).forEach((key) => {
      if (typeof data[key] === 'string') {
        data[key] = data[key].trim();
        if (!data[key] && key !== 'name') delete data[key];
      }
    });
    try {
      if (!data.name) throw new ApiError(400, 'Lead name is required');
      validateLeadFields(data);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      errors.push({ row: rowNumber, message: error.message });
      return;
    }

    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (email && (existingEmails.has(email) || seenEmails.has(email))) {
      errors.push({ row: rowNumber, message: `A lead with email ${email} already exists` });
      return;
    }
    if (email) seenEmails.add(email);

    const assignedTo = isManagerOrAbove(req.user) ? undefined : req.user._id;
    const lead = new Lead({ ...data, assignedTo, createdBy: req.user._id });
    if (lead.stage === 'Converted') lead.convertedAt = new Date();
    const validationError = lead.validateSync();
    if (validationError) {
      errors.push({ row: rowNumber, message: Object.values(validationError.errors).map((item) => item.message).join(', ') });
      return;
    }
    documents.push(lead);
  });

  if (documents.length) {
    const created = await Lead.insertMany(documents);
    await Activity.insertMany(
      created.map((lead) => ({ lead: lead._id, user: req.user._id, type: 'created', notes: 'Lead imported from CSV' }))
    );
    const convertedLeads = created.filter((lead) => lead.stage === 'Converted');
    for (const lead of convertedLeads) await ensureCustomerForLead(lead, req.user);
  }

  res.status(201).json({ created: documents.length, rejected: errors.length, errors });
});

exports.get = asyncHandler(async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  await lead.populate('assignedTo', 'name email');
  const [activities, tasks, contacts] = await Promise.all([
    Activity.find({ lead: lead._id }).populate('user', 'name').sort({ createdAt: -1 }).limit(100),
    Task.find({ lead: lead._id }).populate('assignedTo', 'name').sort({ dueDate: 1 }),
    Contact.find({ lead: lead._id }),
  ]);
  res.json({ lead, activities, tasks, contacts });
});

exports.update = asyncHandler(async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  // Agents may edit contact details and notes; managers may edit everything except assignment (separate endpoint)
  const allowed = isManagerOrAbove(req.user)
    ? ['name', 'email', 'phone', 'organization', 'source', 'notes', 'dealValue', 'probability', 'expectedCloseDate', 'priority']
    : ['email', 'phone', 'organization', 'notes', 'dealValue', 'probability', 'expectedCloseDate', 'priority'];
  const data = pick(req.body || {}, allowed);
  validateLeadFields(data);
  Object.assign(lead, data);
  await lead.save();
  await lead.populate('assignedTo', 'name email');
  res.json({ lead });
});

exports.setStage = asyncHandler(async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  const { stage } = req.body || {};
  if (!STAGES.includes(stage)) throw new ApiError(400, `Stage must be one of: ${STAGES.join(', ')}`);
  if (lead.stage === stage) return res.json({ lead });

  const previous = lead.stage;
  lead.stage = stage;
  if (stage === 'Converted') lead.convertedAt = lead.convertedAt || new Date();
  await lead.save();
  await Activity.create({
    lead: lead._id,
    user: req.user._id,
    type: 'stage_change',
    notes: `Stage changed from ${previous} to ${stage}`,
  });
  if (stage === 'Converted') await ensureCustomerForLead(lead, req.user);
  await lead.populate('assignedTo', 'name email');
  res.json({ lead });
});

exports.convert = asyncHandler(async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  if (lead.stage !== 'Converted') {
    const previous = lead.stage;
    lead.stage = 'Converted';
    lead.convertedAt = new Date();
    await lead.save();
    await Activity.create({ lead: lead._id, user: req.user._id, type: 'stage_change', notes: `Lead converted to customer from ${previous}` });
  }
  const contact = await ensureCustomerForLead(lead, req.user);
  await contact.populate('assignedTo', 'name email');
  res.json({ lead, contact });
});

exports.assign = asyncHandler(async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  const assignee = await getAssignableUser(req.body && req.body.assignedTo);
  lead.assignedTo = assignee._id;
  await lead.save();
  await Activity.create({
    lead: lead._id,
    user: req.user._id,
    type: 'assignment',
    notes: `Assigned to ${assignee.name}`,
  });
  await lead.populate('assignedTo', 'name email');
  res.json({ lead });
});

exports.addActivity = asyncHandler(async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  const { type = 'note', notes } = req.body || {};
  if (!MANUAL_ACTIVITY_TYPES.includes(type)) throw new ApiError(400, `Type must be one of: ${MANUAL_ACTIVITY_TYPES.join(', ')}`);
  if (typeof notes !== 'string' || !notes.trim()) throw new ApiError(400, 'Notes are required');
  const activity = await Activity.create({ lead: lead._id, user: req.user._id, type, notes: notes.trim() });
  await activity.populate('user', 'name');
  res.status(201).json({ activity });
});

exports.remove = asyncHandler(async (req, res) => {
  const lead = await getAccessibleLead(req.params.id, req.user);
  await Promise.all([
    Task.deleteMany({ lead: lead._id }),
    Activity.deleteMany({ lead: lead._id }),
    Contact.updateMany({ lead: lead._id }, { $unset: { lead: 1 } }),
  ]);
  await lead.deleteOne();
  res.json({ message: 'Lead deleted' });
});
