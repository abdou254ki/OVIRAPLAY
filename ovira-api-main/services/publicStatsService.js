'use strict';
// إحصاءات عامة مجمّعة (أرقام فقط، بلا أي بيانات شخصية) لعرضها بصدق في صفحات الهبوط.
const Order = require('../models/Order');

const MIN_SAMPLE = 10;     // لا نعرض رقمًا من عينة أصغر من هذا
const WINDOW_DAYS = 90;
const CACHE_MS = 10 * 60 * 1000;

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

// الزمن بين "مؤكد" (تأكيد الدفع) و"تم التسليم" كما هو مسجّل فعلًا في history.
// طلبات سُلّمت دون المرور بحالة "مؤكد" تُستبعد حتى لا نُحرّف الرقم.
function computeDeliveryStats(rows, minSample = MIN_SAMPLE) {
  const mins = [];
  for (const r of rows || []) {
    const h = Array.isArray(r.history) ? r.history : [];
    const confirmed = h.find((x) => x.status === 'مؤكد');
    const delivered = [...h].reverse().find((x) => x.status === 'تم التسليم');
    if (!confirmed || !delivered) continue;
    const diff = (new Date(delivered.at).getTime() - new Date(confirmed.at).getTime()) / 60000;
    if (Number.isFinite(diff) && diff >= 0) mins.push(diff);
  }
  if (mins.length < minSample) return null;
  mins.sort((a, b) => a - b);
  const round = (n) => Math.max(1, Math.round(n));
  return {
    sample: mins.length,
    medianMinutes: round(percentile(mins, 50)),
    p80Minutes: round(percentile(mins, 80)),
    days: WINDOW_DAYS
  };
}

let cache = { at: 0, data: null };

async function getPublicDeliveryStats() {
  if (Date.now() - cache.at < CACHE_MS) return cache.data;
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const rows = await Order.find({ status: 'تم التسليم', createdAt: { $gte: since } })
    .select('history').sort({ createdAt: -1 }).limit(500).lean();
  cache = { at: Date.now(), data: computeDeliveryStats(rows) };
  return cache.data;
}

const _resetCache = () => { cache = { at: 0, data: null }; };

module.exports = { computeDeliveryStats, getPublicDeliveryStats, MIN_SAMPLE, _resetCache };
