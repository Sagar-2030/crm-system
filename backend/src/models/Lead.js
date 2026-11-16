const mongoose = require('mongoose');
const { STAGES, SOURCES } = require('../config/constants');

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
    phone: { type: String, trim: true, maxlength: 30 },
    organization: { type: String, trim: true, maxlength: 150 },
    source: { type: String, enum: SOURCES, default: 'Other' },
    stage: { type: String, enum: STAGES, default: 'New', index: true },
    dealValue: { type: Number, min: 0, default: 0 },
    probability: { type: Number, min: 0, max: 100, default: 20 },
    expectedCloseDate: { type: Date },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    convertedAt: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

leadSchema.virtual('score').get(function scoreLead() {
  let score = 10;
  if (this.email) score += 15;
  if (this.phone) score += 15;
  if (this.organization) score += 15;
  if (['Referral', 'Event'].includes(this.source)) score += 15;
  else if (['Website', 'Email Campaign'].includes(this.source)) score += 10;
  if ((this.dealValue || 0) >= 10000) score += 15;
  else if ((this.dealValue || 0) >= 1000) score += 10;
  if (['Qualified', 'Proposal', 'Negotiation'].includes(this.stage)) score += 15;
  if (this.expectedCloseDate) score += 5;
  return Math.min(score, 100);
});

leadSchema.index({ name: 'text', organization: 'text', email: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
