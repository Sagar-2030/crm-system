const Lead = require('../models/Lead');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/error');
const { assertObjectId } = require('../utils/helpers');

const buildDateRange = (from, to) => {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid "from" date');
    range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid "to" date');
    // include the whole end day
    d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return Object.keys(range).length ? range : null;
};

// Reports are restricted to managers and super admins at the route level.
exports.overview = asyncHandler(async (req, res) => {
  const { from, to, assignedTo } = req.query;
  const range = buildDateRange(from, to);
  const leadMatch = {};
  if (range) leadMatch.createdAt = range;
  if (assignedTo) {
    assertObjectId(assignedTo, 'assignee id');
    leadMatch.assignedTo = new (require('mongoose').Types.ObjectId)(assignedTo);
  }

  const [byStage, bySource, monthly, customersMonthly, revenueMonthly, dealByStage] = await Promise.all([
    Lead.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: leadMatch },
      {
        $group: {
          _id: '$source',
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$stage', 'Converted'] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Lead.aggregate([
      { $match: leadMatch },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          created: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$stage', 'Converted'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    require('../models/Contact').aggregate([
      { $match: { ...(range ? { createdAt: range } : {}), $or: [{ category: 'Customer' }, { category: { $exists: false } }] } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, customers: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Lead.aggregate([
      { $match: { ...(leadMatch.assignedTo ? { assignedTo: leadMatch.assignedTo } : {}), stage: 'Converted', convertedAt: { $exists: true, ...(range || {}) } } },
      { $group: { _id: { y: { $year: '$convertedAt' }, m: { $month: '$convertedAt' } }, revenue: { $sum: { $ifNull: ['$dealValue', 0] } }, deals: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Lead.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$stage', value: { $sum: { $ifNull: ['$dealValue', 0] } }, count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    bySource: bySource.map((r) => ({
      source: r._id || 'Other',
      total: r.total,
      converted: r.converted,
      conversionRate: r.total ? Math.round((r.converted / r.total) * 1000) / 10 : 0,
    })),
    byStage: byStage.map((r) => ({ stage: r._id, count: r.count })),
    monthly: monthly.map((r) => ({
      month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`,
      created: r.created,
      converted: r.converted,
    })),
    customersMonthly: customersMonthly.map((r) => ({ month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`, customers: r.customers })),
    revenueMonthly: revenueMonthly.map((r) => ({ month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`, revenue: r.revenue, deals: r.deals })),
    dealByStage: dealByStage.map((r) => ({ stage: r._id, value: r.value, count: r.count })),
  });
});

exports.team = asyncHandler(async (req, res) => {
  const range = buildDateRange(req.query.from, req.query.to);
  const dateMatch = range ? { createdAt: range } : {};

  const [users, leadAgg, taskAgg, actAgg, revenueAgg] = await Promise.all([
    User.find({ role: { $in: ['manager', 'agent'] }, isActive: true }).sort({ name: 1 }),
    Lead.aggregate([
      { $match: { ...dateMatch, assignedTo: { $ne: null } } },
      {
        $group: {
          _id: '$assignedTo',
          leads: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$stage', 'Converted'] }, 1, 0] } },
        },
      },
    ]),
    Task.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: '$assignedTo',
          tasks: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        },
      },
    ]),
    Activity.aggregate([{ $match: dateMatch }, { $group: { _id: '$user', activities: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: { ...(range ? { convertedAt: range } : {}), assignedTo: { $ne: null }, stage: 'Converted', convertedAt: { $exists: true, ...(range || {}) } } },
      { $group: { _id: '$assignedTo', revenue: { $sum: { $ifNull: ['$dealValue', 0] } } } },
    ]),
  ]);

  const idx = (arr) => Object.fromEntries(arr.map((r) => [String(r._id), r]));
  const L = idx(leadAgg);
  const T = idx(taskAgg);
  const A = idx(actAgg);
  const R = idx(revenueAgg);

  const team = users.map((u) => {
    const id = String(u._id);
    return {
      userId: u._id,
      name: u.name,
      role: u.role,
      department: u.department,
      jobTitle: u.jobTitle,
      monthlySalesTarget: u.monthlySalesTarget || 0,
      leads: (L[id] && L[id].leads) || 0,
      converted: (L[id] && L[id].converted) || 0,
      revenue: (R[id] && R[id].revenue) || 0,
      targetAttainment: (u.monthlySalesTarget || 0) > 0 ? Math.round(((R[id] && R[id].revenue || 0) / u.monthlySalesTarget) * 100) : null,
      tasks: (T[id] && T[id].tasks) || 0,
      tasksCompleted: (T[id] && T[id].completed) || 0,
      activities: (A[id] && A[id].activities) || 0,
    };
  });

  res.json({ team });
});
