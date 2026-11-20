'use strict';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const Admin = require('../../models/Admin');
const { ADMIN_ROLES } = require('../../models/Admin');
const Audit = require('../../models/Audit');
const { ensureSeedProducts } = require('../../services/productService');

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

module.exports = {
  PAGE_SIZE,
  MAX_LOGIN_ATTEMPTS,
  LOCK_TIME_MS,
  MAX_OTP_ATTEMPTS,
  recordAdminAudit,
  migrateOwner,
  loginLimiter,
  twoFaLimiter,
  adminApiLimiter,
  signAdminSessionToken,
  requireAdmin,
  requireRole
};
