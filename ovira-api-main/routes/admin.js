const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Order = require('../models/Order');
const Admin = require('../models/Admin');
const { ADMIN_ROLES } = require('../models/Admin');
const Audit = require('../models/Audit');
const Customer = require('../models/Customer');
const Complaint = require('../models/Complaint');
const Conversation = require('../models/Conversation');
const Product = require('../models/Product');
const ProductRevision = require('../models/ProductRevision');
const Review = require('../models/Review');
const { STATUSES } = require('../models/Order');
const { setStatus, deliverOrderAccount } = require('../services/orderService');
const { getChargilyConfig, saveChargilyConfig } = require('../services/chargilyService');
const paymentMethodsSvc = require('../services/paymentMethodsService');
const { getRenewalsList, sendTelegramRenewalReminder } = require('../services/renewalService');
const { DEFAULT_STEPS, ensureSeedProducts, parsePlansInput, readLandingInput, landingToText } = require('../services/productService');
const { bot, notifyComplaintReply } = require('../bot/telegram');
const {
  generateTotpSecret,
  verifyTotpToken,
  buildOtpAuthUrl,
  createOtpChallenge,
  verifyOtpChallenge,
  sendTelegramOtpMessage
} = require('../services/authService');

const router = express.Router();
const { ADMIN_EMAIL, ADMIN_PASSWORD_HASH, JWT_SECRET, TELEGRAM_ADMIN_IDS } = process.env;
const PAGE_SIZE = 30;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// دالة مساعدة لتسجيل الأحداث الأمنية والإدارية بأمان دون تعطيل المسار
async function recordAdminAudit({ adminId, action, entity, entityId, summary }) {
  try {
    await Audit.create({
      adminId: Number(adminId) || 0,
      action,
      entity,
      entityId: String(entityId || ''),
      summary: String(summary || '').slice(0, 400)
    });
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

// التهيئة الأولية لحساب المالك (تعمل فقط إذا لم يوجد أي مالك في القاعدة — إغلاق ثغرة A12)
async function migrateOwner() {
  try {
    await ensureSeedProducts();
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) return;

    const ownerExists = await Admin.findOne({ role: 'owner' });
    if (!ownerExists) {
      const mainId = Number((TELEGRAM_ADMIN_IDS || '0').split(',')[0].trim()) || 1;
      const envEmail = ADMIN_EMAIL.trim().toLowerCase();
      const rawSecret = ADMIN_PASSWORD_HASH.trim();
      const finalHash = rawSecret.startsWith('$2') ? rawSecret : await bcrypt.hash(rawSecret, 12);

      await Admin.create({
        telegramId: mainId,
        name: 'المالك الأساسي',
        role: 'owner',
        email: envEmail,
        passwordHash: finalHash,
        active: true,
        tokenVersion: 0
      });
    } else if (!ownerExists.passwordHash && ADMIN_PASSWORD_HASH) {
      // فقط إذا كان سجل المالك قديماً بلا كلمة سر نهائياً
      const rawSecret = ADMIN_PASSWORD_HASH.trim();
      ownerExists.passwordHash = rawSecret.startsWith('$2') ? rawSecret : await bcrypt.hash(rawSecret, 12);
      if (!ownerExists.email && ADMIN_EMAIL) ownerExists.email = ADMIN_EMAIL.trim().toLowerCase();
      await ownerExists.save();
    }
  } catch (e) {
    console.error('Owner migration error:', e.message);
  }
}
if (mongoose.connection.readyState === 1) {
  migrateOwner();
} else {
  mongoose.connection.once('open', migrateOwner);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات دخول كثيرة، أعد المحاولة بعد 15 دقيقة.' }
});

const twoFaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات تحقق كثيرة، أعد المحاولة بعد 15 دقيقة.' }
});

const adminApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'طلبات كثيرة جداً، تمهل قليلاً.' }
});

router.use(adminApiLimiter);

function signAdminSessionToken(admin) {
  return jwt.sign(
    {
      id: String(admin._id),
      telegramId: admin.telegramId,
      role: admin.role,
      email: admin.email || '',
      tv: admin.tokenVersion || 0
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' }
  );
}

// حارس الإدارة المشدد (إغلاق ثغرة A01 و A13)
const requireAdmin = async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول للوحة الإدارة.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ success: false, message: 'انتهت الجلسة أو الرمز غير صالح، سجل الدخول مجدداً.' });
  }

  if (!decoded || decoded.role === 'admin_2fa_pending') {
    return res.status(401).json({ success: false, message: 'يرجى إكمال التحقق بخطوتين أولاً.' });
  }

  // رفض قاطع لأي دور غير إداري (مثل customer أو customer_2fa_pending)
  if (!ADMIN_ROLES.includes(decoded.role) || !decoded.id || !mongoose.isValidObjectId(decoded.id)) {
    await recordAdminAudit({
      adminId: decoded.telegramId || 0,
      action: 'ADMIN_ACCESS_DENIED',
      entity: 'AdminRoute',
      entityId: req.originalUrl,
      summary: `رفض محاولة وصول غير مصرح بها بدور (${decoded.role || 'unknown'})`
    });
    return res.status(403).json({ success: false, message: 'غير مصرّح لك بالوصول إلى لوحة الإدارة.' });
  }

  try {
    const adminDoc = await Admin.findById(decoded.id).lean();
    if (!adminDoc || !adminDoc.active || !ADMIN_ROLES.includes(adminDoc.role)) {
      return res.status(403).json({ success: false, message: 'حساب الإدارة غير نشط أو غير موجود.' });
    }

    // التحقق من عدم إبطال الجلسة بعد تغيير كلمة السر أو الصلاحيات (A13)
    if ((adminDoc.tokenVersion || 0) !== (decoded.tv || 0)) {
      return res.status(401).json({ success: false, message: 'تم إنهاء هذه الجلسة لدواعٍ أمنية، سجل الدخول مجدداً.' });
    }

    req.admin = {
      id: String(adminDoc._id),
      telegramId: adminDoc.telegramId,
      role: adminDoc.role,
      email: adminDoc.email || '',
      tokenVersion: adminDoc.tokenVersion || 0
    };
    next();
  } catch (err) {
    next(err);
  }
};

