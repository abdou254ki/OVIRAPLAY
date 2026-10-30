const API_BASE = 'https://ovira-api.onrender.com';
const API_URL = API_BASE + '/api/orders';
const ACC_URL = API_BASE + '/api/account';

const CFG = {
  wa: '213557235850',
  tg: 'oviraplay_bot',
  googleClientId: '79336176422-fohod45r2nvme8st2kdcreb53fh8q426.apps.googleusercontent.com'
};
const $ = (s) => document.querySelector(s);
const app = $('#app');

const fmt = (n) => '<bdi>' + Number(n || 0).toLocaleString('en-US') + ' DA</bdi>';
const dur = (m) => (m == 1 ? 'شهر واحد' : m < 11 ? m + ' أشهر' : m + ' شهر');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const ico = (d, z = 21) => `<svg viewBox="0 0 24 24" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const I = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  shop: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  track: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  support: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  back: '<path d="M9 18l6-6-6-6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'
};
I.account = I.user;

const DEFAULT_STEPS = [
  { title: 'اختر باقتك وأضفها', desc: 'حدد المدة التي تناسبك ثم أكمل الطلب باسمك ورقم واتساب.' },
  { title: 'ادفع إلكترونياً أو يدوياً', desc: 'ادفع فوراً بالبطاقة الذهبية/CIB عبر شارجيلي أو عبر بريدي موب وبينانس.' },
  { title: 'استلم حسابك وشاشتك', desc: 'نسلّمك الإيميل وكلمة المرور مع شاشتك الخاصة المقفلة برمز PIN.' }
];

let P = [
  { id: 'netflix', n: 'Netflix', t: 'نتفلكس بروفايل خاص', sub: 'مشاهدة بجودة 4K Ultra HD مع شاشة خاصة مقفلة برمز PIN سري', cat: 'أفلام ومسلسلات', c: '#E50914', c2: '#5C060C', l: 'N', badge: '⚡ فوري', f: ['شاشة خاصة باسمك', 'رمز PIN سري خاص بك', 'جودة 4K Ultra HD', 'تسليم فوري للبيانات'], steps: DEFAULT_STEPS, pl: [[1, 900], [3, 2700], [6, 4900], [12, 9500, 1]] },
  { id: 'cr-mega', n: 'Crunchyroll', t: 'كرانشي رول Mega Fan', sub: 'أكبر مكتبة أنمي في العالم بدون إعلانات مع التحميل للمشاهدة بدون إنترنت', cat: 'أنمي', c: '#F47521', c2: '#8A3A0A', l: 'C', badge: '⚡ فوري', f: ['بدون إعلانات', 'حلقات بعد ساعة من اليابان', 'تحميل للمشاهدة بدون إنترنت', 'تسليم فوري للحساب'], steps: DEFAULT_STEPS, pl: [[1, 600], [3, 1650], [6, 3000], [12, 5500, 1]] },
  { id: 'cr-fan', n: 'Crunchyroll', t: 'كرانشي رول Fan', sub: 'مشاهدة كافة حلقات الأنمي بجودة عالية 1080p وبدون إعلانات', cat: 'أنمي', c: '#F47521', c2: '#8A3A0A', l: 'C', badge: '⚡ فوري', f: ['مشاهدة بدون إعلانات', 'مكتبة الأنمي كاملة', 'جودة 1080p', 'تسليم فوري للبيانات'], steps: DEFAULT_STEPS, pl: [[1, 500], [3, 1350], [6, 2500], [12, 4500, 1]] },
  { id: 'shahid', n: 'Shahid VIP', t: 'شاهد VIP (باقة شاملة)', sub: 'أحدث الأعمال العربية الحصرية والباقة الرياضية الشاملة بشاشة خاصة', cat: 'أفلام ومسلسلات', c: '#005FF9', c2: '#002E8A', l: 'S', badge: '⚡ فوري', f: ['الباقة الرياضية الشاملة', 'شاشة خاصة برقم سري', 'بدون إعلانات', 'تسليم فوري'], steps: DEFAULT_STEPS, pl: [[1, 800], [12, 7500, 1]] },
  { id: 'prime', n: 'Prime Video', t: 'أمازون برايم فيديو', sub: 'أفلام ومسلسلات أمازون الحصرية بجودة 4K HDR وشاشة مخصصة لك', cat: 'أفلام ومسلسلات', c: '#00A8E1', c2: '#005B7F', l: 'P', badge: '⚡ فوري', f: ['شاشة خاصة بك', 'مكتبة أفلام أمازون الحصرية', 'جودة 4K HDR', 'تسليم فوري'], steps: DEFAULT_STEPS, pl: [[1, 600], [6, 3200], [12, 6000, 1]] }
];

try {
  const cachedCatalog = JSON.parse(localStorage.getItem('ov_catalog') || 'null');
  if (Array.isArray(cachedCatalog) && cachedCatalog.length) P = cachedCatalog;
} catch (e) {}

let PAY = [];
let payLoaded = false, payFailed = false;
const PAY_DESC = {
  chargily: 'دفع إلكتروني فوري ومؤمّن 100% عبر البطاقة الذهبية أو CIB (يتم تأكيد طلبك تلقائياً)',
  wallet: 'ادفع فوراً من رصيد حسابك في المتجر دون انتظار'
};
const mapPay = (m) => ({
  id: m.id,
  n: m.name,
  auto: m.type === 'auto',
  wallet: m.type === 'wallet',
  k: m.label || '',
  v: m.value || '',
  desc: m.note || PAY_DESC[m.id] || ''
});
function applyPay(methods) {
  PAY = (methods || []).map(mapPay);
  payLoaded = true;
  if (!PAY.some((x) => x.id == payId)) {
    payId = ((PAY.find((x) => x.id == 'chargily') || PAY[0]) || {}).id || '';
  }
}

const FAQ = [
  ['هل الحسابات رسمية وتعمل بدون انقطاع؟', 'نعم، جميع اشتراكاتنا يتم تفعيلها بطرق رسمية 100% لضمان مشاهدة مستقرة طوال فترة اشتراكك.'],
  ['كيف أستلم بيانات الحساب والشاشة؟', 'تصلك بيانات الحساب واسم الشاشة ورمز PIN تلقائياً على بوت تيليغرام، كما تظهر داخل صفحة (حسابي) وصفحة (تتبع طلبي) في الموقع.'],
  ['كيف يعمل الدفع عبر شارجيلي؟', 'اختر Chargily Pay عند إتمام الطلب، وستنتقل لبوابة الدفع الرسمية لإدخال بيانات البطاقة الذهبية أو CIB، ويتأكد طلبك في ثوانٍ.']
];

const COL = { 'قيد المراجعة': '#F59E0B', 'مؤكد': '#2447C9', 'تم التسليم': '#16A34A', 'ملغي': '#EF4444' };
const pr = (id) => P.find((p) => p.id == id);
const pl = (i) => { const p = pr(i.id); return p && (p.pl.find((x) => i.k && x[4] === i.k) || p.pl.find((x) => x[0] == i.m)); };
// نسب التوفير لا تُعرض دون سعر أصلي موثق لكل باقة.

let cart = [], sel = 0, cat = 'الكل', payId = 'chargily', msg = '', chargilyMode = 'test';
let editK = -1;
let editBack = false;
let cartNote = '';
let chkDraft = { n: null, p: null, e: null };
let custToken = localStorage.getItem('ov_ctk') || '';
let custProfile = null;
let custOrders = [];
let custComplaints = [];
let authTab = 'login';
let twoFaPending = null; // { tempToken, method, message }
let twoFaSetup = null;   // { method, secret, otpauthUrl, message }
let ord = { n: '', code: '', ids: [], claimToken: '', paid: false, paymentDetails: null };

try { cart = JSON.parse(localStorage.getItem('oc') || '[]'); } catch (e) {}
try { const cp0 = JSON.parse(localStorage.getItem('ov_pay') || 'null'); if (Array.isArray(cp0) && cp0.length) applyPay(cp0); } catch (e) {}
if (!Array.isArray(cart)) cart = [];

const clean = () => {
  const n0 = cart.length;
  cart = cart.filter((i) => i && pl(i) && i.q > 0);
  if (editK < 0) {
    const seen = {};
    cart = cart.filter((i) => {
      const k = i.id + '|' + (i.k || i.m);
      if (seen[k]) { seen[k].q = Math.min(9, seen[k].q + i.q); return false; }
      seen[k] = i;
      return true;
    });
  }
  if (cart.length !== n0) save();
};
const save = () => { try { localStorage.setItem('oc', JSON.stringify(cart)); } catch (e) {} };
const tot = () => cart.reduce((s, i) => s + pl(i)[1] * i.q, 0);
const me = () => {
  if (custProfile) return { n: custProfile.name, p: custProfile.phone, e: custProfile.email };
  try { return JSON.parse(localStorage.getItem('oi') || '{}'); } catch (e) { return {}; }
};
const normPh = (s) => String(s || '').replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632).replace(/[\s\-().]/g, '').replace(/^(\+|00)?213/, '0');

let tt;
function toast(m) {
  const t = $('#ts');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('on'), 2600);
}

function cp(t) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(() => toast('تم النسخ بنجاح ✓'))
    .catch(() => toast('تعذّر النسخ، انسخ يدويًا'));
}

function theme() {
  const r = document.documentElement;
  const d = r.dataset.theme ? r.dataset.theme == 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
  r.dataset.theme = d ? 'light' : 'dark';
  try { localStorage.setItem('ot', r.dataset.theme); } catch (e) {}
}
try { const s = localStorage.getItem('ot'); if (s) document.documentElement.dataset.theme = s; } catch (e) {}

// جلب إعدادات المصادقة (Google Client ID + Bot Name)
fetch(ACC_URL + '/auth-config')
  .then((r) => r.json())
  .then((d) => {
    if (d && d.success) {
      if (d.googleClientId) CFG.googleClientId = d.googleClientId;
      if (d.telegramBotName) CFG.tg = d.telegramBotName;
    }
  })
  .catch(() => {});

fetch(API_URL + '/catalog')
  .then((r) => r.json())
  .then((d) => {
    if (d && d.success && Array.isArray(d.products) && d.products.length) {
      P = d.products;
      try { localStorage.setItem('ov_catalog', JSON.stringify(P)); } catch (e) {}
      draw();
    }
  })
  .catch(() => {});

function loadPayConfig() {
  return fetch(API_URL + '/payment-config').then((r) => r.json()).then((d) => {
    if (d && d.chargily) chargilyMode = d.chargily.mode;
    if (d && Array.isArray(d.methods)) {
      try { localStorage.setItem('ov_pay', JSON.stringify(d.methods)); } catch (e) {}
      payFailed = false;
      applyPay(d.methods);
      refreshPayUI();
    } else if (!payLoaded) {
      payFailed = true;
      refreshPayUI();
    }
  }).catch(() => {
    if (!payLoaded) { payFailed = true; refreshPayUI(); }
  });
}
loadPayConfig();

async function fetchCustomerProfile() {
  if (!custToken) { custProfile = null; return; }
  try {
    const r = await fetch(ACC_URL + '/me', { headers: { 'Authorization': 'Bearer ' + custToken } });
    if (!r.ok) {
      custToken = '';
      localStorage.removeItem('ov_ctk');
      custProfile = null;
      return;
    }
    const d = await r.json();
    if (d.success) {
      custProfile = d.customer;
      custOrders = d.orders || [];
      custComplaints = d.complaints || [];
      chrome();
    }
  } catch (e) {}
}
if (custToken) fetchCustomerProfile();

function renderDeliveredBox(da) {
  if (!da || (!da.credentials && !da.invitationUrl)) return '';
  return `
    <div class="ok-box">
      <h4>🔐 بيانات الحساب والشاشة الخاصة بك:</h4>
      ${da.type === 'invite' ? `<div class="cred-row"><span>🔗 رابط الدعوة: <a href="${esc(da.invitationUrl)}" target="_blank" rel="noopener noreferrer">فتح الرابط</a></span></div>` : `<div class="cred-row">
        <span>بيانات الحساب: <code>${esc(da.credentials)}</code></span>
        <button class="cp" onclick="cp(this.dataset.copy)" data-copy="${esc(da.credentials)}">${ico(I.copy)} نسخ</button>
      </div>`}
      ${da.profileName ? `
      <div class="cred-row">
        <span>👤 اسم الشاشة: <code>${esc(da.profileName)}</code></span>
        <button class="cp" onclick="cp(this.dataset.copy)" data-copy="${esc(da.profileName)}">${ico(I.copy)} نسخ</button>
      </div>` : ''}
      ${da.pinCode ? `
      <div class="cred-row">
        <span>🔢 كود الشاشة (PIN): <code>${esc(da.pinCode)}</code></span>
        <button class="cp" onclick="cp(this.dataset.copy)" data-copy="${esc(da.pinCode)}">${ico(I.copy)} نسخ</button>
      </div>` : ''}
      ${da.extraNote ? `<p style="font-size:12px;color:var(--mut);margin-top:6px">📌 <b>ملاحظة:</b> ${esc(da.extraNote)}</p>` : ''}
    </div>`;
}

function renderPaymentReceiptBox(pd, total) {
  if (!pd || !pd.paidAtFormatted) return '';
  return `
    <div class="sm" style="border:2px solid var(--ok);text-align:start">
      <h3 style="color:var(--ok)">⚡ وصل دفع إلكتروني مؤكّد</h3>
      <div class="row"><span>المبلغ المدفوع</span><b>${fmt(pd.amountPaid || total)}</b></div>
      <div class="row"><span>وسيلة الدفع</span><b>${esc(pd.paymentMethodUsed || 'Chargily Pay')}</b></div>
      <div class="row"><span>وقت الدفع</span><b dir="ltr">${esc(pd.paidAtFormatted)}</b></div>
      ${pd.payerName ? `<div class="row"><span>اسم الدافع</span><b>${esc(pd.payerName)}</b></div>` : ''}
      ${pd.payerEmail ? `<div class="row"><span>الإيميل</span><b>${esc(pd.payerEmail)}</b></div>` : ''}
      ${pd.transactionId ? `<div class="row"><span>مرجع العملية</span><b dir="ltr">${esc(pd.transactionId)}</b></div>` : ''}
    </div>`;
}

const gc = (p) => `
  <div class="gc">
    ${p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.n)}" style="width:52px;height:52px;object-fit:contain;border-radius:12px">`
      : `<i class="ic" style="background:${esc(p.c)}">${esc(p.l)}</i>`}
    <small>${esc(p.n)}</small>
  </div>`;

const card = (p) => {
  return `<a class="pc" href="#/p/${encodeURIComponent(p.id)}" style="--c:${esc(p.c)};--c2:${esc(p.c2)}">
    <div class="pv">
      <div class="bds"><span class="bd fl">${esc(p.badge || '⚡ فوري')}</span></div>
      ${gc(p)}
    </div>
    <div class="pi">
      <small>${esc(p.cat)}</small>
      <h3>${esc(p.t)}</h3>
      <div class="pr">ابتداءً من <b>${fmt(Math.min(...p.pl.map((x) => x[1])))}</b></div>
      <div class="btn" style="margin:0">عرض الباقات</div>
    </div>
  </a>`;
};

const home = () => `
  <div class="w">
    <div class="hero">
      <div class="sl" style="background:linear-gradient(135deg,#12286E,#2F5BEA)">
        <h2>اشتراكات الترفيه<br>بأسعار تناسبك</h2>
        <p>دفع فوري بالبطاقة الذهبية أو CIB عبر Chargily Pay واستلام للشاشة والـ PIN</p>
        <a class="cta" href="#/shop">تصفّح الاشتراكات</a>
      </div>
    </div>
    <h2 class="sh">اختر اشتراكك</h2>
    <div class="g">${P.map(card).join('')}</div>
    <h2 class="sh">مميزات متجرنا</h2>
    <div class="tr">
      <div><b>⚡ دفع إلكتروني تلقائي</b>ادفع بالذهبية أو CIB أو بمحفظتك ويتأكد طلبك في ثوانٍ</div>
      <div><b>👤 شاشة خاصة ورمز PIN</b>بيانات الشاشة وكود القفل تظهر في حسابك وفي بوت تيليغرام</div>
      <div><b>🎫 دعم فني وشكاوى</b>فريق دعم مخصص لمتابعة طلباتك وحل أي مشكلة فوراً</div>
    </div>
    <h2 class="sh">الأسئلة الشائعة</h2>
    ${FAQ.map((q) => `<details><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join('')}
  </div>`;

const shop = () => {
  const cs = ['الكل', ...new Set(P.map((p) => p.cat))];
  return `<div class="w">
    <h1 class="ttl">المتجر</h1>
    <div class="chips">${cs.map((c) => `<button class="chip ${c == cat ? 'on' : ''}" onclick="setCat('${esc(c)}')">${esc(c)}</button>`).join('')}</div>
    <div class="g" style="margin-top:8px">${P.filter((p) => cat == 'الكل' || p.cat == cat).map(card).join('')}</div>
  </div>`;
};

const prod = (p) => {
  const x = p.pl[sel] || p.pl[0];
  const it = editK >= 0 ? cart[editK] : null;
  const stepsList = Array.isArray(p.steps) && p.steps.length ? p.steps : DEFAULT_STEPS;
  const featBlock = `<h2 class="sh">ما ستحصل عليه</h2>
    <ul class="ft">${(p.f || []).map((f) => `<li><i>✓</i>${esc(f)}</li>`).join('')}</ul>`;
  const plansBlock = `<h2 class="sh">اختر مدة الاشتراك</h2>
    ${p.pl.map((y, i) => `<button class="pl ${i == sel ? 'on' : ''}" onclick="pickPlan(${i})">${y[2] ? '<span class="tag">الأوفر</span>' : ''}<span class="rd"></span><span class="d">${dur(y[0])}${y[3] ? `<small class="plan-label">${esc(y[3])}</small>` : ''}</span><b>${fmt(y[1])}</b></button>`).join('')}`;
  const qtyBlock = it ? `<h2 class="sh">الكمية</h2>
    <div class="qrow">
      <div class="q lg"><button onclick="editQty(-1)" aria-label="إنقاص">−</button><span>${it.q}</span><button onclick="editQty(1)" aria-label="زيادة">+</button></div>
      <b class="qtot">${fmt(x[1] * it.q)}</b>
    </div>` : '';
  return `<div class="ph" style="--c:${esc(p.c)};--c2:${esc(p.c2)}">
    ${gc(p)}
    <h1>${esc(p.t)}</h1>
    <p style="max-width:520px;opacity:.92;font-size:14px">${esc(p.sub || p.cat)}</p>
  </div>
  <div class="w">
    ${it ? `<div class="edit-note">${ico(I.edit, 16)}<span>أنت تعدّل اشتراكاً من سلتك — كل تغيير يُحفظ مباشرة، ويمكنك الرجوع في أي وقت.</span></div>` : ''}
    ${it ? plansBlock + qtyBlock + featBlock : featBlock + plansBlock}
    <h2 class="sh">كيف يتم طلبك؟</h2>
    <div class="tr">
      ${stepsList.map((st, idx) => `<div><b>${idx + 1}. ${esc(st.title)}</b>${esc(st.desc)}</div>`).join('')}
    </div>
  </div>
  <div class="w"><h2 class="sh">⭐ آراء المشترين</h2><div id="productReviews" data-product="${esc(p.id)}"><p class="note">جاري تحميل التقييمات…</p></div>
    ${custToken ? `<div class="sm"><label class="lb">تقييمك (بعد استلام الطلب)</label><select id="reviewStars" class="in2">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} ⭐</option>`).join('')}</select><textarea class="in2" id="reviewText" rows="3" maxlength="800" placeholder="شارك تجربتك الحقيقية مع المنتج"></textarea><button class="btn" onclick="submitReview('${esc(p.id)}')">إرسال التقييم للمراجعة</button></div>` : `<p class="note">سجّل الدخول لتقييم مشترياتك بعد التسليم.</p>`}
  </div>
  ${it ? `<div class="bar">
    <button class="btn o" onclick="editRemove()">حذف</button>
    <button class="btn" onclick="editDone()">حفظ · ${fmt(x[1] * it.q)}</button>
  </div>` : `<div class="bar">
    <button class="btn o" onclick="add('${esc(p.id)}',${x[0]})">أضف للسلة</button>
    <button class="btn" onclick="add('${esc(p.id)}',${x[0]},1)">اشترِ الآن · ${fmt(x[1])}</button>
  </div>`}`;
};

const cartV = () => {
  if (!cart.length) {
    return `<div class="w em"><div>🛒</div><h2>سلتك فارغة</h2><p class="note" style="margin-bottom:18px">اختر اشتراكك المفضل وابدأ المشاهدة اليوم</p><a class="btn" href="#/shop">تصفّح الاشتراكات</a></div>`;
  }
  return `<div class="w">
    <h1 class="ttl">سلة التسوق</h1>
    ${cartNote ? `<div class="cart-note">${esc(cartNote)}</div>` : ''}
    ${cart.map((i, k) => {
      const p = pr(i.id), x = pl(i);
      return `<div class="ci">
        <i class="ic" style="background:${esc(p.c)}" onclick="editItem(${k})">${esc(p.l)}</i>
        <div class="in">
          <button class="ci-t" onclick="editItem(${k})" aria-label="فتح الاشتراك وتعديله"><b>${esc(p.t)}</b><em>${ico(I.edit, 13)} فتح الاشتراك وتعديله</em></button>
          <select class="sel" onchange="chg(${k},this.value)">${p.pl.map((y) => `<option value="${esc(y[4] || y[0])}" ${(y[4] ? y[4] === i.k : y[0] == i.m) ? 'selected' : ''}>${dur(y[0])} · ${esc(y[3] || '')} — \u2066${y[1]} DA\u2069</option>`).join('')}</select>
          <div class="q"><button onclick="qty(${k},-1)">−</button><span>${i.q}</span><button onclick="qty(${k},1)">+</button></div>
        </div>
        <div class="cr"><button onclick="del(${k})">✕</button><b>${fmt(x[1] * i.q)}</b></div>
      </div>`;
    }).join('')}
    <div class="sm">
      <h3>ملخص الطلب</h3>
      <div class="row"><span>عدد الاشتراكات</span><b>${cart.reduce((s, i) => s + i.q, 0)}</b></div>
      <hr>
      <div class="tt"><span>الإجمالي</span>${fmt(tot())}</div>
    </div>
    <a class="btn" href="#/checkout">المتابعة لإتمام الطلب</a>
  </div>`;
};

const payButtons = () => PAY.map((m) => `<button class="pm ${m.auto ? 'full' : ''} ${m.id == payId ? 'on' : ''}" data-i="${esc(m.id)}" onclick="pick('${esc(m.id)}')">${m.auto ? '⚡ ' : m.wallet ? '💰 ' : ''}${esc(m.n)}</button>`).join('');

const submitLabel = () => (payId === 'chargily' ? 'الدفع الآن عبر شارجيلي ⚡' : 'تأكيد وإنهاء الطلب');

function refreshPayUI() {
  const box = $('#pms');
  if (!box) return;
  box.innerHTML = payButtons();
  $('#pbox').innerHTML = pbox();
  const sb = $('#submitBtn');
  if (sb && !sb.disabled) sb.textContent = submitLabel();
}

const pbox = () => {
  if (!payLoaded) return payFailed ? '⚠️ تعذّر تحميل طرق الدفع، أعد تحميل الصفحة أو تواصل معنا عبر واتساب.' : '⏳ جاري تحميل طرق الدفع…';
  const m = PAY.find((x) => x.id == payId);
  if (!m) return '⚠️ لا توجد طرق دفع متاحة حالياً، تواصل معنا عبر واتساب.';
  if (m.auto) {
    return `💳 <b>الدفع التلقائي عبر Chargily Pay</b><p style="margin-top:6px">${esc(m.desc)}</p>${chargilyMode === 'test' ? '<span style="display:inline-block;margin-top:6px;background:#F59E0B;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:800">وضع التجربة مفعل (Test Mode)</span>' : ''}`;
  }
  if (m.wallet) {
    const bal = custProfile ? custProfile.balance || 0 : 0;
    return `💰 <b>الدفع من رصيد المحفظة</b><p style="margin-top:6px">رصيدك المتاح حالياً: <b>${fmt(bal)}</b></p>${!custProfile ? '<p style="color:var(--bad);margin-top:4px">يرجى تسجيل الدخول من تبويب (حسابي) لاستخدام المحفظة.</p>' : ''}`;
  }
  return `حوّل المبلغ إلى ${esc(m.k || 'الحساب')}:<b class="num">${esc(m.v)}</b><button class="cp" data-v="${esc(m.v)}" onclick="cp(this.dataset.v)">${ico(I.copy)} نسخ الرقم</button>${m.desc ? `<p style="margin-top:8px;font-size:13px">${esc(m.desc).replace(/\n/g, '<br>')}</p>` : ''}`;
};

const chk = () => {
  if (!cart.length) return cartV();
  const u = me();
  return `<div class="w">
    <h1 class="ttl">إتمام الطلب</h1>
    <nav class="checkout-steps" aria-label="مراحل إتمام الطلب"><span class="done">✓ اختيار الباقة</span><span class="current">2 بياناتك والدفع</span><span>3 تأكيد الطلب</span></nav>
    <div class="checkout-trust">🔒 تُراجع طريقة الدفع على الخادم، ولا نطلب منك كتابة بيانات بطاقتك البنكية داخل المتجر.</div>
    <div class="sm rv">
      <div class="rv-h"><h3>راجع سلتك قبل الدفع</h3><a class="rv-a" href="#/cart">تعديل السلة</a></div>
      ${cart.map((i, k) => {
        const p = pr(i.id), x = pl(i);
        return `<div class="rv-i ${i.q > 1 ? 'multi' : ''}">
          <i class="ic" style="background:${esc(p.c)}">${esc(p.l)}</i>
          <div class="rv-d"><b>${esc(p.t)}</b><span>${dur(x[0])} ${x[3] ? `· ${esc(x[3])}` : ''} <span class="qx">× ${i.q}</span></span></div>
          <div class="rv-p">${fmt(x[1] * i.q)}<button onclick="editItem(${k})">تعديل</button></div>
        </div>`;
      }).join('')}
      <hr>
      <div class="tt"><span>الإجمالي المطلوب</span>${fmt(tot())}</div>
      ${cart.length > 1 || cart[0].q > 1 ? `<p class="rv-n">في سلتك ${cart.reduce((a, i) => a + i.q, 0)} اشتراكات — تأكد من الأعداد والمدد قبل الدفع.</p>` : ''}
    </div>

    <label class="lb" for="fn">الاسم الكامل *</label>
    <input class="in2" id="fn" autocomplete="name" value="${esc(chkDraft.n ?? u.n ?? '')}" oninput="chkDraft.n=this.value" placeholder="اكتب اسمك الكامل" required>

    <label class="lb" for="fp">رقم واتساب لاستلام الإشعارات *</label>
    <input class="in2" id="fp" type="tel" value="${esc(chkDraft.p ?? u.p ?? '')}" oninput="chkDraft.p=this.value" dir="ltr" placeholder="05XX XX XX XX" required>

    <label class="lb" for="fe">البريد الإلكتروني الشخصي للتواصل والضمان *</label>
    <input class="in2" id="fe" type="email" value="${esc(chkDraft.e ?? u.e ?? '')}" oninput="chkDraft.e=this.value" dir="ltr" placeholder="example@gmail.com" required>

    <div class="checkout-help"><strong>📩 كيف نستلم معلوماتك؟</strong><p>سنستخدم رقم واتساب والبريد لإشعارات الطلب فقط. يمكنك متابعة حالة الطلب في الموقع أو بوت Telegram بعد إتمام الطلب.</p></div>
    <label class="lb">اختر طريقة الدفع</label>
    <div class="pms" id="pms">${payButtons()}</div>
    <div class="box" id="pbox">${pbox()}</div>
    <div class="checkout-total"><span>المبلغ النهائي</span><strong>${fmt(tot())}</strong></div>
    <p class="checkout-confirmation">بالضغط على التأكيد، تُنشئ طلبًا بالمبلغ المعروض. الدفع اليدوي لا يُؤكَّد تلقائيًا بمجرد إرسال صورة وصل.</p>
    <button class="btn" id="submitBtn" onclick="send()">${submitLabel()}</button>
  </div>`;
};

const doneV = () => {
  if (!ord.code) return home();
  const showClaim = ord.claimToken && !custProfile;
  return `<div class="w em">
    <div class="okc">✓</div>
    <nav class="checkout-steps" aria-label="مراحل الطلب"><span class="done">✓ اختيار الباقة</span><span class="done">✓ بياناتك</span><span class="current">3 متابعة الطلب</span></nav>
    <h2>شكرًا ${esc(ord.n || 'لك')}، استلمنا طلبك 🎉</h2>
    <p class="note" style="font-size:15px;margin:4px 0">رقم طلبك: <b dir="ltr">${esc(ord.code)}</b> <button class="order-copy" onclick="cp('${esc(ord.code)}')">📋 نسخ</button></p>
    <p class="note" id="paidStatusNote">${ord.paid ? '✅ تم تأكيد دفعك الإلكتروني بنجاح! سيصلك الحساب والشاشة قريباً.' : 'أرسل صورة وصل الدفع عبر بوت تيليغرام لتأكيد طلبك واستلام الحساب والشاشة.'}</p>

    <div id="receiptContainer">${renderPaymentReceiptBox(ord.paymentDetails, ord.totalPrice)}</div>

    ${msg ? `<pre>${esc(msg)}</pre>` : ''}

    ${CFG.tg ? `<a class="btn tg" target="_blank" rel="noopener" href="https://t.me/${CFG.tg}?start=${encodeURIComponent(ord.code)}">📲 متابعة الطلب واستلام الحساب عبر تيليغرام</a>` : ''}
    ${CFG.wa ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${CFG.wa}?text=${encodeURIComponent(msg || ('مرحباً، قمت بإتمام الطلب رقم ' + ord.code))}">💬 مراسلتنا عبر واتساب</a>` : ''}

    ${showClaim ? `
    <div class="sm" id="claimBox" style="text-align:start;margin-top:20px;border:2px solid var(--pri2)">
      <h3 style="color:var(--pri2)">🎁 احفظ طلبك وأنشئ حسابك الآن</h3>
      <p style="font-size:13px;color:var(--mut);margin-bottom:10px">أنشئ حسابًا باستخدام بيانات طلبك لتتابع الاشتراك والتسليم. إذا كنت مستعجلاً يمكنك التخطي الآن أو استخدام الدخول عبر Google أو Telegram من صفحة حسابي.</p>
      <div class="note" style="margin:10px 0">👤 ${esc(me().n || '')} · 📱 ${esc(me().p || '')} · 📧 ${esc(me().e || '')}</div>
      <a class="chip" href="#/account">الدخول عبر Google / Telegram</a>
      <label class="lb">اختر كلمة سر لحسابك (8 أحرف فأكثر)</label>
      <input class="in2" id="cl_pw" type="password" dir="ltr" placeholder="••••••••">
      <label style="display:flex;gap:8px;font-size:12px;font-weight:700;margin-top:10px;align-items:center">
        <input type="checkbox" id="cl_ok" checked> أوافق على حفظ بياناتي لمتابعة طلباتي
      </label>
      <button class="btn" onclick="claimAccount()">إنشاء حسابي وربط الطلب</button>
    </div>` : ''}

    <a class="btn o" href="#/shop" style="margin-top:14px">العودة للمتجر</a>
  </div>`;
};

const trackV = () => `<div class="w">
  <h1 class="ttl">تتبع طلبي واستلام الحساب</h1>
  <div class="sm">
    <label class="lb">رمز الطلب</label>
    <input class="in2" id="tk_code" placeholder="OP-XXXXXXXX" style="text-transform:uppercase" dir="ltr">
    <label class="lb">آخر 4 أرقام من رقم الهاتف</label>
    <input class="in2" id="tk_ph" type="tel" maxlength="4" placeholder="مثال: 5850" dir="ltr">
    <button class="btn" onclick="trackOrder()">بحث وعرض حالة الطلب</button>
  </div>
  <div id="tk_res"></div>
</div>`;

window.trackOrder = async () => {
  const c = $('#tk_code').value.trim().toUpperCase();
  const p = $('#tk_ph').value.trim();
  if (!c || p.length !== 4) return toast('أدخل رمز الطلب وآخر 4 أرقام من الهاتف');
  $('#tk_res').innerHTML = '<p class="note">جارٍ البحث...</p>';
  try {
    const r = await fetch(`${ACC_URL}/track?code=${encodeURIComponent(c)}&phone4=${encodeURIComponent(p)}`);
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    const t = d.tracking;
    $('#tk_res').innerHTML = `
      <div class="sm">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <b style="font-size:17px" dir="ltr">${esc(t.orderCode)}</b>
          <span style="background:${COL[t.status] || '#666'};color:#fff;padding:3px 12px;border-radius:14px;font-size:12px;font-weight:800">${esc(t.status)}</span>
        </div>
        <div class="row"><span>طريقة الدفع</span><b>${esc(t.paymentMethod || '')} ${t.isPaidOnline ? '⚡' : ''}</b></div>
        <div class="row"><span>تاريخ الطلب</span><b dir="ltr">${new Date(t.createdAt).toLocaleString('fr-DZ')}</b></div>
        <hr>
        <ul style="padding-inline-start:18px;font-size:14px;color:var(--ink);font-weight:700">${t.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        <hr>
        <div class="tt"><span>الإجمالي</span>${fmt(t.totalPrice)}</div>
        ${renderDeliveredBox(t.deliveredAccount)}
        ${t.deliveryNotice ? `<p class="note">${esc(t.deliveryNotice)}</p>` : ''}
        ${t.deliveryNotice ? `<p class="note">${esc(t.deliveryNotice)}</p>` : ''}
      </div>
      ${renderPaymentReceiptBox(t.paymentDetails, t.totalPrice)}`;
  } catch (e) {
    $('#tk_res').innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
};

// ===== صفحة الحساب + شحن الرصيد + الشكاوى + قوقل وتيليغرام و2FA =====
let topupOpen = false, topupAmt = 1000;
const CMP_COL = { 'مفتوحة': '#F59E0B', 'تم الرد': '#16A34A', 'مغلقة': '#64748B' };

const brandFoot = () => `
  <div class="brand-foot">
    <a class="logo" href="#/"><i>▶</i>OVIRA <b>PLAY</b></a>
    <p>متجر الاشتراكات الرقمية · تسليم سريع وآمن</p>
    <div class="trust">
      <span>🔒 بياناتك محمية بـ 2FA</span>
      <span>⚡ تسليم سريع</span>
      <span>💬 دعم متواصل</span>
    </div>
  </div>`;

const pwField = (id, ac) => `
  <div class="pw">
    <input class="in2" id="${id}" type="password" dir="ltr" placeholder="••••••••" autocomplete="${ac}">
    <button type="button" class="eye" onclick="togglePw('${id}',this)" aria-label="إظهار كلمة السر">👁</button>
  </div>`;

window.requestPasswordOtp = async () => {
  try { const r = await fetch(ACC_URL+'/password/request-code',{method:'POST',headers:{Authorization:'Bearer '+custToken}});
    const d = await r.json(); toast(d.message || 'تم طلب رمز التحقق');
  } catch(e){toast('تعذّر طلب الرمز');}
};
window.changeCustomerPassword = async () => {
  const old = document.getElementById('changeOldPw')?.value || '';
  const code = document.getElementById('changeOtp')?.value || '';
  const newPassword = document.getElementById('changeNewPw')?.value || '';
  try {
    const r = await fetch(ACC_URL+'/password/change',{method:'POST',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},
      body:JSON.stringify({currentPassword:old,code,newPassword})});
    const d = await r.json(); toast(d.message || 'تم التحديث');
    if(d.success)custLogout();
  }catch(e){toast('تعذّر تحديث كلمة المرور');}
};

window.togglePw = (id, btn) => {
  const el = document.getElementById(id);
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
};

window.openTopup = () => { topupOpen = !topupOpen; draw(); };
window.setTopupAmt = (v) => { topupAmt = v; draw(); };
window.sendTopup = () => {
  const inp = document.getElementById('tp_amt');
  const amt = Math.round(Number(inp ? inp.value : topupAmt));
  if (!Number.isFinite(amt) || amt < 200) { toast('أدخل مبلغاً لا يقل عن 200 DA'); return; }
  if (!CFG.wa) { toast('رقم الدعم غير متوفر حالياً'); return; }
  const text = `مرحباً، أريد شحن رصيد محفظتي بمبلغ ${amt} DA.\nالاسم: ${custProfile.name}\nالهاتف: ${custProfile.phone || 'غير مضاف'}`;
  window.open('https://wa.me/' + CFG.wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
};

const topupPanel = () => !topupOpen ? '' : `
  <div class="sm topup">
    <h3>➕ شحن رصيد المحفظة</h3>
    <div class="chips" style="margin-bottom:8px">
      ${[500, 1000, 2000, 5000].map((v) => `<button class="chip ${topupAmt === v ? 'on' : ''}" onclick="setTopupAmt(${v})">${fmt(v)}</button>`).join('')}
    </div>
    <label class="lb">أو أدخل مبلغاً آخر (DA)</label>
    <input class="in2" id="tp_amt" type="number" inputmode="numeric" min="200" dir="ltr" value="${topupAmt}">
    <button class="btn wa" style="margin-top:12px" onclick="sendTopup()">💬 اطلب الشحن عبر واتساب</button>
    <p class="note" style="margin-top:8px">سيصلك الرصيد في حسابك بعد تأكيد الإدارة للدفع.</p>
  </div>`;

const complaintsBlock = () => `
  <div class="sec-head">
    <h2 class="sh" style="margin:0">🎫 شكاويّ وردود الإدارة (${custComplaints.length})</h2>
    <a class="chip on" href="#/support">➕ شكوى جديدة</a>
  </div>
  ${custComplaints.length ? custComplaints.map((c) => `
    <div class="sm">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <b>${esc(c.subject)} <span dir="ltr" style="color:var(--mut);font-size:12px">(${esc(c.ticketCode)})</span></b>
        <span class="badge" style="background:${CMP_COL[c.status] || '#64748B'}">${esc(c.status)}</span>
      </div>
      <div style="font-size:12px;color:var(--mut);margin:4px 0">${new Date(c.createdAt).toLocaleString('fr-DZ')}</div>
      <p style="font-size:13px;color:var(--mut);margin-top:6px">${esc(c.message)}</p>
      ${c.adminReply
        ? `<div class="ok-box" style="margin-top:10px"><h4>💬 رد الإدارة:</h4><p style="font-size:13px;font-weight:700">${esc(c.adminReply)}</p></div>`
        : '<div class="wait-box">⏳ بانتظار رد الإدارة…</div>'}
    </div>`).join('')
    : '<div class="sm"><p class="note">لا توجد شكاوى بعد. إذا واجهت أي مشكلة اضغط «شكوى جديدة» وسنرد عليك هنا وعبر تيليغرام.</p></div>'}`;

// بطاقة الأمان والتحقق بخطوتين (2FA) وربط تيليغرام داخل حساب الزبون
const securityBlock = () => {
  if (!custProfile) return '';
  const is2FA = !!custProfile.twoFactorEnabled;
  const methodLabel = custProfile.twoFactorMethod === 'telegram' ? 'عبر بوت تيليغرام 📲' : 'عبر Google Authenticator 🔑';

  return `
    <h2 class="sh">🔐 الأمان والتحقق بخطوتين (2FA)</h2>
    <div class="sec-card">
      <b>🔑 تعيين أو تغيير كلمة المرور</b>
      <p class="note">يلزم كلمة المرور الحالية أو رمز تحقق Telegram/تطبيق المصادقة. عند النجاح تنتهي الجلسات القديمة.</p>
      <input class="in2" id="changeOldPw" type="password" autocomplete="current-password" placeholder="كلمة المرور الحالية (إن وُجدت)">
      <input class="in2" id="changeOtp" inputmode="numeric" maxlength="6" placeholder="رمز 2FA أو Telegram" dir="ltr">
      <input class="in2" id="changeNewPw" type="password" autocomplete="new-password" placeholder="كلمة مرور جديدة (8 أحرف فأكثر)">
      <button class="btn o" onclick="requestPasswordOtp()">📲 إرسال رمز تأكيد إلى Telegram</button>
      <button class="btn" onclick="changeCustomerPassword()">حفظ كلمة المرور</button>
    </div>
    <div class="sec-card">
      ${!custProfile.phone ? `
        <div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);padding:12px;border-radius:14px;margin-bottom:14px">
          <b style="font-size:13px;color:#B45309">📱 أضف رقم واتساب لحسابك لتسهيل الطلبات:</b>
          <div style="display:flex;gap:8px;margin-top:8px">
            <input class="in2" id="prof_ph" type="tel" dir="ltr" placeholder="05XX XX XX XX" style="padding:9px 12px">
            <button class="chip on" onclick="saveCustPhone()">حفظ الرقم</button>
          </div>
        </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <b style="font-size:15px">ربط الحساب ببوت تيليغرام</b>
          <p style="font-size:12px;color:var(--mut)">لاستلام أكواد التحقق 2FA وإشعارات الطلبات والشاشات فوراً</p>
        </div>
        ${custProfile.telegramLinked
          ? `<span class="badge" style="background:var(--ok)">✅ مربوط ${custProfile.telegramUsername ? '(@' + esc(custProfile.telegramUsername) + ')' : ''}</span>`
          : `<button class="chip on" onclick="linkTelegramAccount()">🔗 ربط تيليغرام الآن</button>`}
      </div>

      <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <b style="font-size:15px">التحقق بخطوتين (2FA) عند الدخول</b>
          <p style="font-size:12px;color:var(--mut)">${is2FA ? `الحماية مفعّلة حالياً (${methodLabel})` : 'حماية اختيارية إضافية لحسابك ومحفظتك'}</p>
        </div>
        <span class="badge" style="background:${is2FA ? 'var(--ok)' : '#64748B'}">${is2FA ? '🟢 مفعّل' : '⚪ غير مفعّل'}</span>
      </div>

      ${is2FA ? `
        <button class="btn o" style="margin-top:12px;color:var(--bad);border-color:rgba(239,68,68,.35)" onclick="disableCustomer2FA()">🔓 إيقاف التحقق بخطوتين</button>
      ` : `
        <div class="sec-grid">
          <button class="btn tg" style="margin:0;font-size:13px" onclick="start2FASetup('telegram')">📲 تفعيل عبر بوت تيليغرام</button>
          <button class="btn" style="margin:0;font-size:13px" onclick="start2FASetup('totp')">🔑 تفعيل عبر Google Authenticator</button>
        </div>
      `}

      ${twoFaSetup ? `
        <div class="ok-box" style="margin-top:14px;border-color:var(--pri2);background:rgba(36,71,201,.06)">
          <h4 style="color:var(--pri2)">${twoFaSetup.method === 'totp' ? '🔑 إعداد تطبيق Google Authenticator' : '📲 تأكيد كود بوت تيليغرام'}</h4>
          ${twoFaSetup.method === 'totp' ? `
            <p style="font-size:13px;color:var(--mut)">1. في تطبيق المصادقة اختر إضافة مفتاح يدوياً، ثم انسخ المفتاح أدناه. حفاظاً على سر التحقق لا نرسله إلى أي خادم لتوليد QR.</p>
            <div class="cred-row">
              <span>المفتاح: <code>${esc(twoFaSetup.secret)}</code></span>
              <button class="cp" onclick="cp(this.dataset.copy)" data-copy="${esc(twoFaSetup.secret)}">${ico(I.copy)} نسخ</button>
            </div>
            <p style="font-size:13px;color:var(--mut);margin-top:8px">2. أدخل الرمز المكون من 6 أرقام الظاهر في التطبيق لتأكيد التفعيل:</p>
          ` : `
            <p style="font-size:13px;color:var(--mut)">${esc(twoFaSetup.message)}</p>
          `}
          <input class="in2 otp-inp" id="setup_2fa_code" type="text" inputmode="numeric" maxlength="6" dir="ltr" placeholder="000000" style="margin-top:8px">
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn" style="margin:0" onclick="confirm2FAEnable('${twoFaSetup.method}')">✅ تأكيد وتفعيل</button>
            <button class="btn o" style="margin:0;flex:0 0 35%" onclick="twoFaSetup=null;draw()">إلغاء</button>
          </div>
        </div>
      ` : ''}
    </div>`;
};

const accountV = () => {
  // إذا كان الزبون في مرحلة إدخال كود التحقق بخطوتين (2FA) لإتمام الدخول
  if (twoFaPending) {
    return `<div class="w">
      <h1 class="ttl">🔐 التحقق بخطوتين (2FA)</h1>
      <div class="sm" style="text-align:center">
        <div style="font-size:40px;margin-bottom:8px">${twoFaPending.method === 'telegram' ? '📲' : '🔑'}</div>
        <h3>تأكيد هويتك للدخول</h3>
        <p style="font-size:13px;color:var(--mut);margin-bottom:14px">${esc(twoFaPending.message)}</p>
        <input class="in2 otp-inp" id="login_2fa_code" type="text" inputmode="numeric" maxlength="6" dir="ltr" placeholder="000000">
        <button class="btn" onclick="verifyCustomer2FALogin()">تأكيد الكود والدخول</button>
        <button class="btn o" onclick="twoFaPending=null;draw()">العودة لتسجيل الدخول</button>
      </div>
      ${brandFoot()}
    </div>`;
  }

  if (!custProfile) {
    return `<div class="w">
      <h1 class="ttl">حسابي ومحفظتي</h1>
      <div class="sm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <button class="chip ${authTab === 'login' ? 'on' : ''}" onclick="authTab='login';draw()">تسجيل الدخول</button>
          <button class="chip ${authTab === 'register' ? 'on' : ''}" onclick="authTab='register';draw()">إنشاء حساب جديد</button>
        </div>
        ${authTab === 'register' ? `
          <label class="lb">الاسم الكامل *</label>
          <input class="in2" id="au_name" placeholder="اسمك الكامل" autocomplete="name">
          <label class="lb">رقم واتساب *</label>
          <input class="in2" id="au_phone" type="tel" dir="ltr" placeholder="05XX XX XX XX" autocomplete="tel">
          <label class="lb">البريد الإلكتروني الشخصي *</label>
          <input class="in2" id="au_email" type="email" dir="ltr" placeholder="example@gmail.com" autocomplete="email">
          <label class="lb">كلمة السر (8 أحرف فأكثر) *</label>
          ${pwField('au_pass', 'new-password')}
          <button class="btn" onclick="doCustRegister()">إنشاء الحساب الآن</button>
        ` : `
          <label class="lb">رقم الهاتف أو البريد الإلكتروني</label>
          <input class="in2" id="au_id" dir="ltr" placeholder="05XX XX XX XX أو الإيميل" autocomplete="username">
          <label class="lb">كلمة السر</label>
          ${pwField('au_pass', 'current-password')}
          <button class="btn" onclick="doCustLogin()">دخول إلى حسابي</button>
        `}

        <div class="social-divider">أو الدخول السريع بضغطة زر عبر</div>
        <div class="social-box">
          <div id="g_id_btn" class="social-slot"></div>
          <div id="tg_login_btn" class="social-slot"></div>
        </div>
      </div>
      ${brandFoot()}
    </div>`;
  }

  return `<div class="w">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;gap:10px">
      <h1 class="ttl" style="margin:0">مرحباً، ${esc(custProfile.name)}</h1>
      <button class="chip" onclick="custLogout()">تسجيل الخروج</button>
    </div>

    <div class="sm wallet-card">
      <div style="font-size:13px;opacity:.9">💰 رصيد محفظتك المتاح للشراء الفوري</div>
      <div style="font-size:28px;font-weight:900;margin:4px 0">${fmt(custProfile.balance || 0)}</div>
      <div style="font-size:12px;opacity:.85">📱 ${esc(custProfile.phone || 'لم يُضف رقم بعد')} ${custProfile.email ? '· 📧 ' + esc(custProfile.email) : ''}</div>
      <button class="topup-btn" onclick="openTopup()">➕ شحن الرصيد</button>
    </div>
    ${topupPanel()}

    ${securityBlock()}

    <h2 class="sh">📦 طلباتي وحساباتي المسلمة (${custOrders.length})</h2>
    ${custOrders.length ? custOrders.map((o) => `
      <div class="sm">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b dir="ltr">${esc(o.orderCode)}</b>
          <span class="badge" style="background:${COL[o.status] || '#666'}">${esc(o.status)}</span>
        </div>
        <div style="font-size:12px;color:var(--mut);margin:4px 0">${new Date(o.createdAt).toLocaleString('fr-DZ')} · ${esc(o.paymentMethod)}</div>
        <div style="font-size:14px;font-weight:700;margin:6px 0">${o.items.map((i) => esc(i)).join(' | ')}</div>
        <div class="tt" style="font-size:15px"><span>الإجمالي</span>${fmt(o.totalPrice)}</div>
        ${renderDeliveredBox(o.deliveredAccount)}
      </div>
    `).join('') : '<div class="sm"><p class="note">لا توجد طلبات سابقة بعد.</p></div>'}

    ${complaintsBlock()}
    ${brandFoot()}
  </div>`;
};

// تهيئة أزرار Google وTelegram بعد رسم صفحة الدخول
function mountSocialButtons() {
  const gBox = document.getElementById('g_id_btn');
  if (gBox && CFG.googleClientId) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: CFG.googleClientId,
          callback: window.handleGoogleCredential
        });
        window.google.accounts.id.renderButton(gBox, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'ar',
          width: 280
        });
      } catch (e) {}
    } else {
      setTimeout(mountSocialButtons, 500);
    }
  }

  const tgBox = document.getElementById('tg_login_btn');
  if (tgBox && CFG.tg && !tgBox.hasChildNodes()) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', CFG.tg);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '20');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-request-access', 'write');
    tgBox.appendChild(s);
  }
}

