const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  ticketCode: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  orderCode: { type: String, trim: true, default: '' },
  customerName: { type: String, required: true, trim: true },
  whatsappNumber: { type: String, required: true, trim: true, index: true },
  customerEmail: { type: String, trim: true, default: '' },
  telegramChatId: { type: Number, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['مفتوحة', 'تم الرد', 'مغلقة'], default: 'مفتوحة', index: true },
  adminReply: { type: String, trim: true, default: '' },
  repliedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Complaint', complaintSchema);
