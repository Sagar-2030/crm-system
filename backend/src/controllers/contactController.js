const Contact = require('../models/Contact');
const Lead = require('../models/Lead');
const ContactActivity = require('../models/ContactActivity');
const Purchase = require('../models/Purchase');
const { ApiError, asyncHandler } = require('../middleware/error');
const { isManagerOrAbove } = require('../middleware/auth');
const { escapeRegex, assertObjectId, isValidEmail, getAccessibleLead, getAssignableUser, paginate, pick } = require('../utils/helpers');

// Agents see contacts they created or contacts linked to leads assigned to them.
const contactScope = async (user) => {
  if (isManagerOrAbove(user)) return {};
  const leadIds = await Lead.find({ assignedTo: user._id }).distinct('_id');
  return { $or: [{ createdBy: user._id }, { lead: { $in: leadIds } }] };
};

const loadAccessibleContact = async (id, user) => {
  assertObjectId(id, 'contact id');
  const contact = await Contact.findById(id);
  if (!contact) throw new ApiError(404, 'Contact not found');
  if (!isManagerOrAbove(user)) {
    const scope = await contactScope(user);
    const ok = await Contact.exists({ _id: contact._id, ...scope });
    if (!ok) throw new ApiError(403, 'You do not have access to this contact');
  }
  return contact;
};

const validate = (data) => {
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim())) throw new ApiError(400, 'Contact name is required');
  if (data.email && !isValidEmail(data.email)) throw new ApiError(400, 'Invalid email address');
  if (data.category !== undefined && !['Customer', 'Prospect', 'Partner'].includes(data.category)) throw new ApiError(400, 'Invalid customer category');
  if (data.status !== undefined && !['Active', 'At Risk', 'Inactive'].includes(data.status)) throw new ApiError(400, 'Invalid customer status');
  if (data.lifetimeValue !== undefined && (!Number.isFinite(Number(data.lifetimeValue)) || Number(data.lifetimeValue) < 0)) throw new ApiError(400, 'Lifetime value must be a non-negative number');
  if (data.monthlyRecurringRevenue !== undefined && (!Number.isFinite(Number(data.monthlyRecurringRevenue)) || Number(data.monthlyRecurringRevenue) < 0)) throw new ApiError(400, 'Monthly recurring revenue must be a non-negative number');
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.length > 20 || data.tags.some((tag) => typeof tag !== 'string' || tag.length > 32))) throw new ApiError(400, 'Tags must be a list of up to 20 labels');
};

exports.list = asyncHandler(async (req, res) => {
  const filter = await contactScope(req.user);
  if (req.query.status) {
    if (!['Active', 'At Risk', 'Inactive'].includes(req.query.status)) throw new ApiError(400, 'Invalid customer status filter');
    filter.status = req.query.status;
  }
  if (req.query.category) {
    if (!['Customer', 'Prospect', 'Partner'].includes(req.query.category)) throw new ApiError(400, 'Invalid customer category filter');
    if (req.query.category === 'Customer') {
      filter.$and = [...(filter.$and || []), { $or: [{ category: 'Customer' }, { category: { $exists: false } }] }];
    } else filter.category = req.query.category;
  }
  if (req.query.assignedTo && isManagerOrAbove(req.user)) {
    if (req.query.assignedTo === 'unassigned') filter.assignedTo = null;
    else { assertObjectId(req.query.assignedTo, 'assignee id'); filter.assignedTo = req.query.assignedTo; }
  }
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    const search = [{ name: rx }, { organization: rx }, { email: rx }, { phone: rx }];
    filter.$and = [...(filter.$and || []), { $or: search }];
  }
  const { page, limit, skip } = paginate(req.query);
  const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, value: { lifetimeValue: -1 }, name: { name: 1 } };
  const [contacts, total] = await Promise.all([
    Contact.find(filter).populate('lead', 'name stage').populate('assignedTo', 'name email').sort(sortMap[req.query.sort] || sortMap.newest).skip(skip).limit(limit),
    Contact.countDocuments(filter),
  ]);
  res.json({ contacts, total, page, pages: Math.ceil(total / limit) });
});

exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body || {}, ['name', 'email', 'phone', 'organization', 'lead', 'category', 'status', 'industry', 'lifetimeValue', 'monthlyRecurringRevenue', 'tags', 'notes']);
  if (!data.name) throw new ApiError(400, 'Contact name is required');
  validate(data);
  if (data.email && await Contact.exists({ ...await contactScope(req.user), email: data.email.toLowerCase() })) throw new ApiError(409, 'A customer with this email already exists in your workspace');
  if (data.lead) await getAccessibleLead(data.lead, req.user);
  else delete data.lead;
  let assignedTo = req.user._id;
  if (isManagerOrAbove(req.user) && req.body.assignedTo) assignedTo = (await getAssignableUser(req.body.assignedTo))._id;
  const contact = await Contact.create({ ...data, assignedTo, createdBy: req.user._id });
  await contact.populate('assignedTo', 'name email');
  res.status(201).json({ contact });
});

