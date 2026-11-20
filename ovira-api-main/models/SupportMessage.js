const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  provider: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
  providerMessageId: { type: String, required: true, maxlength: 200 },
  senderWaId: { type: String, required: true, maxlength: 30, select: false },
  text: { type: String, default: '', maxlength: 1200 },
  status: { type: String, enum: ['review', 'queued', 'inference', 'draft_ready', 'closed'], default: 'review' },
  aiDraft: { type: String, default: '', maxlength: 1200 },
  reviewedAt: { type: Date, default: null },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentJob', default: null },
  receivedAt: { type: Date, default: Date.now }
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ provider: 1, providerMessageId: 1 }, { unique: true });
schema.index({ createdAt: -1, status: 1 });
module.exports = mongoose.model('SupportMessage', schema);
