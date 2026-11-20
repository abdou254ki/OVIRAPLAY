'use strict';

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const Product = require('../../models/Product');
const Complaint = require('../../models/Complaint');
const Audit = require('../../models/Audit');
const Admin = require('../../models/Admin');
const { getRenewalsList, sendTelegramRenewalReminder } = require('../../services/renewalService');
const { getChargilyConfig, saveChargilyConfig } = require('../../services/chargilyService');
const paymentMethodsSvc = require('../../services/paymentMethodsService');
const {
  PAGE_SIZE,
  recordAdminAudit,
  requireAdmin,
  requireRole,
  twoFaLimiter
} = require('./middlewares');

const router = express.Router();

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
module.exports = router;
