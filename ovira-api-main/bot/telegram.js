const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');
const Order = require('../models/Order');
const Admin = require('../models/Admin');
const Customer = require('../models/Customer');
const TelegramLogin = require('../models/TelegramLogin');
const Complaint = require('../models/Complaint');
const Product = require('../models/Product');
const { getPublicMethods } = require('../services/paymentMethodsService');
const { createCheckoutSession } = require('../services/chargilyService');
const { STATUSES } = require('../models/Order');
const { setStatus, setNotifier, deliverOrderAccount } = require('../services/orderService');
const { verifyCheckoutStatus, extractPaymentDetails } = require('../services/chargilyService');
const {
  PRESET_TEMPLATES,
  ensureSeedProducts,
  parsePlansInput, planKey, parseLinesInput, parseFaqInput
} = require('../services/productService');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ENV_ADMINS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);
const SITE = (process.env.SITE_URL || 'https://rioxstore.shop').replace(/\/$/, '');

const STATUS_ICON = {
  'قيد المراجعة': '🟡',
  'مؤكد': '🔵',
  'تم التسليم': '🟢',
  'ملغي': '🔴'
};

const HTML = { parse_mode: 'HTML' };
const bot = TOKEN ? new Telegraf(TOKEN) : null;

const adminSessions = new Map();
const customerSessions = new Map();

const esc = (val) =>
  String(val ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));

const formatMoney = (n) => Number(n || 0).toLocaleString('en-US') + ' DA';

const formatTime = (d) =>
  new Date(d || Date.now()).toLocaleString('fr-DZ', { timeZone: 'Africa/Algiers' });

async function checkAdminRole(telegramId, requiredAction = 'view_orders') {
  if (!telegramId) return false;
  if (ENV_ADMINS.includes(Number(telegramId))) return true;
  const adm = await Admin.findOne({ telegramId: Number(telegramId), active: true }).lean();
  if (!adm) return false;
  if (adm.role === 'owner') return true;
  if (adm.role === 'staff' && ['view_orders', 'edit_orders'].includes(requiredAction)) return true;
  if (adm.role === 'viewer' && requiredAction === 'view_orders') return true;
  return false;
}

async function getAllAdminChatIds() {
  const dbAdmins = await Admin.find({ role: { $in: ['owner', 'staff'] }, active: true }).lean();
  const ids = new Set([...ENV_ADMINS, ...dbAdmins.map((a) => Number(a.telegramId))].filter(Boolean));
  return Array.from(ids);
}

async function broadcastToAdmins(sendFn) {
  const ids = await getAllAdminChatIds();
  await Promise.allSettled(ids.map((id) => sendFn(id)));
}

const adminGuard = (action, handler) => async (ctx) => {
  const allowed = await checkAdminRole(ctx.from && ctx.from.id, action);
  if (allowed) return handler(ctx);
  if (ctx.callbackQuery) {
    return ctx.answerCbQuery('⛔ غير مصرّح لك بهذا الإجراء.', { show_alert: true });
  }
  return ctx.reply('⛔ هذا الأمر مخصّص لإدارة المتجر فقط.');
};

const customerMainKeyboard = () =>
  Markup.keyboard([
    ['🛒 المتجر والشراء', '📦 طلباتي وحساباتي'],
    ['🔍 تتبع طلب برمزه'],
    ['🎫 تقديم شكوى / دعم', '💰 محفظتي وحسابي']
  ]).resize();

const adminMainKeyboard = () =>
  Markup.keyboard([
    ['📋 الطلبات', '✅ الطلبات المسلّمة'],
    ['🛍️ البطاقات والمنتجات'],
    ['🎫 الشكاوى', '👥 العملاء'],
    ['📊 لوحة التحكم', '⚙️ الإعدادات']
  ]).resize();

function buildAdminOrderSummary(o) {
  const lines = [
    `🧾 <b>${esc(o.orderCode)}</b> ${STATUS_ICON[o.status] || '⚪'} <b>${esc(o.status)}</b>`,
    `👤 الاسم: ${esc(o.customerName)}`,
    `📱 واتساب: <code>${esc(o.whatsappNumber)}</code>`,
    o.customerEmail ? `📧 الإيميل: <code>${esc(o.customerEmail)}</code>` : '',
    '──────────────',
    ...o.cartItems.map((item) => `• ${esc(item.productName)} — ${item.months} شهر ${item.planLabel ? `(${esc(item.planLabel)})` : ''} × ${item.quantity} (${formatMoney(item.unitPrice * item.quantity)})`),
    `💰 <b>الإجمالي: ${formatMoney(o.totalPrice)}</b>`,
    `💳 الدفع: <b>${esc(o.paymentMethod)}</b>`,
    `🕒 وقت الطلب: ${formatTime(o.createdAt)}`
  ];

  if (o.isPaidOnline && o.paymentDetails) {
    const pd = o.paymentDetails;
    lines.push(
      '──────────────',
      o.paymentMethod === 'رصيد المحفظة' ? '✅ <b>خصم مؤكّد من رصيد المحفظة:</b>' : '⚡ <b>وصل دفع إلكتروني مؤكّد (Chargily Pay):</b>',
      `• المبلغ المدفوع: <b>${formatMoney(pd.amountPaid || o.totalPrice)}</b>`,
      `• وسيلة الدفع: ${esc(pd.paymentMethodUsed || 'الذهبية / CIB')}`,
      `• وقت الدفع: ${esc(pd.paidAtFormatted || formatTime(o.paidAt))}`,
      `• اسم الدافع: ${esc(pd.payerName || o.customerName)}`,
      `• هاتف الدافع: <code>${esc(pd.payerPhone || o.whatsappNumber)}</code>`,
      pd.payerEmail ? `• إيميل الدافع: <code>${esc(pd.payerEmail)}</code>` : '',
      pd.transactionId ? `• مرجع العملية: <code>${esc(pd.transactionId)}</code>` : ''
    );
  } else if (o.receipts && o.receipts.length) {
    const lastReceipt = o.receipts[o.receipts.length - 1];
    lines.push(`📎 وصولات الدفع المرفقة: ${o.receipts.length} (آخر وصل: ${formatTime(lastReceipt.at)})`);
  } else {
    lines.push('⏳ لم يُرفق وصل دفع بعد');
  }

  if (o.deliveredAccount && (o.deliveredAccount.credentials || o.deliveredAccount.invitationUrl)) {
    const da = o.deliveredAccount;
    lines.push(
      '──────────────',
      '🔐 <b>بيانات الحساب المسلّم:</b>',
      da.type === 'invite' ? `• رابط التفعيل: ${esc(da.invitationUrl)}` : `• الحساب: <code>${esc(da.credentials)}</code>`,
      da.profileName ? `• اسم الشاشة: <b>${esc(da.profileName)}</b>` : '',
      da.pinCode ? `• كود الشاشة (PIN): <code>${esc(da.pinCode)}</code>` : '',
      da.extraNote ? `• ملاحظة التسليم: ${esc(da.extraNote)}` : ''
    );
  }

  if (o.adminNote) {
    lines.push(`📝 <b>ملاحظة إدارية:</b> ${esc(o.adminNote)}`);
  }

  return lines.filter(Boolean).join('\n');
}

function buildAdminOrderKeyboard(o) {
  const cleanPhone = String(o.whatsappNumber || '').replace(/^0/, '');
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ تأكيد', `s:${o._id}:1`),
      Markup.button.callback('❌ إلغاء', `s:${o._id}:3`)
    ],
    [
      Markup.button.callback('🔑 تسليم حساب / شاشة / رابط', `dlv:${o._id}`)
    ],
    [
      Markup.button.callback('📦 تم التسليم (بدون بيانات)', `s:${o._id}:2`),
      Markup.button.url('💬 واتساب', `https://wa.me/213${cleanPhone}`)
    ],
    [
      Markup.button.callback('📝 ملاحظة', `note:${o._id}`),
      Markup.button.callback('✉️ مراسلة العميل', `msg:${o._id}`)
    ]
  ]);
}

function buildProductSummary(p) {
  // Telegram text messages have a 4096-character limit after entity parsing.
  // Use short escaped previews; the full content remains stored in MongoDB/the admin form.
  const brief = (value, max = 100) => {
    const v = String(value ?? '');
    return esc(v.slice(0, max)) + (v.length > max ? '…' : '');
  };
  const plansText = (p.plans || []).slice(0, 12)
    .map((pl) => `• ${pl.months} شهر: <b>${formatMoney(pl.price)}</b> ${pl.label ? `— ${brief(pl.label, 40)}` : ''} ${pl.best ? '⭐ (الأوفر)' : ''}`)
    .join('\n');
  const featuresText = (p.features || []).slice(0, 8).map((f) => `✓ ${brief(f, 95)}`).join('\n');
  const stepsText = (p.steps || []).slice(0, 5).map((s, idx) => `${idx + 1}) <b>${brief(s.title, 55)}:</b> ${brief(s.desc, 95)}`).join('\n');

  return [
    `🛍️ <b>بطاقة العرض: ${esc(p.title)}</b> (${p.active ? '🟢 نشطة في الموقع' : '🔴 مخفية'})`,
    `🆔 المعرّف: <code>${esc(p.productId)}</code> | العلامة: <b>${esc(p.brandName)}</b>`,
    `📂 التصنيف: ${esc(p.category)}${p.badgeText ? ` | الشارة: ${esc(p.badgeText)}` : ''}`, 
    `🎨 الألوان: <code>${esc(p.primaryColor)}</code> / <code>${esc(p.secondaryColor)}</code> | الأيقونة: <b>${esc(p.iconText)}</b>`,
    p.imageUrl ? `🖼️ صورة البطاقة: ${esc(p.imageUrl)}` : '',
    `📝 <b>الوصف في صفحة الهبوط:</b>\n${esc(p.subtitle || 'لا يوجد وصف فرعي')}`,
    '──────────────',
    `✨ <b>المميزات (ما ستحصل عليه):</b>\n${featuresText || '—'}`,
    '──────────────',
    `📋 <b>خطوات الطلب في صفحة الهبوط:</b>\n${stepsText || '—'}`,
    '──────────────',
    `💰 <b>الباقات والأسعار:</b>\n${plansText}`,
    Array.isArray(p.audience) && p.audience.length ? `🎯 <b>يناسبك هذا الاشتراك إذا:</b>\n${p.audience.slice(0, 5).map(x => '• ' + brief(x, 100)).join('\n')}` : '',
    Array.isArray(p.limits) && p.limits.length ? `ℹ️ <b>حدود الخدمة:</b>\n${p.limits.slice(0, 5).map(x => '• ' + brief(x, 100)).join('\n')}` : '',
    p.guaranteeText ? `🛡️ <b>الضمان / الاستبدال:</b> ${brief(p.guaranteeText, 200)}` : '',
    p.deliveryText ? `📦 <b>التسليم:</b> ${brief(p.deliveryText, 170)}` : '',
    Array.isArray(p.faqs) && p.faqs.length ? `❓ <b>الأسئلة الشائعة:</b>\n${p.faqs.slice(0, 4).map(x => '• ' + brief(x.q, 75) + ': ' + brief(x.a, 115)).join('\n')}` : '',
    p.seoTitle ? `🔎 عنوان SEO: ${esc(p.seoTitle)}` : '',
    p.seoDescription ? `🧭 وصف SEO: ${brief(p.seoDescription, 110)}` : '',
    '──────────────',
    `🔗 رابط صفحة الهبوط المباشر:\n${SITE}/#/p/${encodeURIComponent(p.productId)}`
  ].filter(Boolean).join('\n');
}

