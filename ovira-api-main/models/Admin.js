const mongoose = require('mongoose');

const ADMIN_ROLES = ['owner', 'staff', 'viewer'];

const adminSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  role: { type: String, enum: ADMIN_ROLES, default: 'staff', index: true },
  active: { type: Boolean, default: true, index: true },
  email: { type: String, required: false, trim: true, lowercase: true, index: true },
  passwordHash: { type: String, required: false },

  // إدارة الجلسات وإبطال الرموز (A13) + الحماية من التخمين
  tokenVersion: { type: Number, default: 0 },
  passwordChangedAt: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

  // إعدادات التحقق بخطوتين (2FA) الاختياري للمدير (A14 / N06)
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorMethod: { type: String, enum: ['', 'telegram', 'totp'], default: '' },
  totpSecret: { type: String, default: '' },
  totpPendingSecret: { type: String, default: '' },
  otpCodeHash: { type: String, default: '' },
  otpExpiresAt: { type: Date },
  otpAttempts: { type: Number, default: 0 },
  agentStepUpHash: { type: String, default: '' },
  agentStepUpExpiresAt: { type: Date },
  agentStepUpAttempts: { type: Number, default: 0 }
});

adminSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.totpSecret;
    delete ret.totpPendingSecret;
    delete ret.otpCodeHash;
    delete ret.otpExpiresAt;
    delete ret.otpAttempts;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.agentStepUpHash;
    delete ret.agentStepUpExpiresAt;
    delete ret.agentStepUpAttempts;
    return ret;
  }
});

module.exports = mongoose.model('Admin', adminSchema);
module.exports.ADMIN_ROLES = ADMIN_ROLES;