// حارس الصلاحيات التفصيلية لكل مسار (Least Privilege — A01)
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.admin || !allowedRoles.includes(req.admin.role)) {
    recordAdminAudit({
      adminId: req.admin ? req.admin.telegramId : 0,
      action: 'ROLE_PERMISSION_DENIED',
      entity: 'AdminRoute',
      entityId: req.originalUrl,
      summary: `منع دور (${req.admin ? req.admin.role : 'none'}) من تنفيذ عملية تتطلب (${allowedRoles.join('/')})`
    });
    return res.status(403).json({ success: false, message: 'صلاحيات حسابك لا تسمح بتنفيذ هذا الإجراء.' });
  }
  next();
};

// 1. تسجيل دخول المدير (إغلاق A12 + حماية القفل المؤقت + دعم 2FA)
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
router.get('/search', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 64) : '';
    if (q.length < 2) return res.json({ success: true, results: { orders: [], customers: [], products: [] } });
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [orders, customers, products] = await Promise.all([
      Order.find({ $or: [{ orderCode: re }, { customerName: re }, { whatsappNumber: re }, { customerEmail: re }] })
        .sort({ createdAt: -1 }).limit(8).select('orderCode customerName totalPrice status createdAt').lean(),
      Customer.find({ $or: [{ name: re }, { phone: re }, { email: re }] })
        .sort({ createdAt: -1 }).limit(8).select('name phone email').lean(),
      Product.find({ $or: [{ title: re }, { brandName: re }, { productId: re }] })
        .limit(8).select('title brandName productId').lean()
    ]);
    res.json({ success: true, results: { orders, customers, products } });
  } catch (err) { next(err); }
});

// لوحة المهام: بيانات فعلية فقط، مع تسمية إيراد المدفوعات المؤكدة بوضوح.
router.get('/overview', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const algeriaDay = new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Algiers' });
    const today = new Date(`${algeriaDay}T00:00:00+01:00`);
    const startOfWeek = new Date(today.getTime() - 6 * 86400000);
    const [review, confirmed, delivered, complaints, pendingReviews, customers, products,
      recentOrders, paidAgg, weekAgg, riskCount, topProducts, supportConversations] = await Promise.all([
      Order.countDocuments({ status: 'قيد المراجعة' }),
      Order.countDocuments({ status: 'مؤكد' }),
      Order.countDocuments({ status: 'تم التسليم' }),
      Complaint.countDocuments({ status: 'مفتوحة' }),
      Review.countDocuments({ approved: false }),
      Customer.countDocuments({ blocked: { $ne: true } }),
      Product.countDocuments({ active: true }),
      Order.find({ status: { $in: ['قيد المراجعة', 'مؤكد'] } })
        .sort({ createdAt: 1 }).limit(6)
        .select('orderCode customerName totalPrice status createdAt').lean(),
      Order.aggregate([
        { $match: { isPaidOnline: true, paidAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { isPaidOnline: true, paidAt: { $gte: startOfWeek } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Africa/Algiers' } }, total: { $sum: '$totalPrice' } } }
      ]),
      Order.countDocuments({ status: 'قيد المراجعة', riskScore: { $gte: 50 } }),
      Order.aggregate([
        { $match: { status: { $in: ['مؤكد','تم التسليم'] }, createdAt: { $gte: new Date(today.getTime() - 30 * 86400000) } } },
        { $unwind: '$cartItems' },
        { $group: { _id: '$cartItems.productName', quantity: { $sum: '$cartItems.quantity' } } },
        { $sort: { quantity: -1 } }, { $limit: 5 }
      ]),
      Conversation.countDocuments({status:{$ne:'closed'}})
    ]);
    const daily = {};
    for (const item of weekAgg) daily[item._id] = item.total;
    const series = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * 86400000);
      const day = d.toLocaleDateString('sv-SE', { timeZone: 'Africa/Algiers' });
      return { day, value: daily[day] || 0 };
    });
    res.json({ success: true, generatedAt: new Date().toISOString(), period: { start: today.toISOString(), timezone: 'Africa/Algiers' }, currency: 'DZD', dataQuality: 'verified_order_and_payment_flags', overview: {
      review, confirmed, delivered, complaints, supportConversations, pendingReviews, customers, products,
      riskCount, paidToday: (paidAgg[0] && paidAgg[0].total) || 0,
      paidTodayCount: (paidAgg[0] && paidAgg[0].count) || 0,
      recentOrders, series, topProducts
    } });
  } catch (err) { next(err); }
});

// سجل نشاط مقروء للإدارة، من دون كلمات مرور أو أسرار.
router.get('/activity', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    const limit = Math.min(80, Math.max(1, Number(req.query.limit) || 30));
    const events = await Audit.find({}).sort({ at: -1 }).limit(limit)
      .select('adminId action entity entityId summary at').lean();
    res.json({ success: true, events });
  } catch (err) { next(err); }
});

// نقطة استعادة النسخ السابقة للمنتج؛ المالك فقط ويمكنه استعادة القيم المعروضة.
const LANDING_FIELDS = ['audience','limits','faqs','guaranteeText','deliveryText','seoTitle','seoDescription'];
const PRODUCT_SNAPSHOT_FIELDS = ['brandName','title','subtitle','category','primaryColor',
  'secondaryColor','iconText','imageUrl','badgeText','features','steps','plans','active', ...LANDING_FIELDS];