function buildProductEditKeyboard(p) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✏️ العنوان والوصف', `pedit:title:${p._id}`),
      Markup.button.callback('💰 تعديل الباقات والأسعار', `pedit:plans:${p._id}`)
    ],
    [
      Markup.button.callback('✨ تعديل المميزات', `pedit:features:${p._id}`),
      Markup.button.callback('📋 تعديل خطوات الطلب', `pedit:steps:${p._id}`)
    ],
    [
      Markup.button.callback('🎨 الألوان والأيقونة والشارة', `pedit:style:${p._id}`),
      Markup.button.callback('🖼️ رابط صورة البطاقة', `pedit:img:${p._id}`)
    ],
    [
      Markup.button.callback('🎯 لمن يناسب؟', `pedit:audience:${p._id}`),
      Markup.button.callback('ℹ️ حدود الخدمة', `pedit:limits:${p._id}`)
    ],
    [
      Markup.button.callback('❓ الأسئلة الشائعة', `pedit:faqs:${p._id}`),
      Markup.button.callback('🛡️ نص الضمان', `pedit:guarantee:${p._id}`)
    ],
    [
      Markup.button.callback('📦 نص التسليم', `pedit:delivery:${p._id}`),
      Markup.button.callback('🔎 SEO', `pedit:seo:${p._id}`)
    ],
    [
      Markup.button.callback(p.active ? '🙈 إخفاء من الموقع' : '👁️ إظهار في الموقع', `ptoggle:${p._id}`),
      Markup.button.callback('🗑️ حذف البطاقة', `pdel:${p._id}`)
    ],
    [
      Markup.button.callback('🔙 العودة لقائمة البطاقات', 'plist_back')
    ]
  ]);
}

function buildDeliveredAccountMessage(o) {
  const da = o.deliveredAccount || {};
  return [
    `🎉 <b>تم تسليم طلبك رقم ${esc(o.orderCode)} بنجاح!</b>`,
    '──────────────',
    ...o.cartItems.map((i) => `🎬 <b>${esc(i.productName)}</b> (${i.months} شهر × ${i.quantity})`),
    '──────────────',
    da.type === 'invite' ? `🔗 <b>رابط التفعيل:</b>\n${esc(da.invitationUrl)}` : `🔐 <b>بيانات الدخول للحساب:</b>\n<code>${esc(da.credentials)}</code>`,
    da.profileName ? `👤 <b>اسم الشاشة الخاصة بك:</b> <code>${esc(da.profileName)}</code>` : '',
    da.pinCode ? `🔢 <b>رمز قفل الشاشة (PIN):</b> <code>${esc(da.pinCode)}</code>` : '',
    da.extraNote ? `📌 <b>تعليمات هامة:</b>\n${esc(da.extraNote)}` : '',
    '──────────────',
    '⚠️ يرجى الالتزام ببيانات الحساب والشاشة المخصّصة لك، والاطلاع على شروط اشتراكك.'
  ].filter(Boolean).join('\n');
}

async function sendOrderCardToAdmin(ctx, o) {
  const opts = { ...HTML, ...buildAdminOrderKeyboard(o) };
  const text = buildAdminOrderSummary(o);
  if (o.receipts && o.receipts.length) {
    return ctx.replyWithPhoto(o.receipts[o.receipts.length - 1].fileId, {
      caption: text.slice(0, 1020),
      ...opts
    });
  }
  return ctx.reply(text, opts);
}

