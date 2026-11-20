const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, default: 'local-agent-v1' },
  enabled: { type: Boolean, default: false },
  executionEnabled: { type: Boolean, default: false },
  autoSiteFaqEnabled: { type: Boolean, default: false },
  autoSiteRepliesEnabled: { type: Boolean, default: false },
  supportHumanOnly: { type: Boolean, default: true },
  killSwitch: { type: Boolean, default: false },
  mode: { type: String, enum: ['shadow', 'assist'], default: 'shadow' },
  replyMode: { type: String, enum: ['assist'], default: 'assist' },
  costPolicy: { type: String, enum: ['free'], default: 'free' },
  maxMessagesPerHour: { type: Number, min: 1, max: 20, default: 20 },
  updatedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true, versionKey: false, autoIndex: false, autoCreate: false });
module.exports = mongoose.model('AgentSettings', schema);
