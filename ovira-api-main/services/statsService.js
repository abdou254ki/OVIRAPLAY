const Order = require('../models/Order');
const Stock = require('../models/Stock');
const Customer = require('../models/Customer');
const Coupon = require('../models/Coupon');

// الحالات التي تُحسب كإيراد محصّل
const PAID = ['مؤكد', 'تم التسليم'];
const DAY = 864e5;
const TZ = 'Africa/Algiers';

/**
 * ملخص الإحصائيات الكامل (لوحة الويب + بوت تيليغرام).
 * query.days = عدد أيام الفترة (0 = كل الفترات)
 * query.skip = إزاحة الفترة للخلف بالأيام (للمقارنة بالفترة السابقة)
 * كل الأرقام من قاعدة البيانات الفعلية، بلا قيم وهمية.
 */
async function buildSummary(query = {}) {
  const days = Math.min(3650, Math.max(0, parseInt(query.days, 10) || 0));
  const skip = Math.min(3650, Math.max(0, parseInt(query.skip, 10) || 0));
  const now = new Date();
  const to = new Date(now.getTime() - skip * DAY);
  const from = days ? new Date(to.getTime() - days * DAY) : new Date(0);
  const inRange = { $gte: from, $lte: to };
  const in7 = new Date(now.getTime() + 7 * DAY);
  const dayKey = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } };

  const [
    byStatus,
    phones,
    topCustomers,
    stocks,
    costsAgg,
    topProducts,
    seriesAgg,
    seriesCost,
    blocked,
    topCoupon,
    tgCount,
    paidAll,
    costAll,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: inRange } },
      { $group: { _id: '$status', n: { $sum: 1 }, sum: { $sum: '$totalPrice' } } },
    ]),
    Order.aggregate([{ $group: { _id: '$whatsappNumber', n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: { $in: PAID } } },
      {
        $group: {
          _id: '$whatsappNumber',
          name: { $last: '$customerName' },
          spent: { $sum: '$totalPrice' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { spent: -1 } },
      { $limit: 5 },
    ]),
    Stock.find({ active: { $ne: false } }).lean(),
    Stock.aggregate([{ $match: { createdAt: inRange } }, { $group: { _id: null, c: { $sum: '$costPrice' } } }]),
    Order.aggregate([
      { $match: { status: { $in: PAID }, createdAt: inRange } },
      { $unwind: '$cartItems' },
      {
        $group: {
          _id: '$cartItems.productName',
          qty: { $sum: '$cartItems.quantity' },
          revenue: { $sum: { $multiply: ['$cartItems.unitPrice', '$cartItems.quantity'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: { createdAt: inRange, status: { $ne: 'ملغي' } } },
      {
        $group: {
          _id: dayKey,
          sales: { $sum: '$totalPrice' },
          paid: { $sum: { $cond: [{ $in: ['$status', PAID] }, '$totalPrice', 0] } },
        },
      },
    ]),
    Stock.aggregate([{ $match: { createdAt: inRange } }, { $group: { _id: dayKey, c: { $sum: '$costPrice' } } }]),
    Customer.countDocuments({ blocked: true }),
    Coupon.findOne({ usedCount: { $gt: 0 } }).sort({ usedCount: -1 }).lean(),
    Order.countDocuments({ createdAt: inRange, telegramChatId: { $exists: true, $ne: null } }),
    Order.aggregate([{ $match: { status: { $in: PAID } } }, { $group: { _id: null, s: { $sum: '$totalPrice' } } }]),
    Stock.aggregate([{ $group: { _id: null, c: { $sum: '$costPrice' } } }]),
  ]);

  // ---- الطلبات ----
  const g = (st) => byStatus.find((x) => x._id === st) || { n: 0, sum: 0 };
  const orders = {
    review: g('قيد المراجعة').n,
    confirmed: g('مؤكد').n,
    done: g('تم التسليم').n,
    canceled: g('ملغي').n,
  };
  orders.total = orders.review + orders.confirmed + orders.done + orders.canceled;

  // ---- المبيعات والأرباح ----
  const paidTotal = g('مؤكد').sum + g('تم التسليم').sum;
  const totalSales = byStatus.filter((x) => x._id !== 'ملغي').reduce((a, x) => a + x.sum, 0);
  const costs = (costsAgg[0] && costsAgg[0].c) || 0;
  const profit = paidTotal - costs;

  // ---- العملاء ----
  const repeat = phones.filter((p) => p.n > 1).length;

  // ---- المخزون والاشتراكات ----
  let active = 0;
  let expSoon = 0;
  let expired = 0;
  let masterSoon = 0;
  let lowStock = 0;
  for (const st of stocks) {
    if (st.masterExpiresAt && st.masterExpiresAt <= in7) masterSoon++;
    if (!(st.slots || []).some((x) => x.status === 'available')) lowStock++;
    for (const sl of st.slots || []) {
      if (sl.status !== 'occupied') continue;
      if (sl.expiresAt && sl.expiresAt <= now) expired++;
      else {
        active++;
        if (sl.expiresAt && sl.expiresAt <= in7) expSoon++;
      }
    }
  }

  // ---- السلسلة الزمنية اليومية ----
  const n = Math.min(90, Math.max(days || 30, 7));
  const bySales = Object.fromEntries(seriesAgg.map((x) => [x._id, x]));
  const byCost = Object.fromEntries(seriesCost.map((x) => [x._id, x.c]));
  const series = { labels: [], sales: [], profits: [], expenses: [] };
  for (let i = n - 1; i >= 0; i--) {
    const key = new Date(to.getTime() - i * DAY).toLocaleDateString('en-CA', { timeZone: TZ });
    const row = bySales[key] || { sales: 0, paid: 0 };
    series.labels.push(key.slice(5));
    series.sales.push(row.sales);
    series.expenses.push(byCost[key] || 0);
    series.profits.push(row.paid - (byCost[key] || 0));
  }

  const collectedAll = (paidAll[0] && paidAll[0].s) || 0;
  const totalCostsAll = (costAll[0] && costAll[0].c) || 0;

  return {
    totalSales,
    collected: paidTotal,
    grossProfit: profit,
    netProfit: profit,
    paidTotal,
    costs,
    orders,
    customers: { total: phones.length, new: Math.max(0, phones.length - repeat), repeat, blocked },
    subs: { active, expSoon, expired, needAct: orders.confirmed },
    finance: {
      balance: collectedAll - totalCostsAll,
      gateways: collectedAll,
      monthProfit: profit,
    },
    top: topProducts.map((x) => ({ name: x._id, qty: x.qty, revenue: x.revenue })),
    topCustomers: topCustomers.map((x) => ({
      _id: x._id,
      name: x.name,
      phone: x._id,
      spent: x.spent,
      orders: x.orders,
    })),
    series,
    sources: { telegram: tgCount, website: Math.max(0, orders.total - tgCount) },
    topCoupon: topCoupon ? { code: topCoupon.code, usedCount: topCoupon.usedCount } : null,
    alerts: { masterSoon, lowStock, expSoon },
  };
}

/**
 * الاشتراكات والحسابات الأم التي تنتهي خلال 7 أيام (أو انتهت فعلاً).
 */
async function listRenewals() {
  const in7 = new Date(Date.now() + 7 * DAY);
  const stocks = await Stock.find({ active: { $ne: false } }).lean();
  const expiringSlots = [];
  const expiringMasters = [];

  for (const st of stocks) {
    const occupied = (st.slots || []).filter((x) => x.status === 'occupied');

    if (st.masterExpiresAt && st.masterExpiresAt <= in7) {
      expiringMasters.push({
        _id: st._id,
        productName: st.productName,
        code: st.code,
        email: st.email,
        masterExpiresAt: st.masterExpiresAt,
        occupiedCount: occupied.length,
      });
    }

    for (const sl of occupied) {
      if (sl.expiresAt && sl.expiresAt <= in7) {
        expiringSlots.push({
          stockId: st._id,
          productName: st.productName,
          stockCode: st.code,
          slotNumber: sl.slotNumber,
          profileName: sl.profileName,
          pin: sl.pin,
          customerName: sl.customerName,
          customerPhone: sl.customerPhone,
          email: st.email,
          expiresAt: sl.expiresAt,
          orderId: sl.orderId ? String(sl.orderId) : '',
          orderCode: sl.orderCode || '',
        });
      }
    }
  }

  expiringSlots.sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
  expiringMasters.sort((a, b) => new Date(a.masterExpiresAt) - new Date(b.masterExpiresAt));
  return { expiringSlots, expiringMasters };
}

module.exports = { buildSummary, listRenewals, PAID, DAY };
