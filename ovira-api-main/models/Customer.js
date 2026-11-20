const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // ملاحظة: الفهارس الفريدة (phone / googleId) تُدار يدويًا في services/indexMigration.js
  // كفهارس جزئية (partial) لتجاهل الحقول الفارغة أو المفقودة نهائيًا.
  phone: { type: String, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, trim: true, lowercase: true, maxlength: 150 },
  googleId: { type: String, trim: true },
  passwordHash: { type: String },

  // حالة إثبات ملكية الهاتف والبريد (لمنع A03 و A15 و N01)
  phoneVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },

  telegramChatId: { type: Number },
  telegramUsername: { type: String, trim: true, default: '' },
  balance: { type: Number, default: 0, min: 0 },
  blocked: { type: Boolean, default: false },
  marketingOptIn: { type: Boolean, default: false },

  // إدارة الجلسات وإبطال الرموز المسروقة (A13) + الحماية من التخمين
  tokenVersion: { type: Number, default: 0 },
  passwordChangedAt: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

  // إعدادات التحقق بخطوتين (2FA) الاختياري للزبون (A14 / N06)
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorMethod: { type: String, enum: ['', 'telegram', 'totp'], default: '' },
  totpSecret: { type: String, default: '' },
  totpPendingSecret: { type: String, default: '' },
  otpCodeHash: { type: String, default: '' },
  otpExpiresAt: { type: Date },
  otpAttempts: { type: Number, default: 0 },
  otpPurpose: { type: String, default: '' },
  // Owner-issued one-time support identity proof. Never authorizes account changes.
  supportCodeHash: { type:String, select:false, default:'' },
  supportCodeExpiresAt: { type:Date },
  supportVerifiedUntil: { type:Date },

  // كود ربط سريع وأحادي الاستخدام لحساب الموقع مع بوت تيليغرام (A04)
  linkCode: { type: String },
  linkCodeExpiresAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date }
}, { autoIndex: false }); // الفهارس تُنشأ في ensureCustomerIndexes() بعد الاتصال

// منع تسرب أي أسرار أو تجزئات عند تحويل الوثيقة إلى JSON في الردود (A15)
const SENSITIVE_CUSTOMER_FIELDS = [
  'passwordHash',
  'totpSecret',
  'totpPendingSecret',
  'otpCodeHash',
  'otpExpiresAt',
  'otpAttempts',
  'otpPurpose',
  'linkCode',
  'linkCodeExpiresAt',
  'failedLoginAttempts',
  'lockUntil',
  'supportCodeHash',
  'supportCodeExpiresAt',
  'supportVerifiedUntil'
];

customerSchema.set('toJSON', {
  transform(doc, ret) {
    for (const field of SENSITIVE_CUSTOMER_FIELDS) {
      delete ret[field];
    }
    return ret;
  }
});

module.exports = mongoose.model('Customer', customerSchema);
module.exports.SENSITIVE_CUSTOMER_FIELDS = SENSITIVE_CUSTOMER_FIELDS;
