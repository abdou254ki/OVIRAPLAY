const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  slotNumber: { type: Number, required: true },
  profileName: { type: String, default: '' },
  pin: { type: String, default: '' },
  status: { type: String, enum: ['available', 'occupied'], default: 'available' },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderCode: { type: String, default: '' },
  assignedAt: { type: Date },
  expiresAt: { type: Date }
}, { _id: false });

const stockSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  productId: { type: String, required: true, index: true },
  productName: { type: String, required: true },
  email: { type: String, required: true, trim: true },
  password: { type: String, required: true, trim: true },
  costPrice: { type: Number, default: 0 },
  masterExpiresAt: { type: Date, required: true },
  notes: { type: String, default: '' },
  slots: { type: [slotSchema], default: [] },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// فهارس المخزون للبحث السريع والتخصيص الذري
stockSchema.index({ productId: 1, 'slots.status': 1 });
stockSchema.index({ active: 1, masterExpiresAt: 1 });

module.exports = mongoose.model('Stock', stockSchema);