if (bot) {
  bot.catch((err, ctx) => console.error('Telegram bot error:', err.message, ctx.updateType));

  bot.command('id', (ctx) => ctx.reply(`معرّفك الرقمي على تيليغرام: <code>${ctx.from.id}</code>`, HTML));

  async function linkCustomerOrder(ctx, rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    const o = await Order.findOne({ orderCode: code });
    if (!o) {
      return ctx.reply('❌ لم أجد طلباً بهذا الرمز، تأكد من كتابة الرمز بشكل صحيح (مثال: OP-1A2B3C4D).');
    }
    // معرفة رمز الطلب ليست إثباتاً للملكية: لا تربط تيليغرام ولا تكشف بيانات التسليم بمجرد الرمز.
    const linked = await Customer.findOne({ telegramChatId: ctx.chat.id, blocked: false }).lean();
    const ownsOrder = !!linked && ((o.customerId && String(o.customerId) === String(linked._id)) ||
      (linked.phoneVerified && o.whatsappNumber === linked.phone));
    if (!ownsOrder) {
      return ctx.reply(`🔎 الطلب ${esc(o.orderCode)}: ${esc(o.status)}. لعرض بياناته وربطه، افتح 🛒 المتجر والشراء وشارك رقم هاتفك من زر تيليغرام الرسمي للتحقق من الملكية.`, HTML);
    }
    if (!o.telegramChatId && linked) {
      o.telegramChatId = ctx.chat.id;
      o.customerId = linked._id;
      await o.save();
    }

    if (o.chargilyCheckoutId && !o.isPaidOnline) {
      try {
        const checkout = await verifyCheckoutStatus(o.chargilyCheckoutId);
        if (checkout && checkout.status === 'paid') {
          o.isPaidOnline = true;
          o.paidAt = new Date();
          o.paymentDetails = extractPaymentDetails(checkout, o);
          if (o.status === 'قيد المراجعة') {
            o.status = 'مؤكد';
            o.history.push({ status: 'مؤكد', by: 'chargily-bot-check' });
          }
          await o.save();
          await notifyChargilyPaidInternal(o);
        }
      } catch (e) {
        console.error('Bot chargily check error:', e.message);
      }
    }

    if (o.status === 'تم التسليم' && o.deliveredAccount && (o.deliveredAccount.credentials || o.deliveredAccount.invitationUrl)) {
      return ctx.reply(buildDeliveredAccountMessage(o), { ...HTML, ...customerMainKeyboard() });
    }

    if (o.isPaidOnline) {
      const pd = o.paymentDetails || {};
      return ctx.reply(
        [
          `✅ <b>تم ربط طلبك ${esc(o.orderCode)} وتأكيد دفعك الإلكتروني!</b>`,
          `💳 وسيلة الدفع: ${esc(o.paymentMethod)}`,
          `💰 المبلغ المدفوع: <b>${formatMoney(pd.amountPaid || o.totalPrice)}</b>`,
          `🕒 وقت الدفع: ${esc(pd.paidAtFormatted || formatTime(o.paidAt))}`,
          `📌 الحالة الحالية: <b>${esc(o.status)}</b>`,
          '',
          'سيصلك الحساب مع اسم الشاشة ورمز PIN هنا في هذه المحادثة فور تسليمه.'
        ].join('\n'),
        { ...HTML, ...customerMainKeyboard() }
      );
    }

    return ctx.reply(
      [
        `✅ <b>تم ربط طلبك ${esc(o.orderCode)}</b> (${formatMoney(o.totalPrice)})`,
        `💳 طريقة الدفع: ${esc(o.paymentMethod)}`,
        '',
        '📷 <b>أرسل الآن صورة واضحة لوصل الدفع</b> هنا في المحادثة ليتم تأكيد طلبك وتسليم الحساب.'
      ].join('\n'),
      { ...HTML, ...customerMainKeyboard() }
    );
  }

  // ===== تسجيل الدخول إلى الموقع عبر البوت (بديل موثوق عن ويدجت تيليغرام) =====
  async function handleSiteLoginStart(ctx, token) {
    if (!ctx.chat || ctx.chat.type !== 'private') return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sess = await TelegramLogin.findOne({ tokenHash, state: 'pending' });
    if (!sess || Date.now() - sess.createdAt.getTime() > 5 * 60 * 1000) {
      return ctx.reply('❌ رابط الدخول غير صالح أو انتهت صلاحيته.\nارجع إلى الموقع واضغط زر (الدخول عبر بوت تيليغرام) من جديد.', customerMainKeyboard());
    }
    sess.chatId = ctx.from.id;
    sess.firstName = String(ctx.from.first_name || '').slice(0, 60);
    sess.lastName = String(ctx.from.last_name || '').slice(0, 60);
    sess.username = String(ctx.from.username || '').slice(0, 60);
    sess.state = 'awaiting';
    await sess.save();

    return ctx.reply(
      [
        '🔐 <b>طلب تسجيل دخول إلى OVIRA PLAY</b>',
        '──────────────',
        'هل أنت من ضغط على زر الدخول في موقع <b>rioxstore.shop</b> الآن؟',
        '⚠️ إذا وصلك هذا الرابط من شخص آخر فاضغط «لست أنا».'
      ].join('\n'),
      {
        ...HTML,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ نعم، أنا من طلب الدخول', `tglogin:ok:${sess._id}`)],
          [Markup.button.callback('❌ لست أنا', `tglogin:no:${sess._id}`)]
        ])
      }
    );
  }

  bot.action(/^tglogin:(ok|no):([a-f0-9]{24})$/, async (ctx) => {
    const [, decision, id] = ctx.match;
    const sess = await TelegramLogin.findOneAndUpdate(
      { _id: id, chatId: ctx.from.id, state: 'awaiting' },
      { $set: { state: decision === 'ok' ? 'approved' : 'rejected' } }
    );
    if (!sess || Date.now() - sess.createdAt.getTime() > 5 * 60 * 1000) {
      await ctx.answerCbQuery('انتهت صلاحية الطلب', { show_alert: true }).catch(() => {});
      return ctx.editMessageText('⌛ انتهت صلاحية طلب الدخول. أعد المحاولة من الموقع.').catch(() => {});
    }
    await ctx.answerCbQuery(decision === 'ok' ? 'تم التأكيد ✓' : 'تم الرفض').catch(() => {});
    return ctx.editMessageText(
      decision === 'ok'
        ? '✅ <b>تم تأكيد الدخول.</b>\nارجع الآن إلى الموقع وسيُفتح حسابك تلقائيًا خلال ثوانٍ.'
        : '🚫 تم رفض طلب الدخول. لم يتم تسجيل أي دخول.',
      HTML
    ).catch(() => {});
  });

  bot.start(async (ctx) => {
    adminSessions.delete(ctx.from.id);
    customerSessions.delete(ctx.from.id);

    if (ctx.startPayload) {
      const payload = String(ctx.startPayload).trim();

      if (/^LNK-[A-F0-9]{6}$/i.test(payload)) {
        const cust = await Customer.findOne({
          linkCode: payload.toUpperCase(),
          linkCodeExpiresAt: { $gt: new Date() }
        });
        if (!cust) {
          return ctx.reply(
            '❌ رابط ربط الحساب غير صالح أو انتهت صلاحيته.\nارجع إلى صفحة (حسابي) في الموقع واضغط على (ربط تيليغرام) للحصول على رابط جديد.',
            customerMainKeyboard()
          );
        }
        cust.telegramChatId = ctx.chat.id;
        if (ctx.from && ctx.from.username) cust.telegramUsername = ctx.from.username;
        cust.linkCode = undefined;
        cust.linkCodeExpiresAt = undefined;
        await cust.save();

        await Order.updateMany(
          { customerId: cust._id, telegramChatId: { $exists: false } },
          { $set: { telegramChatId: ctx.chat.id } }
        );
        if (cust.phoneVerified && cust.phone) {
          await Order.updateMany(
            { whatsappNumber: cust.phone, customerId: { $exists: false }, telegramChatId: { $exists: false } },
            { $set: { customerId: cust._id, telegramChatId: ctx.chat.id } }
          );
        }

        return ctx.reply(
          [
            `✅ <b>تم ربط حسابك (${esc(cust.name)}) ببوت تيليغرام بنجاح!</b>`,
            '──────────────',
            '🔐 يمكنك الآن العودة إلى الموقع وتفعيل <b>التحقق بخطوتين (2FA) عبر تيليغرام</b> لتصلك رموز الدخول الآمنة هنا.',
            '📲 كما ستصلك إشعارات طلباتك وبيانات الحسابات والشاشات في هذه المحادثة.'
          ].join('\n'),
          { ...HTML, ...customerMainKeyboard() }
        );
      }

      // دخول الموقع عبر البوت: t.me/<bot>?start=lg_<48 hex>
      if (/^lg_[a-f0-9]{48}$/i.test(payload)) {
        return handleSiteLoginStart(ctx, payload.slice(3).toLowerCase());
      }

      return linkCustomerOrder(ctx, payload);
    }

    const isAdm = await checkAdminRole(ctx.from.id, 'view_orders');
    if (isAdm) {
      return ctx.reply(
        '👑 <b>مرحباً بك في لوحة إدارة OVIRA PLAY المتكاملة</b>\nجميع الأزرار مربوطة مباشرة مع الموقع ولوحة التحكم وقاعدة البيانات.',
        { ...HTML, ...adminMainKeyboard() }
      );
    }

    return ctx.reply(
      '👋 <b>أهلاً بك في OVIRA PLAY!</b>\nأرسل رمز طلبك (مثل <code>OP-1A2B3C4D</code>) لربطه بحسابك، أو استخدم الأزرار بالأسفل لتتبع طلباتك واستلام حساباتك.',
      { ...HTML, ...customerMainKeyboard() }
    );
  });

  // متجر Telegram يعتمد قاعدة المنتجات وطرق الدفع نفسها، ولا يسمح بسعر من العميل.
  const shopLocks = new Set();
  const cleanPhone = (v) => String(v || '').replace(/\D/g, '').replace(/^213/, '0');
  async function showBotShop(ctx) {
    await ensureSeedProducts();
    const products = await Product.find({ active: true }).sort({ sortOrder: 1 }).limit(30).lean();
    if (!products.length) return ctx.reply('لا توجد باقات منشورة حالياً.');
    return ctx.reply('🛒 <b>متجر OVIRA PLAY</b> — الأسعار والمنتجات مباشرة من قاعدة بيانات الموقع. اختر الخدمة:', {
      ...HTML,
      ...Markup.inlineKeyboard(products.map((p) => [Markup.button.callback(`🛍️ ${p.title}`, `shopview:${p._id}`)]))
    });
  }
  bot.hears('🛒 المتجر والشراء', showBotShop);
  bot.action(/^shopview:([a-f0-9]{24})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const prod = await Product.findOne({ _id: ctx.match[1], active: true }).lean();
    if (!prod) return ctx.reply('المنتج غير متوفر حالياً.');
    const buttons = prod.plans.map((plan) => [Markup.button.callback(
      `${plan.months} شهر · ${formatMoney(plan.price)} ${plan.label || ''}${plan.best ? ' ⭐' : ''}`.slice(0, 60),
      `shopplan:${prod._id}:${prod.plans.indexOf(plan)}`
    )]);
    return ctx.reply(`🎬 <b>${esc(prod.title)}</b>\n${esc(prod.subtitle || '')}\nاختر الباقة:`, { ...HTML, ...Markup.inlineKeyboard(buttons) });
  });
  bot.action(/^shopplan:([a-f0-9]{24}):(\d{1,2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const prod = await Product.findOne({ _id: ctx.match[1], active: true }).lean();
    const plan = prod?.plans[Number(ctx.match[2])];
    if (!plan) return ctx.reply('الباقة غير متاحة، حدّث القائمة.');
    const methods = await getPublicMethods();
    if (!methods.length) return ctx.reply('طرق الدفع غير متاحة حالياً.');
    const cust = await Customer.findOne({ telegramChatId: ctx.chat.id, phoneVerified: true, blocked: false });
    if (!cust || !cust.email) {
      customerSessions.set(ctx.from.id, { step: 'SHOP_PHONE', productId: ctx.match[1], planIndex: Number(ctx.match[2]) });
      return ctx.reply('🔐 لإنشاء طلب من البوت دون موقع، شارك رقم هاتفك <b>عبر زر مشاركة جهة الاتصال الرسمي</b> للتحقق من الملكية (لا تقبل أرقامًا مكتوبة).', {
        ...HTML, ...Markup.keyboard([[Markup.button.contactRequest('📲 مشاركة رقمي للتحقق')], ['🛒 المتجر والشراء']]).resize().oneTime()
      });
    }
    const keys = methods.map((method) => [Markup.button.callback(method.name, `shoppay:${prod._id}:${ctx.match[2]}:${method.id}`)]);
    return ctx.reply(`✅ ${esc(prod.title)} — ${plan.months} شهر\n💰 <b>${formatMoney(plan.price)}</b>\nاختر الدفع:`, {
      ...HTML,
      ...Markup.inlineKeyboard(keys)
    });
  });
  bot.on('contact', async (ctx) => {
    const sess = customerSessions.get(ctx.from.id);
    if (!sess || sess.step !== 'SHOP_PHONE') return;
    const contact = ctx.message.contact;
    if (!contact.user_id || Number(contact.user_id) !== Number(ctx.from.id)) {
      return ctx.reply('⚠️ يجب مشاركة رقم هاتف حسابك أنت عبر زر تيليغرام الرسمي.');
    }
    const phone = cleanPhone(contact.phone_number);
    if (!/^0[567]\d{8}$/.test(phone)) return ctx.reply('هذا الرقم ليس رقم هاتف جزائري صالحًا.');
    const existing = await Customer.findOne({ phone });
    if (existing?.telegramChatId && existing.telegramChatId !== ctx.chat.id) {
      return ctx.reply('هذا الهاتف مرتبط بحساب تيليغرام آخر. تواصل مع الدعم لاستعادة الحساب.');
    }
    sess.phone = phone;
    sess.customerId = existing?._id || null;
    sess.step = 'SHOP_EMAIL';
    return ctx.reply('📧 أرسل بريدك الإلكتروني الشخصي لإتمام طلبك وحفظه في حسابك:', Markup.removeKeyboard());
  });
  bot.action(/^shoppay:([a-f0-9]{24}):(\d{1,2}):([a-z0-9]+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const lockKey = String(ctx.from.id);
    if (shopLocks.has(lockKey)) return ctx.reply('طلبك قيد المعالجة بالفعل.');
    shopLocks.add(lockKey);
    let debited = false, customer = null, price = 0;
    try {
      customer = await Customer.findOne({ telegramChatId: ctx.chat.id, phoneVerified: true, blocked: false });
      if (!customer || !customer.email || !customer.phone) return ctx.reply('يرجى التحقق من رقم هاتفك أولًا من قائمة 🛒 المتجر والشراء.');
      const product = await Product.findOne({ _id: ctx.match[1], active: true }).lean();
      const plan = product?.plans[Number(ctx.match[2])];
      const months = plan?.months;
      if (!plan) return ctx.reply('الباقة لم تعد متاحة.');
      const methods = await getPublicMethods();
      const payMethod = methods.find((m) => m.id === ctx.match[3]);
      if (!payMethod) return ctx.reply('طريقة الدفع لم تعد متاحة.');
      price = plan.price;
      const recent = await Order.findOne({ customerId: customer._id, status: { $ne: 'ملغي' },
        createdAt: { $gt: new Date(Date.now() - 3 * 60000) },
        'cartItems.productId': product.productId, 'cartItems.planKey': planKey(plan) }).lean();
      if (recent) return ctx.reply(`🧾 لديك طلب حديث مطابق: ${recent.orderCode} (${recent.status}). لا حاجة لإنشاء طلب مكرر.`);
      const daily = await Order.countDocuments({ customerId: customer._id, createdAt: { $gt: new Date(Date.now() - 86400000) } });
      if (daily >= 8) return ctx.reply('تم الوصول إلى حد الطلبات اليومي، تواصل مع الدعم لمراجعة الحساب.');
      if (payMethod.id === 'wallet') {
        const updated = await Customer.findOneAndUpdate(
          { _id: customer._id, blocked: false, balance: { $gte: price } },
          { $inc: { balance: -price } }, { new: true }
        );
        if (!updated) return ctx.reply(`رصيد محفظتك غير كافٍ (${formatMoney(customer.balance)}).`);
        debited = true;
      }
      const paid = payMethod.id === 'wallet';
      const order = await Order.create({
        orderCode: 'OP-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        customerId: customer._id, telegramChatId: ctx.chat.id,
        customerName: customer.name, whatsappNumber: customer.phone, customerEmail: customer.email,
        cartItems: [{ productId: product.productId, productName: product.title, months, quantity: 1, unitPrice: price, planKey: planKey(plan), planLabel: plan.label || '' }],
        subTotal: price, totalPrice: price, paymentMethod: payMethod.name,
        status: paid ? 'مؤكد' : 'قيد المراجعة', isPaidOnline: paid,
        paidAt: paid ? new Date() : undefined,
        paymentDetails: paid ? { amountPaid: price, transactionId: 'WALLET-TG-' + crypto.randomBytes(8).toString('hex'), paymentMethodUsed: payMethod.name } : undefined,
        history: [{ status: paid ? 'مؤكد' : 'قيد المراجعة', by: 'telegram-shop' }]
      });
      debited = false; // الطلب موجود: لا تعوض بعد الحفظ
      if (payMethod.id === 'chargily') {
        try {
          const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
          if (!publicUrl) throw new Error('PUBLIC_URL_MISSING');
          const session = await createCheckoutSession({ order, originUrl: SITE, webhookUrl: `${publicUrl}/api/orders/chargily-webhook` });
          order.chargilyCheckoutId = session.checkoutId;
          await order.save();
          await ctx.reply(`🧾 الطلب: ${order.orderCode}\n💰 ${formatMoney(price)}\n🔐 ادفع عبر بوابة Chargily الرسمية:`,
            Markup.inlineKeyboard([[Markup.button.url('💳 الذهاب لصفحة الدفع الآمنة', session.checkoutUrl)]]));
        } catch (e) {
          console.error('Telegram checkout error:', e.message);
          await ctx.reply(`سُجل الطلب ${order.orderCode} لكن تعذر إنشاء رابط Chargily. لم يُؤكد الدفع. تواصل مع الدعم أو انتظر إصلاح البوابة.`);
        }
      } else {
        const destination = [payMethod.label, payMethod.value].filter(Boolean).join(': ');
        await ctx.reply(`🧾 <b>تم تسجيل طلبك ${esc(order.orderCode)}</b>\n🎬 ${esc(product.title)} (${months} شهر)\n💰 ${formatMoney(price)}\n💳 ${esc(payMethod.name)}\n${paid ? '✅ تم خصم المحفظة وتأكيد الطلب' : `📌 بيانات التحويل: ${esc(destination)}\n📸 أرسل صورة وصل الدفع هنا للمراجعة اليدوية`}`, HTML);
      }
      notifyNewOrder(order).catch((e) => console.error('Telegram shop notify failed:', e.message));
      return;
    } catch (e) {
      if (debited && customer) await Customer.updateOne({ _id: customer._id }, { $inc: { balance: price } }).catch(() => {});
      console.error('Telegram shop failed:', e.message);
      return ctx.reply('تعذر إنشاء الطلب، لم يُؤكد الدفع. أعد المحاولة أو اتصل بالدعم.');
    } finally { shopLocks.delete(lockKey); }
  });

  bot.hears('📦 طلباتي وحساباتي', async (ctx) => {
    const cust = await Customer.findOne({ telegramChatId: ctx.chat.id, blocked: false }).lean();
    if (!cust) return ctx.reply('🔐 للتحقق من ملكية الطلبات، اربط حساب الموقع أو افتح متجر البوت وشارك رقم هاتفك.');
    const match = [{ customerId: cust._id }];
    if (cust.phoneVerified && cust.phone) match.push({ whatsappNumber: cust.phone });
    const orders = await Order.find({ $or: match }).sort({ createdAt: -1 }).limit(10).lean();
    if (!orders.length) {
      return ctx.reply(
        '📭 لا توجد طلبات مرتبطة بحسابك على تيليغرام حتى الآن.\nأرسل رمز طلبك (مثل <code>OP-1A2B3C4D</code>) لربطه فوراً.',
        HTML
      );
    }

    for (const o of orders) {
      const lines = [
        `🧾 <b>الطلب: ${esc(o.orderCode)}</b> — ${STATUS_ICON[o.status] || ''} <b>${esc(o.status)}</b>`,
        ...o.cartItems.map((i) => `• ${esc(i.productName)} (${i.months} شهر × ${i.quantity})`),
        `💰 المبلغ: <b>${formatMoney(o.totalPrice)}</b> · ${esc(o.paymentMethod)}`,
        `🕒 التاريخ: ${formatTime(o.createdAt)}`
      ];

      if (o.status === 'تم التسليم' && o.deliveredAccount && (o.deliveredAccount.credentials || o.deliveredAccount.invitationUrl)) {
        const da = o.deliveredAccount;
        lines.push(
          '──────────────',
          da.type === 'invite' ? `🔗 <b>رابط التفعيل:</b> ${esc(da.invitationUrl)}` : `🔐 <b>الحساب:</b> <code>${esc(da.credentials)}</code>`,
          da.profileName ? `👤 <b>اسم الشاشة:</b> <code>${esc(da.profileName)}</code>` : '',
          da.pinCode ? `🔢 <b>كود PIN:</b> <code>${esc(da.pinCode)}</code>` : '',
          da.extraNote ? `📌 <b>ملاحظة:</b> ${esc(da.extraNote)}` : ''
        );
      }
      await ctx.reply(lines.filter(Boolean).join('\n'), HTML);
    }
  });

  bot.hears('🔍 تتبع طلب برمزه', async (ctx) => {
    customerSessions.set(ctx.from.id, { step: 'WAIT_TRACK_CODE' });
    return ctx.reply('🔍 أرسل الآن <b>رمز الطلب</b> الذي تريد تتبعه (مثال: <code>OP-1A2B3C4D</code>):', HTML);
  });

  bot.hears('💰 محفظتي وحسابي', async (ctx) => {
    const customer = await Customer.findOne({ telegramChatId: ctx.chat.id, blocked: false }).lean();

    if (!customer) {
      return ctx.reply(
        `👤 لم يتم ربط حساب متجر بمعرّف تيليغرام الخاص بك بعد.\nيمكنك الدخول إلى حسابك في الموقع (${SITE}/#/account) والضغط على <b>ربط تيليغرام</b> أو إرسال رمز طلبك هنا.`,
        HTML
      );
    }

    const twoFaText = customer.twoFactorEnabled
      ? `🟢 مفعل (${customer.twoFactorMethod === 'telegram' ? 'عبر بوت تيليغرام' : 'عبر Google Authenticator'})`
      : '⚪ غير مفعل (يمكنك تفعيله من الموقع)';

    return ctx.reply(
      [
        '💳 <b>بطاقة حسابك في OVIRA PLAY</b>',
        '──────────────',
        `👤 الاسم: <b>${esc(customer.name)}</b>`,
        customer.phone ? `📱 الهاتف: <code>${esc(customer.phone)}</code>` : '',
        customer.email ? `📧 الإيميل: <code>${esc(customer.email)}</code>` : '',
        `🔐 التحقق بخطوتين (2FA): <b>${twoFaText}</b>`,
        `💰 <b>رصيد المحفظة المتاح: ${formatMoney(customer.balance || 0)}</b>`,
        '',
        `🌐 يمكنك الشراء برصيدك أو إدارة أمان حسابك من الموقع:\n${SITE}/#/account`
      ].filter(Boolean).join('\n'),
      HTML
    );
  });

  bot.hears('🎫 تقديم شكوى / دعم', async (ctx) => {
    customerSessions.set(ctx.from.id, { step: 'COMPLAINT_ORDER_CODE', data: {} });
    return ctx.reply(
      '🎫 <b>فتح تذكرة دعم أو شكوى جديدة</b>\n\nأرسل <b>رمز الطلب</b> المتعلق بالمشكلة (مثل <code>OP-1A2B3C4D</code>)، أو أرسل كلمة <b>تخطي</b> إذا كانت شكوى عامة:',
      {
        ...HTML,
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]])
      }
    );
  });

  bot.hears('✅ الطلبات المسلّمة', adminGuard('view_orders', async (ctx) => {
    const rows = await Order.find({ status: 'تم التسليم' }).sort({ createdAt: -1 }).limit(25).lean();
    if (!rows.length) return ctx.reply('لا توجد طلبات مسلّمة بعد.');
    return ctx.reply(`✅ <b>آخر ${rows.length} طلباً مسلّماً</b> — اضغط لعرض التفاصيل:`, {
      ...HTML, ...Markup.inlineKeyboard(rows.map((o) => [Markup.button.callback(`${o.orderCode} · ${o.customerName.slice(0, 15)}`, `o:${o._id}`)]))
    });
  }));

  bot.hears(['📋 الطلبات', '📋 الطلبات المعلقة'], adminGuard('view_orders', async (ctx) => {
    const [pendingOrders, recentOrders] = await Promise.all([
      Order.find({ status: { $in: ['قيد المراجعة', 'مؤكد'] } }).sort({ createdAt: -1 }).limit(12).lean(),
      Order.find({ status: { $ne: 'تم التسليم' } }).sort({ createdAt: -1 }).limit(8).lean()
    ]);

    const listToShow = pendingOrders.length ? pendingOrders : recentOrders;
    if (!listToShow.length) {
      return ctx.reply('📭 لا توجد أي طلبات في قاعدة البيانات حالياً.', adminMainKeyboard());
    }

    const titleText = pendingOrders.length
      ? `📋 <b>الطلبات النشطة بانتظار المراجعة أو التسليم (${pendingOrders.length}):</b>`
      : `📋 <b>لا توجد طلبات معلقة 🎉 — هذه أحدث الطلبات (${recentOrders.length}):</b>`;

    const buttons = listToShow.map((o) => [
      Markup.button.callback(
        `${STATUS_ICON[o.status]} ${o.orderCode} · ${o.customerName.slice(0, 14)} · ${formatMoney(o.totalPrice)}`,
        `o:${o._id}`
      )
    ]);
    buttons.push([Markup.button.callback('📂 عرض كل الطلبات الأخيرة', 'orders_all_recent')]);

    return ctx.reply(titleText, {
      ...HTML,
      ...Markup.inlineKeyboard(buttons)
    });
  }));

  bot.action('orders_all_recent', adminGuard('view_orders', async (ctx) => {
    await ctx.answerCbQuery();
    const recent = await Order.find({ status: { $ne: 'تم التسليم' } }).sort({ createdAt: -1 }).limit(15).lean();
    if (!recent.length) return ctx.reply('لا توجد طلبات.');
    const buttons = recent.map((o) => [
      Markup.button.callback(
        `${STATUS_ICON[o.status]} ${o.orderCode} · ${o.customerName.slice(0, 14)} · ${formatMoney(o.totalPrice)}`,
        `o:${o._id}`
      )
    ]);
    return ctx.reply('📂 <b>أحدث 15 طلباً في المتجر:</b>', { ...HTML, ...Markup.inlineKeyboard(buttons) });
  }));

  async function showProductsManager(ctx) {
    await ensureSeedProducts();
    const products = await Product.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();

    const buttons = products.map((p) => [
      Markup.button.callback(
        `${p.active ? '🟢' : '🔴'} ${p.title} (${p.brandName}) — ${p.plans.length} باقات`,
        `pview:${p._id}`
      )
    ]);
    buttons.unshift([Markup.button.callback('➕ إنشاء بطاقة عرض وصفحة هبوط جديدة', 'pnew_start')]);

    return ctx.reply(
      `🛍️ <b>إدارة بطاقات العرض وصفحات الهبوط (${products.length}):</b>\n\n` +
      `• اضغط على <b>إنشاء بطاقة عرض جديدة</b> لتصميم بطاقة كاملة (مثل كرانشي رول أو نتفلكس) مع تخصيص العنوان، الوصف، المميزات، الألوان، والأسعار.\n` +
      `• أو اضغط على أي بطاقة حالية لتعديلها فوراً في الموقع:`,
      {
        ...HTML,
        ...Markup.inlineKeyboard(buttons)
      }
    );
  }

  bot.hears(['🛍️ البطاقات والمنتجات', '📦 المخزون', '🎟 الكوبونات'], adminGuard('view_orders', showProductsManager));
  bot.action('plist_back', adminGuard('view_orders', async (ctx) => {
    await ctx.answerCbQuery();
    return showProductsManager(ctx);
  }));

  bot.action(/^pview:([a-f0-9]{24})$/, adminGuard('view_orders', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await Product.findById(ctx.match[1]).lean();
    if (!p) return ctx.reply('البطاقة غير موجودة.');
    return ctx.reply(buildProductSummary(p), {
      ...HTML,
      ...buildProductEditKeyboard(p)
    });
  }));

  bot.action(/^ptoggle:([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    const p = await Product.findById(ctx.match[1]);
    if (!p) return ctx.answerCbQuery('غير موجودة');
    p.active = !p.active;
    await p.save();
    await ctx.answerCbQuery(p.active ? 'تم إظهار البطاقة في الموقع 🟢' : 'تم إخفاء البطاقة 🔴');
    return ctx.editMessageText(buildProductSummary(p), {
      ...HTML,
      ...buildProductEditKeyboard(p)
    }).catch(() => {});
  }));

  bot.action(/^pdel:([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    const p = await Product.findByIdAndDelete(ctx.match[1]);
    if (!p) return ctx.answerCbQuery('غير موجودة');
    await ctx.answerCbQuery('تم حذف البطاقة نهائياً 🗑️');
    return showProductsManager(ctx);
  }));

  bot.action(/^pedit:(title|plans|features|steps|style|img|audience|limits|faqs|guarantee|delivery|seo):([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    const field = ctx.match[1];
    const prodId = ctx.match[2];
    const p = await Product.findById(prodId).lean();
    if (!p) return ctx.answerCbQuery('البطاقة غير موجودة');

    adminSessions.set(ctx.from.id, {
      type: 'EDIT_PRODUCT_FIELD',
      field,
      prodId: String(p._id),
      prodTitle: p.title
    });

    await ctx.answerCbQuery();
    const prompts = {
      title: `✏️ <b>تعديل العنوان والوصف لبطاقة (${esc(p.title)}):</b>\n\nأرسل العنوان الجديد في السطر الأول، والوصف التفصيلي لصفحة الهبوط في السطر الثاني:\n\nمثال:\n<code>كرانشي رول Mega Fan\nأكبر مكتبة أنمي عالمية بدون إعلانات وبأعلى جودة</code>`,
      plans: `💰 <b>تعديل الباقات والأسعار لبطاقة (${esc(p.title)}):</b>\n\nأرسل الصيغة: الأشهر:السعر|اسم الباقة، وضع نجمة بعد السعر للأوفر. مثال:\n<code>1:600|مشترك, 1:1600*|خاص, 12:5500|سنة</code>`,
      features: `✨ <b>تعديل مميزات صفحة الهبوط (ما ستحصل عليه) لبطاقة (${esc(p.title)}):</b>\n\nأرسل كل ميزة في سطر مستقل:\n\nمثال (اكتب المميزات المؤكدة فقط):\n<code>جودة HD\nإمكانية المشاهدة على التلفاز</code>`,
      steps: `📋 <b>تعديل خطوات الطلب في صفحة الهبوط لبطاقة (${esc(p.title)}):</b>\n\nأرسل كل خطوة في سطر بصيغة (العنوان | الشرح):\n\nمثال:\n<code>اختر باقتك | حدد المدة المناسبة وأضفها للسلة\nأكمل الطلب | اختر طريقة دفع متاحة\nانتظر التسليم | اتبع تعليمات الفريق بعد تأكيد الطلب</code>`,
      style: `🎨 <b>تعديل التصميم والألوان والشارة لبطاقة (${esc(p.title)}):</b>\n\nأرسل في سطر واحد مفصول بعلامة <code>|</code>:\n<code>اللون الأول | اللون الثاني | الحرف/الرمز | الشارة</code>\n\nمثال تصميم كرانشي رول:\n<code>#F47521 | #8A3A0A | C | </code>\nاترك الشارة فارغة لإزالتها.`,
      img: `🖼️ <b>تحديث صورة البطاقة (${esc(p.title)}):</b>\n\nأرسل رابط الصورة المباشر (يبدأ بـ <code>https://</code>)، أو أرسل كلمة <b>حذف</b> للعودة لتصميم البطاقة الأيقوني الافتراضي:`,
      audience: `🎯 <b>يناسبك الاشتراك إذا:</b>\nأرسل حالة واحدة في كل سطر (6 أسطر كحد أقصى)، أو أرسل <b>حذف</b> لإخفاء القسم.`,
      limits: `ℹ️ <b>معلومات مهمة وحدود الخدمة:</b>\nأرسل قيدًا واقعيًا في كل سطر (حتى 8 أسطر)، أو <b>حذف</b> لإخفائه.`,
      faqs: `❓ <b>الأسئلة الشائعة للمنتج:</b>\nكل سطر بالصيغة <code>السؤال | الجواب</code> (حتى 8 أسئلة). أرسل <b>حذف</b> لإخفاء القسم.`,
      guarantee: `🛡️ <b>الضمان والاستبدال:</b>\nأرسل السياسة المعتمدة فعلًا (600 حرف كحد أقصى)، أو <b>حذف</b> لإخفائها.`,
      delivery: `📦 <b>كيفية ووقت التسليم:</b>\nأرسل معلومات التسليم الحقيقية (400 حرف كحد أقصى)، أو <b>حذف</b> لإخفائها.`,
      seo: `🔎 <b>SEO لصفحة المنتج:</b>\nأرسل عنوان المنتج في السطر الأول (حتى 70 حرفًا)، ووصفه في السطر الثاني (حتى 200 حرف). أرسل <b>حذف</b> لمسحهما.`
    };

    return ctx.reply(prompts[field], {
      ...HTML,
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]])
    });
  }));

  bot.action('pnew_start', adminGuard('edit_orders', async (ctx) => {
    await ctx.answerCbQuery();
    const tplButtons = [
      [
        Markup.button.callback('🟠 قالب Crunchyroll', 'ptpl:crunchyroll'),
        Markup.button.callback('🔴 قالب Netflix', 'ptpl:netflix')
      ],
      [
        Markup.button.callback('🔵 قالب Shahid VIP', 'ptpl:shahid'),
        Markup.button.callback('💠 قالب Prime Video', 'ptpl:prime')
      ],
      [
        Markup.button.callback('▶️ قالب YouTube', 'ptpl:youtube'),
        Markup.button.callback('🟢 قالب Spotify', 'ptpl:spotify')
      ],
      [
        Markup.button.callback('🤖 قالب ChatGPT', 'ptpl:chatgpt'),
        Markup.button.callback('🟣 قالب Canva Pro', 'ptpl:canva')
      ],
      [
        Markup.button.callback('📺 قالب IPTV Pro', 'ptpl:iptv'),
        Markup.button.callback('🎨 تصميم وألوان مخصصة', 'ptpl:custom')
      ],
      [Markup.button.callback('❌ إلغاء', 'cancel_session')]
    ];

    return ctx.reply(
      '🎨 <b>إنشاء بطاقة عرض وصفحة هبوط جديدة (الخطوة 1 من 6):</b>\n\nاختر قالب التصميم والألوان والشعار الجاهز، أو اختر تصميماً مخصصاً:',
      { ...HTML, ...Markup.inlineKeyboard(tplButtons) }
    );
  }));

  bot.action(/^ptpl:([a-z]+)$/, adminGuard('edit_orders', async (ctx) => {
    const key = ctx.match[1];
    await ctx.answerCbQuery();

    if (key === 'custom') {
      adminSessions.set(ctx.from.id, {
        type: 'NEW_PRODUCT',
        step: 'CUSTOM_BRAND',
        data: {
          primaryColor: '#2447C9',
          secondaryColor: '#12286E',
          iconText: '★',
          badgeText: ''
        }
      });
      return ctx.reply(
        '🏷️ <b>أرسل اسم الخدمة أو العلامة التجارية</b> (مثال: <code>Disney+</code> أو <code>OSN+</code>):',
        { ...HTML, ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]]) }
      );
    }

    const tpl = PRESET_TEMPLATES[key] || PRESET_TEMPLATES.crunchyroll;
    adminSessions.set(ctx.from.id, {
      type: 'NEW_PRODUCT',
      step: 'TITLE',
      data: { ...tpl }
    });

    return ctx.reply(
      `✅ تم اختيار قالب <b>${esc(tpl.brandName)}</b>.\n\n` +
      `📌 <b>الخطوة 2 من 6:</b> أرسل الآن <b>عنوان البطاقة الرئيسي</b> الذي سيظهر للزبائن (مثال: <code>كرانشي رول حساب كامل</code> أو <code>نتفلكس 4K شاشة خاصة</code>):`,
      { ...HTML, ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]]) }
    );
  }));

  bot.hears(['📊 لوحة التحكم', '💰 المالية', '🔔 التجديدات'], adminGuard('view_orders', async (ctx) => {
    const [byStatus, totalCustomers, openComplaints, totalProducts] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, sum: { $sum: '$totalPrice' } } }]),
      Customer.countDocuments(),
      Complaint.countDocuments({ status: 'مفتوحة' }),
      Product.countDocuments({ active: true })
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s]));
    const paidRevenue =
      ((statusMap['مؤكد'] && statusMap['مؤكد'].sum) || 0) +
      ((statusMap['تم التسليم'] && statusMap['تم التسليم'].sum) || 0);
    const totalOrders = byStatus.reduce((acc, s) => acc + s.count, 0);

    const text = [
      '📊 <b>ملخص لوحة التحكم والمالية الحية — OVIRA PLAY</b>',
      '──────────────',
      `💰 <b>إجمالي المبيعات المؤكدة والمسلمة: ${formatMoney(paidRevenue)}</b>`,
      `📦 إجمالي الطلبات الكلي: <b>${totalOrders} طلب</b>`,
      `• 🟡 قيد المراجعة: <b>${(statusMap['قيد المراجعة'] && statusMap['قيد المراجعة'].count) || 0}</b> (${formatMoney((statusMap['قيد المراجعة'] && statusMap['قيد المراجعة'].sum) || 0)})`,
      `• 🔵 مؤكد (بانتظار التسليم): <b>${(statusMap['مؤكد'] && statusMap['مؤكد'].count) || 0}</b> (${formatMoney((statusMap['مؤكد'] && statusMap['مؤكد'].sum) || 0)})`,
      `• 🟢 تم التسليم: <b>${(statusMap['تم التسليم'] && statusMap['تم التسليم'].count) || 0}</b> (${formatMoney((statusMap['تم التسليم'] && statusMap['تم التسليم'].sum) || 0)})`,
      `• 🔴 ملغي: <b>${(statusMap['ملغي'] && statusMap['ملغي'].count) || 0}</b>`,
      '──────────────',
      `👥 الزبائن المسجلون: <b>${totalCustomers} زبون</b>`,
      `🛍️ البطاقات النشطة في الموقع: <b>${totalProducts} بطاقة</b>`,
      `🎫 الشكاوى المفتوحة: <b>${openComplaints} شكوى</b>`,
      '──────────────',
      `🌐 رابط لوحة التحكم الكاملة:\n${SITE}/admin.html`
    ].join('\n');

    return ctx.reply(text, { ...HTML, ...adminMainKeyboard() });
  }));

  bot.hears(['🎫 الشكاوى', '🎫 الشكاوى المفتوحة'], adminGuard('view_orders', async (ctx) => {
    const list = await Complaint.find({ status: 'مفتوحة' }).sort({ createdAt: -1 }).limit(10).lean();
    if (!list.length) {
      return ctx.reply('✅ لا توجد شكاوى مفتوحة حالياً.', adminMainKeyboard());
    }
    for (const c of list) {
      await ctx.reply(
        [
          `🎫 <b>تذكرة رقم: ${esc(c.ticketCode)}</b> (${esc(c.status)})`,
          c.orderCode ? `🧾 الطلب المرتبط: <code>${esc(c.orderCode)}</code>` : '',
          `👤 العميل: ${esc(c.customerName)} · <code>${esc(c.whatsappNumber)}</code>`,
          c.customerEmail ? `📧 الإيميل: <code>${esc(c.customerEmail)}</code>` : '',
          `📌 الموضوع: <b>${esc(c.subject)}</b>`,
          `💬 الرسالة:\n${esc(c.message)}`,
          `🕒 التاريخ: ${formatTime(c.createdAt)}`
        ].filter(Boolean).join('\n'),
        {
          ...HTML,
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('💬 الرد على الشكوى', `creply:${c._id}`),
              Markup.button.callback('🔒 إغلاق التذكرة', `cclose:${c._id}`)
            ]
          ])
        }
      );
    }
  }));

  bot.hears(['👥 العملاء', '👥 الزبائن والأرصدة'], adminGuard('view_orders', async (ctx) => {
    const customers = await Customer.find({}).sort({ createdAt: -1 }).limit(12).lean();
    if (!customers.length) {
      return ctx.reply('👥 لا يوجد زبائن مسجلون في قاعدة البيانات حالياً.', {
        ...HTML,
        ...Markup.inlineKeyboard([[Markup.button.callback('➕ تعديل/شحن رصيد زبون برقم هاتفه', 'adm_wallet_adj')]])
      });
    }
    const lines = customers.map(
      (c, i) => `${i + 1}. <b>${esc(c.name)}</b> (<code>${esc(c.phone || c.email || 'بدون رقم')}</code>) — الرصيد: <b>${formatMoney(c.balance || 0)}</b>`
    );
    return ctx.reply(
      `👥 <b>قائمة الزبائن وأرصدتهم (${customers.length}):</b>\n\n${lines.join('\n')}`,
      {
        ...HTML,
        ...Markup.inlineKeyboard([[Markup.button.callback('💰 شحن / تعديل رصيد زبون برقم هاتفه', 'adm_wallet_adj')]])
      }
    );
  }));

  bot.hears('⚙️ الإعدادات', adminGuard('view_orders', (ctx) => {
    return ctx.reply(
      `⚙️ <b>إعدادات النظام والنسخ الاحتياطي:</b>\n• رابط المتجر: ${SITE}\n• رابط لوحة الإدارة: ${SITE}/admin.html`,
      {
        ...HTML,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💾 أخذ نسخة احتياطية الآن', 'cmd:backup')],
          [Markup.button.callback('🔄 تحديث أزرار الكيبورد', 'cmd:refresh_kb')]
        ])
      }
    );
  }));

  bot.action('cmd:refresh_kb', adminGuard('view_orders', async (ctx) => {
    await ctx.answerCbQuery('تم تحديث الكيبورد ✓');
    return ctx.reply('✅ تم تحديث أزرار لوحة التحكم بنجاح.', adminMainKeyboard());
  }));

  bot.action('cmd:backup', adminGuard('view_orders', async (ctx) => {
    await ctx.answerCbQuery('جارٍ تحضير النسخة الاحتياطية...');
    const { performBackup } = require('../services/backupService');
    const ok = await performBackup(bot);
    if (ok) return ctx.editMessageText('✅ تم إرسال النسخة الاحتياطية المشفرة بنجاح!');
    return ctx.editMessageText('❌ تعذّر إرسال النسخة، تأكد من وجود مفتاح BACKUP_KEY (64 حرفاً) في Render.');
  }));

  bot.action('cancel_session', async (ctx) => {
    adminSessions.delete(ctx.from.id);
    customerSessions.delete(ctx.from.id);
    await ctx.answerCbQuery('تم الإلغاء');
    return ctx.editMessageText('❌ تم إلغاء العملية.');
  });

  bot.action(/^o:([a-f0-9]{24})$/, adminGuard('view_orders', async (ctx) => {
    const o = await Order.findById(ctx.match[1]);
    await ctx.answerCbQuery();
    return o ? sendOrderCardToAdmin(ctx, o) : ctx.reply('الطلب غير موجود.');
  }));

  bot.action(/^s:([a-f0-9]{24}):([0-3])$/, adminGuard('edit_orders', async (ctx) => {
    const newStatus = STATUSES[Number(ctx.match[2])];
    const o = await setStatus(ctx.match[1], newStatus, 'telegram', ctx.from.id);
    if (!o) return ctx.answerCbQuery('الطلب غير موجود', { show_alert: true });
    await ctx.answerCbQuery(`تم التحديث إلى: ${newStatus} ✓`);
    const isPhoto = Boolean(ctx.callbackQuery.message && ctx.callbackQuery.message.photo);
    const editMethod = isPhoto ? 'editMessageCaption' : 'editMessageText';
    const text = buildAdminOrderSummary(o);
    return ctx[editMethod](isPhoto ? text.slice(0, 1020) : text, {
      ...HTML,
      ...buildAdminOrderKeyboard(o)
    }).catch(() => {});
  }));

  bot.action(/^dlv:([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    const order = await Order.findById(ctx.match[1]).lean();
    if (!order) return ctx.answerCbQuery('الطلب غير موجود', { show_alert: true });

    await ctx.answerCbQuery();
    return ctx.reply(`🔑 <b>نوع التسليم للطلب ${esc(order.orderCode)}</b> — اختر:`, {
      ...HTML, ...Markup.inlineKeyboard([
        [Markup.button.callback('📺 شاشة + PIN', `dlvtype:${order._id}:screen`)],
        [Markup.button.callback('🔐 حساب كامل', `dlvtype:${order._id}:account`)],
        [Markup.button.callback('🔗 رابط دعوة / تفعيل', `dlvtype:${order._id}:invite`)]
      ])
    });
  }));

  bot.action(/^dlvtype:([a-f0-9]{24}):(screen|account|invite)$/, adminGuard('edit_orders', async (ctx) => {
    const order = await Order.findById(ctx.match[1]).lean();
    if (!order) return ctx.answerCbQuery('الطلب غير موجود');
    const type = ctx.match[2];
    adminSessions.set(ctx.from.id, { type: 'DELIVER_ORDER', step: type === 'invite' ? 'INVITE_URL' : 'CREDENTIALS',
      orderId: String(order._id), orderCode: order.orderCode, data: { type } });
    await ctx.answerCbQuery();
    return ctx.reply(type === 'invite' ? '🔗 أرسل رابط التفعيل HTTPS:' : '🔐 أرسل البريد وكلمة المرور للحساب:', HTML);
  }));

  bot.action(/^note:([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    adminSessions.set(ctx.from.id, {
      type: 'ORDER_NOTE',
      orderId: ctx.match[1]
    });
    await ctx.answerCbQuery();
    return ctx.reply('📝 اكتب الملاحظة الإدارية لهذا الطلب (حتى 300 حرف):', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]])
    });
  }));

  bot.action(/^msg:([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    const order = await Order.findById(ctx.match[1]).lean();
    if (!order) return ctx.answerCbQuery('الطلب غير موجود', { show_alert: true });
    if (!order.telegramChatId) {
      return ctx.answerCbQuery('⚠️ العميل لم يربط طلبه بتيليغرام بعد، راسله عبر زر واتساب.', { show_alert: true });
    }
    adminSessions.set(ctx.from.id, {
      type: 'MESSAGE_CUSTOMER',
      orderId: String(order._id),
      orderCode: order.orderCode,
      chatId: order.telegramChatId
    });
    await ctx.answerCbQuery();
    return ctx.reply(`✉️ اكتب الرسالة التي تريد إرسالها للعميل (${esc(order.customerName)}) بخصوص الطلب <b>${esc(order.orderCode)}</b>:`, {
      ...HTML,
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]])
    });
  }));

  bot.action(/^creply:([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    const comp = await Complaint.findById(ctx.match[1]).lean();
    if (!comp) return ctx.answerCbQuery('الشكوى غير موجودة', { show_alert: true });

    adminSessions.set(ctx.from.id, {
      type: 'REPLY_COMPLAINT',
      complaintId: String(comp._id),
      ticketCode: comp.ticketCode
    });
    await ctx.answerCbQuery();
    return ctx.reply(`💬 اكتب ردك على الشكوى رقم <b>${esc(comp.ticketCode)}</b> الخاصة بالعميل (${esc(comp.customerName)}):`, {
      ...HTML,
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]])
    });
  }));

  bot.action(/^cclose:([a-f0-9]{24})$/, adminGuard('edit_orders', async (ctx) => {
    const comp = await Complaint.findByIdAndUpdate(ctx.match[1], { status: 'مغلقة' }, { new: true });
    if (!comp) return ctx.answerCbQuery('غير موجودة');
    await ctx.answerCbQuery('تم إغلاق التذكرة ✓');
    return ctx.editMessageText(`🔒 تم إغلاق التذكرة رقم ${comp.ticketCode}.`);
  }));

  bot.action('adm_wallet_adj', adminGuard('edit_orders', async (ctx) => {
    adminSessions.set(ctx.from.id, {
      type: 'WALLET_ADJUST',
      step: 'PHONE'
    });
    await ctx.answerCbQuery();
    return ctx.reply('📱 أرسل رقم هاتف الزبون أو بريده الإلكتروني:', {
      ...HTML,
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ إلغاء', 'cancel_session')]])
    });
  }));

  bot.on(['photo', 'document'], async (ctx) => {
    const m = ctx.message;
    const fileId = m.photo
      ? m.photo[m.photo.length - 1].file_id
      : m.document && /^image\//.test(m.document.mime_type || '')
      ? m.document.file_id
      : null;

    if (!fileId) return ctx.reply('📷 يرجى إرسال صورة واضحة لوصل الدفع.');

    const verifiedCustomer = await Customer.findOne({ telegramChatId: ctx.chat.id, blocked: false }).lean();
    if (!verifiedCustomer) return ctx.reply('اربط حسابك أولاً من المتجر أو شارك رقمك للتحقق.');
    const owned = [{ customerId: verifiedCustomer._id }];
    if (verifiedCustomer.phoneVerified && verifiedCustomer.phone) owned.push({ whatsappNumber: verifiedCustomer.phone });
    // عند وجود أكثر من طلب، يجب تحديد رمز الطلب في تعليق الصورة لتجنب نسبة الوصل لطلب خاطئ.
    const captionCode = String(m.caption || '').match(/OP-[A-F0-9]{8}/i)?.[0]?.toUpperCase();
    const pending = await Order.find({ $or: owned, status: 'قيد المراجعة',
      ...(captionCode ? { orderCode: captionCode } : {})
    }).sort({ createdAt: -1 }).limit(2);
    if (!captionCode && pending.length > 1) {
      return ctx.reply('📎 لديك عدة طلبات قيد المراجعة. أعد إرسال صورة الوصل مع كتابة رمز الطلب OP-XXXXXXXX في وصف الصورة ليُربط بالطلب الصحيح.');
    }
    const o = pending[0];
    if (!o) {
      return ctx.reply('⚠️ لا يوجد طلب قيد المراجعة مرتبط بحسابك حالياً.\nأرسل رمز طلبك أولاً (مثل <code>OP-1A2B3C4D</code>) ثم أرسل صورة الوصل.', HTML);
    }

    if (o.isPaidOnline) {
      return ctx.reply(`✅ طلبك ${o.orderCode} مدفوع ومؤكّد إلكترونياً بالفعل، لا داعي لإرسال صورة الوصل.`);
    }

    if (o.receipts.length >= 5) {
      return ctx.reply('⏳ تم استلام وصولاتك السابقة بالفعل، طلبك قيد المراجعة حالياً.');
    }

    const receiptTime = new Date();
    o.receipts.push({ fileId, at: receiptTime });
    await o.save();

    await ctx.reply(
      `✅ <b>استلمنا صورة وصل الدفع لطلبك ${esc(o.orderCode)}</b>\n🕒 وقت الاستلام: ${formatTime(receiptTime)}\nسنراجعه ونرسل لك بيانات الحساب في أقرب وقت.`,
      HTML
    );

    const captionText = [
      '📎 <b>وصل دفع يدوي جديد</b>',
      `🕒 وقت إرسال الوصل: <b>${formatTime(receiptTime)}</b>`,
      '──────────────',
      buildAdminOrderSummary(o)
    ].join('\n');

    await broadcastToAdmins((adminId) =>
      bot.telegram.sendPhoto(adminId, fileId, {
        caption: captionText.slice(0, 1020),
        ...HTML,
        ...buildAdminOrderKeyboard(o)
      })
    );
  });

  bot.on('text', async (ctx) => {
    const text = (ctx.message.text || '').trim();
    if (text.startsWith('/')) return;

    const admSess = adminSessions.get(ctx.from.id);
    if (admSess && (await checkAdminRole(ctx.from.id, 'edit_orders'))) {
      if (admSess.type === 'NEW_PRODUCT') {
        if (admSess.step === 'CUSTOM_BRAND') {
          admSess.data.brandName = text.slice(0, 40);
          admSess.data.iconText = text.slice(0, 2).toUpperCase();
          admSess.step = 'CUSTOM_COLORS';
          return ctx.reply(
            '🎨 أرسل <b>اللون الأساسي واللون الثانوي</b> مفصولين بفاصلة (مثال: <code>#E50914, #5C060C</code>) أو أرسل <b>تخطي</b> للألوان الافتراضية:',
            HTML
          );
        }
        if (admSess.step === 'CUSTOM_COLORS') {
          if (text !== 'تخطي' && text.includes('#')) {
            const [c1, c2] = text.split(',').map((s) => s.trim());
            if (c1) admSess.data.primaryColor = c1;
            if (c2) admSess.data.secondaryColor = c2;
          }
          admSess.step = 'TITLE';
          return ctx.reply('📌 أرسل الآن <b>عنوان البطاقة الرئيسي</b> (مثال: <code>ديزني بلس بروفايل خاص</code>):', HTML);
        }
        if (admSess.step === 'TITLE') {
          admSess.data.title = text.slice(0, 80);
          admSess.step = 'CATEGORY';
          return ctx.reply(
            '📂 <b>الخطوة 3 من 6:</b> أرسل <b>اسم القسم/التصنيف</b> (مثال: <code>أنمي</code> أو <code>أفلام ومسلسلات</code>) أو أرسل <b>تخطي</b> لاعتماد (' + esc(admSess.data.category || 'أفلام ومسلسلات') + '):',
            HTML
          );
        }
        if (admSess.step === 'CATEGORY') {
          if (text !== 'تخطي') admSess.data.category = text.slice(0, 40);
          admSess.step = 'SUBTITLE';
          return ctx.reply(
            '📝 <b>الخطوة 4 من 6:</b> أرسل <b>الوصف التفصيلي لصفحة الهبوط</b> (يظهر تحت عنوان المنتج في صفحة الهبوط):',
            HTML
          );
        }
        if (admSess.step === 'SUBTITLE') {
          admSess.data.subtitle = text === 'تخطي' ? '' : text.slice(0, 250);
          admSess.step = 'FEATURES';
          return ctx.reply(
            '✨ <b>الخطوة 5 من 6:</b> أرسل <b>مميزات الاشتراك (ما ستحصل عليه)</b>، كل ميزة في سطر مستقل:\n\nاكتب فقط المميزات التي تقدمها فعلاً، مثلاً:\n<code>جودة HD\nدعم التلفاز</code>\nأرسل <b>تخطي</b> إذا لم ترد عرض قسم المميزات.',
            HTML
          );
        }
        if (admSess.step === 'FEATURES') {
          admSess.data.features = text === 'تخطي' ? [] : parseLinesInput(text, 20, 200);
          admSess.step = 'PLANS';
          return ctx.reply(
            '💰 <b>الخطوة 6 من 6:</b> أرسل <b>الباقات والأسعار</b> بصيغة (الأشهر:السعر) مفصولة بفاصلة، وضع <code>*</code> بجانب الباقة الأوفر:\n\nمثال:\n<code>1:600|مشترك, 1:1600*|خاص, 12:5500|سنة</code>',
            HTML
          );
        }
        if (admSess.step === 'PLANS') {
          const plans = parsePlansInput(text);
          if (!plans.length) {
            return ctx.reply('❌ صيغة الباقات غير صحيحة. أرسلها هكذا مثلاً: <code>1:600, 3:1650, 12:5500*</code>', HTML);
          }
          const d = admSess.data;
          adminSessions.delete(ctx.from.id);

          const slugBase = String(d.brandName || 'item')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .slice(0, 10) || 'prod';
          const productId = `${slugBase}-${crypto.randomBytes(2).toString('hex')}`;

          const created = await Product.create({
            productId,
            brandName: d.brandName || 'OVIRA',
            title: d.title,
            subtitle: d.subtitle || '',
            category: d.category || 'أفلام ومسلسلات',
            primaryColor: d.primaryColor || '#F47521',
            secondaryColor: d.secondaryColor || '#8A3A0A',
            iconText: d.iconText || 'C',
            badgeText: d.badgeText || '',
            features: Array.isArray(d.features) ? d.features : [],
            steps: [],
            plans,
            active: true
          });

          return ctx.reply(
            `🎉 <b>تم إنشاء بطاقة العرض وصفحة الهبوط بنجاح ونشرها في الموقع!</b>\n\n` + buildProductSummary(created),
            { ...HTML, ...buildProductEditKeyboard(created) }
          );
        }
      }

      if (admSess.type === 'EDIT_PRODUCT_FIELD') {
        const p = await Product.findById(admSess.prodId);
        if (!p) { adminSessions.delete(ctx.from.id); return ctx.reply('❌ البطاقة غير موجودة.'); }

        if (admSess.field === 'title') {
          const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
          if (lines[0]) p.title = lines[0];
          if (lines[1]) p.subtitle = lines.slice(1).join(' ');
        } else if (admSess.field === 'plans') {
          const plans = parsePlansInput(text);
          if (!plans.length) return ctx.reply('❌ صيغة الباقات غير صالحة. مثال: 1:600|مشترك, 1:1600*|خاص');
          p.plans = plans;
        } else if (admSess.field === 'features') {
          p.features = text === 'حذف' ? [] : parseLinesInput(text, 20, 200);
        } else if (admSess.field === 'steps') {
          const parsedSteps = text
            .split('\n')
            .map((line) => {
              const [t, d] = line.split('|').map((s) => s.trim());
              return t && d ? { title: t, desc: d } : null;
            })
            .filter(Boolean);
          if (text !== 'حذف' && !parsedSteps.length) return ctx.reply('أرسل خطوة بصيغة: العنوان | الشرح، أو أرسل حذف لإزالة الخطوات.');
          p.steps = text === 'حذف' ? [] : parsedSteps;
        } else if (admSess.field === 'style') {
          const [c1, c2, ic, bdg] = text.split('|').map((s) => s.trim());
          if (c1) p.primaryColor = c1;
          if (c2) p.secondaryColor = c2;
          if (ic) p.iconText = ic;
          p.badgeText = bdg || '';
        } else if (admSess.field === 'img') {
          if (text !== 'حذف' && !/^https:\/\/\S+$/i.test(text)) return ctx.reply('أرسل رابط HTTPS أو كلمة حذف.');
          p.imageUrl = text === 'حذف' ? '' : text.trim();
        } else if (admSess.field === 'audience') {
          p.audience = text === 'حذف' ? undefined : parseLinesInput(text, 6, 140);
        } else if (admSess.field === 'limits') {
          p.limits = text === 'حذف' ? undefined : parseLinesInput(text, 8, 180);
        } else if (admSess.field === 'faqs') {
          const faqs = text === 'حذف' ? [] : parseFaqInput(text, 8);
          if (text !== 'حذف' && !faqs.length) return ctx.reply('❌ أرسل كل سؤال بصيغة السؤال | الجواب، أو كلمة حذف.');
          p.faqs = faqs.length ? faqs : undefined;
        } else if (admSess.field === 'guarantee') {
          p.guaranteeText = text === 'حذف' ? undefined : text.slice(0, 600);
        } else if (admSess.field === 'delivery') {
          p.deliveryText = text === 'حذف' ? undefined : text.slice(0, 400);
        } else if (admSess.field === 'seo') {
          if (text === 'حذف') {
            p.seoTitle = undefined;
            p.seoDescription = undefined;
          } else {
            const lines = text.split(/\r?\n/).map(v => v.trim());
            if (!lines[0]) return ctx.reply('أرسل عنوان SEO في السطر الأول، ثم الوصف في الثاني.');
            p.seoTitle = lines[0].slice(0, 70);
            p.seoDescription = lines.slice(1).join(' ').slice(0, 200) || undefined;
          }
        }

        adminSessions.delete(ctx.from.id);
        await p.save();
        return ctx.reply(`✅ <b>تم تحديث البطاقة وصفحة الهبوط في الموقع فوراً!</b>\n\n` + buildProductSummary(p), {
          ...HTML,
          ...buildProductEditKeyboard(p)
        });
      }

      if (admSess.type === 'DELIVER_ORDER') {
        if (admSess.step === 'INVITE_URL') {
          if (!/^https:\/\/\S+$/i.test(text)) return ctx.reply('أدخل رابطًا يبدأ بـ https://');
          admSess.data.invitationUrl = text;
          admSess.step = 'EXTRA_NOTE';
          return ctx.reply('📌 أرسل تعليمات إضافية أو تخطي لإتمام التسليم:', HTML);
        }
        if (admSess.step === 'CREDENTIALS') {
          admSess.data.credentials = text;
          admSess.step = admSess.data.type === 'account' ? 'EXTRA_NOTE' : 'PROFILE_NAME';
          return ctx.reply(admSess.data.type === 'account' ? '📌 أرسل تعليمات إضافية أو تخطي لإتمام التسليم:' :
            '👤 أرسل اسم الشاشة، أو تخطي:', HTML);
        }
        if (admSess.step === 'PROFILE_NAME') {
          admSess.data.profileName = text === 'تخطي' ? '' : text;
          admSess.step = 'PIN_CODE';
          return ctx.reply(
            '🔢 <b>الخطوة 3 من 4:</b> أرسل <b>كود قفل الشاشة (PIN)</b>، أو أرسل <b>تخطي</b> إذا لم يوجد:',
            HTML
          );
        }
        if (admSess.step === 'PIN_CODE') {
          admSess.data.pinCode = text === 'تخطي' ? '' : text;
          admSess.step = 'EXTRA_NOTE';
          return ctx.reply(
            '📌 <b>الخطوة 4 من 4:</b> أرسل أي <b>ملاحظة أو تعليمات إضافية</b> للزبون، أو أرسل <b>تخطي</b> لإتمام التسليم الآن:',
            HTML
          );
        }
        if (admSess.step === 'EXTRA_NOTE') {
          admSess.data.extraNote = text === 'تخطي' ? '' : text;
          adminSessions.delete(ctx.from.id);

          const updatedOrder = await deliverOrderAccount(admSess.orderId, {
            type: admSess.data.type,
            invitationUrl: admSess.data.invitationUrl,
            credentials: admSess.data.credentials,
            profileName: admSess.data.profileName,
            pinCode: admSess.data.pinCode,
            extraNote: admSess.data.extraNote,
            by: `telegram:${ctx.from.id}`,
            adminId: ctx.from.id
          });

          if (!updatedOrder) return ctx.reply('❌ الطلب غير موجود.');
          return ctx.reply(
            `✅ <b>تم تسليم الحساب والشاشة للطلب ${esc(updatedOrder.orderCode)} وإرساله للعميل بنجاح!</b>\n\n` +
            buildAdminOrderSummary(updatedOrder),
            { ...HTML, ...buildAdminOrderKeyboard(updatedOrder) }
          );
        }
      }

      if (admSess.type === 'ORDER_NOTE') {
        adminSessions.delete(ctx.from.id);
        const order = await Order.findById(admSess.orderId);
        if (!order) return ctx.reply('❌ الطلب غير موجود.');
        order.adminNote = text.slice(0, 300);
        await order.save();
        return ctx.reply(`📝 تم حفظ الملاحظة على الطلب <b>${esc(order.orderCode)}</b>.`, HTML);
      }

      if (admSess.type === 'MESSAGE_CUSTOMER') {
        adminSessions.delete(ctx.from.id);
        try {
          await bot.telegram.sendMessage(
            admSess.chatId,
            `✉️ <b>رسالة من إدارة OVIRA PLAY بخصوص طلبك ${esc(admSess.orderCode)}:</b>\n\n${esc(text)}`,
            HTML
          );
          return ctx.reply('✅ تم إرسال الرسالة للعميل بنجاح.');
        } catch (e) {
          return ctx.reply(`❌ تعذّر إرسال الرسالة للعميل: ${e.message}`);
        }
      }

      if (admSess.type === 'REPLY_COMPLAINT') {
        adminSessions.delete(ctx.from.id);
        const comp = await Complaint.findById(admSess.complaintId);
        if (!comp) return ctx.reply('❌ الشكوى غير موجودة.');
        comp.adminReply = text;
        comp.repliedAt = new Date();
        comp.status = 'تم الرد';
        await comp.save();
        await notifyComplaintReplyInternal(comp);
        return ctx.reply(`✅ تم حفظ ردك وإرساله للعميل (التذكرة <b>${esc(comp.ticketCode)}</b>).`, HTML);
      }

      if (admSess.type === 'WALLET_ADJUST') {
        if (admSess.step === 'PHONE') {
          const cleanInput = text.trim();
          const query = cleanInput.includes('@')
            ? { email: cleanInput.toLowerCase() }
            : { phone: cleanInput.replace(/\s+/g, '') };
          const cust = await Customer.findOne(query);
          if (!cust) {
            adminSessions.delete(ctx.from.id);
            return ctx.reply('❌ لا يوجد زبون مسجل بهذا الرقم أو الإيميل. يمكنك إضافته من لوحة التحكم.');
          }
          admSess.customerId = String(cust._id);
          admSess.customerName = cust.name;
          admSess.currentBalance = cust.balance || 0;
          admSess.step = 'AMOUNT';
          return ctx.reply(
            `👤 الزبون: <b>${esc(cust.name)}</b>\n💰 الرصيد الحالي: <b>${formatMoney(admSess.currentBalance)}</b>\n\nأرسل الآن <b>الرصيد الجديد الكامل</b> بالدينار (مثال: <code>1500</code>):`,
            HTML
          );
        }
        if (admSess.step === 'AMOUNT') {
          adminSessions.delete(ctx.from.id);
          const newBal = Number(text);
          if (isNaN(newBal) || newBal < 0) return ctx.reply('❌ أدخل رقماً صحيحاً.');
          const cust = await Customer.findByIdAndUpdate(
            admSess.customerId,
            { balance: Math.round(newBal) },
            { new: true }
          );
          if (cust && cust.telegramChatId) {
            bot.telegram
              .sendMessage(
                cust.telegramChatId,
                `💰 <b>تحديث في محفظتك لدى OVIRA PLAY:</b>\nرصيدك المتاح الآن هو: <b>${formatMoney(cust.balance)}</b>`,
                HTML
              )
              .catch(() => {});
          }
          return ctx.reply(`✅ تم تحديث رصيد <b>${esc(admSess.customerName)}</b> إلى <b>${formatMoney(newBal)}</b>.`, HTML);
        }
      }
    }

    const signup = customerSessions.get(ctx.from.id);
    if (signup?.step === 'SHOP_EMAIL') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || text.length > 150) return ctx.reply('أدخل بريدًا إلكترونيًا صالحًا.');
      const safeName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ').trim().slice(0, 80) || 'زبون تيليغرام';
      let c = signup.customerId ? await Customer.findById(signup.customerId) : null;
      if (c && c.telegramChatId && c.telegramChatId !== ctx.chat.id) return ctx.reply('الحساب مرتبط بتيليغرام مختلف، يرجى التواصل مع الدعم.');
      if (!c) c = new Customer({ name: safeName.length >= 3 ? safeName : 'عميل تيليغرام', phone: signup.phone });
      if (!c.email) c.email = text.toLowerCase();
      c.telegramChatId = ctx.chat.id;
      c.phoneVerified = true;
      c.telegramUsername = ctx.from.username || '';
      await c.save();
      customerSessions.delete(ctx.from.id);
      await Order.updateMany({ whatsappNumber: signup.phone, customerId: { $exists: false }, telegramChatId: { $exists: false } },
        { $set: { customerId: c._id, telegramChatId: ctx.chat.id } });
      await ctx.reply('✅ تم توثيق رقم هاتفك وربط حساب المتجر بتيليغرام. اختر طريقة الدفع الآن.', customerMainKeyboard());
      return ctx.reply('🛒 اضغط على باقتك مجددًا:', Markup.inlineKeyboard([[Markup.button.callback('متابعة شراء الباقة', `shopplan:${signup.productId}:${signup.planIndex}`)]]));
    }

    if (/^OP-[A-F0-9]{8}$/i.test(text)) {
      customerSessions.delete(ctx.from.id);
      return linkCustomerOrder(ctx, text);
    }

    const custSess = customerSessions.get(ctx.from.id);
    if (custSess) {
      if (custSess.step === 'WAIT_TRACK_CODE') {
        customerSessions.delete(ctx.from.id);
        return linkCustomerOrder(ctx, text);
      }

      if (custSess.step === 'COMPLAINT_ORDER_CODE') {
        custSess.data.orderCode = text === 'تخطي' ? '' : text.toUpperCase();
        custSess.step = 'COMPLAINT_PHONE';
        return ctx.reply('📱 أرسل <b>رقم هاتفك (واتساب)</b> للتواصل معك:', HTML);
      }

      if (custSess.step === 'COMPLAINT_PHONE') {
        custSess.data.phone = text.replace(/\s+/g, '');
        custSess.step = 'COMPLAINT_SUBJECT';
        return ctx.reply('📌 اكتب <b>عنواناً مختصراً للمشكلة</b> (مثال: مشكلة في كود الشاشة / تأخر التسليم):', HTML);
      }

      if (custSess.step === 'COMPLAINT_SUBJECT') {
        custSess.data.subject = text.slice(0, 120);
        custSess.step = 'COMPLAINT_MESSAGE';
        return ctx.reply('📝 اشرح <b>تفاصيل المشكلة أو الشكوى</b> بالكامل لنقوم بحلها لك فوراً:', HTML);
      }

      if (custSess.step === 'COMPLAINT_MESSAGE') {
        const d = custSess.data;
        customerSessions.delete(ctx.from.id);

        const linkedCust = await Customer.findOne({ phone: d.phone }).lean();
        const ticketCode = 'TK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const comp = await Complaint.create({
          ticketCode,
          customerId: linkedCust ? linkedCust._id : undefined,
          orderCode: d.orderCode || '',
          customerName: (linkedCust && linkedCust.name) || ctx.from.first_name || 'عميل تيليغرام',
          whatsappNumber: d.phone,
          customerEmail: (linkedCust && linkedCust.email) || '',
          telegramChatId: ctx.chat.id,
          subject: d.subject,
          message: text.slice(0, 1000)
        });

        await notifyNewComplaintInternal(comp);
        return ctx.reply(
          `✅ <b>تم تسجيل شكواك بنجاح!</b>\n🎫 رقم التذكرة: <code>${comp.ticketCode}</code>\nسيرد عليك فريق الدعم هنا في نفس المحادثة قريباً.`,
          { ...HTML, ...customerMainKeyboard() }
        );
      }
    }
  });
}

