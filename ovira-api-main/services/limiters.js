'use strict';
// محدّدات طلبات /api/orders
// المشكلة السابقة: حدّ واحد (50 طلبًا/15 دقيقة لكل IP) كان يشمل قراءة الكتالوج وطرق الدفع والتقييمات،
// وشبكات الجوال تتشارك IP واحدًا بين كثيرين، فكانت الواجهة تتلقى 429 وتعرض بيانات قديمة بصمت.
// الآن: القراءة العامة لها سقف واسع، والكتابة (إنشاء الطلبات والتحقق من الدفع) تبقى مشددة.
const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;
const isRead = (req) => req.method === 'GET' || req.method === 'HEAD';

function createOrderLimiters({ readLimit, writeLimit } = {}) {
  const rl = Number(readLimit || process.env.ORDERS_READ_LIMIT || 1200);
  const wl = Number(writeLimit || process.env.ORDERS_WRITE_LIMIT || 50);

  const read = rateLimit({
    windowMs: WINDOW_MS,
    limit: rl,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !isRead(req),
    message: { success: false, code: 'RATE_LIMITED', message: 'طلبات كثيرة جدًا من شبكتك، أعد المحاولة بعد قليل.' }
  });

  const write = rateLimit({
    windowMs: WINDOW_MS,
    limit: wl,
    standardHeaders: true,
    legacyHeaders: false,
    // الويبهوك موقّع بتوقيع شارجيلي ويأتي من خوادمهم؛ لا يُحتسب ضمن حدّ الزبائن.
    skip: (req) => isRead(req) || req.method === 'OPTIONS' || req.path === '/chargily-webhook',
    message: { success: false, code: 'RATE_LIMITED', message: 'محاولات كثيرة، أعد المحاولة بعد قليل.' }
  });

  return [read, write];
}

module.exports = { createOrderLimiters };
