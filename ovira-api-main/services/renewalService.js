const crypto = require('crypto');
const Order = require('../models/Order');
const Setting = require('../models/Setting');

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_LOG_KEY = 'renewal_reminders_sent';

const esc = (val) =>
  String(val ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));

// حساب موعد انتهاء الاشتراك والأيام المتبقية لطلب مسلّم
function computeOrderRenewalInfo(order) {
  const startRaw =
    (order.deliveredAccount && order.deliveredAccount.deliveredAt) ||
    order.paidAt ||
    order.createdAt ||
    new Date();
  const startDate = new Date(startRaw);

  const monthsList = (order.cartItems || [])
    .map((i) => Number(i.months) || 1)
    .filter((m) => m > 0);
  const minMonths = monthsList.length ? Math.min(...monthsList) : 1;

  const durationDays = minMonths * 30;
  const expiresAt = new Date(startDate.getTime() + durationDays * DAY_MS);
  const diffMs = expiresAt.getTime() - Date.now();
  const daysLeft = Math.ceil(diffMs / DAY_MS);

  let renewalStatus = 'active'; // ساري
  if (daysLeft <= 0) {
    renewalStatus = 'expired'; // منتهي
  } else if (daysLeft <= 5) {
    renewalStatus = 'expiring_soon'; // ينتهي قريباً (خلال 5 أيام)
  }

  const itemsSummary = (order.cartItems || [])
    .map((i) => `${i.productName} (${i.months} شهر)`)
    .join(' + ');

  const cleanPhone = String(order.whatsappNumber || '').replace(/^0/, '');
  const waText =
    daysLeft <= 0
      ? `مرحباً ${order.customerName} 👋، انتهت مدة اشتراكك في (${itemsSummary}) الخاص بالطلب ${order.orderCode}. هل ترغب في تجديد اشتراكك للاحتفاظ بنفس الشاشة؟`
      : `مرحباً ${order.customerName} 👋، تبقّى ${daysLeft} يوم على انتهاء اشتراكك في (${itemsSummary}) الخاص بالطلب ${order.orderCode}. يمكنك التجديد الآن لضمان عدم انقطاع الخدمة.`;

  return {
    _id: order._id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    whatsappNumber: order.whatsappNumber,
    customerEmail: order.customerEmail || '',
    telegramLinked: !!order.telegramChatId,
    telegramChatId: order.telegramChatId || null,
    itemsSummary,
    months: minMonths,
    totalPrice: order.totalPrice,
    deliveredAt: startDate,
    expiresAt,
    daysLeft,
    renewalStatus,
    deliveredAccount: order.deliveredAccount || {},
    waRemindUrl: `https://wa.me/213${cleanPhone}?text=${encodeURIComponent(waText)}`
  };
}

// جلب قائمة التجديدات مرتبة من الأشد استعجالاً (المنتهية ثم القريبة الانتهاء)
async function getRenewalsList({ filter = 'urgent', limit = 100 } = {}) {
  const deliveredOrders = await Order.find({ status: 'تم التسليم' })
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  const all = deliveredOrders.map(computeOrderRenewalInfo);
  all.sort((a, b) => a.daysLeft - b.daysLeft);

  const counts = {
    expired: all.filter((x) => x.renewalStatus === 'expired').length,
    expiringSoon: all.filter((x) => x.renewalStatus === 'expiring_soon').length,
    active: all.filter((x) => x.renewalStatus === 'active').length,
    total: all.length
  };

  let filtered = all;
  if (filter === 'expired') {
    filtered = all.filter((x) => x.renewalStatus === 'expired').sort((a, b) => b.daysLeft - a.daysLeft);
  } else if (filter === 'expiring_soon') {
    filtered = all.filter((x) => x.renewalStatus === 'expiring_soon');
  } else if (filter === 'urgent') {
    filtered = all.filter((x) => x.daysLeft >= -30 && x.daysLeft <= 5);
  } else if (filter === 'reminder_due') {
    filtered = all.filter((x) => x.daysLeft >= -7 && x.daysLeft <= 3);
  }

  return {
    renewals: filtered.slice(0, Math.max(1, Math.min(Number(limit) || 100, 200))),
    counts
  };
}