function productSnapshot(p) {
  const snap = {};
  for (const k of PRODUCT_SNAPSHOT_FIELDS) snap[k] = JSON.parse(JSON.stringify(p[k] ?? null));
  return snap;
}
router.get('/products/:id/revisions', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'معرّف غير صالح' });
    const revisions = await ProductRevision.find({ productId: req.params.id }).sort({ createdAt: -1 })
      .limit(15).select('createdAt adminId label').lean();
    res.json({ success: true, revisions });
  } catch (err) { next(err); }
});
router.post('/products/:id/restore/:revId', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (![req.params.id, req.params.revId].every(mongoose.isValidObjectId))
      return res.status(400).json({ success: false, message: 'معرّف غير صالح' });
    const [product, rev] = await Promise.all([
      Product.findById(req.params.id),
      ProductRevision.findOne({ _id: req.params.revId, productId: req.params.id })
    ]);
    if (!product || !rev) return res.status(404).json({ success: false, message: 'لم يتم العثور على النسخة' });
    // احفظ الحالة الحالية أولاً بحيث يمكن التراجع عن الاستعادة نفسها.
    await ProductRevision.create({ productId: product._id, adminId: req.admin.telegramId,
      label: 'قبل استعادة نسخة سابقة', snapshot: productSnapshot(product) });
    for (const key of PRODUCT_SNAPSHOT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(rev.snapshot, key)) continue; // نسخ قديمة لا تحوي حقول الهبوط: لا نمسّها
      const v = rev.snapshot[key];
      product[key] = LANDING_FIELDS.includes(key) && v == null ? undefined : v;
    }
    await product.save();
    await recordAdminAudit({ adminId: req.admin.telegramId, action: 'RESTORE_PRODUCT',
      entity: 'Product', entityId: product.productId, summary: `استعادة تعديل سابق للمنتج (${product.title})` });
    res.json({ success: true, message: 'تم استرجاع النسخة بنجاح', product });
  } catch (err) { next(err); }
});

// 2. إدارة الطلبات
const buildFilter = (query) => {
  const { status, q, from, to } = query || {};
  const filter = {};
  if (query && query.scope === 'delivered') filter.status = 'تم التسليم';
  else if (STATUSES.includes(status) && status !== 'تم التسليم') filter.status = status;
  else filter.status = { $ne: 'تم التسليم' };
  const range = {};
  if (from && !isNaN(Date.parse(from))) range.$gte = new Date(from);
  if (to && !isNaN(Date.parse(to))) range.$lte = new Date(to);
  if (Object.keys(range).length) filter.createdAt = range;
  if (typeof q === 'string' && q.trim()) {
    const rx = new RegExp(q.trim().slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ customerName: rx }, { whatsappNumber: rx }, { customerEmail: rx }, { orderCode: rx }];
  }
  return filter;
};

router.get('/orders', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = buildFilter(req.query);
    const [rows, total, openComplaints] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      Order.countDocuments(filter),
      Complaint.countDocuments({ status: 'مفتوحة' })
    ]);
    const orders = rows.map(({ receipts, history, claimTokenHash, guestAccessTokenHash, deliveredAccount, ...o }) => ({
      ...o,
      // لا تعرض أسرار التسليم لدور viewer. أبقها للمالك/الموظف المصرح كي لا تنكسر لوحة التسليم الحالية.
      deliveredAccount: req.admin.role === 'viewer' && deliveredAccount
        ? { type: deliveredAccount.type, deliveredAt: deliveredAccount.deliveredAt }
        : (deliveredAccount || null),
      receiptCount: (receipts || []).length,
      telegram: !!o.telegramChatId
    }));
    res.json({ success: true, orders, total, openComplaints, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  } catch (err) {
    next(err);
  }
});


// Manual historical purchase linkage: owner-only, original order/payment state immutable.
const {matchesHistoricalPurchase}=require('../services/historicalLinkPolicy');
router.get('/orders/:id/link-candidates',requireAdmin,requireRole(['owner']),async(req,res,next)=>{
 try {
  if(!mongoose.isValidObjectId(req.params.id))return res.sendStatus(400);
  const order=await Order.findById(req.params.id).select('status customerId customerEmail whatsappNumber orderCode').lean();
  if(!order)return res.sendStatus(404);
  if(order.status!=='تم التسليم'||order.customerId)return res.status(409).json({success:false,code:'ORDER_NOT_ELIGIBLE'});
  const q=String(req.query.q||'').trim().slice(0,100);
  if(q.length<3)return res.status(400).json({success:false,code:'SEARCH_TERM_TOO_SHORT'});
  const rx=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
  const candidates=await Customer.find({blocked:{$ne:true},$or:[{email:rx},{phone:rx},{name:rx}]}).select('name email phone emailVerified phoneVerified').limit(20).lean();
  res.set('Cache-Control','no-store');res.json({success:true,candidates:candidates.map(c=>({id:c._id,name:c.name,email:c.email||'',phone:c.phone||'',match:matchesHistoricalPurchase(order,c)}))});
 }catch(e){next(e)}
});
router.post('/orders/:id/link-customer',requireAdmin,requireRole(['owner']),async(req,res,next)=>{
 try {
  if(!mongoose.isValidObjectId(req.params.id)||!mongoose.isValidObjectId(req.body?.customerId))return res.sendStatus(400);
  if(req.body?.confirm!=='LINK_ORDER_TO_ACCOUNT')return res.status(400).json({success:false,code:'CONFIRMATION_REQUIRED'});
  const {requireStepUp}=require('../services/agentCredentialService');
  await requireStepUp(req.admin.id,req.body.currentPassword,req.body.code);
  const customer=await Customer.findById(req.body.customerId).select('name email phone emailVerified phoneVerified blocked').lean();
  if(!customer||customer.blocked)return res.status(404).json({success:false,code:'CUSTOMER_NOT_FOUND'});
  const order=await Order.findById(req.params.id).select('orderCode status customerId customerEmail whatsappNumber').lean();
  if(!order)return res.status(404).json({success:false,code:'ORDER_NOT_FOUND'});
  if(order.status!=='تم التسليم'||order.customerId)return res.status(409).json({success:false,code:'ORDER_NOT_ELIGIBLE'});
  const match=matchesHistoricalPurchase(order,customer);
  if(!match.email&&!match.phone)return res.status(409).json({success:false,code:'IDENTITY_NOT_MATCHED',message:'لا يتطابق البريد أو الهاتف مع بيانات الطلب؛ لم يُجرَ الربط.'});
  if(!match.verified){
    const note=String(req.body?.evidenceNote||'').trim();
    if(note.length<20||note.length>300)return res.status(428).json({success:false,code:'OWNERSHIP_PROOF_REQUIRED',message:'الحساب لا يتضمن وسيلة اتصال موثقة مطابقة. يلزم إثبات ملكية مستقل وملاحظة إدارية مفصلة (20 حرفاً على الأقل).'});
  }
  // The atomic compare-and-set prevents attaching a delivered purchase twice.
  const session=await mongoose.startSession();
  let updated;
  try{
   await session.withTransaction(async()=>{
     updated=await Order.findOneAndUpdate({_id:order._id,status:'تم التسليم',customerId:null},{$set:{customerId:customer._id}},{new:true,session});
     if(!updated){const err=new Error('ALREADY_LINKED');err.code='ALREADY_LINKED';throw err;}
     await Audit.create([{adminId:Number(req.admin.telegramId)||0,action:'DELIVERED_ORDER_LINKED',entity:'Order',entityId:order.orderCode,summary:`ربط يدوي بالحساب ${String(customer._id)}؛ إثبات ${match.verified?'مطابقة مؤكدة':'مراجعة مستقلة: '+String(req.body.evidenceNote).trim().slice(0,180)}`}],{session});
   });
  }finally{await session.endSession()}
  try{
    await require('../models/SiteNotification').updateOne({customerId:customer._id,dedupeKey:'linked-order:'+order._id},{$setOnInsert:{customerId:customer._id,kind:'order',title:'إضافة طلب سابق إلى حسابك',body:`تم ربط الطلب ${String(order.orderCode).slice(0,32)} بحسابك. يمكنك مراجعته في «طلباتي».`,link:'#/account',dedupeKey:'linked-order:'+order._id,createdBy:req.admin.id}},{upsert:true});
  }catch(e){console.error('[link-order] notification unavailable:',e.code||e.name)}
  res.set('Cache-Control','no-store');res.json({success:true,orderId:updated._id,customerId:customer._id});
 }catch(e){if(e.code==='ALREADY_LINKED')return res.status(409).json({success:false,code:'ALREADY_LINKED'});if(e.httpStatus)return res.status(e.httpStatus).json({success:false,code:e.code,message:e.message});next(e)}
});

