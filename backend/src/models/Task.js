const mongoose = require('mongoose');
const { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } = require('../config/constants');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    type: { type: String, enum: TASK_TYPES, default: 'Follow-up' },
    dueDate: { type: Date, required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'Medium' },
    status: { type: String, enum: TASK_STATUSES, default: 'Pending', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
