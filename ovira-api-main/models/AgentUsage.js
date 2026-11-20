const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, required: true }, // HMAC pseudonym, never plain phone
  timestamps: { type: [Date], default: [] },
  revision: { type: Number, default: 1 }
}, { timestamps: true, autoIndex: false, autoCreate: false });
module.exports = mongoose.model('AgentUsage', schema);