router.patch('/orders/:id', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const { status, adminNote } = req.body || {};
    const validStatus = status !== undefined && STATUSES.includes(status);
    const validNote = typeof adminNote === 'string' && adminNote.length <= 300;
    if (!mongoose.isValidObjectId(req.params.id) || (!validStatus && !validNote)) {
      return res.status(400).json({ success: false, message: 'بيانات غير صالحة.' });
    }
    let order = validStatus ? await setStatus(req.params.id, status, 'panel', req.admin.telegramId) : await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    if (validNote) {
      order.adminNote = adminNote.trim();
      await order.save();
    }
    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_ORDER',
      entity: 'Order',
      entityId: order.orderCode,
      summary: `تحديث الطلب ${order.orderCode} (${validStatus ? 'الحالة: ' + status : 'ملاحظة'})`
    });
    if (validStatus && order.customerId) {
      try {
        await require('../models/SiteNotification').findOneAndUpdate({customerId:order.customerId,dedupeKey:`order:${order._id}:${String(status)}:${(order.history||[]).length}`},
          {$setOnInsert:{customerId:order.customerId,kind:'order',title:'تحديث حالة طلبك',body:`تم تحديث حالة طلب ${String(order.orderCode).slice(0,30)} إلى: ${status}. التفاصيل داخل حسابي.`,link:'#/account'}},
          {upsert:true,new:true,setDefaultsOnInsert:true});
      } catch(e){console.error('[site-notification] order status notice failed:',e.code||e.name);}
    }
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/deliver', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const { type = 'screen', credentials, profileName, pinCode, invitationUrl, extraNote } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id) || !['account', 'screen', 'invite'].includes(type) ||
        (type !== 'invite' && (!credentials || String(credentials).trim().length < 3)) ||
        (type === 'invite' && !/^https:\/\/[^\s]+$/i.test(String(invitationUrl || '')))) {
      return res.status(400).json({ success: false, message: 'أدخل بيانات الحساب (البريد وكلمة المرور).' });
    }
    const order = await deliverOrderAccount(req.params.id, {
      type,
      credentials,
      invitationUrl,
      profileName,
      pinCode,
      extraNote,
      by: 'panel',
      adminId: req.admin.telegramId
    });
    if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'DELIVER_ORDER',
      entity: 'Order',
      entityId: order.orderCode,
      summary: `تسليم بيانات الحساب والشاشة للطلب ${order.orderCode}`
    });
    if (order.customerId) {
      try {
        await require('../models/SiteNotification').findOneAndUpdate({customerId:order.customerId,dedupeKey:`delivered:${order._id}`},
          {$setOnInsert:{customerId:order.customerId,kind:'order',title:'تم تجهيز طلبك',body:`طلب ${String(order.orderCode).slice(0,30)} جاهز. افتح «حسابي» للاطلاع على تفاصيل التسليم بطريقة آمنة.`,link:'#/account'}},
          {upsert:true,new:true,setDefaultsOnInsert:true});
      } catch(e){console.error('[site-notification] delivery notice failed:',e.code||e.name);}
    }
    res.json({
      success: true,
      message: 'تم تسليم الحساب وتحديث الطلب وإشعار الزبون بنجاح!',
      order
    });
  } catch (err) {
    next(err);
  }
});