async function processAuthResult(d, welcomeMsg = 'مرحباً بك ✓') {
  if (d.requires2FA) {
    twoFaPending = {
      tempToken: d.tempToken,
      method: d.method,
      message: d.message
    };
    toast(d.message);
    draw();
    return;
  }
  twoFaPending = null;
  custToken = d.token;
  localStorage.setItem('ov_ctk', custToken);
  await fetchCustomerProfile();
  toast(welcomeMsg);
  draw();
}

window.handleGoogleCredential = async (response) => {
  try {
    const r = await fetch(ACC_URL + '/oauth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'تم تسجيل الدخول عبر Google بنجاح ✓');
  } catch (e) {
    toast(e.message || 'تعذّر الدخول عبر قوقل');
  }
};

window.onTelegramAuth = async (user) => {
  try {
    const r = await fetch(ACC_URL + '/oauth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'تم تسجيل الدخول عبر تيليغرام بنجاح ✓');
  } catch (e) {
    toast(e.message || 'تعذّر الدخول عبر تيليغرام');
  }
};

window.verifyCustomer2FALogin = async () => {
  const codeEl = document.getElementById('login_2fa_code');
  const code = (codeEl ? codeEl.value : '').trim();
  if (code.length !== 6) return toast('أدخل الكود المكون من 6 أرقام');
  try {
    const r = await fetch(ACC_URL + '/2fa/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: twoFaPending.tempToken, code })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'تم التحقق وتسجيل الدخول بنجاح 🎉');
  } catch (e) {
    toast(e.message);
  }
};

window.linkTelegramAccount = async () => {
  try {
    const r = await fetch(ACC_URL + '/telegram-link-code', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + custToken }
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    window.open(d.botUrl, '_blank', 'noopener');
    toast('اضغط Start في بوت تيليغرام ثم حدّث الصفحة ✓');
  } catch (e) {
    toast(e.message);
  }
};

window.start2FASetup = async (method) => {
  try {
    const r = await fetch(ACC_URL + '/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + custToken },
      body: JSON.stringify({ method })
    });
    const d = await r.json();
    if (!d.success) {
      if (d.needsTelegramLink && d.linkCode) {
        window.open(`https://t.me/${CFG.tg}?start=${d.linkCode}`, '_blank', 'noopener');
      }
      throw new Error(d.message);
    }
    twoFaSetup = d;
    draw();
  } catch (e) {
    toast(e.message);
  }
};

window.confirm2FAEnable = async (method) => {
  const codeEl = document.getElementById('setup_2fa_code');
  const code = (codeEl ? codeEl.value : '').trim();
  if (code.length !== 6) return toast('أدخل الرمز المكون من 6 أرقام');
  try {
    const r = await fetch(ACC_URL + '/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + custToken },
      body: JSON.stringify({ method, code })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    twoFaSetup = null;
    await fetchCustomerProfile();
    toast(d.message);
    draw();
  } catch (e) {
    toast(e.message);
  }
};

window.disableCustomer2FA = async () => {
  if (!confirm('هل تريد إيقاف التحقق بخطوتين (2FA) لحسابك؟')) return;
  try {
    const r = await fetch(ACC_URL + '/2fa/disable', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + custToken }
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await fetchCustomerProfile();
    toast(d.message);
    draw();
  } catch (e) {
    toast(e.message);
  }
};

window.saveCustPhone = async () => {
  const phEl = document.getElementById('prof_ph');
  const phone = phEl ? phEl.value.trim() : '';
  if (!phone) return toast('أدخل رقم الواتساب');
  try {
    const r = await fetch(ACC_URL + '/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + custToken },
      body: JSON.stringify({ phone })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await fetchCustomerProfile();
    toast(d.message);
    draw();
  } catch (e) {
    toast(e.message);
  }
};

const supportV = () => {
  const u = me();
  return `<div class="w">
    <h1 class="ttl">🎫 تقديم شكوى أو تذكرة دعم</h1>
    <div class="sm">
      <p style="font-size:13px;color:var(--mut);margin-bottom:10px">إذا واجهت أي مشكلة في الحساب أو الشاشة أو الدفع، املأ النموذج أدناه وسنرد عليك فوراً عبر تيليغرام وفي حسابك.</p>
      <label class="lb">الاسم الكامل *</label>
      <input class="in2" id="sp_name" value="${esc(u.n || '')}" placeholder="اسمك الكامل">
      <label class="lb">رقم واتساب *</label>
      <input class="in2" id="sp_phone" type="tel" dir="ltr" value="${esc(u.p || '')}" placeholder="05XX XX XX XX">
      <label class="lb">البريد الإلكتروني</label>
      <input class="in2" id="sp_email" type="email" dir="ltr" value="${esc(u.e || '')}" placeholder="example@gmail.com">
      <label class="lb">رمز الطلب المرتبط (اختياري)</label>
      <input class="in2" id="sp_code" dir="ltr" style="text-transform:uppercase" placeholder="OP-XXXXXXXX">
      <label class="lb">عنوان المشكلة *</label>
      <input class="in2" id="sp_subj" placeholder="مثال: مشكلة في كود الشاشة PIN / استفسار عن طلب">
      <label class="lb">تفاصيل الشكوى *</label>
      <textarea class="in2" id="sp_msg" placeholder="اشرح المشكلة بالتفصيل..."></textarea>
      <button class="btn" id="sp_btn" onclick="sendComplaint()">إرسال الشكوى للإدارة</button>
    </div>
  </div>`;
};

window.sendComplaint = async () => {
  const payload = {
    customerName: $('#sp_name').value.trim(),
    whatsappNumber: $('#sp_phone').value.trim(),
    customerEmail: $('#sp_email').value.trim(),
    orderCode: $('#sp_code').value.trim(),
    subject: $('#sp_subj').value.trim(),
    message: $('#sp_msg').value.trim()
  };
  const btn = $('#sp_btn');
  btn.disabled = true;
  try {
    const r = await fetch(ACC_URL + '/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    toast(d.message);
    $('#sp_subj').value = '';
    $('#sp_msg').value = '';
    if (custToken) await fetchCustomerProfile();
  } catch (e) {
    toast(e.message || 'تعذّر إرسال الشكوى');
  } finally {
    btn.disabled = false;
  }
};

window.doCustLogin = async () => {
  const identifier = $('#au_id').value.trim();
  const password = $('#au_pass').value;
  try {
    const r = await fetch(ACC_URL + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'مرحباً بك مجدداً ✓');
  } catch (e) {
    toast(e.message);
  }
};

window.doCustRegister = async () => {
  const name = $('#au_name').value.trim();
  const phone = $('#au_phone').value.trim();
  const email = $('#au_email').value.trim();
  const password = $('#au_pass').value;
  try {
    const r = await fetch(ACC_URL + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    try { localStorage.setItem('oi', JSON.stringify({ n: name, p: phone, e: email })); } catch (e) {}
    await processAuthResult(d, d.message);
  } catch (e) {
    toast(e.message);
  }
};

window.custLogout = () => {
  custToken = '';
  custProfile = null;
  custOrders = [];
  custComplaints = [];
  twoFaPending = null;
  twoFaSetup = null;
  localStorage.removeItem('ov_ctk');
  toast('تم تسجيل الخروج');
  draw();
};

window.claimAccount = async () => {
  if (!$('#cl_ok').checked) return toast('يرجى الموافقة على الشروط');
  const password = $('#cl_pw').value;
  try {
    const r = await fetch(ACC_URL + '/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken: ord.claimToken, password, consent: true })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    custToken = d.token;
    try { sessionStorage.removeItem('ov_claim_' + ord.code); } catch(e) {}
    localStorage.setItem('ov_ctk', custToken);
    await fetchCustomerProfile();
    toast('تم إنشاء حسابك وربط طلبك بنجاح 🎉');
    const box = $('#claimBox');
    if (box) box.innerHTML = '<div style="text-align:center;color:var(--ok);font-weight:800">✅ تم تفعيل حسابك وربط الطلب بنجاح! يمكنك متابعته من تبويب (حسابي).</div>';
  } catch (e) {
    toast(e.message);
  }
};

function view() {
  const rawHash = location.hash.slice(2);
  const [pathPart, queryPart] = rawHash.split('?');
  const h = (pathPart || 'home').split('/');
  const v = h[0] || 'home';
  const prodSlug = decodeURIComponent(h[1] || '');

  if (v === 'done' && queryPart) {
    const params = new URLSearchParams(queryPart);
    const orderFromUrl = params.get('order');
    if (orderFromUrl) {
      ord.code = orderFromUrl;
      try { ord.claimToken = sessionStorage.getItem('ov_claim_' + orderFromUrl) || ''; } catch(e) {}
      ord.paid = params.get('paid') === '1';
      cart = []; save();
      fetch(`${API_URL}/verify-chargily/${encodeURIComponent(orderFromUrl)}`, { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d && d.success) {
            ord.paid = d.paid;
            ord.totalPrice = d.totalPrice;
            ord.paymentDetails = d.paymentDetails;
            const el = $('#paidStatusNote');
            if (el && d.paid) el.textContent = '✅ تم تأكيد الدفع الإلكتروني تلقائياً عبر Chargily Pay وإرسال الوصل للإدارة!';
            const rc = $('#receiptContainer');
            if (rc && d.paymentDetails) rc.innerHTML = renderPaymentReceiptBox(d.paymentDetails, d.totalPrice);
          }
        }).catch(() => {});
    }
  }

  document.body.className = v == 'p' && pr(prodSlug) ? 'pp' : '';
  if (v == 'p' && pr(prodSlug)) return prod(pr(prodSlug));
  return v == 'shop' ? shop()
    : v == 'cart' ? cartV()
    : v == 'checkout' ? chk()
    : v == 'done' ? doneV()
    : v == 'track' ? trackV()
    : v == 'account' ? accountV()
    : v == 'support' ? supportV()
    : home();
}

function chrome() {
  const h = location.hash.slice(2).split('?')[0].split('/');
  const v = h[0] || 'home';
  const n = cart.reduce((s, i) => s + i.q, 0);

  $('#hd').classList.toggle('tight', v != 'home' && !!custProfile);
  $('#hd').innerHTML = `
    ${v != 'home' ? `<button class="ib" onclick="back()" aria-label="رجوع">${ico(I.back)}</button>` : ''}
    <a class="logo" href="#/"><i>▶</i><span class="lt">OVIRA <b>PLAY</b></span></a>
    ${custProfile ? `<a class="wallet-pill" href="#/account" aria-label="رصيد محفظتك">${ico(I.wallet, 18)}<span class="wt"><small>رصيدك</small><b>${fmt(custProfile.balance || 0)}</b></span></a>` : ''}
    <button class="ib" onclick="theme()" aria-label="تغيير المظهر">${ico(I.moon)}</button>
    <a class="ib" href="#/cart" aria-label="السلة">${ico(I.cart)}${n ? `<span class="cnt">${n}</span>` : ''}</a>`;

  const tabs = [
    ['home', 'الرئيسية', '/'],
    ['shop', 'المتجر', '/shop'],
    ['track', 'تتبع', '/track'],
    ['account', 'حسابي', '/account'],
    ['support', 'شكوى/دعم', '/support']
  ];
  $('#nv').innerHTML = tabs.map((x) => `<a href="#${x[2]}" class="${x[0] == v ? 'on' : ''}">${ico(I[x[0]] || I.user)}${x[1]}</a>`).join('');
}

function draw() {
  clean();
  app.innerHTML = view();
  chrome();
  mountSocialButtons();
  if (document.getElementById('productReviews')) loadProductReviews();
}

async function loadProductReviews() {
  const target = document.getElementById('productReviews');
  if (!target) return;
  const id = target.dataset.product;
  try {
    const r = await fetch(`${API_URL}/reviews/${encodeURIComponent(id)}`);
    const d = await r.json();
    if (!d.success || !target.isConnected || target.dataset.product !== id) return;
    target.innerHTML = `<p class="note">${d.count ? `متوسط التقييم: ${d.average}/5 من ${d.count} تقييم` : 'لا توجد تقييمات منشورة بعد.'}</p>` +
      (d.reviews || []).map((v) => `<div class="sm"><b>${esc(v.displayName)}</b> <span>${'⭐'.repeat(v.stars)}</span><p>${esc(v.comment)}</p></div>`).join('');
  } catch(e) { if(target.isConnected)target.textContent='تعذّر تحميل التقييمات حالياً.'; }
}
window.submitReview = async (productId) => {
  const stars = Number(document.getElementById('reviewStars')?.value);
  const comment = document.getElementById('reviewText')?.value || '';
  try {
    const r = await fetch(ACC_URL+'/reviews', {method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+custToken},
      body:JSON.stringify({productId,stars,comment})});
    const d = await r.json();toast(d.message || 'تم إرسال التقييم');
  } catch(e){toast('تعذر إرسال التقييم');}
};

function route() {
  const h = location.hash.slice(2).split('?')[0].split('/');
  const slug = decodeURIComponent(h[1] || '');
  editK = -1;
  if (h[0] != 'p') editBack = false;
  if (h[0] != 'cart') cartNote = '';
  if (h[0] == 'p' && pr(slug)) {
    const q = new URLSearchParams(location.hash.split('?')[1] || '').get('edit');
    const k = q === null ? -1 : parseInt(q, 10);
    const it = k >= 0 ? cart[k] : null;
    if (it && it.id == slug && pl(it)) {
      editK = k;
      sel = Math.max(0, pr(slug).pl.findIndex((x) => it.k ? x[4] === it.k : x[0] == it.m));
    } else {
      sel = Math.max(0, pr(slug).pl.findIndex((x) => x[2]));
    }
  }
  if (h[0] == 'account' && custToken) fetchCustomerProfile().then(() => { app.innerHTML = view(); chrome(); });
  draw();
  scrollTo(0, 0);
}

function back() { history.length > 1 ? history.back() : (location.hash = '#/'); }
function setCat(c) { cat = c; draw(); }
function pickPlan(i) {
  sel = i;
  if (editK >= 0 && cart[editK]) { const v = pr(cart[editK].id).pl[i]; cart[editK].m = v[0]; cart[editK].k = v[4] || ''; save(); }
  draw();
}
function add(id, m, go) {
  const chosen = pr(id)?.pl[sel] || pr(id)?.pl.find((x) => x[0] == m);
  const key = chosen?.[4] || '';
  const e = cart.find((i) => i.id == id && (key ? i.k === key : i.m == m));
  const had = !!e;
  if (e) e.q = Math.min(9, e.q + 1);
  else cart.push({ id, m, k: key, q: 1 });
  save();
  const cur = cart.find((i) => i.id == id && (key ? i.k === key : i.m == m));
  if (go) {
    if (cart.length === 1 && cur.q === 1) { location.hash = '#/checkout'; return; }
    const t = pr(id).t + ' — ' + dur(m);
    cartNote = had
      ? `«${t}» كان في سلتك أصلاً فأصبحت كميته ${cur.q}. إن لم تقصد ذلك فعدّل الكمية قبل المتابعة.`
      : `تمت إضافة «${t}». راجع كل ما في سلتك ثم تابع للدفع.`;
    location.hash = '#/cart';
  } else {
    draw();
    toast(had ? `في سلتك الآن ${cur.q} من هذا الاشتراك — عدّل الكمية من السلة إن لزم` : 'تمت الإضافة إلى السلة ✓');
  }
}

window.editItem = (k) => {
  const it = cart[k];
  if (!it) return;
  editBack = true;
  location.hash = '#/p/' + encodeURIComponent(it.id) + '?edit=' + k;
};
function leaveEdit() {
  if (editBack) { editBack = false; history.back(); }
  else location.hash = '#/cart';
}
window.editQty = (d) => {
  if (editK < 0 || !cart[editK]) return;
  cart[editK].q = Math.min(9, Math.max(1, cart[editK].q + d));
  save();
  draw();
};
window.editDone = () => { toast('تم حفظ التعديل ✓'); leaveEdit(); };
window.editRemove = () => {
  if (editK >= 0) { cart.splice(editK, 1); save(); }
  editK = -1;
  toast('تم حذف الاشتراك من السلة');
  leaveEdit();
};
function qty(k, d) { cart[k].q = Math.min(9, Math.max(1, cart[k].q + d)); save(); draw(); }
function del(k) { cart.splice(k, 1); save(); draw(); toast('تم الحذف من السلة'); }
function chg(k, v) { const chosen = pr(cart[k].id)?.pl.find((x) => x[4] ? x[4] === String(v) : x[0] == v); if(chosen){cart[k].m=chosen[0];cart[k].k=chosen[4] || '';} save(); draw(); }
function pick(id) {
  payId = id;
  document.querySelectorAll('.pm').forEach((b) => b.classList.toggle('on', b.dataset.i == id));
  $('#pbox').innerHTML = pbox();
  const sb = $('#submitBtn');
  if (sb) sb.textContent = submitLabel();
}

async function send() {
  const n = $('#fn').value.trim();
  const ph = normPh($('#fp').value);
  const em = $('#fe').value.trim().toLowerCase();

  if (n.length < 3) { $('#fn').focus(); return toast('اكتب اسمك الكامل'); }
  if (!/^0[567]\d{8}$/.test(ph)) { $('#fp').focus(); return toast('أدخل رقم واتساب جزائري صحيح من 10 أرقام'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $('#fe').focus(); return toast('أدخل بريدك الإلكتروني الشخصي بشكل صحيح'); }

  const pm = PAY.find((x) => x.id == payId);
  if (!pm) return toast('اختر طريقة دفع متاحة أولاً');
  const submitBtn = $('#submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري معالجة الطلب...';

  const returnOrigin = location.origin + location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  const payload = {
    customerName: n,
    whatsappNumber: ph,
    customerEmail: em,
    paymentMethod: pm.n,
    totalPrice: tot(),
    cartItems: cart.map((i) => ({ id: i.id, m: i.m, k: i.k || '', q: i.q })),
    returnOrigin
  };

  const headers = { 'Content-Type': 'application/json' };
  if (custToken) headers['Authorization'] = 'Bearer ' + custToken;

  try {
    const response = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await response.json();
    if (data.success) {
      const code = data.order.orderCode;
      msg = [
        '🧾 طلب جديد — OVIRA PLAY',
        'رقم الطلب: ' + code,
        '👤 الاسم: ' + n,
        '📱 واتساب: ' + ph,
        '📧 الإيميل: ' + em,
        '',
        '🛒 المشتريات:',
        ...cart.map((i, k) => (k + 1) + ') ' + pr(i.id).t + ' (' + dur(pl(i)[0]) + ' × ' + i.q + ')'),
        '💰 الإجمالي: ' + tot() + ' DA',
        '💳 طريقة الدفع: ' + pm.n
      ].join('\n');

      ord = {
        code,
        n: n.split(' ')[0],
        ids: cart.map((i) => pr(i.id).n),
        claimToken: data.claimToken,
        paid: !!data.order.isPaidOnline,
        totalPrice: data.order.totalPrice,
        paymentDetails: null
      };

      try { localStorage.setItem('oi', JSON.stringify({ n, p: ph, e: em }));
        if (data.claimToken) sessionStorage.setItem('ov_claim_' + code, data.claimToken); } catch (e) {}

      if (data.checkoutUrl) {
        location.href = data.checkoutUrl;
        return;
      }

      if (custToken) fetchCustomerProfile();
      cart = []; save(); chkDraft = { n: null, p: null, e: null }; location.hash = '#/done';
    } else {
      toast(data.message || 'حدث خطأ أثناء معالجة الطلب.');
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel();
      if (data.code === 'PAYMENT_UNAVAILABLE') loadPayConfig();
    }
  } catch (error) {
    toast('تعذّر الاتصال بالخادم، حاول مجدداً.');
    submitBtn.disabled = false;
    submitBtn.textContent = submitLabel();
  }
}

if (CFG.wa) {
  const f = $('#fab');
  f.href = 'https://wa.me/' + CFG.wa;
}

addEventListener('hashchange', route);
route();
