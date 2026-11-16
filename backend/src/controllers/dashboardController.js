const Lead = require('../models/Lead');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const Contact = require('../models/Contact');
const { STAGES } = require('../config/constants');
const { asyncHandler } = require('../middleware/error');
const { isManagerOrAbove } = require('../middleware/auth');
const { leadScope } = require('../utils/helpers');

exports.summary = asyncHandler(async (req, res) => {
  const manager = isManagerOrAbove(req.user);
  const leadFilter = leadScope(req.user);
  const taskFilter = manager ? {} : { assignedTo: req.user._id };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [stageAgg, pendingTasks, overdueTasks, leadIds, forecast] = await Promise.all([
    Lead.aggregate([{ $match: leadFilter }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Task.countDocuments({ ...taskFilter, status: { $ne: 'Completed' } }),
    Task.countDocuments({ ...taskFilter, status: { $ne: 'Completed' }, dueDate: { $lt: now } }),
    manager ? Promise.resolve(null) : Lead.find(leadFilter).distinct('_id'),
    Lead.aggregate([{ $match: leadFilter }, { $group: { _id: null, pipelineValue: { $sum: { $cond: [{ $not: [{ $in: ['$stage', ['Converted', 'Lost']] }] }, { $ifNull: ['$dealValue', 0] }, 0] } }, weightedForecast: { $sum: { $cond: [{ $not: [{ $in: ['$stage', ['Converted', 'Lost']] }] }, { $multiply: [{ $ifNull: ['$dealValue', 0] }, { $divide: [{ $ifNull: ['$probability', 20] }, 100] }] }, 0] } } } }]),
  ]);

  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0]));
  stageAgg.forEach((r) => {
    byStage[r._id] = r.count;
  });
  const totalLeads = Object.values(byStage).reduce((a, b) => a + b, 0);
  const converted = byStage.Converted;
  // Conversion rate is computed over leads that reached a final outcome; null when none have.
  const closed = converted + byStage.Lost;
  const conversionRate = closed > 0 ? Math.round((converted / closed) * 1000) / 10 : null;

  const activityFilter = manager ? {} : { lead: { $in: leadIds } };
  const customerFilter = manager ? {} : { $or: [{ createdBy: req.user._id }, { lead: { $in: leadIds } }] };
  const customerMatch = { ...customerFilter, $and: [...(customerFilter.$and || []), { $or: [{ category: 'Customer' }, { category: { $exists: false } }] }] };
  const [customers, bookedRevenue, customerHealth, recentCustomers, monthlyRevenue] = await Promise.all([
    Contact.countDocuments(customerMatch),
    Lead.aggregate([{ $match: { ...leadFilter, stage: 'Converted' } }, { $group: { _id: null, total: { $sum: { $ifNull: ['$dealValue', 0] } } } }]),
    Contact.aggregate([{ $match: customerMatch }, { $group: { _id: null, mrr: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$status', 'Active'] }, 'Active'] }, { $ifNull: ['$monthlyRecurringRevenue', 0] }, 0] } }, retained: { $sum: { $cond: [{ $in: [{ $ifNull: ['$status', 'Active'] }, ['Active', 'At Risk']] }, 1, 0] } }, total: { $sum: 1 } } }]),
    Contact.find(customerMatch).populate('assignedTo', 'name').sort({ createdAt: -1 }).limit(5),
    Lead.aggregate([{ $match: { ...leadFilter, stage: 'Converted', convertedAt: { $gte: previousMonthStart, $lt: nextMonthStart } } }, { $group: { _id: null, current: { $sum: { $cond: [{ $gte: ['$convertedAt', monthStart] }, { $ifNull: ['$dealValue', 0] }, 0] } }, previous: { $sum: { $cond: [{ $lt: ['$convertedAt', monthStart] }, { $ifNull: ['$dealValue', 0] }, 0] } } } }]),
  ]);
  const recentActivity = await Activity.find(activityFilter)
    .populate('user', 'name')
    .populate('lead', 'name')
    .sort({ createdAt: -1 })
    .limit(10);

  const [upcomingTasks, upcomingMeetings] = await Promise.all([
    Task.find({ ...taskFilter, status: { $ne: 'Completed' } }).populate('lead', 'name').populate('assignedTo', 'name').sort({ dueDate: 1 }).limit(5),
    Task.find({ ...taskFilter, type: 'Meeting', status: { $ne: 'Completed' }, dueDate: { $gte: now } }).populate('lead', 'name').sort({ dueDate: 1 }).limit(5),
  ]);

  res.json({
    totals: { leads: totalLeads, customers, revenue: bookedRevenue[0]?.total || 0, revenueGrowth: monthlyRevenue[0]?.previous > 0 ? Math.round(((monthlyRevenue[0].current - monthlyRevenue[0].previous) / monthlyRevenue[0].previous) * 1000) / 10 : null, mrr: customerHealth[0]?.mrr || 0, retentionRate: customerHealth[0]?.total ? Math.round((customerHealth[0].retained / customerHealth[0].total) * 100) : null, converted, pendingTasks, overdueTasks, conversionRate, pipelineValue: forecast[0]?.pipelineValue || 0, weightedForecast: forecast[0]?.weightedForecast || 0 },
    byStage,
    recentActivity,
    upcomingTasks,
    recentCustomers,
    upcomingMeetings,
  });
});
