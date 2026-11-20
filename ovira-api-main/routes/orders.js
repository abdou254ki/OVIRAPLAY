const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { getPublicMethods } = require('../services/paymentMethodsService');
const { notifyNewOrder } = require('../bot/telegram');
const { setStatus, notifyChargilyPaymentSuccess } = require('../services/orderService');
const { getPublicDeliveryStats } = require('../services/publicStatsService');
const { ensureSeedProducts, formatProductForFrontend, planKey } = require('../services/productService');
const {
  getChargilyConfig,
  createCheckoutSession,
  verifyCheckoutStatus,
  extractPaymentDetails,
  verifyWebhookSignature
} = require('../services/chargilyService');

const router = express.Router();
const PHONE_RE = /^0[567]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizePhone = (s) =>
  String(s || '')
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632)
    .replace(/[\s\-().]/g, '')
    .replace(/^(\+|00)?213/, '0');

// مصدر الزيارة القادم من الواجهة (utm): حروف وأرقام وبعض الرموز فقط، بحد أقصى 80 حرفًا.
const sanitizeSource = (v) =>
  typeof v === 'string' ? v.replace(/[^A-Za-z0-9 _.:|/+\-]/g, '').trim().slice(0, 80) : '';

const genCode = () => 'OP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
const fail = (res, status, message, errors) => res.status(status).json({ success: false, message, ...(errors && { errors }) });

function getOptionalCustomer(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(h.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return decoded && decoded.role === 'customer' ? decoded : null;
  } catch {
    return null;
  }
}

// جلب جميع بطاقات العرض وصفحات الهبوط النشطة للمتجر
router.get('/catalog', async (req, res, next) => {
  try {
    await ensureSeedProducts();
    const products = await Product.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    // تخزين قصير عند المتصفح يخفف الضغط على الخادم؛ ETag يتولى التحقق السريع بعده.
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      products: products.map(formatProductForFrontend)
    });
  } catch (err) {
    next(err);
  }
});

// ملخص التقييمات المعتمدة لكل المنتجات دفعة واحدة (أرقام مجمّعة فقط).
router.get('/reviews-summary', async (req, res, next) => {
  try {
    const rows = await Review.aggregate([
      { $match: { approved: true } },
      { $group: {
        _id: '$productId',
        count: { $sum: 1 },
        average: { $avg: '$stars' },
        one:   { $sum: { $cond: [{ $eq: ['$stars', 1] }, 1, 0] } },
        two:   { $sum: { $cond: [{ $eq: ['$stars', 2] }, 1, 0] } },
        three: { $sum: { $cond: [{ $eq: ['$stars', 3] }, 1, 0] } },
        four:  { $sum: { $cond: [{ $eq: ['$stars', 4] }, 1, 0] } },
        five:  { $sum: { $cond: [{ $eq: ['$stars', 5] }, 1, 0] } }
      } }
    ]);

    const summary = {};
    for (const r of rows) {
      summary[r._id] = {
        count: r.count,
        average: Number(r.average.toFixed(1))
      };
      if ([r.one, r.two, r.three, r.four, r.five].some((v) => v !== undefined)) {
        summary[r._id].distribution = { 1: r.one, 2: r.two, 3: r.three, 4: r.four, 5: r.five };
      }
    }

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ success: true, summary });
  } catch (err) { next(err); }
});

// زمن التسليم الفعلي المسجّل (من تأكيد الدفع إلى التسليم). يرجع null إذا كانت العينة صغيرة.
router.get('/delivery-stats', async (req, res, next) => {
  try {
    const stats = await getPublicDeliveryStats();
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ success: true, stats });
  } catch (err) { next(err); }
});

