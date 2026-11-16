const mongoose = require('mongoose');

const contactActivitySchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['note', 'call', 'email', 'meeting'], required: true },
  notes: { type: String, trim: true, required: true, maxlength: 2000 },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('ContactActivity', contactActivitySchema);
