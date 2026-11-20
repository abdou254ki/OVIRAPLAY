'use strict';
// اختبارات الدفعة 1: لا تتصل بقاعدة بيانات ولا بتيليغرام ولا بشارجيلي (كل شيء مُستبدل بنسخ وهمية).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const api = path.resolve(__dirname, '..');
const abs = (p) => require.resolve(path.join(api, p));

(async () => {
  // ---------- 1) productService ----------
  const Product = require('../models/Product');
  const ps = require('../services/productService');

  // منتج قديم (بدون أي حقل هبوط) يُنسَّق دون أخطاء ولا قيم مخترعة
  const old = { _id: 1, productId: 'netflix', brandName: 'Netflix', title: 'نتفلكس', category: 'أفلام',
    badgeText: '⚡ فوري', features: ['أ', 'ب'], plans: [{ months: 1, price: 900, best: false }] };
  const f = ps.formatProductForFrontend(old);
  assert.deepEqual(f.f, ['أ', 'ب']);
  assert.deepEqual([f.aud, f.lim, f.faq], [[], [], []]);
  assert.equal(f.guar, ''); assert.equal(f.dlv, '');
  assert.equal(f.badge, '⚡ فوري', 'بيانات المالك القديمة تبقى كما هي');
  // منتج بلا شارة ولا مميزات: لا ادعاءات مخترعة
  const bare = ps.formatProductForFrontend({ productId: 'x', brandName: 'X', title: 'X', category: 'c', plans: [{ months: 1, price: 1 }] });
  assert.equal(bare.badge, ''); assert.deepEqual(bare.f, []);
  assert.equal(JSON.stringify(ps.DEFAULT_STEPS).includes('فوراً'), false);

  // المحللات
  assert.deepEqual(ps.parseLinesInput('- أ\n\n• ب \n✓ ج', 2), ['أ', 'ب']);
  assert.deepEqual(ps.parseFaqInput('كم المدة؟ | شهر\nبدون فاصل\n | بلا سؤال\nسؤال | جواب | فيه فاصل'),
    [{ q: 'كم المدة؟', a: 'شهر' }, { q: 'سؤال', a: 'جواب | فيه فاصل' }]);
  const li = ps.readLandingInput({ audienceText: 'لمن يشاهد\nعلى التلفاز', faqsText: 'س | ج', guaranteeText: '  استبدال خلال 3 أيام  ',
    deliveryText: '', seoTitle: 'ت'.repeat(200) });
  assert.deepEqual(li.audience, ['لمن يشاهد', 'على التلفاز']);
  assert.deepEqual(li.faqs, [{ q: 'س', a: 'ج' }]);
  assert.equal(li.guaranteeText, 'استبدال خلال 3 أيام');
  assert.ok('deliveryText' in li && li.deliveryText === undefined, 'نص فارغ => يُحذف');
  assert.equal(li.seoTitle.length, 70);
  assert.ok(!('limits' in li), 'حقل غير مُرسل لا يُمس');
  assert.deepEqual(Object.keys(ps.readLandingInput({})), []);
  assert.equal(ps.landingToText({ faqs: [{ q: 'س', a: 'ج' }] }).faqsText, 'س | ج');

  // المخطط: المنتج القديم لا يحصل على مصفوفات فارغة ويتحقق صحيح مع الحقول الجديدة
  const doc = new Product({ productId: 'a', brandName: 'A', title: 'A', plans: [{ months: 1, price: 10 }] });
  assert.equal(doc.audience, undefined); assert.equal(doc.faqs, undefined);
  assert.equal(doc.badgeText, '');
  doc.set(ps.readLandingInput({ faqsText: 'س | ج', guaranteeText: 'ضمان' }));
  assert.equal(doc.validateSync(), undefined);
  assert.equal(doc.faqs.length, 1);
  doc.set(ps.readLandingInput({ faqsText: '' }));
  assert.equal(doc.faqs, undefined, 'التفريغ يحذف الحقل');

  // ensureSeedProducts: لا يلمس القاعدة إلا بتفعيل صريح
  let calls = 0;
  const realCount = Product.countDocuments, realInsert = Product.insertMany;
  Product.countDocuments = async () => { calls++; return 0; };
  Product.insertMany = async () => { calls += 100; };
  delete process.env.SEED_DEFAULT_PRODUCTS;
  await ps.ensureSeedProducts();
  assert.equal(calls, 0, 'بدون المتغير: لا استعلام ولا كتابة');
  process.env.SEED_DEFAULT_PRODUCTS = 'true';
  await ps.ensureSeedProducts();
  assert.equal(calls, 101, 'بالتفعيل الصريح وقاعدة فارغة فقط: يزرع');
  Product.countDocuments = async () => 3; calls = 0;
  await ps.ensureSeedProducts();
  assert.equal(calls, 0, 'قاعدة غير فارغة: لا يزرع');
  delete process.env.SEED_DEFAULT_PRODUCTS;
  Product.countDocuments = realCount; Product.insertMany = realInsert;

  // ---------- 2) publicStatsService ----------
  const { computeDeliveryStats } = require('../services/publicStatsService');
  const mk = (confirmMin, deliverMin) => ({ history: [
    { status: 'قيد المراجعة', at: new Date(0) },
    { status: 'مؤكد', at: new Date(confirmMin * 60000) },
    { status: 'تم التسليم', at: new Date(deliverMin * 60000) }] });
  assert.equal(computeDeliveryStats([mk(0, 5), mk(0, 9)]), null, 'عينة صغيرة => null');
  const rows = Array.from({ length: 10 }, (_, i) => mk(0, (i + 1) * 10)); // 10..100 دقيقة
  const st = computeDeliveryStats(rows);
  assert.equal(st.sample, 10); assert.equal(st.medianMinutes, 50); assert.equal(st.p80Minutes, 80);
  assert.equal(computeDeliveryStats([...rows, { history: [{ status: 'تم التسليم', at: new Date() }] }]).sample, 10, 'بلا "مؤكد" يُستبعد');

  // ---------- 3) المحدّدات ----------
  const { createOrderLimiters } = require('../services/limiters');
  const lim = express();
  lim.use('/o', ...createOrderLimiters({ readLimit: 5, writeLimit: 2 }), express.Router()
    .get('/catalog', (q, r) => r.json({ ok: 1 }))
    .post('/', (q, r) => r.json({ ok: 1 }))
    .post('/chargily-webhook', (q, r) => r.json({ ok: 1 })));
  const srv = await new Promise((res) => { const s = lim.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${srv.address().port}/o`;
  const st1 = []; for (let i = 0; i < 6; i++) st1.push((await fetch(base + '/catalog')).status);
  assert.deepEqual(st1, [200, 200, 200, 200, 200, 429], 'القراءة: سقفها الخاص');
  const st2 = []; for (let i = 0; i < 3; i++) st2.push((await fetch(base + '/', { method: 'POST' })).status);
  assert.deepEqual(st2, [200, 200, 429], 'الكتابة: سقف مشدد ومستقل عن القراءة');
  for (let i = 0; i < 6; i++) assert.equal((await fetch(base + '/chargily-webhook', { method: 'POST' })).status, 200, 'الويبهوك مستثنى');
  const blocked = await (await fetch(base + '/catalog')).json();
  assert.equal(blocked.code, 'RATE_LIMITED');
  srv.close();

  // ---------- 4) مسارات orders (نماذج وهمية) ----------
  const stub = (p, exports) => { require.cache[abs(p)] = { id: abs(p), filename: abs(p), loaded: true, exports }; };
  stub('services/paymentMethodsService.js', { getPublicMethods: async () => [{ name: 'بريدي موب' }] });
  stub('bot/telegram.js', { notifyNewOrder: async () => {} });
  const Order = require('../models/Order'), Review = require('../models/Review'), Customer = require('../models/Customer');
  const chain = (v) => { const c = { sort: () => c, select: () => c, limit: () => c, lean: async () => v }; return c; };
  const netflix = { productId: 'netflix', brandName: 'Netflix', title: 'نتفلكس', category: 'أ', features: ['ميزة'],
    faqs: [{ q: 'س', a: 'ج' }], plans: [{ months: 1, price: 900, best: true }], active: true, sortOrder: 1 };
  Product.find = () => chain([netflix]);
  Product.findOne = () => chain(netflix);
  Product.countDocuments = async () => 1;
  Review.aggregate = async () => [{ _id: 'netflix', count: 3, average: 4.666 }];
  Order.find = () => chain(Array.from({ length: 12 }, (_, i) => mk(0, 5 + i)));
  Order.findOne = () => chain(null);
  Order.countDocuments = async () => 0;
  let created = null;
  Order.create = async (o) => { created = o; return { ...o, status: 'قيد المراجعة', createdAt: new Date(), isPaidOnline: false }; };
  Customer.findById = async () => null;

  const ordersRouter = require('../routes/orders');
  assert.equal(ordersRouter.sanitizeSource('facebook<script>/cpc|camp 1;'), 'facebookscript/cpc|camp 1');
  assert.equal(ordersRouter.sanitizeSource({ a: 1 }), '');
  assert.equal(ordersRouter.sanitizeSource('x'.repeat(200)).length, 80);

  const app = express(); app.use(express.json()); app.use('/api/orders', ordersRouter);
  app.use((e, q, r, n) => r.status(500).json({ err: e.message }));
  const s2 = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const b2 = `http://127.0.0.1:${s2.address().port}/api/orders`;

  const cat = await fetch(b2 + '/catalog');
  assert.match(cat.headers.get('cache-control'), /max-age=30/);
  const catJ = await cat.json();
  assert.equal(catJ.products[0].id, 'netflix'); assert.deepEqual(catJ.products[0].faq, [{ q: 'س', a: 'ج' }]);
  assert.ok(catJ.generatedAt);

  const rs = await (await fetch(b2 + '/reviews-summary')).json();
  assert.deepEqual(rs.summary, { netflix: { count: 3, average: 4.7 } });

  const ds = await (await fetch(b2 + '/delivery-stats')).json();
  assert.equal(ds.stats.sample, 12);

  const post = await fetch(b2 + '/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    customerName: 'اختبار الاسم', whatsappNumber: '0555123456', customerEmail: 'a@b.co', paymentMethod: 'بريدي موب',
    cartItems: [{ id: 'netflix', m: 1, q: 1 }], totalPrice: 900, source: 'facebook/cpc/<b>lancement</b>' }) });
  assert.equal(post.status, 201);
  assert.equal(created.source, 'facebook/cpc/blancement/b', 'المصدر يُنظَّف ويُحفظ');
  created = null;
  const post2 = await fetch(b2 + '/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    customerName: 'اختبار الاسم', whatsappNumber: '0555123457', customerEmail: 'a@b.co', paymentMethod: 'بريدي موب',
    cartItems: [{ id: 'netflix', m: 1, q: 1 }], totalPrice: 900 }) });
  assert.equal(post2.status, 201); assert.equal(created.source, undefined, 'بلا مصدر => لا حقل');
  const bad = await fetch(b2 + '/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    customerName: 'اختبار الاسم', whatsappNumber: '0555123458', customerEmail: 'a@b.co', paymentMethod: 'بريدي موب',
    cartItems: [{ id: 'netflix', m: 1, q: 1 }], totalPrice: 700 }) });
  assert.equal(bad.status, 400, 'تحقق السعر من الخادم ما زال يعمل');
  s2.close();

  console.log('landing-batch1: كل الاختبارات نجحت');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
