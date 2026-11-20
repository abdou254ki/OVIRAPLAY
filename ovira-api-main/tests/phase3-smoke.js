'use strict';
// اختبارات معزولة للواجهة والعقود؛ لا تتصل بقاعدة البيانات أو خدمات الدفع أو تيليغرام.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = path.resolve(__dirname, '..');
const web = path.resolve(api, '..', 'OVIRAPLAY-main');
const source = (p) => fs.readFileSync(path.join(api, p), 'utf8');
const page = { innerHTML: '' };
const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const dom = { getElementById: (id) => id === 'root' ? page : null, querySelectorAll: () => [] };
const sandbox = vm.createContext({ document: dom, window: {}, localStorage: ls, sessionStorage: ls,
  console, setTimeout, clearTimeout, setInterval:()=>0, clearInterval:()=>{}, alert: () => {}, fetch: async () => ({}) });
vm.runInContext(fs.readFileSync(path.join(web, 'admin.js'), 'utf8'), sandbox);
const dashboard = { overview: { review: 3, confirmed: 2, delivered: 10, complaints: 1,
  pendingReviews: 4, paidToday: 5000, paidTodayCount: 2, riskCount: 1,
  recentOrders: [{ orderCode: 'OP-TEST1', customerName: 'اختبار', totalPrice: 1500,
    status: 'مؤكد', createdAt: new Date().toISOString() }],
  series: [{day: '2026-10-29', value: 1000}, {day:'2026-10-30',value:4000}] } };
vm.runInContext(`tab='overview'; renderMain(${JSON.stringify(dashboard)})`, sandbox);
assert.match(page.innerHTML, /مركز الإدارة/);
assert.match(page.innerHTML, /5,000/);
assert.match(page.innerHTML, /OP-TEST1/);
assert.match(page.innerHTML, /سجل النشاط/);
assert.match(page.innerHTML, /مدفوعات إلكترونية اليوم/);
vm.runInContext(`tab='activity'; renderMain(${JSON.stringify({events:[{action:'UPDATE_PRODUCT',
  entity:'Product',summary:'تحديث بطاقة تجريبية', at:'2026-10-30T00:00:00Z', adminId:7}]})})`, sandbox);
assert.match(page.innerHTML, /UPDATE_PRODUCT/);
assert.match(page.innerHTML, /تحديث بطاقة تجريبية/);
const p = { _id: '507f1f77bcf86cd799439012', title: 'Gemini Pro', brandName:'Gemini Pro', productId:'gemini',
  subtitle:'وصف', category:'ذكاء اصطناعي', primaryColor:'#4285F4', secondaryColor:'#8E44AD',
  iconText:'✦', imageUrl:'', badgeText:'جديد', active:true,
  plans:[{months:12,price:1000,label:'Family'},{months:12,price:1500,label:'Personal'},
    {months:18,price:1500,label:'Family'},{months:18,price:2000,label:'Personal'}],
  features:[], steps:[] };
vm.runInContext(`tab='products'; renderMain(${JSON.stringify({products:[p]})})`, sandbox);
assert.match(page.innerHTML,/data-plan-target/);
assert.match(page.innerHTML,/12:1000\|Family/);
assert.match(page.innerHTML,/12:1500\|Personal/);
assert.match(page.innerHTML,/تعديل الصيغة اليدوية/);
assert.match(page.innerHTML,/سجل التعديلات \/ استعادة/);
const plans = vm.runInContext(`readPlanRows('12:1000|Family, 12:1500*|Personal, 18:1500|Family, 18:2000|Personal')`, sandbox);
assert.equal(plans.length,4);
assert.equal(plans[1].featured,true);
assert.equal(plans[3].price,'2000');
assert.match(source('routes/admin.js'), /router\.get\('\/overview', requireAdmin, requireRole/);
assert.match(source('routes/admin.js'), /router\.get\('\/activity', requireAdmin, requireRole\(\['owner'\]\)/);
assert.match(source('routes/admin.js'), /router\.post\('\/products\/:id\/restore\/:revId', requireAdmin, requireRole\(\['owner'\]\)/);
assert.match(source('routes/admin.js'), /await ProductRevision\.create/);
assert.ok(fs.existsSync(path.join(api,'models/ProductRevision.js')));
const appSource = fs.readFileSync(path.join(web, 'app.js'), 'utf8');
assert.match(appSource,/checkout-steps/);
assert.doesNotMatch(appSource,/وفّر \$\{/);
assert.match(appSource,/الدفع اليدوي لا يُؤكَّد تلقائيًا/);
console.log('PASS phase3: dashboard, activity, visual plans, revision guards, checkout steps');
