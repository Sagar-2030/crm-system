const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 160 },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['Paid', 'Pending', 'Refunded'], default: 'Paid' },
  purchasedAt: { type: Date, required: true, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
