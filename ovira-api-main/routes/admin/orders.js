'use strict';

const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Order = require('../../models/Order');
const { STATUSES } = require('../../models/Order');
const Complaint = require('../../models/Complaint');
const Customer = require('../../models/Customer');
const Audit = require('../../models/Audit');
const Product = require('../../models/Product');
const Stock = require('../../models/Stock');
const { setStatus, deliverOrderAccount } = require('../../services/orderService');
const stockService = require('../../services/stockService');
const { matchesHistoricalPurchase } = require('../../services/historicalLinkPolicy');
const { bot } = require('../../bot/telegram');
const {
  PAGE_SIZE,
  recordAdminAudit,
  requireAdmin,
  requireRole,
  twoFaLimiter
} = require('./middlewares');

const router = express.Router();

// فلتر الطلبات المتقدم (يدعم الحالات، والبحث، والتواريخ، والجدولة)
const buildFilter = (query) => {
  const { status, q, from, to, scheduled, scheduledUpcoming } = query || {};
  const filter = {};

  if (query && query.scope === 'delivered') {
    filter.status = 'تم التسليم';
  } else if (scheduled === 'true' || scheduled === '1') {
    filter.scheduledFor = { $exists: true, $ne: null };
  } else if (STATUSES.includes(status) && status !== 'تم التسليم') {
    filter.status = status;
  } else {
    filter.status = { $ne: 'تم التسليم' };
  }

  if (scheduledUpcoming === 'true') {
    filter.scheduledFor = { $gte: new Date() };
  }

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

// 1. جلب قائمة الطلبات
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

// 2. إنشاء طلب يدوي من لوحة التحكم (Phase 3.2 أ)
router.post('/orders/manual', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const {
      productId,
      planId,
      productName,
      months = 1,
      price,
      quantity = 1,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod = 'يدوي / إداري',
      paymentStatus = 'paid',
      requestedAt,
      scheduledFor,
      timezone = 'Africa/Algiers',
      scheduleNote,
      adminNote,
      idempotencyKey,
      autoAssignStock = false
    } = req.body || {};

    if (!customerName || !customerPhone) {
      return res.status(400).json({ success: false, message: 'اسم الزبون ورقم الهاتف/الواتساب مطلوبان.' });
    }

    // التحقق من مفتاح منع التكرار (Idempotency)
    if (idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey }).lean();
      if (existing) {
        return res.json({ success: true, order: existing, message: 'تم استرجاع الطلب المسجل مسبقاً.' });
      }
    }

    // جلب بيانات المنتج إن وجدت
    let prodDoc = null;
    if (productId && mongoose.isValidObjectId(productId)) {
      prodDoc = await Product.findById(productId).lean();
    } else if (productId) {
      prodDoc = await Product.findOne({ productId }).lean();
    }

    const resolvedTitle = prodDoc ? prodDoc.title : (productName || 'طلب يدوي');
    const unitPrice = Number(price) >= 0 ? Number(price) : (prodDoc?.plans?.[0]?.price || 0);
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const totalPrice = unitPrice * qty;

    const orderCode = 'OP-M' + crypto.randomBytes(3).toString('hex').toUpperCase();

    // ربط الحساب إذا وجد أو جلب العميل برقم الهاتف
    let linkedCustomerId = customerId && mongoose.isValidObjectId(customerId) ? customerId : null;
    if (!linkedCustomerId) {
      const cleanPhone = String(customerPhone).trim();
      const existingCust = await Customer.findOne({ $or: [{ phone: cleanPhone }, { whatsapp: cleanPhone }] });
      if (existingCust) {
        linkedCustomerId = existingCust._id;
      }
    }

    const initialStatus = paymentStatus === 'paid' ? 'مؤكد' : 'قيد المراجعة';

    const orderData = {
      orderCode,
      customerName: String(customerName).trim(),
      whatsappNumber: String(customerPhone).trim(),
      customerEmail: customerEmail ? String(customerEmail).trim().toLowerCase() : '',
      customerId: linkedCustomerId,
      cartItems: [{
        productId: prodDoc ? String(prodDoc._id) : (productId || 'custom'),
        productName: resolvedTitle,
        planId: planId || 'manual-plan',
        months: Number(months) || 1,
        quantity: qty,
        price: unitPrice
      }],
      totalPrice,
      paymentMethod: String(paymentMethod || 'يدوي / إداري'),
      status: initialStatus,
      deliveryState: paymentStatus === 'paid' ? 'ready_to_deliver' : 'pending_payment',
      adminNote: adminNote ? String(adminNote).trim() : '',
      idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
      requestedAt: requestedAt ? new Date(requestedAt) : undefined,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      timezone: timezone || 'Africa/Algiers',
      scheduleNote: scheduleNote ? String(scheduleNote).trim() : ''
    };

    let order = await Order.create(orderData);

    // تخصيص المخزون تلقائياً إذا طُلب ذلك
    if (autoAssignStock && paymentStatus === 'paid') {
      try {
        const stockResult = await stockService.assignSlotsForOrder(order);
        order.deliveryAccount = {
          type: 'account',
          credentials: stockResult.credentials,
          deliveredAt: new Date()
        };
        order.allocatedSlots = stockResult.assignedSlots;
        order.deliveryState = 'delivered';
        order.status = 'تم التسليم';
        await order.save();
      } catch (stErr) {
        console.warn('Manual order auto-assign stock skipped:', stErr.message);
      }
    }

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'CREATE_MANUAL_ORDER',
      entity: 'Order',
      entityId: order.orderCode,
      summary: `إنشاء طلب يدوي ${order.orderCode} للعميل ${order.customerName} بقيمة ${totalPrice} دج`
    });

    if (bot && process.env.TELEGRAM_ADMIN_IDS) {
      try {
        const mainId = Number(process.env.TELEGRAM_ADMIN_IDS.split(',')[0].trim());
        if (mainId) {
          bot.telegram.sendMessage(mainId, `➕ *طلب يدوي جديد*\nكود: \`${order.orderCode}\`\nالعميل: ${order.customerName}\nالمبلغ: ${totalPrice} دج\nالحالة: ${order.status}`, { parse_mode: 'Markdown' }).catch(() => {});
        }
      } catch (_) {}
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب اليدوي بنجاح!',
      order
    });
  } catch (err) {
    next(err);
  }
});

