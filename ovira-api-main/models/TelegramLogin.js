const mongoose = require('mongoose');

// جلسة دخول عبر بوت تيليغرام (رابط عميق t.me/<bot>?start=lg_<token>)
// تُحذف تلقائيًا بعد 10 دقائق (TTL) ولا تحتوي إلا على بيانات مؤقتة.
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  state: { type: String, enum: ['pending', 'awaiting', 'approved', 'rejected', 'used'], default: 'pending' },
  chatId: { type: Number },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  username: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: 600 }
});

module.exports = mongoose.model('TelegramLogin', schema);
