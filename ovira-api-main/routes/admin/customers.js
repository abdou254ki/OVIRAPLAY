'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../../models/Customer');
const Complaint = require('../../models/Complaint');
const Review = require('../../models/Review');
const Order = require('../../models/Order');
const { bot, notifyComplaintReply } = require('../../bot/telegram');
const {
  PAGE_SIZE,
  recordAdminAudit,
  requireAdmin,
  requireRole
} = require('./middlewares');

const router = express.Router();

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
module.exports = router;