exports.importMany = asyncHandler(async (req, res) => {
  const rows = req.body?.contacts;
  if (!Array.isArray(rows) || !rows.length) throw new ApiError(400, 'Provide at least one customer to import');
  if (rows.length > 500) throw new ApiError(400, 'You can import up to 500 customers at a time');
  const importedEmails = rows.map((row) => String(row?.email || '').trim().toLowerCase()).filter(Boolean);
  const existingEmails = new Set((await Contact.find({ ...await contactScope(req.user), email: { $in: importedEmails } }).distinct('email')).map((email) => email.toLowerCase()));
  const seen = new Set();
  const documents = [];
  const errors = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = Number.isInteger(row?.rowNumber) && row.rowNumber >= 2 ? row.rowNumber : index + 2;
    try {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new ApiError(400, 'Row must contain customer fields');
      const data = pick(row, ['name', 'email', 'phone', 'organization', 'category', 'status', 'industry', 'lifetimeValue', 'monthlyRecurringRevenue', 'tags', 'notes']);
      Object.keys(data).forEach((key) => { if (typeof data[key] === 'string') { data[key] = data[key].trim(); if (!data[key] && key !== 'name') delete data[key]; } });
      if (!data.name) throw new ApiError(400, 'Customer name is required');
      if (data.email) data.email = data.email.toLowerCase();
      if (typeof data.tags === 'string') data.tags = data.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
      if (data.lifetimeValue === '') delete data.lifetimeValue;
      if (data.monthlyRecurringRevenue === '') delete data.monthlyRecurringRevenue;
      validate(data);
      if (data.email && (existingEmails.has(data.email) || seen.has(data.email))) throw new ApiError(409, `Customer with email ${data.email} already exists`);
      let assignedTo = req.user._id;
      if (isManagerOrAbove(req.user) && row.assignedTo) assignedTo = (await getAssignableUser(row.assignedTo))._id;
      const document = new Contact({ ...data, assignedTo, createdBy: req.user._id });
      const validationError = document.validateSync();
      if (validationError) throw new ApiError(400, Object.values(validationError.errors).map((item) => item.message).join(', '));
      documents.push(document);
      if (data.email) seen.add(data.email);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      errors.push({ row: rowNumber, message: error.message });
    }
  }
  if (documents.length) await Contact.insertMany(documents);
  res.status(201).json({ created: documents.length, rejected: errors.length, errors });
});

exports.update = asyncHandler(async (req, res) => {
  const contact = await loadAccessibleContact(req.params.id, req.user);
  const data = pick(req.body || {}, ['name', 'email', 'phone', 'organization', 'lead', 'category', 'status', 'industry', 'lifetimeValue', 'monthlyRecurringRevenue', 'tags', 'notes']);
  validate(data);
  if (data.email && await Contact.exists({ _id: { $ne: contact._id }, ...await contactScope(req.user), email: data.email.toLowerCase() })) throw new ApiError(409, 'A customer with this email already exists in your workspace');
  if (data.lead) await getAccessibleLead(data.lead, req.user);
  if (data.lead === '' || data.lead === null) data.lead = undefined;
  if (isManagerOrAbove(req.user) && req.body.assignedTo) contact.assignedTo = (await getAssignableUser(req.body.assignedTo))._id;
  else if (isManagerOrAbove(req.user) && req.body.assignedTo === '') contact.assignedTo = undefined;
  Object.assign(contact, data);
  await contact.save();
  await contact.populate('assignedTo', 'name email');
  res.json({ contact });
});

exports.get = asyncHandler(async (req, res) => {
  const contact = await loadAccessibleContact(req.params.id, req.user);
  await contact.populate([{ path: 'lead', select: 'name stage' }, { path: 'assignedTo', select: 'name email' }]);
  const activities = await ContactActivity.find({ contact: contact._id }).populate('user', 'name').sort({ createdAt: -1 }).limit(100);
  const purchases = await Purchase.find({ contact: contact._id }).sort({ purchasedAt: -1 }).limit(100);
  res.json({ contact, activities, purchases });
});

exports.addActivity = asyncHandler(async (req, res) => {
  const contact = await loadAccessibleContact(req.params.id, req.user);
  const { type = 'note', notes } = req.body || {};
  if (!['note', 'call', 'email', 'meeting'].includes(type)) throw new ApiError(400, 'Activity type must be note, call, email, or meeting');
  if (typeof notes !== 'string' || !notes.trim()) throw new ApiError(400, 'Activity notes are required');
  const activity = await ContactActivity.create({ contact: contact._id, user: req.user._id, type, notes: notes.trim() });
  await activity.populate('user', 'name');
  res.status(201).json({ activity });
});

exports.addPurchase = asyncHandler(async (req, res) => {
  const contact = await loadAccessibleContact(req.params.id, req.user);
  const { description, amount, status = 'Paid', purchasedAt } = req.body || {};
  if (typeof description !== 'string' || !description.trim()) throw new ApiError(400, 'Purchase description is required');
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) throw new ApiError(400, 'Purchase amount must be non-negative');
  if (!['Paid', 'Pending', 'Refunded'].includes(status)) throw new ApiError(400, 'Invalid purchase status');
  const date = purchasedAt ? new Date(purchasedAt) : new Date();
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Purchase date is invalid');
  const purchase = await Purchase.create({ contact: contact._id, description: description.trim(), amount: Number(amount), status, purchasedAt: date, createdBy: req.user._id });
  res.status(201).json({ purchase });
});

exports.remove = asyncHandler(async (req, res) => {
  const contact = await loadAccessibleContact(req.params.id, req.user);
  await ContactActivity.deleteMany({ contact: contact._id });
  await Purchase.deleteMany({ contact: contact._id });
  await contact.deleteOne();
  res.json({ message: 'Contact deleted' });
});