// إرسال تذكير تجديد للزبون عبر بوت تيليغرام
async function sendTelegramRenewalReminder(bot, orderOrInfo, siteUrl = 'https://rioxstore.shop') {
  const info = orderOrInfo.renewalStatus ? orderOrInfo : computeOrderRenewalInfo(orderOrInfo);
  if (!bot || !info.telegramChatId) {
    return { sentTelegram: false, reason: 'الزبون غير مربوط ببوت تيليغرام، استخدم رابط واتساب.' };
  }

  const statusLine =
    info.daysLeft <= 0
      ? `⚠️ <b>انتهت مدة اشتراكك</b> منذ ${Math.abs(info.daysLeft)} يوم.`
      : `⏳ تبقّى <b>${info.daysLeft} أيام</b> على انتهاء مدة اشتراكك.`;

  const msg = [
    `🔔 <b>تذكير بتجديد الاشتراك — OVIRA PLAY</b>`,
    '──────────────',
    `👤 مرحباً <b>${esc(info.customerName)}</b>`,
    `🧾 رقم الطلب: <code>${esc(info.orderCode)}</code>`,
    `🎬 الاشتراك: <b>${esc(info.itemsSummary)}</b>`,
    info.deliveredAccount && info.deliveredAccount.profileName
      ? `👤 الشاشة: <b>${esc(info.deliveredAccount.profileName)}</b>`
      : '',
    statusLine,
    `📅 تاريخ الانتهاء: <b>${new Date(info.expiresAt).toLocaleDateString('fr-DZ')}</b>`,
    '──────────────',
    `🔄 للاحتفاظ بنفس حسابك وشاشتك دون انقطاع، يمكنك طلب التجديد مباشرة عبر المتجر:\n${siteUrl}`
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await bot.telegram.sendMessage(Number(info.telegramChatId), msg, { parse_mode: 'HTML' });
    return { sentTelegram: true };
  } catch (err) {
    return { sentTelegram: false, reason: err.message };
  }
}

// مهمة تلقائية خفيفة تفحص الاشتراكات القريبة من الانتهاء (3 أيام أو أقل) وترسل تذكيراً مرة واحدة
function initRenewalJob(bot, broadcastToAdminsFn) {
  if (!bot) return;
  let running = false;
  const runCheck = async () => {
    if (running) return;
    running = true;
    try {
      const { renewals } = await getRenewalsList({ filter: 'reminder_due', limit: 200 });
      if (!renewals.length) return;

      await Setting.findOneAndUpdate(
        { key: REMINDER_LOG_KEY }, { $setOnInsert: { value: {} } }, { upsert: true }
      );

      for (const item of renewals) {
        // نرسل تذكيراً تلقائياً عند بقاء 3 أيام وعند يوم الانتهاء (0)
        const stage = item.daysLeft <= 0 ? 'exp0' : item.daysLeft <= 3 ? 'exp3' : null;
        if (!stage || item.daysLeft < -7) continue; // لا تزعج عملاء اشتراكات انتهت منذ زمن

        if (!item.telegramChatId) continue;
        const logKey = crypto.createHash('sha256').update(`${item.orderCode}_${stage}`).digest('hex');
        const field = `value.${logKey}`;
        const claimed = await Setting.findOneAndUpdate(
          { key: REMINDER_LOG_KEY, [field]: { $exists: false } },
          { $set: { [field]: Date.now() } }, { new: true }
        );
        if (!claimed) continue;
        const sent = await sendTelegramRenewalReminder(bot, item);
        if (!sent.sentTelegram) {
          await Setting.updateOne({ key: REMINDER_LOG_KEY }, { $unset: { [field]: '' } });
          continue;
        }
        if (typeof broadcastToAdminsFn === 'function') {
          const admMsg =
            item.daysLeft <= 0
              ? `🔔 <b>انتهى اشتراك الزبون:</b> ${esc(item.customerName)} (<code>${esc(item.orderCode)}</code>)\n📦 ${esc(item.itemsSummary)}\n📱 واتساب: <code>${esc(item.whatsappNumber)}</code>`
              : `⏳ <b>اشتراك ينتهي خلال ${item.daysLeft} أيام:</b> ${esc(item.customerName)} (<code>${esc(item.orderCode)}</code>)\n📦 ${esc(item.itemsSummary)}`;
          await broadcastToAdminsFn((admId) =>
            bot.telegram.sendMessage(admId, admMsg, { parse_mode: 'HTML' })
          );
        }

      }
    } catch (e) {
      console.error('Renewal job error:', e.message);
    } finally {
      running = false;
    }
  };

  // فحص فوري عند التشغيل، ثم كل 6 ساعات (تعاد الفحوص بعد إعادة تشغيل Render)
  runCheck().catch((e) => console.error('Renewal job failed:', e.message));
  return setInterval(runCheck, 6 * 60 * 60 * 1000);
}

module.exports = {
  computeOrderRenewalInfo,
  getRenewalsList,
  sendTelegramRenewalReminder,
  initRenewalJob
};
