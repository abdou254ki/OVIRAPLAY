const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  adminId: { type: Number, required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },
  summary: { type: String, required: true },
  at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Audit', auditSchema);