// إرسال رمز دخول مؤقت للزبون الموثّق؛ لا يُسجل الرمز في MongoDB أو Audit.
router.post('/orders/:id/temporary-code', requireAdmin, requireRole(['owner', 'staff']), twoFaLimiter, async (req, res, next) => {
  try {
    const code = req.body?.code;
    if (!mongoose.isValidObjectId(req.params.id) || typeof code !== 'string' || !/^[a-zA-Z0-9]{4,12}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'أدخل رمزاً مؤقتاً من 4 إلى 12 حرفاً أو رقماً.' });
    }
    const order = await Order.findById(req.params.id).lean();
    if (!order || !order.customerId || !order.telegramChatId || !bot) {
      return res.status(400).json({ success: false, message: 'الطلب غير مربوط بحساب عميل موثّق في Telegram.' });
    }
    const c = await Customer.findById(order.customerId).lean();
    if (!c || c.blocked || c.telegramChatId !== order.telegramChatId) {
      return res.status(403).json({ success: false, message: 'لا يوجد تطابق موثّق بين الزبون وTelegram.' });
    }
    await bot.telegram.sendMessage(order.telegramChatId,
      `🔑 رمز دخول مؤقت للطلب ${order.orderCode}: ${code}\n⚠️ أدخله فوراً؛ لا تشاركه مع شخص آخر.`,
      { protect_content: true });
    await recordAdminAudit({ adminId: req.admin.telegramId, action: 'SEND_TEMP_CODE', entity: 'Order',
      entityId: order.orderCode, summary: 'إرسال رمز مؤقت دون حفظ محتواه' });
    res.json({ success: true, message: 'تم إرسال الرمز المؤقت إلى الزبون الموثّق.' });
  } catch (err) { next(err); }
});

router.delete('/orders/:id', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف الطلب غير صالح.' });
    }
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (deleted) {
      await recordAdminAudit({
        adminId: req.admin.telegramId,
        action: 'DELETE_ORDER',
        entity: 'Order',
        entityId: deleted.orderCode,
        summary: `حذف الطلب ${deleted.orderCode} نهائياً`
      });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 3. إدارة بطاقات العرض وصفحات الهبوط
router.get('/products', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    await ensureSeedProducts();
    const products = await Product.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
    // landing: نفس القيم بصيغة نصية جاهزة للتعديل (سطر لكل عنصر، "سؤال | جواب")
    res.json({ success: true, products: products.map((p) => ({ ...p, landing: landingToText(p) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/products', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const {
      brandName,
      title,
      subtitle,
      category,
      primaryColor,
      secondaryColor,
      iconText,
      imageUrl,
      badgeText,
      featuresText,
      stepsText,
      plansText
    } = req.body || {};

    if (!brandName || !title) {
      return res.status(400).json({ success: false, message: 'اسم العلامة وعنوان البطاقة مطلوبان.' });
    }

    const plans = parsePlansInput(plansText);
    if (!plans.length) {
      return res.status(400).json({ success: false, message: 'أدخل الباقات بصيغة صحيحة (مثال: 1:600, 3:1650, 12:5500*).' });
    }

    const features = String(featuresText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const steps = String(stepsText || '')
      .split('\n')
      .map((line) => {
        const [t, d] = line.split('|').map((s) => s.trim());
        return t && d ? { title: t, desc: d } : null;
      })
      .filter(Boolean);

    const slugBase = String(brandName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 10) || 'prod';
    const productId = `${slugBase}-${crypto.randomBytes(2).toString('hex')}`;

    const product = await Product.create({
      productId,
      brandName: String(brandName).trim(),
      title: String(title).trim(),
      subtitle: String(subtitle || '').trim(),
      category: String(category || 'أفلام ومسلسلات').trim(),
      primaryColor: String(primaryColor || '#F47521').trim(),
      secondaryColor: String(secondaryColor || '#8A3A0A').trim(),
      iconText: String(iconText || String(brandName).slice(0, 1).toUpperCase()).trim(),
      imageUrl: String(imageUrl || '').trim(),
      badgeText: String(badgeText || '').trim(), // الشارة اختيارية؛ لا نفترض "فوري" لأن التسليم يدوي
      features, // لا نخترع مميزات؛ القسم يختفي من الصفحة إذا كان فارغًا
      steps: steps.length ? steps : DEFAULT_STEPS,
      plans,
      ...readLandingInput(req.body),
      active: true
    });

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'CREATE_PRODUCT',
      entity: 'Product',
      entityId: product.productId,
      summary: `إنشاء بطاقة منتج جديدة (${product.title})`
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء بطاقة العرض وصفحة الهبوط بنجاح!',
      product
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/products/:id', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف غير صالح.' });
    }
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'البطاقة غير موجودة.' });
    const beforeUpdate = productSnapshot(p);

    const {
      brandName,
      title,
      subtitle,
      category,
      primaryColor,
      secondaryColor,
      iconText,
      imageUrl,
      badgeText,
      featuresText,
      stepsText,
      plansText,
      active
    } = req.body || {};

    if (typeof brandName === 'string' && brandName.trim()) p.brandName = brandName.trim();
    if (typeof title === 'string' && title.trim()) p.title = title.trim();
    if (typeof subtitle === 'string') p.subtitle = subtitle.trim();
    if (typeof category === 'string' && category.trim()) p.category = category.trim();
    if (typeof primaryColor === 'string' && primaryColor.trim()) p.primaryColor = primaryColor.trim();
    if (typeof secondaryColor === 'string' && secondaryColor.trim()) p.secondaryColor = secondaryColor.trim();
    if (typeof iconText === 'string' && iconText.trim()) p.iconText = iconText.trim();
    if (typeof imageUrl === 'string') p.imageUrl = imageUrl.trim();
    if (typeof badgeText === 'string') p.badgeText = badgeText.trim(); // نص فارغ = إزالة الشارة
    if (typeof active === 'boolean') p.active = active;

    if (typeof featuresText === 'string') {
      const feats = featuresText.split('\n').map((s) => s.trim()).filter(Boolean);
      p.features = feats; // النص الفارغ يمسح المميزات؛ لا يظهر قسم بلا محتوى
    }

    if (typeof stepsText === 'string' && stepsText.trim()) {
      const parsedSteps = stepsText
        .split('\n')
        .map((line) => {
          const [t, d] = line.split('|').map((s) => s.trim());
          return t && d ? { title: t, desc: d } : null;
        })
        .filter(Boolean);
      if (parsedSteps.length) p.steps = parsedSteps;
    }

    if (typeof plansText === 'string' && plansText.trim()) {
      const plans = parsePlansInput(plansText);
      if (!plans.length) {
        return res.status(400).json({ success: false, message: 'صيغة الباقات غير صالحة.' });
      }
      p.plans = plans;
    }

    p.set(readLandingInput(req.body)); // حقول الهبوط: غير المُرسل لا يُمس، والنص الفارغ يحذف الحقل

    await p.save();
    if (JSON.stringify(beforeUpdate) !== JSON.stringify(productSnapshot(p))) {
      try {
        await ProductRevision.create({ productId: p._id, adminId: req.admin.telegramId,
          label: 'تعديل المنتج', snapshot: beforeUpdate });
      } catch (historyErr) {
        console.error('Failed to persist product revision:', historyErr.message);
      }
    }
    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_PRODUCT',
      entity: 'Product',
      entityId: p.productId,
      summary: `تعديل بطاقة المنتج (${p.title})`
    });

    res.json({ success: true, message: 'تم حفظ تعديلات البطاقة وصفحة الهبوط بنجاح!', product: p });
  } catch (err) {
    next(err);
  }
});

