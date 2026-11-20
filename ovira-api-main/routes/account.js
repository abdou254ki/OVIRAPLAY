const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Complaint = require('../models/Complaint');
const Review = require('../models/Review');
const TelegramLogin = require('../models/TelegramLogin');
const { bot, notifyNewComplaint } = require('../bot/telegram');
const {
  getGoogleClientId,
  generateTotpSecret,
  verifyTotpToken,
  buildOtpAuthUrl,
  createOtpChallenge,
  verifyOtpChallenge,
  sendTelegramOtpMessage,
  verifyGoogleIdToken,
  verifyTelegramWidgetData
} = require('../services/authService');

const router = express.Router();
const PHONE_RE = /^0[567]\d{8}$/;

const normalizePhone = (s) =>
  String(s || '')
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632)
    .replace(/[\s\-().]/g, '')
    .replace(/^(\+|00)?213/, '0');

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات كثيرة، أعد المحاولة لاحقاً.' },
});

const tgStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات كثيرة، أعد المحاولة لاحقاً.' },
});
// الاستطلاع (polling) كل بضع ثوانٍ يحتاج حدًا أوسع من باقي مسارات الدخول
const tgPollLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات كثيرة، أعد المحاولة لاحقاً.' },
});

// إنشاء/جلب حساب بمعرّف تيليغرام (مشترك بين Widget والدخول عبر البوت).
// يتحمّل سباق الإنشاء المتزامن (E11000) بإعادة البحث بدل الفشل.
async function findOrCreateTelegramCustomer({ tgId, fullName, tgUsername }) {
  let customer = await Customer.findOne({ telegramChatId: tgId });
  if (!customer) {
    try {
      customer = await Customer.create({
        name: String(fullName || 'عميل تيليغرام').slice(0, 80),
        telegramChatId: tgId,
        telegramUsername: tgUsername || '',
        lastLoginAt: new Date()
      });
    } catch (err) {
      if (err && err.code === 11000) {
        console.error('[oauth/telegram] E11000', JSON.stringify(err.keyPattern || {}));
        customer = await Customer.findOne({ telegramChatId: tgId });
        if (!customer) throw err;
      } else {
        throw err;
      }
    }
  } else if (tgUsername && customer.telegramUsername !== tgUsername) {
    customer.telegramUsername = tgUsername;
    await customer.save();
  }
  return customer;
}

const requireCustomer = async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.role !== 'customer') throw new Error('NOT_CUSTOMER');
    const customer = await Customer.findById(decoded.id);
    if (!customer || customer.blocked || (customer.tokenVersion || 0) !== (decoded.tv || 0)) {
      return res.status(403).json({ success: false, message: 'الحساب غير متاح أو الجلسة منتهية.' });
    }
    req.customer = customer;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول إلى حسابك.' });
  }
};

function formatCustomerPayload(c) {
  return {
    id: c._id,
    name: c.name,
    phone: c.phone || '',
    email: c.email || '',
    balance: c.balance || 0,
    telegramLinked: !!c.telegramChatId,
    telegramUsername: c.telegramUsername || '',
    twoFactorEnabled: !!c.twoFactorEnabled,
    twoFactorMethod: c.twoFactorMethod || '',
    createdAt: c.createdAt
  };
}

function signCustomerToken(c) {
  return jwt.sign(
    { id: c._id, phone: c.phone || '', role: 'customer', tv: c.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '30d' }
  );
}

