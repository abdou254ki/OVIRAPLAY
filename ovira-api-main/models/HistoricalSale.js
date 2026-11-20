const mongoose = require('mongoose');

// Import staging only: not automatically attached to a customer account or to the financial journal.
const schema = new mongoose.Schema({
  sourceChannel: { type: String, enum: ['instagram','facebook','whatsapp','telegram','offline','other'], required: true },
  externalRef: { type: String, required: true, trim: true, maxlength: 80 },
  occurredAt: { type: Date, required: true },
  customerLabel: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  amountMinor: { type: Number, required: true, min: 1, max: 1e11, validate: Number.isSafeInteger },
  currency: { type: String, enum: ['DZD'], default: 'DZD' },
  costMinor: { type: Number, default: null, min: 0, validate: { validator: v => v == null || Number.isSafeInteger(v) } },
  status: { type: String, enum: ['draft'], default: 'draft' },
  linkStatus: { type: String, enum: ['unlinked'], default: 'unlinked' },
  customerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  sourceEvidenceNote: { type: String, trim: true, maxlength: 300, default: '' }
}, { timestamps: true, versionKey: false, autoIndex: false, autoCreate: false });
schema.index({ sourceChannel: 1, externalRef: 1 }, { unique: true });
schema.index({ occurredAt: -1, status: 1 });
module.exports = mongoose.model('HistoricalSale', schema);