// تقييمات الزبائن الموافق عليها فقط، دون هاتف أو بريد إلكتروني.
router.get('/reviews/:productId', async (req, res, next) => {
  try {
    const productId = String(req.params.productId || '').slice(0, 80);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(12, Math.max(1, Number.parseInt(req.query.limit, 10) || 6));
    const skip = (page - 1) * pageSize;
    const filter = { productId, approved: true };

    const [rows, totals] = await Promise.all([
      Review.find(filter)
        .select('displayName stars comment createdAt -_id')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      page === 1
        ? Review.aggregate([
            { $match: filter },
            { $group: {
              _id: null,
              count: { $sum: 1 },
              average: { $avg: '$stars' },
              one:   { $sum: { $cond: [{ $eq: ['$stars', 1] }, 1, 0] } },
              two:   { $sum: { $cond: [{ $eq: ['$stars', 2] }, 1, 0] } },
              three: { $sum: { $cond: [{ $eq: ['$stars', 3] }, 1, 0] } },
              four:  { $sum: { $cond: [{ $eq: ['$stars', 4] }, 1, 0] } },
              five:  { $sum: { $cond: [{ $eq: ['$stars', 5] }, 1, 0] } }
            } }
          ])
        : Review.countDocuments(filter).then((count) => [{ count }])
    ]);

    const stats = totals[0] || {};
    const count = Number(stats.count) || 0;
    const payload = {
      success: true,
      reviews: rows,
      count,
      page,
      pageSize,
      hasMore: skip + rows.length < count
    };

    // Calculate the full rating breakdown only once, on the first page.
    if (page === 1 && count > 0) {
      payload.average = Number(stats.average.toFixed(1));
      payload.distribution = {
        1: Number(stats.one) || 0,
        2: Number(stats.two) || 0,
        3: Number(stats.three) || 0,
        4: Number(stats.four) || 0,
        5: Number(stats.five) || 0
      };
    }

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json(payload);
  } catch (err) { next(err); }
});

// جلب إعدادات الدفع العامة للواجهة
router.get('/payment-config', async (req, res, next) => {
  try {
    const [cfg, methods] = await Promise.all([getChargilyConfig(), getPublicMethods()]);
    res.json({
      success: true,
      chargily: {
        enabled: cfg.enabled && !!cfg.secretKey,
        mode: cfg.mode,
        publicKey: cfg.publicKey
      },
      // طرق الدفع الظاهرة فقط (المعطّلة لا تُرسل أبداً)
      methods
    });
  } catch (err) {
    next(err);
  }
});

