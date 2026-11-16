const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
    phone: { type: String, trim: true, maxlength: 30 },
    organization: { type: String, trim: true, maxlength: 150 },
    category: { type: String, enum: ['Customer', 'Prospect', 'Partner'], default: 'Customer', index: true },
    status: { type: String, enum: ['Active', 'At Risk', 'Inactive'], default: 'Active', index: true },
    industry: { type: String, trim: true, maxlength: 100 },
    lifetimeValue: { type: Number, min: 0, default: 0 },
    monthlyRecurringRevenue: { type: Number, min: 0, default: 0 },
    tags: [{ type: String, trim: true, maxlength: 32 }],
    notes: { type: String, trim: true, maxlength: 2000 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);
