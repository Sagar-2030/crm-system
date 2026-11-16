const mongoose = require('mongoose');

const workspaceSettingSchema = new mongoose.Schema({
  key: { type: String, default: 'workspace', unique: true },
  companyName: { type: String, trim: true, maxlength: 120, default: 'Northstar CRM' },
  website: { type: String, trim: true, maxlength: 200, default: '' },
  supportEmail: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  currency: { type: String, enum: ['USD', 'INR', 'EUR', 'GBP'], default: 'USD' },
  timezone: { type: String, trim: true, maxlength: 60, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('WorkspaceSetting', workspaceSettingSchema);