// إنشاء طلب جديد (يدعم البطاقات الجديدة المضافة من تيليغرام أو لوحة التحكم)
router.post('/', async (req, res, next) => {
  try {
    await ensureSeedProducts();
    const { customerName, whatsappNumber, customerEmail, cartItems, totalPrice, paymentMethod, source } = req.body || {};
    const errors = [];

    const name = typeof customerName === 'string' ? customerName.trim() : '';
    if (name.length < 3 || name.length > 80) errors.push('الاسم الكامل مطلوب (3 إلى 80 حرفًا).');

    const phone = typeof whatsappNumber === 'string' ? normalizePhone(whatsappNumber) : '';
    if (!PHONE_RE.test(phone)) errors.push('رقم واتساب غير صالح.');

    const email = typeof customerEmail === 'string' ? customerEmail.trim().toLowerCase() : '';
    if (!email || !EMAIL_RE.test(email)) errors.push('البريد الإلكتروني الشخصي مطلوب وبصيغة صحيحة.');

    const availableMethods = await getPublicMethods();
    if (!availableMethods.some((m) => m.name === paymentMethod)) {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_UNAVAILABLE',
        message: 'طريقة الدفع المختارة غير متاحة حالياً، اختر طريقة أخرى.'
      });
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0 || cartItems.length > 20) {
      errors.push('السلة فارغة أو غير صالحة.');
    }
    if (errors.length) return fail(res, 400, errors[0], errors);

    let computedTotal = 0;
    const items = [];
    for (const it of cartItems) {
      const id = String((it && it.id) || '').toLowerCase();
      const monthsNum = Number(it && it.m);
      const qty = Number(it && it.q);
      const requestedKey = typeof it?.k === 'string' ? it.k : '';
      let selectedPlanKey = '', selectedPlanLabel = '';

      if (!id || !Number.isInteger(monthsNum) || !Number.isInteger(qty) || qty < 1 || qty > 9) {
        return fail(res, 400, 'عنصر غير صالح في السلة.');
      }

      // البحث في قاعدة البيانات أولاً ثم في الملف الاحتياطي
      const dbProd = await Product.findOne({ productId: id, active: true }).lean();
      let productName = '';
      let unitPrice = null;

      if (dbProd) {
        productName = dbProd.title;
        const foundPlan = (dbProd.plans || []).find((p) => Number(p.months) === monthsNum && (!requestedKey || planKey(p) === requestedKey));
        if (foundPlan) { unitPrice = Number(foundPlan.price); selectedPlanKey = planKey(foundPlan); selectedPlanLabel = foundPlan.label || ''; }
      }

      if (dbProd && !requestedKey && dbProd.plans.filter((p) => Number(p.months) === monthsNum).length > 1) {
        return fail(res, 400, 'اختر نوع الباقة مجددًا (خاص أو مشترك) من أحدث نسخة للمتجر.');
      }
      if (unitPrice === null || isNaN(unitPrice)) {
        return fail(res, 400, 'الباقة المختارة غير متوفرة حالياً، حدّث الصفحة.');
      }

      computedTotal += unitPrice * qty;
      items.push({ productId: id, productName, months: monthsNum, quantity: qty, unitPrice, planKey: selectedPlanKey, planLabel: selectedPlanLabel });
    }

    if (Number(totalPrice) !== computedTotal) {
      return fail(res, 400, 'السعر الإجمالي غير مطابق، حدّث الصفحة وأعد المحاولة.');
    }

    // دفاع تدريجي ضد الطلبات الوهمية؛ HMAC يمنع حفظ IP صريح في سجل الطلب.
    const actorHash = crypto.createHmac('sha256', process.env.JWT_SECRET || 'no-secret')
      .update(String(req.ip || 'unknown')).digest('hex');
    const sameFingerprint = crypto.createHmac('sha256', process.env.JWT_SECRET || 'no-secret')
      .update(phone + '|' + paymentMethod + '|' + items.map((x) => x.productId + ':' + x.months + ':' + x.planKey + ':' + x.quantity).join('|'))
      .digest('hex');
    const authCust = getOptionalCustomer(req);
    let linkedCustomer = null;
    if (authCust && authCust.id) {
      linkedCustomer = await Customer.findById(authCust.id);
    }
    // لا تربط طلب ضيف بحساب زبون آخر بناءً على رقم هاتف غير مثبت.
    if (authCust && (!linkedCustomer || linkedCustomer.blocked ||
        (linkedCustomer.tokenVersion || 0) !== (authCust.tv || 0))) {
      return fail(res, 401, 'جلسة الحساب غير متاحة. سجل الدخول مجدداً.');
    }

    const manual = paymentMethod !== 'رصيد المحفظة' && paymentMethod !== 'Chargily Pay (الذهبية / CIB)';
    if (manual || paymentMethod === 'رصيد المحفظة') {
      const recentSame = await Order.findOne({ orderFingerprint: sameFingerprint,
        status: { $ne: 'ملغي' }, createdAt: { $gte: new Date(Date.now() - (manual ? 10 : 2) * 60000) },
        ...(manual ? {} : { customerId: linkedCustomer?._id }) }).lean();
      if (recentSame) return res.status(200).json({ success: true, reused: true, message: 'هذا الطلب موجود بالفعل.',
        order: { orderCode: recentSame.orderCode, status: recentSame.status,
          totalPrice: recentSame.totalPrice, createdAt: recentSame.createdAt } });
      if (manual) {
      const since = new Date(Date.now() - 60 * 60000);
      const unpaidByPhone = await Order.countDocuments({ whatsappNumber: phone, status: 'قيد المراجعة', createdAt: { $gte: since } });
      if (unpaidByPhone >= 4) return fail(res, 429, 'لديك عدة طلبات معلّقة خلال الساعة. يرجى متابعة الطلب الحالي أو مراسلة الدعم.');
      const unpaidByIp = await Order.countDocuments({ idempotencyKey: actorHash, status: 'قيد المراجعة', createdAt: { $gte: since } });
      if (!linkedCustomer && unpaidByIp >= 16) return fail(res, 429, 'تم تأجيل إنشاء الطلبات اليدوية من شبكتك مؤقتًا بسبب عدد كبير من المحاولات. تواصل مع الدعم.');
      }
    }

    if (paymentMethod === 'رصيد المحفظة') {
      if (!authCust || !linkedCustomer) {
        return fail(res, 401, 'يجب تسجيل الدخول لحسابك أولاً للدفع من رصيد المحفظة.');
      }
      if ((linkedCustomer.balance || 0) < computedTotal) {
        return fail(res, 400, `رصيد محفظتك (${linkedCustomer.balance || 0} DA) غير كافٍ لإتمام الطلب (${computedTotal} DA).`);
      }
      const debit = await Customer.findOneAndUpdate(
        { _id: linkedCustomer._id, blocked: false, balance: { $gte: computedTotal } },
        { $inc: { balance: -computedTotal } }, { new: true }
      );
      if (!debit) return fail(res, 409, 'تغيّر رصيد المحفظة، يرجى تحديث الحساب والمحاولة مجددًا.');
      // نحتاج سجلّ معاملة وMongoDB transaction لاحقاً لضمان التعافي من انقطاع الخادم تماماً.
      linkedCustomer = debit;
    }

    const claimToken = crypto.randomBytes(16).toString('hex');
    const claimTokenHash = crypto.createHash('sha256').update(claimToken).digest('hex');
    const claimExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const isWalletPaid = paymentMethod === 'رصيد المحفظة';
    const nowFormatted = new Date().toLocaleString('fr-DZ', { timeZone: 'Africa/Algiers' });

    let order;
    for (let attempt = 0; attempt < 3 && !order; attempt++) {
      try {
        order = await Order.create({
          orderCode: genCode(),
          orderFingerprint: sameFingerprint,
          idempotencyKey: manual ? actorHash : undefined,
          customerName: name,
          whatsappNumber: phone,
          customerEmail: email,
          cartItems: items,
          subTotal: computedTotal,
          totalPrice: computedTotal,
          paymentMethod,
          source: sanitizeSource(source) || undefined,
          status: isWalletPaid ? 'مؤكد' : 'قيد المراجعة',
          customerId: linkedCustomer ? linkedCustomer._id : undefined,
          telegramChatId: linkedCustomer && linkedCustomer.telegramChatId ? linkedCustomer.telegramChatId : undefined,
          claimTokenHash,
          claimExpiresAt,
          isPaidOnline: isWalletPaid,
          paidAt: isWalletPaid ? new Date() : undefined,
          paymentDetails: isWalletPaid ? {
            transactionId: 'WALLET-' + Date.now(),
            amountPaid: computedTotal,
            paymentMethodUsed: 'رصيد المحفظة',
            payerName: name,
            payerEmail: email,
            payerPhone: phone,
            paidAtFormatted: nowFormatted
          } : undefined,
          history: [{ status: isWalletPaid ? 'مؤكد' : 'قيد المراجعة', by: isWalletPaid ? 'wallet' : 'customer' }]
        });
      } catch (err) {
        if (err.code !== 11000) {
          if (paymentMethod === 'رصيد المحفظة' && linkedCustomer) await Customer.updateOne({ _id: linkedCustomer._id }, { $inc: { balance: computedTotal } });
          throw err;
        }
      }
    }
    if (!order) {
      if (paymentMethod === 'رصيد المحفظة' && linkedCustomer) await Customer.updateOne({ _id: linkedCustomer._id }, { $inc: { balance: computedTotal } });
      return fail(res, 500, 'تعذّر حفظ الطلب، حاول مرة أخرى.');
    }

    if (paymentMethod === 'Chargily Pay (الذهبية / CIB)') {
      const publicServerUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `https://${req.get('host')}`).replace(/\/$/, '');
      const webhookUrl = `${publicServerUrl}/api/orders/chargily-webhook`;
      const originUrl = process.env.SITE_URL || 'https://rioxstore.shop'; // لا تقبل عنوان عودة يُحدده الزبون

      const session = await createCheckoutSession({
        order,
        originUrl,
        webhookUrl
      });

      order.chargilyCheckoutId = session.checkoutId;
      await order.save();

      notifyNewOrder(order).catch((e) => console.error('telegram notify failed:', e.message));

      return res.status(201).json({
        success: true,
        message: 'جاري تحويلك لبوابة الدفع شارجيلي...',
        checkoutUrl: session.checkoutUrl,
        order: {
          orderCode: order.orderCode,
          status: order.status,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt
        },
        claimToken
      });
    }

    notifyNewOrder(order).catch((e) => console.error('telegram notify failed:', e.message));
    if (isWalletPaid) {
      notifyChargilyPaymentSuccess(order).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'تم استلام طلبك بنجاح.',
      order: {
        orderCode: order.orderCode,
        status: order.status,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt,
        isPaidOnline: order.isPaidOnline
      },
      claimToken
    });
  } catch (err) {
    next(err);
  }
});