async function notifyNewOrder(o) {
  if (!bot) return;
  await broadcastToAdmins((id) =>
    bot.telegram.sendMessage(id, '🆕 <b>طلب جديد وارد</b>\n' + buildAdminOrderSummary(o), {
      ...HTML,
      ...buildAdminOrderKeyboard(o)
    })
  );
}

async function notifyChargilyPaidInternal(o) {
  if (!bot) return;
  const pd = o.paymentDetails || {};
  const adminMsg = [
    o.paymentMethod === 'رصيد المحفظة' ? '✅💰 <b>تم خصم رصيد المحفظة بنجاح!</b>' : '⚡💳 <b>تم الدفع الإلكتروني بنجاح عبر Chargily Pay!</b>',
    '──────────────',
    `🧾 رقم الطلب: <b>${esc(o.orderCode)}</b>`,
    `👤 اسم العميل في الموقع: <b>${esc(o.customerName)}</b>`,
    `📱 واتساب العميل: <code>${esc(o.whatsappNumber)}</code>`,
    o.customerEmail ? `📧 إيميل العميل: <code>${esc(o.customerEmail)}</code>` : '',
    '──────────────',
    o.paymentMethod === 'رصيد المحفظة' ? '💰 <b>تفاصيل الدفع من رصيد المحفظة:</b>' : '🏦 <b>بيانات وصل الدفع من شارجيلي:</b>',
    `• المبلغ المدفوع: <b>${formatMoney(pd.amountPaid || o.totalPrice)}</b>`,
    `• وسيلة الدفع: <b>${esc(pd.paymentMethodUsed || 'الذهبية / CIB')}</b>`,
    `• وقت الدفع الفعلي: <b>${esc(pd.paidAtFormatted || formatTime(o.paidAt))}</b>`,
    `• اسم الدافع: ${esc(pd.payerName || o.customerName)}`,
    pd.payerEmail ? `• إيميل الدافع: <code>${esc(pd.payerEmail)}</code>` : '',
    pd.transactionId ? `• مرجع العملية: <code>${esc(pd.transactionId)}</code>` : '',
    '──────────────',
    '🛒 <b>المشتريات المطلوب تسليمها:</b>',
    ...o.cartItems.map((i) => `• ${esc(i.productName)} — ${i.months} شهر × ${i.quantity}`)
  ].filter(Boolean).join('\n');

  await broadcastToAdmins((id) =>
    bot.telegram.sendMessage(id, adminMsg, {
      ...HTML,
      ...buildAdminOrderKeyboard(o)
    })
  );

  if (o.telegramChatId) {
    await bot.telegram
      .sendMessage(
        o.telegramChatId,
        [
          o.paymentMethod === 'رصيد المحفظة' ? `✅ <b>تم خصم رصيد المحفظة وتأكيد طلبك ${esc(o.orderCode)}!</b>` : `✅ <b>تم استلام وتأكيد دفعتك الإلكترونية للطلب ${esc(o.orderCode)}!</b>`,
          `💰 المبلغ: <b>${formatMoney(pd.amountPaid || o.totalPrice)}</b>`,
          `🕒 وقت الدفع: ${esc(pd.paidAtFormatted || formatTime(o.paidAt))}`,
          '',
          'نجهّز لك الآن بيانات الحساب والشاشة الخاصة بك وستصلك هنا خلال لحظات.'
        ].join('\n'),
        HTML
      )
      .catch(() => {});
  }
}

