const mongoose = require('mongoose');

// يحتوي فقط على إعدادات عرض المنتج، ولا يخزّن بيانات دفع أو حسابات عملاء.
const productRevisionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product', index: true },
  adminId: { type: Number, required: true },
  label: { type: String, default: 'تعديل المنتج', maxlength: 100 },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
});
module.exports = mongoose.model('ProductRevision', productRevisionSchema);