router.delete('/products/:id', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف غير صالح.' });
    }
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (deleted) {
      await recordAdminAudit({
        adminId: req.admin.telegramId,
        action: 'DELETE_PRODUCT',
        entity: 'Product',
        entityId: deleted.productId,
        summary: `حذف بطاقة المنتج (${deleted.title})`
      });
    }
    res.json({ success: true, message: 'تم حذف البطاقة نهائياً.' });
  } catch (err) {
    next(err);
  }
});

// أداء مصادر الزيارة (utm) خلال آخر 7/30/90 يومًا: عدد الطلبات والمؤكَّد منها والإيراد المؤكَّد.
// قراءة فقط ومجمّعة؛ لا تُرجع أي اسم أو هاتف أو بريد.
router.get('/marketing', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const since = new Date(Date.now() - days * 86400000);
    const PAID = ['مؤكد', 'تم التسليم'];
    const rows = await Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'ملغي' } } },
      { $group: {
        _id: { $ifNull: ['$source', ''] },
        orders: { $sum: 1 },
        paid: { $sum: { $cond: [{ $in: ['$status', PAID] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $in: ['$status', PAID] }, '$totalPrice', 0] } }
      } },
      { $sort: { orders: -1 } },
      { $limit: 50 }
    ]);
    res.json({ success: true, days, rows: rows.map((r) => ({ source: r._id || '', orders: r.orders, paid: r.paid, revenue: r.revenue })) });
  } catch (err) { next(err); }
});

// مراجعة تقييمات المشتريات الموثّقة قبل ظهورها للزوار
router.get('/reviews', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const reviews = await Review.find({}).sort({ approved: 1, createdAt: -1 }).limit(150).lean();
    res.json({ success: true, reviews: reviews.map((r) => ({ _id: r._id, productId: r.productId,
      displayName: r.displayName, stars: r.stars, comment: r.comment, approved: r.approved, createdAt: r.createdAt })) });
  } catch (err) { next(err); }
});
router.patch('/reviews/:id', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body?.approved !== 'boolean') {
      return res.status(400).json({ success: false, message: 'بيانات غير صالحة' });
    }
    const review = await Review.findByIdAndUpdate(req.params.id, { approved: req.body.approved }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: 'التقييم غير موجود' });
    await recordAdminAudit({ adminId: req.admin.telegramId, action: 'MODERATE_REVIEW',
      entity: 'Review', entityId: review._id, summary: review.approved ? 'نشر تقييم' : 'إخفاء تقييم' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 4. إدارة شكاوى الزبائن
router.get('/complaints', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const { status } = req.query || {};
    const filter = status && ['مفتوحة', 'تم الرد', 'مغلقة'].includes(status) ? { status } : {};
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, complaints });
  } catch (err) {
    next(err);
  }
});

router.post('/complaints/:id/reply', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف غير صالح.' });
    }
    const { reply, status } = req.body || {};
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'الشكوى غير موجودة.' });

    if (typeof reply === 'string' && reply.trim()) {
      complaint.adminReply = reply.trim().slice(0, 1500);
      complaint.repliedAt = new Date();
      complaint.status = 'تم الرد';
    }
    if (status && ['مفتوحة', 'تم الرد', 'مغلقة'].includes(status)) {
      complaint.status = status;
    }
    await complaint.save();

    if (complaint.adminReply && typeof notifyComplaintReply === 'function') {
      notifyComplaintReply(complaint).catch((e) => console.error('complaint reply notify error:', e.message));
    }

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'REPLY_COMPLAINT',
      entity: 'Complaint',
      entityId: complaint.ticketCode,
      summary: `الرد على التذكرة ${complaint.ticketCode} (${complaint.status})`
    });

    res.json({ success: true, message: 'تم حفظ الرد وإشعار الزبون بنجاح.', complaint });
  } catch (err) {
    next(err);
  }
});

