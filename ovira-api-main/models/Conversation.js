const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  channel: { type: String, enum: ['site','whatsapp','legacy'], required: true },
  status: { type: String, enum: ['open','review','closed'], default: 'open' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  // A guest must prove possession of this one-time capability. Never link by phone/email alone.
  guestTokenHash: { type: String, select: false, default: undefined },
  guestName: { type: String, default: '', maxlength: 80 },
  guestPhone: { type: String, default: '', maxlength: 30 },
  subject: { type: String, default: 'استفسار', maxlength: 120 },
  providerThreadId: { type: String, default: undefined, select: false },
  legacyComplaintId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
  legacySupportMessageId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessageText: { type: String, default: '', maxlength: 180 },
  lastSender: { type: String, default: 'customer' },
  unreadAdmin: { type: Number, default: 0, min: 0 },
  unreadCustomer: { type: Number, default: 0, min: 0 },
  messageCount: { type: Number, default: 0, min: 0 },
  aiMode: { type: String, enum: ['assist','human'], default: 'human' },
  isPrimarySupportThread: { type: Boolean, default: undefined },
  assignedAdminId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ lastMessageAt: -1, _id: -1 });
schema.index({ channel: 1, lastMessageAt: -1, _id: -1 });
schema.index({ aiMode: 1, lastMessageAt: -1 });
schema.index({ unreadAdmin: -1, lastMessageAt: -1 });
schema.index({ customerId: 1, lastMessageAt: -1 });
// This is intentionally partial: existing historical conversations remain untouched.
schema.index({ channel:1, customerId:1, isPrimarySupportThread:1 }, {unique:true,partialFilterExpression:{channel:'site',customerId:{$type:'objectId'},isPrimarySupportThread:true}});
schema.index({ status: 1, lastMessageAt: -1 });
schema.index({ channel: 1, providerThreadId: 1 }, { unique: true, partialFilterExpression: { providerThreadId: { $type: 'string' } } });
schema.index({ legacyComplaintId: 1 }, { unique: true, partialFilterExpression: { legacyComplaintId: { $type: 'objectId' } } });
schema.index({ legacySupportMessageId: 1 }, { unique: true, partialFilterExpression: { legacySupportMessageId: { $type: 'objectId' } } });
schema.set('toJSON', {transform(_d, x) { delete x.guestTokenHash; delete x.providerThreadId; return x; }});
module.exports = mongoose.model('Conversation', schema);