async function canSendSensitiveOrderToTelegram(o) {
  if (!o.telegramChatId) return false;
  const cust = await Customer.findOne({ telegramChatId: o.telegramChatId, blocked: false }).lean();
  return !!cust && ((o.customerId && String(o.customerId) === String(cust._id)) ||
    (cust.phoneVerified && o.whatsappNumber === cust.phone));
}
async function notifyCustomerStatusChange(o) {
  if (!bot || !o.telegramChatId) return;
  if (o.status === 'تم التسليم' && o.deliveredAccount && (o.deliveredAccount.credentials || o.deliveredAccount.invitationUrl)) {
    if (!await canSendSensitiveOrderToTelegram(o)) return;
    return bot.telegram.sendMessage(o.telegramChatId, buildDeliveredAccountMessage(o), HTML);
  }
  const messages = {
    'مؤكد': `✅ تم تأكيد طلبك <b>${esc(o.orderCode)}</b>. سنرسل لك بيانات الحساب والشاشة خلال لحظات.`,
    'تم التسليم': `🎉 تم تسليم طلبك <b>${esc(o.orderCode)}</b>. شكراً لثقتك بـ OVIRA PLAY!`,
    'ملغي': `❌ تم إلغاء طلبك <b>${esc(o.orderCode)}</b>. للاستفسار يمكنك فتح تذكرة دعم من الأزرار بالأسفل.`
  };
  if (messages[o.status]) {
    await bot.telegram.sendMessage(o.telegramChatId, messages[o.status], HTML);
  }
}