// فحص ما إذا كان الحساب يتطلب التحقق بخطوتين (2FA) قبل منحه التوكن النهائي
async function handleCustomerLoginResponse(res, customer) {
  if (customer.twoFactorEnabled && customer.twoFactorMethod) {
    if (customer.twoFactorMethod === 'telegram') {
      if (!customer.telegramChatId) {
        return res.status(400).json({
          success: false,
          message: 'التحقق عبر تيليغرام مفعل ولكن لم يتم ربط البوت بحسابك بعد.'
        });
      }
      const { code, hash, expiresAt } = createOtpChallenge();
      customer.otpCodeHash = hash;
      customer.otpExpiresAt = expiresAt;
      await customer.save();
      await sendTelegramOtpMessage(bot, customer.telegramChatId, code, 'تسجيل الدخول إلى حسابك');
    }

    const tempToken = jwt.sign(
      { id: customer._id, role: 'customer_2fa_pending', method: customer.twoFactorMethod },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    return res.json({
      success: true,
      requires2FA: true,
      method: customer.twoFactorMethod,
      tempToken,
      message:
        customer.twoFactorMethod === 'telegram'
          ? 'تم إرسال رمز التحقق المكون من 6 أرقام إلى حسابك في بوت تيليغرام.'
          : 'أدخل رمز التحقق المكون من 6 أرقام من تطبيق Google Authenticator.'
    });
  }

  customer.lastLoginAt = new Date();
  await customer.save();
  const token = signCustomerToken(customer);
  return res.json({
    success: true,
    token,
    customer: formatCustomerPayload(customer)
  });
}

// إعدادات المصادقة العامة للواجهة (Google Client ID + اسم البوت)
router.get('/auth-config', (req, res) => {
  res.json({
    success: true,
    googleClientId: getGoogleClientId(),
    telegramBotName: (process.env.TELEGRAM_BOT_USERNAME || 'oviraplay_bot').replace(/^@/, '')
  });
});

// 1. تتبع الطلب للزوار
router.get('/track', trackLimiter, async (req, res, next) => {
  try {
    const { code, phone4 } = req.query;
    if (!code || !phone4 || String(phone4).trim().length !== 4) {
      return res.status(400).json({ success: false, message: 'أدخل رمز الطلب وآخر 4 أرقام من الهاتف.' });
    }
    const order = await Order.findOne({ orderCode: String(code).trim().toUpperCase() }).lean();
    if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود، تأكد من الرمز.' });

    if (order.whatsappNumber.slice(-4) !== String(phone4).trim()) {
      return res.status(401).json({ success: false, message: 'آخر 4 أرقام من الهاتف غير متطابقة مع هذا الطلب.' });
    }

    res.json({
      success: true,
      tracking: {
        orderCode: order.orderCode,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaidOnline: !!order.isPaidOnline,
        paymentDetails: order.paymentDetails || null,
        createdAt: order.createdAt,
        history: order.history,
        items: order.cartItems.map((i) => `${i.productName} (${i.months} شهر × ${i.quantity})`),
        totalPrice: order.totalPrice,
        // لا نكشف كلمة مرور أو رابط دعوة عبر رمز طلب وآخر 4 أرقام من الهاتف.
        deliveredAccount: null,
        deliveryNotice: order.status === 'تم التسليم' ? 'للاطلاع على بيانات التسليم ادخل إلى حسابك أو بوت Telegram المرتبط بشكل موثّق.' : '' 
      }
    });
  } catch (err) {
    next(err);
  }
});

// 2. إنشاء حساب جديد للزبون
router.post('/register', trackLimiter, async (req, res, next) => {
  try {
    const { name, phone, email, password } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (cleanName.length < 3) return res.status(400).json({ success: false, message: 'الاسم الكامل مطلوب.' });
    if (!PHONE_RE.test(cleanPhone)) return res.status(400).json({ success: false, message: 'رقم الهاتف غير صالح.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ success: false, message: 'البريد الإلكتروني غير صالح.' });
    if (!password || String(password).length < 8) return res.status(400).json({ success: false, message: 'كلمة السر يجب أن تكون 8 أحرف على الأقل.' });

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (customer) {
      return res.status(400).json({ success: false, message: 'هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);
    if (!customer) {
      customer = await Customer.create({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail || undefined,
        passwordHash,
        lastLoginAt: new Date()
      });
    }
    // لا تربط أي طلب قديم لمجرد معرفة رقم الهاتف، يلزم إثبات ملكية مستقل.

    const token = signCustomerToken(customer);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء حسابك وربط طلباتك بنجاح!',
      token,
      customer: formatCustomerPayload(customer)
    });
  } catch (err) {
    next(err);
  }
});

// 3. تسجيل الدخول العادي (مع دعم التحقق بخطوتين 2FA إن كان مفعلاً)
router.post('/login', trackLimiter, async (req, res, next) => {
  try {
    const { identifier, phone, password } = req.body || {};
    const rawId = String(identifier || phone || '').trim();
    if (!rawId || !password) return res.status(400).json({ success: false, message: 'أدخل رقم الهاتف أو الإيميل وكلمة السر.' });

    const isEmail = rawId.includes('@');
    const query = isEmail ? { email: rawId.toLowerCase() } : { phone: normalizePhone(rawId) };
    const customer = await Customer.findOne(query);

    if (!customer || !customer.passwordHash) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة أو الحساب غير مفعل بكلمة سر.' });
    }
    if (customer.blocked) {
      return res.status(403).json({ success: false, message: 'هذا الحساب محظور، تواصل مع الإدارة.' });
    }

    const ok = await bcrypt.compare(String(password), customer.passwordHash);
    if (!ok) return res.status(401).json({ success: false, message: 'كلمة السر غير صحيحة.' });

    return handleCustomerLoginResponse(res, customer);
  } catch (err) {
    next(err);
  }
});

// 4. تسجيل الدخول السريع عبر Google
router.post('/oauth/google', trackLimiter, async (req, res, next) => {
  try {
    const { credential } = req.body || {};
    const gUser = await verifyGoogleIdToken(credential);

    // Google identity is authoritative only for its own googleId. Email in a legacy account may be unverified.
    let customer = await Customer.findOne({ googleId: gUser.googleId });
    if (!customer && gUser.email && await Customer.exists({ email: gUser.email })) {
      return res.status(409).json({ success: false, code: 'ACCOUNT_LINK_REVIEW', message: 'يوجد حساب بنفس البريد؛ سجل الدخول بطريقته الأصلية واطلب ربط Google بعد التحقق.' });
    }

    if (!customer) {
      try {
        customer = await Customer.create({
          name: (gUser.name || 'عميل قوقل').slice(0, 80),
          email: gUser.email,
          googleId: gUser.googleId,
          emailVerified: true, // قوقل أكّد ملكية البريد
          lastLoginAt: new Date()
        });
      } catch (err) {
        // سباق متزامن أو فهرس قديم: لا نُسقط الطلب بخطأ 500 إن كان الحساب موجودًا فعلًا
        if (err && err.code === 11000) {
          console.error('[oauth/google] E11000 — keyPattern:', JSON.stringify(err.keyPattern || {}));
          customer = await Customer.findOne({ googleId: gUser.googleId });
          if (!customer) return res.status(409).json({ success: false, code: 'ACCOUNT_LINK_REVIEW', message: 'البريد مستخدم بحساب سابق؛ الربط يحتاج مراجعة إثبات الملكية.' });
          if (!customer) throw err;
        } else {
          throw err;
        }
      }
    }
    if (customer && !customer.googleId) customer.googleId = gUser.googleId;
    if (customer && !customer.email && gUser.email) customer.email = gUser.email;
    if (customer && customer.isModified()) await customer.save();

    if (customer.blocked) {
      return res.status(403).json({ success: false, message: 'هذا الحساب محظور، تواصل مع الإدارة.' });
    }

    // لا تربط طلب ضيف بمجرد إدخال بريد مطابق؛ يحتاج إثبات مصدر الطلب ومراجعة.

    return handleCustomerLoginResponse(res, customer);
  } catch (err) {
    // لا تُعرض أخطاء MongoDB أو تفاصيل الخادم الخام للعملاء.
    // نحافظ فقط على رسائل التحقق المعروفة والآمنة القادمة من Google.
    const googleAuthMessages = new Set([
      'رمز الدخول من قوقل مفقود.',
      'تعذّر التحقق من صلاحية حساب قوقل.',
      'معرّف تطبيق قوقل (Client ID) غير مطابق.',
      'البريد الإلكتروني في حساب قوقل غير مؤكّد.'
    ]);
    if (googleAuthMessages.has(err?.message)) {
      return res.status(401).json({ success: false, message: err.message });
    }
    // الخطأ الداخلي يُعالج مركزياً برسالة عامة، دون كشف اسم المجموعة أو الفهرس.
    console.error('[oauth/google] unexpected:', err && err.code, err && err.name, err && err.message);
    next(err);
  }
});

// 5. تسجيل الدخول السريع عبر Telegram Login Widget
router.post('/oauth/telegram', trackLimiter, async (req, res, next) => {
  try {
    const authData = req.body || {};
    if (!verifyTelegramWidgetData(authData)) {
      return res.status(401).json({ success: false, message: 'بيانات مصادقة تيليغرام غير صالحة أو منتهية.' });
    }

    const tgId = Number(authData.id);
    const fullName = [authData.first_name, authData.last_name].filter(Boolean).join(' ').trim() || authData.username || 'عميل تيليغرام';
    const tgUsername = authData.username || '';

    const customer = await findOrCreateTelegramCustomer({ tgId, fullName, tgUsername });

    if (customer.blocked) {
      return res.status(403).json({ success: false, message: 'هذا الحساب محظور، تواصل مع الإدارة.' });
    }

    await Order.updateMany(
      { telegramChatId: tgId, customerId: { $exists: false } },
      { $set: { customerId: customer._id } }
    );

    return handleCustomerLoginResponse(res, customer);
  } catch (err) {
    next(err);
  }
});

// 5-ب. الدخول عبر بوت تيليغرام (رابط عميق) — لا يحتاج إدخال رقم الهاتف ولا نافذة منبثقة
const hashLoginToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const LOGIN_TTL_MS = 5 * 60 * 1000;

router.post('/oauth/telegram/start', tgStartLimiter, async (req, res, next) => {
  try {
    const token = crypto.randomBytes(24).toString('hex'); // 48 حرفًا
    await TelegramLogin.create({ tokenHash: hashLoginToken(token) });
    const botName = (process.env.TELEGRAM_BOT_USERNAME || 'oviraplay_bot').replace(/^@/, '');
    res.json({
      success: true,
      token,
      botUrl: `https://t.me/${botName}?start=lg_${token}`,
      expiresIn: LOGIN_TTL_MS / 1000
    });
  } catch (err) {
    next(err);
  }
});

router.post('/oauth/telegram/poll', tgPollLimiter, async (req, res, next) => {
  try {
    const token = String((req.body || {}).token || '');
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return res.status(400).json({ success: false, message: 'طلب غير صالح.' });
    }
    const tokenHash = hashLoginToken(token);
    const sess = await TelegramLogin.findOne({ tokenHash });
    if (!sess || Date.now() - sess.createdAt.getTime() > LOGIN_TTL_MS) {
      return res.status(410).json({ success: false, expired: true, message: 'انتهت صلاحية المحاولة، اضغط الزر من جديد.' });
    }
    if (sess.state === 'rejected') {
      await TelegramLogin.deleteOne({ _id: sess._id });
      return res.status(403).json({ success: false, rejected: true, message: 'تم رفض محاولة الدخول من تيليغرام.' });
    }
    if (sess.state !== 'approved') {
      return res.json({ success: true, pending: true, state: sess.state });
    }

    // استهلاك أحادي: أول طلب فقط ينجح في تحويل approved → used
    const consumed = await TelegramLogin.findOneAndUpdate(
      { _id: sess._id, state: 'approved' },
      { $set: { state: 'used' } }
    );
    if (!consumed) return res.json({ success: true, pending: true, state: 'used' });

    const fullName = [sess.firstName, sess.lastName].filter(Boolean).join(' ').trim() || sess.username || 'عميل تيليغرام';
    const customer = await findOrCreateTelegramCustomer({ tgId: sess.chatId, fullName, tgUsername: sess.username });

    if (customer.blocked) {
      return res.status(403).json({ success: false, message: 'هذا الحساب محظور، تواصل مع الإدارة.' });
    }
    await Order.updateMany(
      { telegramChatId: sess.chatId, customerId: { $exists: false } },
      { $set: { customerId: customer._id } }
    );
    await TelegramLogin.deleteOne({ _id: sess._id });
    return handleCustomerLoginResponse(res, customer);
  } catch (err) {
    console.error('[oauth/telegram/poll]', err && err.code, err && err.message);
    next(err);
  }
});

// 6. تأكيد كود التحقق بخطوتين (2FA) لإتمام تسجيل الدخول للزبون
router.post('/2fa/verify-login', trackLimiter, async (req, res, next) => {
  try {
    const { tempToken, code } = req.body || {};
    if (!tempToken || !code) {
      return res.status(400).json({ success: false, message: 'أدخل رمز التحقق المكون من 6 أرقام.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة، أعد تسجيل الدخول.' });
    }

    if (decoded.role !== 'customer_2fa_pending') {
      return res.status(401).json({ success: false, message: 'رمز الجلسة غير صالح.' });
    }

    const customer = await Customer.findById(decoded.id);
    if (!customer || customer.blocked) {
      return res.status(403).json({ success: false, message: 'الحساب غير متاح.' });
    }

    let isValid = false;
    if (customer.twoFactorMethod === 'totp') {
      isValid = verifyTotpToken(customer.totpSecret, code);
    } else if (customer.twoFactorMethod === 'telegram') {
      isValid = verifyOtpChallenge(code, customer.otpCodeHash, customer.otpExpiresAt);
    }

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' });
    }

    customer.otpCodeHash = '';
    customer.otpExpiresAt = undefined;
    customer.lastLoginAt = new Date();
    await customer.save();

    const token = signCustomerToken(customer);
    res.json({
      success: true,
      message: 'تم التحقق وتسجيل الدخول بنجاح!',
      token,
      customer: formatCustomerPayload(customer)
    });
  } catch (err) {
    next(err);
  }
});

// 7. إدارة وإعداد التحقق بخطوتين (2FA) من داخل حساب الزبون
router.post('/2fa/setup', requireCustomer, async (req, res, next) => {
  try {
    const { method } = req.body || {};
    const c = req.customer;

    if (method === 'totp') {
      const secret = generateTotpSecret();
      c.totpPendingSecret = secret;
      await c.save();
      const otpauthUrl = buildOtpAuthUrl({
        secret,
        accountLabel: c.email || c.phone || c.name,
        issuer: 'OVIRA PLAY'
      });
      return res.json({
        success: true,
        method: 'totp',
        secret,
        otpauthUrl
      });
    }

    if (method === 'telegram') {
      if (!c.telegramChatId) {
        const linkCode = 'LNK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        c.linkCode = linkCode;
        c.linkCodeExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await c.save();
        return res.status(400).json({
          success: false,
          needsTelegramLink: true,
          linkCode,
          message: 'يرجى ربط حسابك ببوت تيليغرام أولاً بالضغط على زر الربط ثم المحاولة مجدداً.'
        });
      }
      const { code, hash, expiresAt } = createOtpChallenge();
      c.otpCodeHash = hash;
      c.otpExpiresAt = expiresAt;
      await c.save();
      await sendTelegramOtpMessage(bot, c.telegramChatId, code, 'تفعيل التحقق بخطوتين (2FA)');
      return res.json({
        success: true,
        method: 'telegram',
        message: 'أرسلنا رمز تأكيد من 6 أرقام إلى حسابك في بوت تيليغرام، أدخله لتفعيل الميزة.'
      });
    }

    return res.status(400).json({ success: false, message: 'طريقة تحقق غير صالحة.' });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/enable', requireCustomer, async (req, res, next) => {
  try {
    const { method, code } = req.body || {};
    const c = req.customer;

    if (method === 'totp') {
      if (!c.totpPendingSecret || !verifyTotpToken(c.totpPendingSecret, code)) {
        return res.status(400).json({ success: false, message: 'الرمز غير صحيح، تأكد من مسح الباركود في تطبيق Google Authenticator.' });
      }
      c.totpSecret = c.totpPendingSecret;
      c.totpPendingSecret = '';
      c.twoFactorMethod = 'totp';
      c.twoFactorEnabled = true;
      await c.save();
      return res.json({
        success: true,
        message: 'تم تفعيل التحقق بخطوتين عبر Google Authenticator بنجاح!',
        customer: formatCustomerPayload(c)
      });
    }

    if (method === 'telegram') {
      if (!verifyOtpChallenge(code, c.otpCodeHash, c.otpExpiresAt)) {
        return res.status(400).json({ success: false, message: 'الرمز المرسل في تيليغرام غير صحيح أو انتهت صلاحيته.' });
      }
      c.otpCodeHash = '';
      c.otpExpiresAt = undefined;
      c.twoFactorMethod = 'telegram';
      c.twoFactorEnabled = true;
      await c.save();
      return res.json({
        success: true,
        message: 'تم تفعيل التحقق بخطوتين عبر بوت تيليغرام بنجاح!',
        customer: formatCustomerPayload(c)
      });
    }

    return res.status(400).json({ success: false, message: 'طريقة غير صالحة.' });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/disable', requireCustomer, async (req, res, next) => {
  try {
    const c = req.customer;
    c.twoFactorEnabled = false;
    c.twoFactorMethod = '';
    c.totpSecret = '';
    c.totpPendingSecret = '';
    c.otpCodeHash = '';
    await c.save();
    res.json({
      success: true,
      message: 'تم إيقاف التحقق بخطوتين لحسابك.',
      customer: formatCustomerPayload(c)
    });
  } catch (err) {
    next(err);
  }
});

// توليد رابط ربط سريع بين حساب الموقع وبوت تيليغرام
router.post('/telegram-link-code', requireCustomer, async (req, res, next) => {
  try {
    const c = req.customer;
    const linkCode = 'LNK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    c.linkCode = linkCode;
    c.linkCodeExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await c.save();
    res.json({
      success: true,
      linkCode,
      botUrl: `https://t.me/${(process.env.TELEGRAM_BOT_USERNAME || 'oviraplay_bot').replace(/^@/, '')}?start=${linkCode}`
    });
  } catch (err) {
    next(err);
  }
});

// Profile display-name changes are ordinary; email and phone identity changes
// require a separate authenticated OTP step-up, never a chat instruction.
router.patch('/profile', requireCustomer, async (req, res, next) => {
  try {
    const {name,phone,email}=req.body||{};
    if ((typeof email==='string' && email.trim().toLowerCase()!==String(req.customer.email||'')) ||
        (typeof phone==='string' && normalizePhone(phone)!==String(req.customer.phone||'')))
      return res.status(403).json({success:false,code:'PROFILE_STEP_UP_REQUIRED',message:'تغيير البريد أو الهاتف يتطلب تحققًا مستقلاً من صفحة الحساب؛ لا ترسل OTP في المحادثة.'});
    if (typeof name==='string' && name.trim().length>=3 && name.trim().length<=80) req.customer.name=name.trim();
    await req.customer.save();
    res.json({success:true,customer:formatCustomerPayload(req.customer)});
  }catch(err){next(err);}
});

// The request must originate from the already-authenticated customer account.
router.post('/profile/request-change-code',trackLimiter,requireCustomer,async(req,res,next)=>{
  try {
    const customer=req.customer;
    if(customer.twoFactorEnabled && customer.twoFactorMethod==='totp') {
      // Finite attempt window; never reset it on every user request.
      if(!customer.otpExpiresAt || new Date(customer.otpExpiresAt).getTime()<Date.now()) {
        customer.otpAttempts=0;customer.otpExpiresAt=new Date(Date.now()+15*60*1000);
        await customer.save();
      }
      return res.json({success:true,message:'استخدم رمز المصادقة من تطبيق TOTP؛ لا تضعه في الشات.'});
    }
    if (!customer.telegramChatId || !bot)
      return res.status(409).json({success:false,code:'VERIFICATION_NOT_AVAILABLE',message:'لتغيير البريد أو الهاتف فعّل TOTP أو اربط Telegram بحسابك أولاً. يمكن للدعم مساعدتك في الإرشاد فقط.'});
    const {code,hash,expiresAt}=createOtpChallenge();
    customer.otpCodeHash=hash;customer.otpExpiresAt=expiresAt;customer.otpAttempts=0;customer.otpPurpose='profile_change';
    await customer.save();
    await sendTelegramOtpMessage(bot,customer.telegramChatId,code,'تأكيد تغيير بيانات الحساب');
    res.json({success:true,message:'أُرسل رمز التحقق إلى Telegram المرتبط بحسابك. أدخله في صفحة الحساب فقط.'});
  }catch(e){next(e);}
});
router.post('/profile/secure-update',trackLimiter,requireCustomer,async(req,res,next)=>{
  try {
    const customer=req.customer;
    const {email,phone,code}=req.body||{};
    if(typeof code!=='string' || !/^\d{6}$/.test(code))return res.status(400).json({success:false,code:'OTP_REQUIRED'});
    if((customer.otpAttempts||0)>=5)return res.status(429).json({success:false,code:'OTP_ATTEMPTS_EXCEEDED'});
    const valid=customer.twoFactorEnabled && customer.twoFactorMethod==='totp'
      ? verifyTotpToken(customer.totpSecret,code)
      : customer.otpPurpose==='profile_change' && verifyOtpChallenge(code,customer.otpCodeHash,customer.otpExpiresAt);
    if(!valid){customer.otpAttempts=(customer.otpAttempts||0)+1;await customer.save();return res.status(401).json({success:false,code:'BAD_OTP',message:'رمز التحقق غير صحيح.'});}
    let nextEmail=null,nextPhone=null;
    if(typeof email==='string' && email.trim()){
      nextEmail=email.trim().toLowerCase();
      if(nextEmail.length>150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail))
        return res.status(400).json({success:false,code:'INVALID_EMAIL'});
      if(await Customer.exists({email:nextEmail,_id:{$ne:customer._id}}))return res.status(409).json({success:false,code:'EMAIL_IN_USE'});
    }
    if(typeof phone==='string' && phone.trim()){
      nextPhone=normalizePhone(phone);
      if(!PHONE_RE.test(nextPhone))return res.status(400).json({success:false,code:'INVALID_PHONE'});
      if(await Customer.exists({phone:nextPhone,_id:{$ne:customer._id}}))return res.status(409).json({success:false,code:'PHONE_IN_USE'});
    }
    if(!nextEmail&&!nextPhone)return res.status(400).json({success:false,code:'NO_CHANGES'});
    if(nextEmail && nextEmail!==customer.email){customer.email=nextEmail;customer.emailVerified=false;}
    if(nextPhone && nextPhone!==customer.phone){customer.phone=nextPhone;customer.phoneVerified=false;}
    customer.otpCodeHash='';customer.otpPurpose='';customer.otpExpiresAt=undefined;customer.otpAttempts=0;
    customer.tokenVersion=(customer.tokenVersion||0)+1; // invalidate old sessions
    await customer.save();
    res.json({success:true,message:'تم تحديث بيانات الحساب. سجّل الدخول مجددًا، وقد يُطلب توثيق البريد أو الهاتف الجديد.'});
  }catch(e){next(e);}
});

// A support code can prove the authenticated customer contacted the owner.
// It does not replace account OTP, does not reset credentials, and is never
// submitted through the chat or passed to the local AI model.
router.post('/support/redeem-code',trackLimiter,requireCustomer,async(req,res,next)=>{
  try {
    const raw=String(req.body?.supportCode||'').trim().toUpperCase();
    if(!/^OVS-[A-F0-9]{18}$/.test(raw))return res.status(400).json({success:false,code:'INVALID_SUPPORT_CODE'});
    const customer=await Customer.findById(req.customer._id).select('+supportCodeHash');
    const hash=crypto.createHash('sha256').update(raw).digest();
    const expected=Buffer.from(customer?.supportCodeHash||'', 'hex');
    if(!customer || !customer.supportCodeExpiresAt || new Date(customer.supportCodeExpiresAt).getTime()<Date.now() ||
       expected.length!==hash.length || !crypto.timingSafeEqual(hash,expected))
      return res.status(401).json({success:false,code:'SUPPORT_CODE_INVALID_OR_EXPIRED'});
    customer.supportCodeHash='';customer.supportCodeExpiresAt=undefined;
    customer.supportVerifiedUntil=new Date(Date.now()+15*60*1000);
    await customer.save();
    res.json({success:true,message:'تم تأكيد هوية حسابك للدعم لمدة 15 دقيقة. التغييرات الحساسة تحتاج OTP مستقلاً.'});
  }catch(e){next(e);}
});
// 8. إنشاء حساب سريع بعد إتمام الطلب (Claim)
router.post('/claim', async (req, res, next) => {
  try {
    const { claimToken, password, consent } = req.body || {};
    if (!claimToken || consent !== true) {
      return res.status(400).json({ success: false, message: 'بيانات غير مكتملة أو لم توافق على الشروط.' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'يرجى اختيار كلمة سر من 8 أحرف على الأقل لحماية حسابك.' });
    }

    const claimTokenHash = crypto.createHash('sha256').update(String(claimToken)).digest('hex');
    const order = await Order.findOne({ claimTokenHash, claimExpiresAt: { $gt: new Date() } });
    if (!order) return res.status(400).json({ success: false, message: 'رابط التسجيل غير صالح أو انتهت صلاحيته.' });

    // رمز طلب لا يُثبت ملكية حساب قائم ولا يحق له إعادة تعيين كلمة مروره.
    const existingCustomer = await Customer.findOne({ phone: order.whatsappNumber });
    if (existingCustomer) {
      return res.status(409).json({ success: false, message: 'يوجد حساب بهذا الرقم. سجل الدخول إليه بدلاً من إعادة تعيين كلمة السر عبر الطلب.' });
    }
    const customer = new Customer({
      phone: order.whatsappNumber,
      name: order.customerName,
      email: order.customerEmail || undefined,
      phoneVerified: false,
      emailVerified: false
    });

    customer.passwordHash = await bcrypt.hash(String(password), 12);
    customer.lastLoginAt = new Date();
    await customer.save();

    // اربط الطلب الذي تم إثبات رمزه فقط؛ باقي الطلبات تحتاج إثبات ملكية مستقل.
    order.customerId = customer._id;
    order.claimTokenHash = undefined;
    order.claimExpiresAt = undefined;
    await order.save();

    const token = signCustomerToken(customer);
    res.json({
      success: true,
      message: 'تم إنشاء حسابك وربط طلباتك بنجاح!',
      token,
      customer: formatCustomerPayload(customer)
    });
  } catch (err) {
    next(err);
  }
});

// تغيير/تعيين كلمة المرور بتأكيد مستقل: الحالية أو OTP عبر Telegram أو TOTP.
router.post('/password/request-code', trackLimiter, requireCustomer, async (req, res, next) => {
  try {
    const c = req.customer;
    if (!c.telegramChatId || !bot) return res.status(400).json({ success: false, message: 'اربط حسابك أولاً ببوت Telegram لتلقي رمز التحقق.' });
    const { code, hash, expiresAt } = createOtpChallenge();
    c.otpCodeHash = hash; c.otpExpiresAt = expiresAt; c.otpAttempts = 0; c.otpPurpose = 'password_change';
    await c.save();
    await sendTelegramOtpMessage(bot, c.telegramChatId, code, 'تعيين أو تغيير كلمة المرور');
    res.json({ success: true, message: 'أرسلنا رمز تحقق مؤقتًا إلى Telegram.' });
  } catch (err) { next(err); }
});
router.post('/password/change', trackLimiter, requireCustomer, async (req, res, next) => {
  try {
    const c = req.customer;
    const { currentPassword, code, newPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 إلى 128 حرفاً.' });
    }
    // إذا كانت 2FA مفعلة، لا يكفي إدخال كلمة المرور الحالية وحدها لتعطيل سيطرة المهاجم.
    let passwordOk = false;
    if (c.passwordHash && typeof currentPassword === 'string' && currentPassword) {
      passwordOk = await bcrypt.compare(currentPassword, c.passwordHash);
    }
    let codeOk = false;
    const codeProvided = typeof code === 'string' && /^\d{6}$/.test(code);
    if (codeProvided && (c.otpAttempts || 0) < 5) {
      if (c.twoFactorEnabled && c.twoFactorMethod === 'totp') {
        codeOk = verifyTotpToken(c.totpSecret, code);
      } else if (c.otpPurpose === 'password_change') {
        codeOk = verifyOtpChallenge(code, c.otpCodeHash, c.otpExpiresAt);
      }
      if (!codeOk) c.otpAttempts = (c.otpAttempts || 0) + 1;
    }
    const ok = c.twoFactorEnabled ? codeOk : (passwordOk || codeOk);
    if (!ok) {
      await c.save();
      return res.status(401).json({ success: false, message: c.twoFactorEnabled
        ? 'الحساب محمي بالتحقق بخطوتين؛ أدخل رمز TOTP أو رمز Telegram المرسل لهذا الغرض.'
        : 'تأكيد الهوية غير صحيح. استخدم كلمة المرور الحالية أو رمز التحقق.' });
    }
    c.passwordHash = await bcrypt.hash(newPassword, 12);
    c.passwordChangedAt = new Date();
    c.tokenVersion = (c.tokenVersion || 0) + 1;
    c.otpCodeHash = ''; c.otpPurpose = ''; c.otpExpiresAt = undefined; c.otpAttempts = 0;
    await c.save();
    res.json({ success: true, message: 'تم تعيين كلمة المرور وإبطال الجلسات القديمة. سجّل الدخول مجددًا.' });
  } catch (err) { next(err); }
});

// تقييم واحد موثّق لكل منتج تم تسليمه، مع مراجعة الإدارة قبل النشر.
router.post('/reviews', trackLimiter, requireCustomer, async (req, res, next) => {
  try {
    const c = req.customer;
    const { productId, stars, comment } = req.body || {};
    const product = await require('../models/Product').findOne({ productId: String(productId || '') }).lean();
    if (!product || !Number.isInteger(stars) || stars < 1 || stars > 5 || typeof comment !== 'string' ||
        comment.trim().length < 5 || comment.trim().length > 800) {
      return res.status(400).json({ success: false, message: 'اختر 1–5 نجوم واكتب تعليقاً من 5 إلى 800 حرف.' });
    }
    const purchased = await Order.exists({ customerId: c._id, status: 'تم التسليم', 'cartItems.productId': product.productId });
    if (!purchased) return res.status(403).json({ success: false, message: 'يمكن تقييم المنتجات بعد استلام طلب حقيقي على حسابك فقط.' });
    await Review.findOneAndUpdate({ productId: product.productId, customerId: c._id },
      { $set: { stars, comment: comment.trim(), displayName: c.name.slice(0, 50), approved: false, createdAt: new Date() } },
      { upsert: true, runValidators: true });
    res.json({ success: true, message: 'تم استلام تقييمك وسيظهر بعد موافقة الإدارة.' });
  } catch (err) { next(err); }
});

// 9. جلب بيانات حساب الزبون + الطلبات + الشكاوى
router.get('/me', requireCustomer, async (req, res, next) => {
  try {
    const c = req.customer;
    const orConditions = [{ customerId: c._id }];
    if (c.phone && c.phoneVerified) orConditions.push({ whatsappNumber: c.phone, customerId: null });
    if (c.telegramChatId) orConditions.push({ telegramChatId: c.telegramChatId, customerId: null });

    const [orders, complaints] = await Promise.all([
      Order.find({ $or: orConditions }).sort({ createdAt: -1 }).limit(50).lean(),
      Complaint.find({ $or: orConditions }).sort({ createdAt: -1 }).limit(30).lean()
    ]);

    res.json({
      success: true,
      customer: formatCustomerPayload(c),
      orders: orders.map((o) => ({
        orderCode: o.orderCode,
        status: o.status,
        totalPrice: o.totalPrice,
        paymentMethod: o.paymentMethod,
        isPaidOnline: !!o.isPaidOnline,
        createdAt: o.createdAt,
        items: o.cartItems.map((i) => `${i.productName} (${i.months} شهر × ${i.quantity})`),
        deliveredAccount:
          o.status === 'تم التسليم' && o.deliveredAccount && (o.deliveredAccount.credentials || o.deliveredAccount.invitationUrl)
            ? o.deliveredAccount
            : null
      })),
      complaints
    });
  } catch (err) {
    next(err);
  }
});

// 10. إرسال شكوى أو تذكرة دعم
// Old unauthenticated ticket creation previously linked guests by phone alone.
// Replaced by conversations endpoint: no account ownership may be inferred from a phone input.
router.post('/complaints', trackLimiter, (_req, res) => res.status(410).json({success:false,code:'MOVED_TO_CONVERSATIONS',message:'استعمل مركز المحادثات الجديد.'}));

module.exports = router;
