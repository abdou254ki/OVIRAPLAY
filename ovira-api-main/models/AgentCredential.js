const mongoose = require('mongoose');

// عامل الهاتف لا يحصل على اسم مستخدم MongoDB ولا على مفاتيح الإدارة.
const schema = new mongoose.Schema({
  deviceName: { type: String, required: true, maxlength: 64, trim: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  scopes: { type: [String], default: ['agent:heartbeat', 'jobs:claim', 'jobs:result'] },
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending', index: true },
  createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  lastHeartbeatAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  tokenVersion: { type: Number, default: 1 },
  workerVersion: { type: String, maxlength: 40, default: '' }
}, { timestamps: true, versionKey: false, autoIndex: false, autoCreate: false });
schema.index({ status: 1, createdAt: -1 });
schema.set('toJSON', { transform(_doc, ret) { delete ret.tokenHash; return ret; } });
module.exports = mongoose.model('AgentCredential', schema);