async function notifyAccountDelivered(o) {
  if (!bot || !await canSendSensitiveOrderToTelegram(o)) return;
  await bot.telegram.sendMessage(o.telegramChatId, buildDeliveredAccountMessage(o), HTML);
}

async function notifyNewComplaintInternal(comp) {
  if (!bot) return;
  const msg = [
    `🚨 <b>شكوى / تذكرة دعم جديدة (${esc(comp.ticketCode)})</b>`,
    comp.orderCode ? `🧾 الطلب: <code>${esc(comp.orderCode)}</code>` : '',
    `👤 العميل: <b>${esc(comp.customerName)}</b>`,
    `📱 الهاتف: <code>${esc(comp.whatsappNumber)}</code>`,
    comp.customerEmail ? `📧 الإيميل: <code>${esc(comp.customerEmail)}</code>` : '',
    `📌 الموضوع: <b>${esc(comp.subject)}</b>`,
    `💬 التفاصيل:\n${esc(comp.message)}`,
    `🕒 الوقت: ${formatTime(comp.createdAt)}`
  ].filter(Boolean).join('\n');

  await broadcastToAdmins((id) =>
    bot.telegram.sendMessage(id, msg, {
      ...HTML,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('💬 الرد على الشكوى', `creply:${comp._id}`),
          Markup.button.callback('🔒 إغلاق التذكرة', `cclose:${comp._id}`)
        ]
      ])
    })
  );
}

async function notifyComplaintReplyInternal(comp) {
  if (!bot || !comp.telegramChatId) return;
  await bot.telegram
    .sendMessage(
      comp.telegramChatId,
      [
        `💬 <b>رد الإدارة على تذكرتك رقم ${esc(comp.ticketCode)}:</b>`,
        `📌 بخصوص: ${esc(comp.subject)}`,
        '──────────────',
        esc(comp.adminReply),
        '──────────────',
        'نشكرك لتواصلك مع دعم OVIRA PLAY.'
      ].join('\n'),
      HTML
    )
    .catch(() => {});
}

setNotifier({
  customerStatus: notifyCustomerStatusChange,
  accountDelivered: notifyAccountDelivered,
  chargilyPaid: notifyChargilyPaidInternal
});

module.exports = {
  bot,
  notifyNewOrder,
  notifyNewComplaint: notifyNewComplaintInternal,
  notifyComplaintReply: notifyComplaintReplyInternal
};
