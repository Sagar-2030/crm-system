const Task = require('../models/Task');
const { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } = require('../config/constants');
const { ApiError, asyncHandler } = require('../middleware/error');
const { isManagerOrAbove } = require('../middleware/auth');
const { assertObjectId, escapeRegex, getAccessibleLead, getAssignableUser, paginate, pick } = require('../utils/helpers');

const parseDate = (v) => {
  const d = new Date(v);
  if (!v || Number.isNaN(d.getTime())) throw new ApiError(400, 'A valid due date is required');
  return d;
};

const loadAccessibleTask = async (id, user) => {
  assertObjectId(id, 'task id');
  const task = await Task.findById(id);
  if (!task) throw new ApiError(404, 'Task not found');
  if (!isManagerOrAbove(user) && String(task.assignedTo) !== String(user._id)) {
    throw new ApiError(403, 'You do not have access to this task');
  }
  return task;
};

exports.list = asyncHandler(async (req, res) => {
  const { status, lead, overdue, assignedTo, q } = req.query;
  const filter = isManagerOrAbove(req.user) ? {} : { assignedTo: req.user._id };

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { description: rx }];
  }
  if (status) {
    if (!TASK_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status filter');
    filter.status = status;
  }
  if (lead) {
    assertObjectId(lead, 'lead id');
    filter.lead = lead;
  }
  if (assignedTo && isManagerOrAbove(req.user)) {
    assertObjectId(assignedTo, 'assignee id');
    filter.assignedTo = assignedTo;
  }
  if (overdue === 'true') {
    filter.status = { $ne: 'Completed' };
    filter.dueDate = { $lt: new Date() };
  }

  const { page, limit, skip } = paginate(req.query);
  const [tasks, total] = await Promise.all([
    Task.find(filter).populate('assignedTo', 'name').populate('lead', 'name').sort({ dueDate: 1 }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);
  res.json({ tasks, total, page, pages: Math.ceil(total / limit) });
});

exports.notifications = asyncHandler(async (req, res) => {
  const scope = isManagerOrAbove(req.user) ? {} : { assignedTo: req.user._id };
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const openTasks = { ...scope, status: { $ne: 'Completed' } };
  const overdueFilter = { ...openTasks, dueDate: { $lt: now } };
  const upcomingFilter = { ...openTasks, dueDate: { $gte: now, $lte: nextWeek } };

  const [overdueCount, upcomingCount, overdue, upcoming] = await Promise.all([
    Task.countDocuments(overdueFilter),
    Task.countDocuments(upcomingFilter),
    Task.find(overdueFilter)
      .populate('assignedTo', 'name')
      .populate('lead', 'name')
      .sort({ dueDate: 1 })
      .limit(5),
    Task.find(upcomingFilter)
      .populate('assignedTo', 'name')
      .populate('lead', 'name')
      .sort({ dueDate: 1 })
      .limit(5),
  ]);

  res.json({ overdueCount, upcomingCount, overdue, upcoming });
});

exports.create = asyncHandler(async (req, res) => {
  const { title, description, dueDate, priority, type = 'Follow-up', lead, assignedTo } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) throw new ApiError(400, 'Task title is required');
  if (priority !== undefined && !TASK_PRIORITIES.includes(priority)) throw new ApiError(400, 'Invalid priority');
  if (!TASK_TYPES.includes(type)) throw new ApiError(400, 'Invalid task type');

  if (lead) await getAccessibleLead(lead, req.user);

  // Agents can only create tasks for themselves
  let assigneeId = req.user._id;
  if (isManagerOrAbove(req.user) && assignedTo) assigneeId = (await getAssignableUser(assignedTo))._id;

  const task = await Task.create({
    title: title.trim(),
    description,
    type,
    dueDate: parseDate(dueDate),
    priority,
    lead: lead || undefined,
    assignedTo: assigneeId,
    createdBy: req.user._id,
  });
  await task.populate([{ path: 'assignedTo', select: 'name' }, { path: 'lead', select: 'name' }]);
  res.status(201).json({ task });
});

exports.update = asyncHandler(async (req, res) => {
  const task = await loadAccessibleTask(req.params.id, req.user);
  const manager = isManagerOrAbove(req.user);

  // Agents may only change status (completion progress) on their own tasks
  const allowed = manager ? ['title', 'description', 'dueDate', 'priority', 'status', 'type'] : ['status'];
  const data = pick(req.body || {}, allowed);

  if (data.status !== undefined && !TASK_STATUSES.includes(data.status)) throw new ApiError(400, 'Invalid status');
  if (data.priority !== undefined && !TASK_PRIORITIES.includes(data.priority)) throw new ApiError(400, 'Invalid priority');
  if (data.type !== undefined && !TASK_TYPES.includes(data.type)) throw new ApiError(400, 'Invalid task type');
  if (data.title !== undefined && !String(data.title).trim()) throw new ApiError(400, 'Task title is required');
  if (data.dueDate !== undefined) data.dueDate = parseDate(data.dueDate);

  if (manager && req.body.assignedTo) task.assignedTo = (await getAssignableUser(req.body.assignedTo))._id;
  if (data.status === 'Completed' && task.status !== 'Completed') task.completedAt = new Date();
  if (data.status && data.status !== 'Completed') task.completedAt = undefined;

  Object.assign(task, data);
  await task.save();
  await task.populate([{ path: 'assignedTo', select: 'name' }, { path: 'lead', select: 'name' }]);
  res.json({ task });
});

exports.remove = asyncHandler(async (req, res) => {
  const task = await loadAccessibleTask(req.params.id, req.user);
  await task.deleteOne();
  res.json({ message: 'Task deleted' });
});
