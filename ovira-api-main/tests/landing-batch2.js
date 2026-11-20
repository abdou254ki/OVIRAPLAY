'use strict';
// اختبارات الدفعة 2 (routes/admin.js): بلا قاعدة بيانات ولا تيليغرام. الدخول يُحاكى بتوقيع JWT صحيح.
process.env.JWT_SECRET = 'x'.repeat(40);
process.env.ADMIN_EMAIL = 'a@b.c'; process.env.ADMIN_PASSWORD_HASH = 'x';
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const abs = (p) => require.resolve(path.join(__dirname, '..', p));
const stub = (p, exports) => { require.cache[abs(p)] = { id: abs(p), filename: abs(p), loaded: true, exports }; };

(async () => {
  stub('bot/telegram.js', { bot: null, notifyComplaintReply: async () => {}, notifyNewOrder: async () => {} });
  const Admin = require('../models/Admin'), Audit = require('../models/Audit'), Product = require('../models/Product');
  const ProductRevision = require('../models/ProductRevision'), Order = require('../models/Order');
  const adminId = new mongoose.Types.ObjectId();
  const chain = (v) => { const c = { sort: () => c, select: () => c, limit: () => c, lean: async () => v }; return c; };
  Admin.findById = () => chain({ _id: adminId, active: true, role: 'owner', tokenVersion: 0, telegramId: 1 });
  Admin.findOne = () => chain(null);
  const audits = []; Audit.create = async (a) => { audits.push(a); };
  const revisions = []; ProductRevision.create = async (r) => { revisions.push(r); return r; };

  const router = require('../routes/admin');
  const app = express(); app.use(express.json()); app.use('/api/admin', router);
  app.use((e, q, r, n) => r.status(500).json({ err: e.message }));
  const srv = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${srv.address().port}/api/admin`;
  const H = { 'content-type': 'application/json',
    authorization: 'Bearer ' + jwt.sign({ role: 'owner', id: String(adminId), tv: 0, telegramId: 1 }, process.env.JWT_SECRET) };
  const call = async (m, u, body) => { const r = await fetch(base + u, { method: m, headers: H, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json() }; };

  // مستند حقيقي يحاكي منتجًا قديمًا (بلا حقول هبوط) مع save يتحقق من المخطط فقط
  const mkDoc = () => { const d = new Product({ productId: 'netflix', brandName: 'Netflix', title: 'نتفلكس', category: 'أ',
    badgeText: '⚡ فوري', features: ['ميزة قديمة'], plans: [{ months: 1, price: 900, best: true }] });
    d.save = async function () { const e = this.validateSync(); if (e) throw e; return this; }; return d; };

  // ----- POST: إنشاء منتج جديد -----
  let created = null;
  Product.create = async (o) => { created = o; return { ...o, productId: 'x-1', title: o.title }; };
  let r = await call('POST', '/products', { brandName: 'Spotify', title: 'سبوتيفاي', plansText: '1:500, 12:5000*',
    faqsText: 'كم المدة؟ | شهر', audienceText: 'للموسيقى', limitsText: 'جهاز واحد', guaranteeText: 'استبدال', deliveryText: 'خلال ساعات',
    seoTitle: 'عنوان', seoDescription: 'وصف' });
  assert.equal(r.s, 201);
  assert.equal(created.badgeText, '', 'لا شارة افتراضية');
  assert.deepEqual(created.features, [], 'لا مميزات مخترعة');
  assert.deepEqual(created.faqs, [{ q: 'كم المدة؟', a: 'شهر' }]);
  assert.deepEqual([created.audience, created.limits], [['للموسيقى'], ['جهاز واحد']]);
  assert.equal(created.guaranteeText, 'استبدال'); assert.equal(created.seoTitle, 'عنوان');
  await call('POST', '/products', { brandName: 'Plain', title: 'عادي', plansText: '1:100' });
  assert.ok(!('faqs' in created) || created.faqs === undefined, 'بلا حقول هبوط => لا شيء يُكتب');

  // ----- PATCH: حفظ حقول الهبوط، إزالة الشارة، سجل التعديلات -----
  let doc = mkDoc(); Product.findById = async () => doc;
  const id = String(new mongoose.Types.ObjectId());
  r = await call('PATCH', `/products/${id}`, { badgeText: '', faqsText: 'س | ج', limitsText: 'حد 1\nحد 2', guaranteeText: 'ضمان 7 أيام' });
  assert.equal(r.s, 200);
  assert.equal(doc.badgeText, '', 'يمكن إزالة الشارة');
  assert.equal(doc.faqs.length, 1); assert.deepEqual([...doc.limits], ['حد 1', 'حد 2']);
  assert.equal(doc.guaranteeText, 'ضمان 7 أيام');
  assert.deepEqual([...doc.features], ['ميزة قديمة'], 'ما لم يُرسل لا يُمس');
  assert.equal(revisions.length, 1, 'تعديل حقول الهبوط ينشئ نسخة في السجل');
  assert.equal(revisions[0].snapshot.badgeText, '⚡ فوري');
  assert.equal(revisions[0].snapshot.faqs, null, 'النسخة السابقة: لا هبوط');

  // PATCH بلا تغيير فعلي لا ينشئ نسخة
  const n0 = revisions.length;
  await call('PATCH', `/products/${id}`, { title: 'نتفلكس' });
  assert.equal(revisions.length, n0, 'لا تغيير => لا نسخة');

  // مسح حقل بإرسال نص فارغ
  await call('PATCH', `/products/${id}`, { faqsText: '' });
  assert.equal(doc.faqs, undefined, 'النص الفارغ يحذف الحقل');

  // ----- GET /products: نصوص التعديل الجاهزة -----
  Product.find = () => chain([{ productId: 'n', brandName: 'N', title: 'T', plans: [], faqs: [{ q: 'س', a: 'ج' }], audience: ['أ', 'ب'] },
    { productId: 'old', brandName: 'O', title: 'T2', plans: [] }]);
  r = await call('GET', '/products');
  assert.equal(r.j.products[0].landing.faqsText, 'س | ج');
  assert.equal(r.j.products[0].landing.audienceText, 'أ\nب');
  assert.equal(r.j.products[1].landing.faqsText, '', 'منتج قديم: نصوص فارغة بلا أخطاء');

  // ----- الاستعادة -----
  doc = mkDoc(); doc.set({ faqs: [{ q: 'س', a: 'ج' }], guaranteeText: 'حالي' });
  const revId = String(new mongoose.Types.ObjectId());
  // أ) نسخة قديمة بلا مفاتيح هبوط: تبقى حقول الهبوط الحالية
  ProductRevision.findOne = async () => ({ snapshot: { title: 'عنوان قديم', badgeText: '⚡ فوري' } });
  r = await call('POST', `/products/${id}/restore/${revId}`);
  assert.equal(r.s, 200); assert.equal(doc.title, 'عنوان قديم');
  assert.equal(doc.faqs.length, 1, 'نسخة قديمة لا تمسح الهبوط الحالي');
  // ب) نسخة جديدة فيها هبوط فارغ (null): يصير الحقل غير موجود لا null
  ProductRevision.findOne = async () => ({ snapshot: { title: 'T', faqs: null, audience: null, guaranteeText: null } });
  r = await call('POST', `/products/${id}/restore/${revId}`);
  assert.equal(r.s, 200);
  assert.equal(doc.faqs, undefined); assert.equal(doc.audience, undefined); assert.equal(doc.guaranteeText, undefined);
  assert.equal(doc.validateSync(), undefined, 'المنتج بعد الاستعادة صالح');

  // ----- /marketing -----
  let pipeline = null;
  Order.aggregate = async (p) => { pipeline = p; return [{ _id: 'facebook/cpc/a', orders: 5, paid: 2, revenue: 1800 }, { _id: '', orders: 9, paid: 4, revenue: 4000 }]; };
  r = await call('GET', '/marketing?days=7');
  assert.equal(r.s, 200); assert.equal(r.j.days, 7);
  assert.deepEqual(r.j.rows[0], { source: 'facebook/cpc/a', orders: 5, paid: 2, revenue: 1800 });
  assert.equal(r.j.rows[1].source, '');
  assert.deepEqual(pipeline[0].$match.status, { $ne: 'ملغي' }, 'الملغاة مستبعدة');
  assert.ok(pipeline[0].$match.createdAt.$gte instanceof Date);
  r = await call('GET', '/marketing?days=9999'); assert.equal(r.j.days, 30, 'قيمة غير مسموحة => 30');
  assert.ok(!JSON.stringify(r.j).match(/customerName|whatsapp|email/i), 'بلا بيانات شخصية');

  // دور viewer: يقرأ التسويق ولا يعدّل المنتجات
  Admin.findById = () => chain({ _id: adminId, active: true, role: 'viewer', tokenVersion: 0, telegramId: 2 });
  const Hv = { ...H, authorization: 'Bearer ' + jwt.sign({ role: 'viewer', id: String(adminId), tv: 0, telegramId: 2 }, process.env.JWT_SECRET) };
  const rv = await fetch(base + '/marketing', { headers: Hv }); assert.equal(rv.status, 200);
  const rp = await fetch(base + `/products/${id}`, { method: 'PATCH', headers: Hv, body: JSON.stringify({ title: 'x' }) });
  assert.equal(rp.status, 403);
  // بدون توكن
  assert.equal((await fetch(base + '/marketing')).status, 401);

  srv.close();
  console.log('landing-batch2: كل الاختبارات نجحت');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
