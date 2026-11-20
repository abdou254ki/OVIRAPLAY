'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../../models/Admin');
const { ADMIN_ROLES } = require('../../models/Admin');
const { bot } = require('../../bot/telegram');
const {
  generateTotpSecret,
  verifyTotpToken,
  buildOtpAuthUrl,
  createOtpChallenge,
  verifyOtpChallenge,
  sendTelegramOtpMessage
} = require('../../services/authService');
const {
  MAX_LOGIN_ATTEMPTS,
  LOCK_TIME_MS,
  MAX_OTP_ATTEMPTS,
  recordAdminAudit,
  migrateOwner,
  loginLimiter,
  twoFaLimiter,
  signAdminSessionToken,
  requireAdmin,
  requireRole
} = require('./middlewares');

const router = express.Router();
const { JWT_SECRET } = process.env;

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'أدخل البريد الإلكتروني وكلمة السر.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password;

    // إذا لم يكن هناك مالك بعد في القاعدة، نفذ التهيئة الأولية مرة واحدة
    const ownerCount = await Admin.countDocuments({ role: 'owner' });
    if (ownerCount === 0) {
      await migrateOwner();
    }

    const admin = await Admin.findOne({ email: cleanEmail, active: true });
    if (!admin || !admin.passwordHash || !ADMIN_ROLES.includes(admin.role)) {
      await recordAdminAudit({
        adminId: 0,
        action: 'ADMIN_LOGIN_FAILED',
        entity: 'Admin',
        entityId: cleanEmail,
        summary: 'محاولة دخول فاشلة للوحة الإدارة (بريد غير موجود أو غير مفعل)'
      });
      return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة السر غير صحيحة.' });
    }

    if (admin.lockUntil && admin.lockUntil.getTime() > Date.now()) {
      const waitMin = Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `تم قفل الحساب مؤقتاً لكثرة المحاولات الخاطئة. حاول بعد ${waitMin} دقيقة.`
      });
    }

    const isAuthenticated = await bcrypt.compare(cleanPass, admin.passwordHash);
    if (!isAuthenticated) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        admin.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
      }
      await admin.save();

      await recordAdminAudit({
        adminId: admin.telegramId,
        action: 'ADMIN_LOGIN_FAILED',
        entity: 'Admin',
        entityId: admin._id,
        summary: `كلمة سر خاطئة للمدير (المحاولة ${admin.failedLoginAttempts})`
      });
      return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة السر غير صحيحة.' });
    }

    admin.failedLoginAttempts = 0;
    admin.lockUntil = undefined;

    if (admin.twoFactorEnabled && admin.twoFactorMethod) {
      if (admin.twoFactorMethod === 'telegram') {
        const targetChatId = admin.telegramId || Number((TELEGRAM_ADMIN_IDS || '').split(',')[0].trim());
        const { code, hash, expiresAt } = createOtpChallenge();
        admin.otpCodeHash = hash;
        admin.otpExpiresAt = expiresAt;
        admin.otpAttempts = 0;
        await admin.save();
        await sendTelegramOtpMessage(bot, targetChatId, code, 'الدخول إلى لوحة الإدارة');
      } else {
        admin.otpAttempts = 0;
        await admin.save();
      }

      const tempToken = jwt.sign(
        { id: String(admin._id), role: 'admin_2fa_pending', method: admin.twoFactorMethod, tv: admin.tokenVersion || 0 },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

      return res.json({
        success: true,
        requires2FA: true,
        method: admin.twoFactorMethod,
        tempToken,
        message:
          admin.twoFactorMethod === 'telegram'
            ? 'أرسلنا رمز التحقق من 6 أرقام إلى حسابك في بوت تيليغرام.'
            : 'أدخل رمز التحقق المكون من 6 أرقام من تطبيق Google Authenticator.'
      });
    }

    await admin.save();
    await recordAdminAudit({
      adminId: admin.telegramId,
      action: 'ADMIN_LOGIN_SUCCESS',
      entity: 'Admin',
      entityId: admin._id,
      summary: 'تسجيل دخول ناجح للوحة الإدارة'
    });

    const token = signAdminSessionToken(admin);
    res.json({ success: true, token, role: admin.role, email: admin.email });
  } catch (err) {
    next(err);
  }
});