// 5. إدارة الزبائن وحساباتهم وأرصدتهم (إغلاق A15 باستبعاد كافة أسرار 2FA)
router.get('/customers', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const { q } = req.query || {};
    const filter = {};
    if (typeof q === 'string' && q.trim()) {
      const rx = new RegExp(q.trim().slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }

    // استبعاد صارم لجميع الحقول الحساسة وأسرار 2FA (إغلاق A15)
    const projection = {
      passwordHash: 0,
      totpSecret: 0,
      totpPendingSecret: 0,
      otpCodeHash: 0,
      otpExpiresAt: 0,
      otpAttempts: 0,
      otpPurpose: 0,
      linkCode: 0,
      linkCodeExpiresAt: 0,
      failedLoginAttempts: 0,
      lockUntil: 0
    };

    const customers = await Customer.find(filter, projection).sort({ createdAt: -1 }).limit(100).lean();
    const ids = customers.map((c) => c._id);
    const orderStats = await Order.aggregate([
      // لا يُنسب طلب إلى عميل بسبب تطابق رقم أدخله زائر؛ customerId المثبت فقط.
      { $match: { customerId: { $in: ids } } },
      { $group: { _id: '$customerId', count: { $sum: 1 }, spent: { $sum: '$totalPrice' } } }
    ]);
    const statsMap = Object.fromEntries(orderStats.map((s) => [String(s._id), s]));

    const enriched = customers.map((c) => ({
      _id: c._id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      balance: c.balance || 0,
      blocked: !!c.blocked,
      twoFactorEnabled: !!c.twoFactorEnabled,
      twoFactorMethod: c.twoFactorMethod || '',
      telegramLinked: !!c.telegramChatId,
      createdAt: c.createdAt,
      ordersCount: (statsMap[String(c._id)] && statsMap[String(c._id)].count) || 0,
      totalSpent: (statsMap[String(c._id)] && statsMap[String(c._id)].spent) || 0
    }));

    res.json({ success: true, customers: enriched });
  } catch (err) {
    next(err);
  }
});

// تعديل الرصيد أو كلمة السر أو الحظر للزبون (للمالك فقط + تحديث ذري + إبطال الجلسات A13)
router.patch('/customers/:id', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف الزبون غير صالح.' });
    }
    const { balanceDelta, exactBalance, blocked, newPassword, name, email } = req.body || {};
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'الزبون غير موجود.' });

    const prevBalance = customer.balance || 0;
    let invalidateSession = false;

    if (typeof exactBalance === 'number' && Number.isFinite(exactBalance)) {
      customer.balance = Math.max(0, Math.round(exactBalance));
    } else if (typeof balanceDelta === 'number' && Number.isFinite(balanceDelta)) {
      customer.balance = Math.max(0, Math.round(prevBalance + balanceDelta));
    }

    if (typeof blocked === 'boolean') {
      if (blocked !== customer.blocked) invalidateSession = true;
      customer.blocked = blocked;
    }
    if (typeof name === 'string' && name.trim().length >= 3) customer.name = name.trim().slice(0, 80);
    if (typeof email === 'string') customer.email = email.trim().toLowerCase().slice(0, 150);
    if (typeof newPassword === 'string' && newPassword.length >= 6) {
      customer.passwordHash = await bcrypt.hash(newPassword, 12);
      customer.passwordChangedAt = new Date();
      invalidateSession = true;
    }

    if (invalidateSession) {
      customer.tokenVersion = (customer.tokenVersion || 0) + 1;
    }

    await customer.save();

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_CUSTOMER',
      entity: 'Customer',
      entityId: customer._id,
      summary: `تحديث حساب الزبون (${customer.name}) — الرصيد: ${prevBalance} -> ${customer.balance} DA`
    });

    res.json({
      success: true,
      message: 'تم تحديث حساب الزبون بنجاح.',
      customer: {
        _id: customer._id,
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        balance: customer.balance,
        blocked: customer.blocked
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/customers', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    const { name, phone, email, balance, password } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\s+/g, '');
    if (!name || !cleanPhone) return res.status(400).json({ success: false, message: 'الاسم ورقم الهاتف مطلوبان.' });

    const exists = await Customer.findOne({ phone: cleanPhone });
    if (exists) return res.status(400).json({ success: false, message: 'يوجد زبون مسجل بهذا الرقم مسبقاً.' });

    const passwordHash = password && String(password).length >= 6 ? await bcrypt.hash(String(password), 12) : undefined;
    const customer = await Customer.create({
      name: String(name).trim().slice(0, 80),
      phone: cleanPhone,
      email: email ? String(email).trim().toLowerCase() : undefined,
      balance: Math.max(0, Math.round(Number(balance) || 0)),
      passwordHash,
      phoneVerified: false // إدخال موظف ليس إثبات ملكية الهاتف
    });

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'CREATE_CUSTOMER',
      entity: 'Customer',
      entityId: customer._id,
      summary: `إضافة زبون جديد (${customer.name}) برصيد ابتدائي ${customer.balance} DA`
    });

    res.status(201).json({ success: true, message: 'تمت إضافة الزبون بنجاح.', customer });
  } catch (err) {
    next(err);
  }
});

// إدارة الاشتراكات والتجديدات — لا تعيد أسرار الحسابات المسلمة للمتصفح
router.get('/renewals', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const filter = ['all', 'urgent', 'expired', 'expiring_soon', 'active'].includes(req.query.filter)
      ? req.query.filter : 'urgent';
    const data = await getRenewalsList({ filter, limit: 200 });
    const renewals = data.renewals.map(({ deliveredAccount, telegramChatId, ...entry }) => ({
      ...entry,
      profileName: deliveredAccount && deliveredAccount.profileName || ''
    }));
    res.json({ success: true, renewals, counts: data.counts });
  } catch (err) { next(err); }
});

router.post('/renewals/:id/remind', requireAdmin, requireRole(['owner', 'staff']), twoFaLimiter, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرف الاشتراك غير صالح.' });
    }
    const order = await Order.findOne({ _id: req.params.id, status: 'تم التسليم' }).lean();
    if (!order) return res.status(404).json({ success: false, message: 'الاشتراك غير موجود أو لم يُسلّم بعد.' });
    const result = await sendTelegramRenewalReminder(bot, order);
    if (!result.sentTelegram) {
      return res.status(400).json({ success: false, message: 'لم يتم إرسال التذكير؛ تأكد من ربط الزبون ببوت تيليغرام. استخدم واتساب بدلاً من ذلك.' });
    }
    await recordAdminAudit({ adminId: req.admin.telegramId, action: 'SEND_RENEWAL_REMINDER',
      entity: 'Order', entityId: order.orderCode, summary: 'إرسال تذكير تجديد عبر تيليغرام' });
    res.json({ success: true, message: 'تم إرسال تذكير التجديد عبر تيليغرام.' });
  } catch (err) { next(err); }
});