// 3. مرشحو ربط الطلب بالحساب
router.get('/orders/:id/link-candidates', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(400);
    const order = await Order.findById(req.params.id).select('status customerId customerEmail whatsappNumber orderCode').lean();
    if (!order) return res.sendStatus(404);
    if (order.status !== 'تم التسليم' || order.customerId) return res.status(409).json({ success: false, code: 'ORDER_NOT_ELIGIBLE' });
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q.length < 3) return res.status(400).json({ success: false, code: 'SEARCH_TERM_TOO_SHORT' });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const candidates = await Customer.find({ blocked: { $ne: true }, $or: [{ email: rx }, { phone: rx }, { name: rx }] }).select('name email phone emailVerified phoneVerified').limit(20).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, candidates: candidates.map(c => ({ id: c._id, name: c.name, email: c.email || '', phone: c.phone || '', match: matchesHistoricalPurchase(order, c) })) });
  } catch (e) {
    next(e);
  }
});

// 4. ربط الطلب بالعميل مع قفل ذري
router.post('/orders/:id/link-customer', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.body?.customerId)) return res.sendStatus(400);
    if (req.body?.confirm !== 'LINK_ORDER_TO_ACCOUNT') return res.status(400).json({ success: false, code: 'CONFIRMATION_REQUIRED' });
    const { requireStepUp } = require('../../services/agentCredentialService');
    await requireStepUp(req.admin.id, req.body.currentPassword, req.body.code);
    const customer = await Customer.findById(req.body.customerId).select('name email phone emailVerified phoneVerified blocked').lean();
    if (!customer || customer.blocked) return res.status(404).json({ success: false, code: 'CUSTOMER_NOT_FOUND' });
    const order = await Order.findById(req.params.id).select('orderCode status customerId customerEmail whatsappNumber').lean();
    if (!order) return res.status(404).json({ success: false, code: 'ORDER_NOT_FOUND' });
    if (order.status !== 'تم التسليم' || order.customerId) return res.status(409).json({ success: false, code: 'ORDER_NOT_ELIGIBLE' });
    const match = matchesHistoricalPurchase(order, customer);
    if (!match.email && !match.phone) return res.status(409).json({ success: false, code: 'IDENTITY_NOT_MATCHED', message: 'لا يتطابق البريد أو الهاتف مع بيانات الطلب؛ لم يُجرَ الربط.' });
    if (!match.verified) {
      const note = String(req.body?.evidenceNote || '').trim();
      if (note.length < 20 || note.length > 300) return res.status(428).json({ success: false, code: 'OWNERSHIP_PROOF_REQUIRED', message: 'الحساب لا يتضمن وسيلة اتصال موثقة مطابقة. يلزم إثبات ملكية مستقل وملاحظة إدارية مفصلة (20 حرفاً على الأقل).' });
    }
    const session = await mongoose.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        updated = await Order.findOneAndUpdate({ _id: order._id, status: 'تم التسليم', customerId: null }, { $set: { customerId: customer._id } }, { new: true, session });
        if (!updated) { const err = new Error('ALREADY_LINKED'); err.code = 'ALREADY_LINKED'; throw err; }
        await Audit.create([{ adminId: Number(req.admin.telegramId) || 0, action: 'DELIVERED_ORDER_LINKED', entity: 'Order', entityId: order.orderCode, summary: `ربط يدوي بالحساب ${String(customer._id)}؛ إثبات ${match.verified ? 'مطابقة مؤكدة' : 'مراجعة مستقلة: ' + String(req.body.evidenceNote).trim().slice(0, 180)}` }], { session });
      });
    } finally {
      await session.endSession();
    }
    try {
      await require('../../models/SiteNotification').updateOne({ customerId: customer._id, dedupeKey: 'linked-order:' + order._id }, { $setOnInsert: { customerId: customer._id, kind: 'order', title: 'إضافة طلب سابق إلى حسابك', body: `تم ربط الطلب ${String(order.orderCode).slice(0, 32)} بحسابك. يمكنك مراجعته في «طلباتي».`, link: '#/account', dedupeKey: 'linked-order:' + order._id, createdBy: req.admin.id } }, { upsert: true });
    } catch (e) { console.error('[link-order] notification unavailable:', e.code || e.name); }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, orderId: updated._id, customerId: customer._id });
  } catch (e) {
    if (e.code === 'ALREADY_LINKED') return res.status(409).json({ success: false, code: 'ALREADY_LINKED' });
    if (e.httpStatus) return res.status(e.httpStatus).json({ success: false, code: e.code, message: e.message });
    next(e);
  }
});

