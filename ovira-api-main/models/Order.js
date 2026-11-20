const mongoose = require('mongoose');

const PAYMENT_METHODS = [
  'Chargily Pay (الذهبية / CIB)',
  'رصيد المحفظة',
  'بريدي موب',
  'Binance',
  'Redotpay',
  'Bybit'
];

const STATUSES = ['قيد المراجعة', 'مؤكد', 'تم التسليم', 'ملغي'];

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    months: { type: Number, required: true, min: 1, max: 36 },
    quantity: { type: Number, required: true, min: 1, max: 9 },
    unitPrice: { type: Number, required: true, min: 0 },
    planKey: { type: String, default: '' },
    planLabel: { type: String, default: '' }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
  customerName: { type: String, required: true, trim: true, maxlength: 80 },
  whatsappNumber: { type: String, required: true, trim: true, index: true },
  customerEmail: { type: String, trim: true, lowercase: true, default: '', maxlength: 150 },
  cartItems: {
    type: [cartItemSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0 && v.length <= 20,
      message: 'السلة غير صالحة'
    }
  },
  subTotal: { type: Number, default: 0, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  couponCode: { type: String, default: '' },
  totalPrice: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, required: true, enum: PAYMENT_METHODS },
  status: { type: String, enum: STATUSES, default: 'قيد المراجعة', index: true },

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  telegramChatId: { type: Number, index: true },
  adminNote: { type: String, default: '', maxlength: 300 },

  // بيانات الدفع الإلكتروني عبر شارجيلي (A11 / N03)
  chargilyCheckoutId: { type: String, sparse: true, index: true },
  isPaidOnline: { type: Boolean, default: false },
  paidAt: { type: Date },
  paymentDetails: {
    transactionId: { type: String, default: '' },
    amountPaid: { type: Number },
    currency: { type: String, default: 'dzd' },
    envMode: { type: String, default: '' },
    paymentMethodUsed: { type: String, default: '' },
    payerName: { type: String, default: '' },
    payerEmail: { type: String, default: '' },
    payerPhone: { type: String, default: '' },
    paidAtFormatted: { type: String, default: '' }
  },

  // بيانات الحساب والشاشة المسلمة للزبون
  deliveredAccount: {
    type: { type: String, enum: ['account', 'screen', 'invite'], default: 'screen' },
    credentials: { type: String, default: '' },
    invitationUrl: { type: String, default: '' },
    profileName: { type: String, default: '' },
    pinCode: { type: String, default: '' },
    extraNote: { type: String, default: '' },
    deliveredAt: { type: Date }
  },

  receipts: [
    {
      fileId: { type: String, required: true },
      at: { type: Date, default: Date.now }
    }
  ],

  history: [
    {
      status: { type: String, required: true },
      by: { type: String, required: true },
      at: { type: Date, default: Date.now }
    }
  ],

  // رموز ربط الحساب والوصول الآمن للضيف (A02 / A04 / A07)
  claimTokenHash: { type: String, index: true },
  claimExpiresAt: { type: Date },
  guestAccessTokenHash: { type: String, index: true },
  guestAccessExpiresAt: { type: Date },

  // مكافحة الطلبات الوهمية ومنع التكرار (Idempotency & Anti-Abuse)
  orderFingerprint: { type: String, index: true },
  idempotencyKey: { type: String, sparse: true, index: true },
  riskScore: { type: Number, default: 0 },
  riskFlags: { type: [String], default: [] },

  // مصدر الزيارة (utm) كما أرسلته الواجهة؛ للقياس فقط، بلا default حتى لا تُكتب في الطلبات القديمة.
  source: { type: String, trim: true, maxlength: 80 },

  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Order', orderSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.STATUSES = STATUSES;