// تأكيد كود التحقق بخطوتين (2FA) للمدير (مع حد محاولات N06)
router.post('/2fa/verify-login', twoFaLimiter, async (req, res, next) => {
  try {
    const { tempToken, code } = req.body || {};
    if (typeof tempToken !== 'string' || typeof code !== 'string' || !tempToken || !code.trim()) {
      return res.status(400).json({ success: false, message: 'أدخل رمز التحقق المكون من 6 أرقام.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة، أعد تسجيل الدخول.' });
    }

    if (!decoded || decoded.role !== 'admin_2fa_pending' || !mongoose.isValidObjectId(decoded.id)) {
      return res.status(401).json({ success: false, message: 'رمز الجلسة غير صالح.' });
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.active || !ADMIN_ROLES.includes(admin.role)) {
      return res.status(401).json({ success: false, message: 'الحساب غير متاح.' });
    }

    if ((admin.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      admin.otpCodeHash = '';
      admin.otpExpiresAt = undefined;
      await admin.save();
      return res.status(401).json({ success: false, message: 'تم تجاوز عدد المحاولات المسموح به، أعد تسجيل الدخول.' });
    }

    let isValid = false;
    if (admin.twoFactorMethod === 'totp') {
      isValid = verifyTotpToken(admin.totpSecret, code);
    } else if (admin.twoFactorMethod === 'telegram') {
      isValid = verifyOtpChallenge(code, admin.otpCodeHash, admin.otpExpiresAt);
    }

    if (!isValid) {
      admin.otpAttempts = (admin.otpAttempts || 0) + 1;
      if (admin.otpAttempts >= MAX_OTP_ATTEMPTS) {
        admin.otpCodeHash = '';
        admin.otpExpiresAt = undefined;
      }
      await admin.save();
      await recordAdminAudit({
        adminId: admin.telegramId,
        action: 'ADMIN_2FA_FAILED',
        entity: 'Admin',
        entityId: admin._id,
        summary: `رمز 2FA خاطئ للمدير (المحاولة ${admin.otpAttempts})`
      });
      return res.status(401).json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' });
    }

    admin.otpCodeHash = '';
    admin.otpExpiresAt = undefined;
    admin.otpAttempts = 0;
    await admin.save();

    await recordAdminAudit({
      adminId: admin.telegramId,
      action: 'ADMIN_LOGIN_2FA_SUCCESS',
      entity: 'Admin',
      entityId: admin._id,
      summary: 'اكتمال دخول المدير عبر التحقق بخطوتين (2FA)'
    });

    const token = signAdminSessionToken(admin);
    res.json({ success: true, token, role: admin.role, email: admin.email });
  } catch (err) {
    next(err);
  }
});

// إعداد وتفعيل أو إيقاف التحقق بخطوتين (2FA) للمدير (للمالك فقط + حماية A14)
router.post('/2fa/setup', requireAdmin, requireRole(['owner']), twoFaLimiter, async (req, res, next) => {
  try {
    const { method } = req.body || {};
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ success: false, message: 'الحساب غير موجود.' });

    if (method === 'totp') {
      const secret = generateTotpSecret();
      admin.totpPendingSecret = secret;
      admin.otpAttempts = 0;
      await admin.save();
      const otpauthUrl = buildOtpAuthUrl({
        secret,
        accountLabel: admin.email || 'Admin',
        issuer: 'OVIRA PLAY Admin'
      });
      return res.json({ success: true, method: 'totp', secret, otpauthUrl });
    }

    if (method === 'telegram') {
      const targetChatId = admin.telegramId || Number((TELEGRAM_ADMIN_IDS || '').split(',')[0].trim());
      if (!targetChatId) {
        return res.status(400).json({ success: false, message: 'معرّف تيليغرام للمدير غير مضبوط في الإعدادات.' });
      }
      const { code, hash, expiresAt } = createOtpChallenge();
      admin.otpCodeHash = hash;
      admin.otpExpiresAt = expiresAt;
      admin.otpAttempts = 0;
      await admin.save();
      await sendTelegramOtpMessage(bot, targetChatId, code, 'تفعيل التحقق بخطوتين للوحة الإدارة');
      return res.json({
        success: true,
        method: 'telegram',
        message: 'تم إرسال كود التأكيد إلى حسابك في بوت تيليغرام، أدخله بالأسفل لتفعيل الحماية.'
      });
    }

    return res.status(400).json({ success: false, message: 'طريقة غير صالحة.' });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/enable', requireAdmin, requireRole(['owner']), twoFaLimiter, async (req, res, next) => {
  try {
    const { method, code } = req.body || {};
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ success: false, message: 'الحساب غير موجود.' });

    if ((admin.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'تجاوزت الحد المسموح، أعد طلب إعداد الرمز.' });
    }

    if (method === 'totp') {
      if (!admin.totpPendingSecret || !verifyTotpToken(admin.totpPendingSecret, code)) {
        admin.otpAttempts = (admin.otpAttempts || 0) + 1;
        await admin.save();
        return res.status(400).json({ success: false, message: 'الرمز غير صحيح، تأكد من مسح الباركود في Google Authenticator.' });
      }
      admin.totpSecret = admin.totpPendingSecret;
      admin.totpPendingSecret = '';
      admin.twoFactorMethod = 'totp';
      admin.twoFactorEnabled = true;
      admin.otpAttempts = 0;
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
      await admin.save();

      await recordAdminAudit({
        adminId: admin.telegramId,
        action: 'ADMIN_2FA_ENABLED',
        entity: 'Admin',
        entityId: admin._id,
        summary: 'تفعيل التحقق بخطوتين (TOTP) للوحة الإدارة'
      });

      return res.json({
        success: true,
        token: signAdminSessionToken(admin),
        message: 'تم تفعيل التحقق بخطوتين عبر Google Authenticator للوحة التحكم!'
      });
    }

    if (method === 'telegram') {
      if (!verifyOtpChallenge(code, admin.otpCodeHash, admin.otpExpiresAt)) {
        admin.otpAttempts = (admin.otpAttempts || 0) + 1;
        await admin.save();
        return res.status(400).json({ success: false, message: 'الرمز غير صحيح أو منتهي الصلاحية.' });
      }
      admin.otpCodeHash = '';
      admin.otpExpiresAt = undefined;
      admin.twoFactorMethod = 'telegram';
      admin.twoFactorEnabled = true;
      admin.otpAttempts = 0;
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
      await admin.save();

      await recordAdminAudit({
        adminId: admin.telegramId,
        action: 'ADMIN_2FA_ENABLED',
        entity: 'Admin',
        entityId: admin._id,
        summary: 'تفعيل التحقق بخطوتين (Telegram) للوحة الإدارة'
      });

      return res.json({
        success: true,
        token: signAdminSessionToken(admin),
        message: 'تم تفعيل التحقق بخطوتين عبر بوت تيليغرام للوحة التحكم!'
      });
    }

    return res.status(400).json({ success: false, message: 'طريقة غير صالحة.' });
  } catch (err) {
    next(err);
  }
});