// 5. تعديل حالة الطلب والملاحظة الإدارية (مع تحرير المخزون عند الإلغاء)
router.patch('/orders/:id', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const { status, adminNote, scheduledFor, requestedAt, scheduleNote } = req.body || {};
    const validStatus = status !== undefined && STATUSES.includes(status);
    const validNote = typeof adminNote === 'string' && adminNote.length <= 300;
    if (!mongoose.isValidObjectId(req.params.id) || (!validStatus && !validNote && !scheduledFor)) {
      return res.status(400).json({ success: false, message: 'بيانات غير صالحة.' });
    }
    let order = validStatus ? await setStatus(req.params.id, status, 'panel', req.admin.telegramId) : await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });

    if (validNote) {
      order.adminNote = adminNote.trim();
    }
    if (scheduledFor) order.scheduledFor = new Date(scheduledFor);
    if (requestedAt) order.requestedAt = new Date(requestedAt);
    if (scheduleNote) order.scheduleNote = String(scheduleNote).trim();

    // إذا تم إلغاء الطلب: تحرير أي شاشات مخصصة من المخزون
    if (status === 'ملغي') {
      try {
        await Stock.updateMany(
          { 'slots.orderId': order._id },
          {
            $set: {
              'slots.$[elem].status': 'available',
              'slots.$[elem].orderId': null,
              'slots.$[elem].orderCode': '',
              'slots.$[elem].customerName': '',
              'slots.$[elem].customerPhone': ''
            }
          },
          { arrayFilters: [{ 'elem.orderId': order._id }] }
        );
        order.deliveryState = 'cancelled';
        order.allocatedSlots = [];
      } catch (relErr) {
        console.error('Failed to release slots for cancelled order:', relErr.message);
      }
    }

    await order.save();

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_ORDER',
      entity: 'Order',
      entityId: order.orderCode,
      summary: `تحديث الطلب ${order.orderCode} (${validStatus ? 'الحالة: ' + status : 'ملاحظة'})`
    });

    if (validStatus && order.customerId) {
      try {
        await require('../../models/SiteNotification').findOneAndUpdate({ customerId: order.customerId, dedupeKey: `order:${order._id}:${String(status)}:${(order.history || []).length}` },
          { $setOnInsert: { customerId: order.customerId, kind: 'order', title: 'تحديث حالة طلبك', body: `تم تحديث حالة طلب ${String(order.orderCode).slice(0, 30)} إلى: ${status}. التفاصيل داخل حسابي.`, link: '#/account' } },
          { upsert: true, new: true, setDefaultsOnInsert: true });
      } catch (e) { console.error('[site-notification] order status notice failed:', e.code || e.name); }
    }
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// 6. تسليم بيانات الحساب للطلب (يدعم التعيين من المخزون)
router.post('/orders/:id/deliver', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const { type = 'screen', credentials, profileName, pinCode, invitationUrl, extraNote, fromStock } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرف الطلب غير صالح.' });
    }

    let finalCreds = credentials;
    let finalProfile = profileName;
    let finalPin = pinCode;
    let allocatedSlots = [];

    // إذا طُلب التعيين التلقائي من المخزون
    if (fromStock || (!credentials && type === 'screen')) {
      const orderDoc = await Order.findById(req.params.id);
      if (!orderDoc) return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
      const stockRes = await stockService.assignSlotsForOrder(orderDoc);
      finalCreds = stockRes.credentials;
      allocatedSlots = stockRes.assignedSlots;
      if (stockRes.assignedSlots && stockRes.assignedSlots[0]) {
        finalProfile = stockRes.assignedSlots[0].profileName;
        finalPin = stockRes.assignedSlots[0].pin;
      }
    }

    if (!['account', 'screen', 'invite'].includes(type) ||
        (type !== 'invite' && (!finalCreds || String(finalCreds).trim().length < 3)) ||
        (type === 'invite' && !/^https:\/\/[^\s]+$/i.test(String(invitationUrl || '')))) {
      return res.status(400).json({ success: false, message: 'أدخل بيانات الحساب (البريد وكلمة المرور) أو استخدم المخزون المتاح.' });
    }

    const order = await deliverOrderAccount(req.params.id, {
      type,
      credentials: finalCreds,
      invitationUrl,
      profileName: finalProfile,
      pinCode: finalPin,
      extraNote,
      by: 'panel',
      adminId: req.admin.telegramId
    });
    if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });

    if (allocatedSlots.length) {
      order.allocatedSlots = allocatedSlots;
      order.deliveryState = 'delivered';
      await order.save();
    }

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'DELIVER_ORDER',
      entity: 'Order',
      entityId: order.orderCode,
      summary: `تسليم بيانات الحساب والشاشة للطلب ${order.orderCode}`
    });

    if (order.customerId) {
      try {
        await require('../../models/SiteNotification').findOneAndUpdate({ customerId: order.customerId, dedupeKey: `delivered:${order._id}` },
          { $setOnInsert: { customerId: order.customerId, kind: 'order', title: 'تم تجهيز طلبك', body: `طلب ${String(order.orderCode).slice(0, 30)} جاهز. افتح «حسابي» للاطلاع على تفاصيل التسليم بطريقة آمنة.`, link: '#/account' } },
          { upsert: true, new: true, setDefaultsOnInsert: true });
      } catch (e) { console.error('[site-notification] delivery notice failed:', e.code || e.name); }
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

// 7. إرسال رمز دخول مؤقت
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

// 8. حذف الطلب نهائياً مع تحرير أي مخزون مرتبط
router.delete('/orders/:id', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف الطلب غير صالح.' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });

    // تحرير المخزون إن وُجد
    try {
      await Stock.updateMany(
        { 'slots.orderId': order._id },
        {
          $set: {
            'slots.$[elem].status': 'available',
            'slots.$[elem].orderId': null,
            'slots.$[elem].orderCode': ''
          }
        },
        { arrayFilters: [{ 'elem.orderId': order._id }] }
      );
    } catch (stErr) {
      console.warn('Failed to release stock on order deletion:', stErr.message);
    }

    await Order.findByIdAndDelete(req.params.id);

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'DELETE_ORDER',
      entity: 'Order',
      entityId: order.orderCode,
      summary: `حذف الطلب ${order.orderCode} نهائياً`
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.buildFilter = buildFilter;
