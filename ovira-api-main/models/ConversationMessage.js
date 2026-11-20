const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  author: { type: String, enum: ['customer','guest','admin','ai','whatsapp','system'], required: true },
  text: { type: String, required: true, maxlength: 2000 },
  providerMessageId: { type: String, default: undefined },
  // prevents duplicate web retry / webhook redelivery; user-controlled keys never authorize a send
  dedupeKey: { type: String, default: undefined },
  aiJobId: { type: mongoose.Schema.Types.ObjectId, default: null },
  aiDraft: { type: String, default: '', maxlength: 1000 },
  sentByAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
  delivery: { type: String, enum: ['site','received','internal'], default: 'site' }
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ conversationId: 1, createdAt: 1 });
schema.index({ conversationId: 1, createdAt: -1, _id: -1 });
schema.index({ providerMessageId: 1 }, { unique: true, partialFilterExpression: { providerMessageId: { $type:'string' } } });
schema.index({ conversationId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type:'string' } } });
module.exports = mongoose.model('ConversationMessage', schema);