// إيقاف 2FA للمدير يتطلب إثبات الهوية بكلمة السر الحالية أو رمز 2FA (إغلاق A14)
router.post('/2fa/disable', requireAdmin, requireRole(['owner']), twoFaLimiter, async (req, res, next) => {
  try {
    const { currentPassword, code } = req.body || {};
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ success: false, message: 'الحساب غير موجود.' });

    let verified = false;
    if (typeof currentPassword === 'string' && currentPassword && admin.passwordHash) {
      verified = await bcrypt.compare(currentPassword, admin.passwordHash);
    } else if (typeof code === 'string' && code.trim()) {
      if (admin.twoFactorMethod === 'totp') {
        verified = verifyTotpToken(admin.totpSecret, code);
      } else if (admin.twoFactorMethod === 'telegram') {
        verified = verifyOtpChallenge(code, admin.otpCodeHash, admin.otpExpiresAt);
      }
    }

    if (!verified) {
      return res.status(401).json({
        success: false,
        requiresReauth: true,
        message: 'لإيقاف التحقق بخطوتين، يرجى تأكيد كلمة السر الحالية للمدير.'
      });
    }

    admin.twoFactorEnabled = false;
    admin.twoFactorMethod = '';
    admin.totpSecret = '';
    admin.totpPendingSecret = '';
    admin.otpCodeHash = '';
    admin.otpExpiresAt = undefined;
    admin.otpAttempts = 0;
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await admin.save();

    await recordAdminAudit({
      adminId: admin.telegramId,
      action: 'ADMIN_2FA_DISABLED',
      entity: 'Admin',
      entityId: admin._id,
      summary: 'إيقاف التحقق بخطوتين للوحة الإدارة بعد التحقق من الهوية'
    });

    res.json({
      success: true,
      token: signAdminSessionToken(admin),
      message: 'تم إيقاف التحقق بخطوتين للوحة التحكم.'
    });
  } catch (err) {
    next(err);
  }
});

// بحث موحد مع تحديد حجم الاستعلام وتفادي حقن تعبيرات RegExp.
module.exports = router;
