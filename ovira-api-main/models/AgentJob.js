const mongoose = require('mongoose');

// Queued inference ONLY. No direct financial, fulfilment or WhatsApp send capabilities.
const schema = new mongoose.Schema({
  kind: { type: String, enum: ['support_draft', 'conversation_draft', 'test_prompt'], required: true },
  dedupeKey: { type: String, required: true, maxlength: 180 },
  status: { type: String, enum: ['queued', 'leased', 'review', 'sent', 'failed', 'cancelled'], default: 'queued' },
  priority: { type: Number, default: 0, min: 0, max: 10 },
  inputText: { type: String, required: true, maxlength: 1200 },
  approvedContext: { type: String, default: '', maxlength: 2000 },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportMessage', default: null },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
  conversationMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConversationMessage', default: null },
  resultText: { type: String, default: '', maxlength: 1200 },
  errorCode: { type: String, default: '', maxlength: 50 },
  attempts: { type: Number, default: 0 },
  jobVersion: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  notBefore: { type: Date, default: Date.now },
  leaseOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentCredential', default: null },
  leaseTokenHash: { type: String, select: false, default: '' },
  leaseExpiresAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  policyVersion: { type: String, default: 'assist-free-v1' }
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ dedupeKey: 1 }, { unique: true });
schema.index({conversationId:1,status:1});
schema.index({status:1,leaseExpiresAt:1});
schema.index({ status: 1, notBefore: 1, priority: -1, createdAt: 1 });
schema.set('toJSON', { transform(_doc, ret) { delete ret.leaseTokenHash; return ret; } });
module.exports = mongoose.model('AgentJob', schema);