async function confirmChargilyOrder(order, checkoutData, source) {
  if (!order) return null;
  const alreadyNotified = order.isPaidOnline;

  order.isPaidOnline = true;
  order.paidAt = order.paidAt || new Date();
  order.paymentDetails = extractPaymentDetails(checkoutData, order);
  order.adminNote = (order.adminNote ? order.adminNote + ' | ' : '') + `✅ مدفوع عبر شارجيلي (${order.paymentDetails.paidAtFormatted})`;
  if (order.status === 'قيد المراجعة') {
    order.status = 'مؤكد';
    order.history.push({ status: 'مؤكد', by: source });
  }
  await order.save();

  if (!alreadyNotified) {
    await notifyChargilyPaymentSuccess(order);
  }
  return order;
}

router.post('/chargily-webhook', async (req, res) => {
  try {
    const signature = req.get('signature');
    const isValid = await verifyWebhookSignature(req.rawBody, signature);
    if (!isValid) {
      console.warn('Chargily Webhook rejected: Invalid signature');
      return res.status(403).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body || {};
    if (event.type === 'checkout.paid' && event.data) {
      const checkout = event.data;
      const orderCode = checkout.metadata && checkout.metadata.orderCode;
      const order = await Order.findOne(
        orderCode ? { orderCode } : { chargilyCheckoutId: checkout.id }
      );
      if (order) {
        await confirmChargilyOrder(order, checkout, 'chargily-webhook');
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Chargily webhook error:', err.message);
    return res.status(500).json({ success: false });
  }
});

router.post('/verify-chargily/:code', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderCode: String(req.params.code || '').toUpperCase() });
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود.' });
    }
    if (order.isPaidOnline && order.paymentDetails && order.paymentDetails.paidAtFormatted) {
      return res.json({
        success: true,
        status: order.status,
        paid: true,
        orderCode: order.orderCode,
        customerName: order.customerName,
        whatsappNumber: order.whatsappNumber,
        customerEmail: order.customerEmail,
        totalPrice: order.totalPrice,
        paymentMethod: order.paymentMethod,
        paymentDetails: order.paymentDetails,
        items: order.cartItems
      });
    }

    if (order.chargilyCheckoutId) {
      const checkout = await verifyCheckoutStatus(order.chargilyCheckoutId);
      if (checkout && checkout.status === 'paid') {
        await confirmChargilyOrder(order, checkout, 'chargily-verify');
      }
    }

    return res.json({
      success: true,
      status: order.status,
      paid: !!order.isPaidOnline,
      orderCode: order.orderCode,
      customerName: order.customerName,
      whatsappNumber: order.customerName,
      customerEmail: order.customerEmail,
      totalPrice: order.totalPrice,
      paymentMethod: order.paymentMethod,
      paymentDetails: order.paymentDetails,
      items: order.cartItems
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.confirmChargilyOrder = confirmChargilyOrder;
module.exports.sanitizeSource = sanitizeSource;