// 6. إدارة طرق الدفع (إصلاح العقد F03 + حصرها بالمالك فقط)
router.get('/payment-methods', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    const getter = paymentMethodsSvc.getAdminPaymentMethods || paymentMethodsSvc.getAllPaymentMethodsForAdmin;
    const data = await getter();
    const methods = Array.isArray(data) ? data : (data && data.methods) || [];
    res.json({ success: true, methods });
  } catch (err) {
    next(err);
  }
});

router.post('/payment-methods', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    const inputMethods = req.body && req.body.methods;
    const result = await paymentMethodsSvc.savePaymentMethods(inputMethods);
    const methods = Array.isArray(result) ? result : (result && result.methods) || [];

    const enabledList = methods.filter((m) => m.enabled).map((m) => m.id).join(', ') || 'لا شيء';
    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_PAYMENT_METHODS',
      entity: 'Setting',
      entityId: 'payment_methods',
      summary: `تحديث طرق الدفع (المفعّلة: ${enabledList})`
    });

    res.json({
      success: true,
      message: 'تم حفظ إعدادات طرق الدفع بنجاح ✓',
      methods
    });
  } catch (err) {
    if (err.code === 'INVALID_INPUT' || err.code === 'NO_VISIBLE_METHOD') {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// 7. إعدادات شارجيلي وبيانات المدير وحالة التحقق بخطوتين (للمالك فقط)
router.get('/settings', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    const [cfg, adminDoc] = await Promise.all([
      getChargilyConfig(),
      Admin.findById(req.admin.id).lean()
    ]);
    const publicServerUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `https://${req.get('host')}`).replace(/\/$/, '');

    res.json({
      success: true,
      chargily: {
        mode: cfg.mode,
        enabled: cfg.enabled,
        testPublicKey: cfg.testPublicKey,
        testSecretKey: cfg.testSecretKey ? cfg.testSecretKey.slice(0, 8) + '***' + cfg.testSecretKey.slice(-4) : '',
        livePublicKey: cfg.livePublicKey,
        liveSecretKey: cfg.liveSecretKey ? cfg.liveSecretKey.slice(0, 8) + '***' + cfg.liveSecretKey.slice(-4) : '',
        webhookUrl: `${publicServerUrl}/api/orders/chargily-webhook`
      },
      adminSecurity: {
        email: (adminDoc && adminDoc.email) || req.admin.email || '',
        telegramId: (adminDoc && adminDoc.telegramId) || req.admin.telegramId || '',
        twoFactorEnabled: !!(adminDoc && adminDoc.twoFactorEnabled),
        twoFactorMethod: (adminDoc && adminDoc.twoFactorMethod) || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/chargily', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    const updated = await saveChargilyConfig(req.body || {});
    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_CHARGILY_SETTINGS',
      entity: 'Setting',
      entityId: 'chargily_config',
      summary: `تحديث إعدادات شارجيلي (الوضع: ${updated.mode})`
    });
    res.json({
      success: true,
      message: `تم حفظ إعدادات شارجيلي بنجاح (الوضع الحالي: ${updated.mode === 'live' ? 'حقيقي Live' : 'تجريبي Test'})`
    });
  } catch (err) {
    next(err);
  }
});

// تغيير البريد وكلمة السر للمدير (يتطلب إبطال الجلسات القديمة A13)
router.post('/settings/credentials', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    const { currentPassword, newEmail, newPassword } = req.body || {};
    if (!newEmail || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'أدخل بريداً صحيحاً وكلمة سر جديدة من 8 أحرف على الأقل.' });
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ success: false, message: 'الحساب غير موجود.' });

    // إعادة المصادقة إلزامية دائماً عند تغيير بيانات المدير
    if (typeof currentPassword !== 'string' || !currentPassword || !admin.passwordHash ||
        !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      return res.status(401).json({ success: false, message: 'أدخل كلمة السر الحالية الصحيحة لإتمام التغيير.' });
    }

    admin.email = String(newEmail).trim().toLowerCase();
    admin.passwordHash = await bcrypt.hash(String(newPassword), 12);
    admin.passwordChangedAt = new Date();
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await admin.save();

    await recordAdminAudit({
      adminId: admin.telegramId,
      action: 'UPDATE_ADMIN_CREDENTIALS',
      entity: 'Admin',
      entityId: admin._id,
      summary: 'تحديث البريد الإلكتروني وكلمة السر للمالك وإبطال الجلسات السابقة'
    });

    res.json({
      success: true,
      token: signAdminSessionToken(admin),
      message: 'تم تحديث البريد وكلمة السر وإبطال الجلسات القديمة بنجاح!'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/clean-db', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  // Old admin database wipe is permanently disabled in the upgraded site.
  return res.status(403).json({success:false,code:'DESTRUCTIVE_ACTION_DISABLED',message:'حذف بيانات الإنتاج غير مسموح من لوحة التحكم.'});
  // حماية الإنتاج: المسح لا يُفتح من لوحة عامة، ويستلزم تصريحًا تشغيليًا صريحًا.
  if (process.env.ALLOW_DESTRUCTIVE_ADMIN_CLEANUP !== 'true') return res.status(403).json({ success:false, message:'تم تعطيل التنظيف الشامل لحماية بيانات الإنتاج.' });
  try {
    const { deleteOrders } = req.body || {};
    const delAdmins = await Admin.deleteMany({ _id: { $ne: req.admin.id } });
    let delOrdersCount = 0;
    if (deleteOrders) {
      const delOrd = await Order.deleteMany({});
      delOrdersCount = delOrd.deletedCount;
      await Complaint.deleteMany({});
    }
    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'CLEAN_DATABASE',
      entity: 'System',
      entityId: 'clean-db',
      summary: `تنظيف قاعدة البيانات (حذف ${delAdmins.deletedCount} حساب إداري، و ${delOrdersCount} طلب)`
    });
    res.json({
      success: true,
      message: `تم التنظيف بنجاح! (حُذف ${delAdmins.deletedCount} حساب إداري وهمي، و ${delOrdersCount} طلب).`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.requireAdmin = requireAdmin;
module.exports.requireRole = requireRole;
