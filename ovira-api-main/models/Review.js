const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  productId: { type: String, required: true, index: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Customer' },
  displayName: { type: String, required: true, trim: true, maxlength: 50 },
  stars: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 800 },
  approved: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ productId: 1, customerId: 1 }, { unique: true });
schema.index({ approved: 1, productId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('Review', schema);
