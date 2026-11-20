const API_BASE = (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  ? 'http://127.0.0.1:5001'
  : 'https://ovira-api.onrender.com';
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

// المصدر الوحيد للمنتجات هو الكتالوج الحي من الخادم؛ لا منتجات وهمية ولا كاش قديم.
let P = [];
let catalogStatus = 'loading'; // loading | ready | error
let catalogErrorCode = '';
let catalogRequest = null;
let cartAlert = '';
const BASE_TITLE = document.title || 'OVIRA PLAY | متجر الاشتراكات الرقمية';
const BASE_META = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
let productReviewSummary = {};
const productReviewsCache = new Map();
let deliveryStats = null;

function updatePageSEO(product) {
  const t = product && String(product.seoT || '').trim();
  document.title = product ? (t || `${product.t} | OVIRA PLAY`) : BASE_TITLE;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', product ? String(product.seoD || product.sub || '').trim() : BASE_META);
  // تحديث معاينة الصفحة داخل المتصفح؛ معاينات شبكات التواصل الخارجية تحتاج صفحات SSR حقيقية.
  for (const [property, content] of [
    ['og:title', document.title],
    ['og:description', product ? String(product.seoD || product.sub || '').trim() : BASE_META]
  ]) {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }
}

// حملة الإحالة: تقرأ من رابط الصفحة أو مسار #/، وتبقى في الجلسة وفي التخزين المحلي 7 أيام.
const SOURCE_KEY = 'ov_ref_source_v1';
const SOURCE_TTL = 7 * 24 * 60 * 60 * 1000;
const sourceSafe = (v) => String(v || '').replace(/[^A-Za-z0-9 _.:|/+\-]/g, '').trim();
function sourceParams() {
  const normal = new URLSearchParams(location.search || '');
  const hash = (location.hash || '').slice(1);
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : (/^(?:\/?)(?:utm_source|utm_medium|utm_campaign|src)=/i.test(hash) ? hash.replace(/^\//, '') : '');
  const hashed = new URLSearchParams(query);
  const parts = ['utm_source', 'utm_medium', 'utm_campaign', 'src'];
  return parts.map((key) => {
    const v = hashed.get(key) || normal.get(key);
    return v ? `${key}:${sourceSafe(v).slice(0, 48)}` : '';
  }).filter((x) => x && !x.endsWith(':')).join('|').slice(0, 80);
}
function captureSource() {
  const value = sourceParams();
  if (!value) return;
  const record = JSON.stringify({ value, at: Date.now() });
  try { sessionStorage.setItem(SOURCE_KEY, record); } catch (_) {}
  try { localStorage.setItem(SOURCE_KEY, record); } catch (_) {}
}
function currentSource() {
  captureSource();
  for (const store of [typeof sessionStorage !== 'undefined' ? sessionStorage : null, typeof localStorage !== 'undefined' ? localStorage : null]) {
    if (!store) continue;
    try {
      const d = JSON.parse(store.getItem(SOURCE_KEY) || 'null');
      if (d && typeof d.value === 'string' && Number(d.at) > Date.now() - SOURCE_TTL && Number(d.at) <= Date.now()) return sourceSafe(d.value).slice(0, 80);
      if (d) store.removeItem(SOURCE_KEY);
    } catch (_) {}
  }
  return '';
}
captureSource();

function catalogLoading() {
  return `<div class="w ov-loading" role="status" aria-live="polite" aria-label="جاري تحميل المنتجات">
    <div class="ov-skeleton ov-sk-hero"></div><div class="ov-skeleton" style="height:25px;width:180px"></div>
    <div class="ov-sk-grid">${[0, 1, 2, 3].map(() => '<div class="ov-skeleton ov-sk-card"></div>').join('')}</div>
    <p class="note" style="text-align:center;margin-top:20px">جاري جلب الاشتراكات والأسعار الحالية من المتجر… قد يتأخر اتصال الخادم قليلاً.</p>
  </div>`;
}
function catalogUnavailable() {
  const rateLimited = catalogErrorCode === 'RATE_LIMITED';
  return `<div class="w"><div class="ov-state" role="alert">
    <div style="font-size:35px">${rateLimited ? '⏳' : '📡'}</div>
    <h2>${rateLimited ? 'ازدحام مؤقت في الطلبات' : 'تعذّر تحميل الاشتراكات'}</h2>
    <p>${rateLimited ? 'وصل المتجر إلى حد الاتصالات المسموح مؤقتاً. يرجى إعادة المحاولة بعد قليل.' : 'لا يمكن التأكد من المنتجات والأسعار الحالية دون الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة، وقد يحتاج الخادم بعض الوقت للبدء.'}</p>
    <button class="btn" type="button" onclick="retryCatalog()">إعادة المحاولة</button>
  </div></div>`;
}
function catalogEmpty() {
  return `<div class="w"><div class="ov-state"><h2>لا توجد اشتراكات متاحة حالياً</h2><p>لم ينشر المتجر منتجات نشطة في الوقت الحالي.</p><button class="btn" type="button" onclick="retryCatalog()">تحديث القائمة</button></div></div>`;
}

async function loadCatalog() {
  if (catalogRequest) return catalogRequest;
  catalogStatus = 'loading';
  catalogErrorCode = '';
  draw();
  catalogRequest = (async () => {
    try {
      const response = await fetch(API_URL + '/catalog', { cache: 'no-cache' });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('INVALID_RESPONSE'); }
      if (!response.ok || !data || !data.success || !Array.isArray(data.products)) {
        const err = new Error('CATALOG_FAILED');
        err.code = data?.code === 'RATE_LIMITED' || response.status === 429 ? 'RATE_LIMITED' : 'CATALOG_FAILED';
        throw err;
      }
      P = data.products.filter((p) => p && typeof p.id === 'string' && Array.isArray(p.pl));
      catalogStatus = 'ready';
      try { localStorage.removeItem('ov_catalog'); } catch (_) {}
      route(false);
    } catch (e) {
      P = [];
      catalogStatus = 'error';
      catalogErrorCode = e.code || 'CONNECTION_FAILED';
      draw();
    } finally {
      catalogRequest = null;
    }
  })();
  return catalogRequest;
}
function retryCatalog() { if (!catalogRequest) loadCatalog(); }

async function loadReviewSummary() {
  try {
    const response = await fetch(`${API_URL}/reviews-summary`);
    const data = await response.json();
    if (response.ok && data.success && data.summary && !Array.isArray(data.summary)) {
      productReviewSummary = data.summary;
      updateProductEvidence();
    }
  } catch (_) { /* لا نعرض رقماً غير موثق عند انقطاع الاتصال */ }
}
async function loadDeliveryStats() {
  try {
    const response = await fetch(`${API_URL}/delivery-stats`);
    const data = await response.json();
    const s = data?.stats;
    if (response.ok && data.success && s && Number.isFinite(Number(s.medianMinutes)) && Number(s.sample) >= 10) {
      deliveryStats = s;
      updateProductEvidence();
    }
  } catch (_) { /* لا نعرض وقت تسليم تخمينياً */ }
}


let PAY = [];
let payLoaded = false, payFailed = false;
const PAY_DESC = {
  chargily: 'دفع إلكتروني عبر Chargily Pay عند تفعيله. يتحقق الخادم من نجاح العملية قبل تأكيد الدفع.',
  wallet: 'يُخصم مبلغ الطلب من رصيد محفظتك المتاح عند تأكيد العملية.'
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

const COL = { 'قيد المراجعة': '#F59E0B', 'مؤكد': '#2447C9', 'تم التسليم': '#16A34A', 'ملغي': '#EF4444' };
const pr = (id) => P.find((p) => p.id === String(id));
const pl = (item) => {
  const product = pr(item?.id);
  if (!product) return null;
  if (item.k) return product.pl.find((x) => x[4] === item.k && Number(x[0]) === Number(item.m)) || null;
  const matches = product.pl.filter((x) => Number(x[0]) === Number(item.m));
  return matches.length === 1 ? matches[0] : null; // لا نخمن عندما تتطابق مدة باقتين
};
// نسب التوفير لا تُعرض دون سعر أصلي موثق لكل باقة.


let cart = [], sel = 0, cat = 'الكل', shopQuery = '', shopSort = 'featured', payId = 'chargily', msg = '', chargilyMode = 'test';
let editK = -1;
let editBack = false;
let cartNote = '';
let chkDraft = { n: null, p: null, e: null, accepted: false };
let checkoutStage = 'details'; // details -> review -> submit
let custToken = localStorage.getItem('ov_ctk') || '';
let custProfile = null;
let custOrders = [];
let custComplaints = [];
let authTab = 'login';
let twoFaPending = null; // { tempToken, method, message }
let tgBot = null;      // { url, msg } حالة الدخول عبر بوت تيليغرام
let tgBotTimer = null;
let twoFaSetup = null;   // { method, secret, otpauthUrl, message }
let ord = { n: '', code: '', ids: [], claimToken: '', paid: false, paymentDetails: null };

try { cart = JSON.parse(localStorage.getItem('oc') || '[]'); } catch (e) {}
try { const cp0 = JSON.parse(localStorage.getItem('ov_pay') || 'null'); if (Array.isArray(cp0) && cp0.length) applyPay(cp0); } catch (e) {}
if (!Array.isArray(cart)) cart = [];

const clean = () => {
  if (catalogStatus !== 'ready') return; // لا تمس سلة العميل إن فشل جلب الكتالوج
  const initial = JSON.stringify(cart);
  let removed = 0;
  cart = cart.filter((item) => {
    if (!item || !Number.isInteger(Number(item.q)) || Number(item.q) < 1 || !pl(item)) { removed++; return false; }
    item.q = Math.min(9, Number(item.q));
    const plan = pl(item);
    if (!item.k && plan[4]) item.k = plan[4]; // ترقية السلة القديمة حين تكون المدة فريدة
    return true;
  });
  if (editK < 0) {
    const seen = new Map();
    cart = cart.filter((item) => {
      const key = item.id + '|' + (item.k || item.m);
      if (seen.has(key)) { seen.get(key).q = Math.min(9, seen.get(key).q + item.q); return false; }
      seen.set(key, item);
      return true;
    });
  }
  if (removed) cartAlert = `تم استبعاد ${removed} من عناصر السلة لأن الباقة لم تعد متاحة أو تغيرت. اختر الباقة الجديدة من المتجر قبل الشراء.`;
  if (JSON.stringify(cart) !== initial) save();
};
const save = () => { try { localStorage.setItem('oc', JSON.stringify(cart)); } catch (_) {} };
const tot = () => cart.reduce((s, i) => s + (pl(i)?.[1] || 0) * i.q, 0);


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
  const d = r.dataset.theme ? r.dataset.theme == 'dark' : true;
  r.dataset.theme = d ? 'light' : 'dark';
  try { localStorage.setItem('ovira_theme_v3', r.dataset.theme); } catch (e) {}
}
try {
  const s = localStorage.getItem('ovira_theme_v3');
  document.documentElement.dataset.theme = s === 'light' ? 'light' : 'dark';
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}

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

// لا نُظهر بيانات cachedCatalog ولا المنتجات القديمة في متصفح فيسبوك.
// نؤخّر الاتصال إلى نهاية تهيئة الواجهة حتى لا نغيّر شاشات الحساب وتسجيل الدخول.

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
      chrome();
      return;
    }
    const d = await r.json();
    if (d.success) {
      custProfile = d.customer;
      if (location.hash.split('?')[0] === '#/track') location.hash = '#/account';
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

const gc = (p, eager = false) => `
  <div class="gc">
    ${p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.n)}" width="52" height="52" loading="${eager ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${eager ? 'high' : 'auto'}" style="width:52px;height:52px;object-fit:contain;border-radius:12px">`
      : `<i class="ic" style="background:${esc(p.c)}">${esc(p.l)}</i>`}
    <small>${esc(p.n)}</small>
  </div>`;

const card = (p) => {
  const plans = (Array.isArray(p.pl) ? p.pl : []).filter((x) => Number.isFinite(Number(x[1])));
  const cheapest = plans.length ? Math.min(...plans.map((x) => Number(x[1]))) : null;
  const searchable = [p.t, p.n, p.cat, p.sub].filter(Boolean).join(' ').toLowerCase();
  return `<a class="pc ovx-product-card"
      href="#/p/${encodeURIComponent(p.id)}"
      style="--c:${esc(p.c)};--c2:${esc(p.c2)}"
      data-search="${esc(searchable)}"
      data-price="${cheapest === null ? 999999999 : cheapest}"
      data-title="${esc(String(p.t || '').toLocaleLowerCase())}"
      data-index="${Math.max(0, P.indexOf(p))}">
    <div class="ovx-product-card-art">
      <span class="ovx-card-orbit ovx-card-orbit-one"></span>
      <span class="ovx-card-orbit ovx-card-orbit-two"></span>
      <div class="ovx-card-logo-wrap">${gc(p)}</div>
    </div>
    <div class="ovx-product-card-body">
      <div class="ovx-card-title-line">
        <div>
          <small>${esc(p.cat || 'منتج رقمي')}</small>
          <h3>${esc(p.t)}</h3>
        </div>
        <span class="ovx-card-arrow" aria-hidden="true">↗</span>
      </div>
      <div class="ovx-card-divider"></div>
      <div class="ovx-card-bottom">
        <div class="ovx-card-price">
          <small>${cheapest !== null ? 'السعر يبدأ من' : 'السعر'}</small>
          <strong>${cheapest !== null ? fmt(cheapest) : 'غير متاح'}</strong>
          ${cheapest !== null ? '<span>DA</span>' : ''}
        </div>
        <span class="ovx-card-cta">عرض المنتج <b>←</b></span>
      </div>
    </div>
  </a>`;
};

const home = () => {
  const categories = [...new Set(P.map((p) => p.cat).filter(Boolean))];
  const planCount = P.reduce((total, product) => total + (Array.isArray(product.pl) ? product.pl.length : 0), 0);
  const services = [
    { icon: '▶', title: 'الترفيه والبث', description: 'اشتراكات منصات المشاهدة والمحتوى الرقمي.', message: 'مرحباً، أريد الاستفسار عن اشتراكات الترفيه والبث.' },
    { icon: '⌁', title: 'الألعاب الإلكترونية', description: 'خدمات رقمية لعشاق الألعاب والمنصات.', message: 'مرحباً، أريد الاستفسار عن خدمات الألعاب الإلكترونية.' },
    { icon: '◈', title: 'المنتجات الرقمية', description: 'أدوات وخدمات رقمية للاستخدام اليومي.', message: 'مرحباً، أريد الاستفسار عن المنتجات الرقمية.' },
    { icon: '⌘', title: 'تطوير المواقع', description: 'تصميم وتطوير مواقع للشركات والمشاريع.', message: 'مرحباً، أريد الاستفسار عن خدمات تطوير المواقع.' }
  ];
  const serviceUrl = (message) => CFG.wa
    ? `https://wa.me/${CFG.wa}?text=${encodeURIComponent(message)}`
    : '#/support';

  return `
    <div class="w ov-home ovx-home">
      <section class="ovx-hero" aria-labelledby="ovHomeTitle">
        <div class="ovx-hero-copy">
          <div class="ovx-eyebrow"><span class="ovx-live-dot"></span> متجر رقمي واحد، اختيارات أكثر</div>
          <h1 id="ovHomeTitle">عالمك الرقمي<br><span>يبدأ من هنا.</span></h1>
          <p class="ovx-hero-description">اكتشف اشتراكاتك وخدماتك الرقمية، قارن الباقات بوضوح، واطلب بالطريقة التي تناسبك — مع متابعة طلبك من حسابك.</p>
          <div class="ovx-hero-actions">
            <a class="ovx-btn ovx-btn-primary" href="#/shop">اكتشف المتجر <span>←</span></a>
            <a class="ovx-btn ovx-btn-glass" href="#/account">حسابي وطلباتي</a>
          </div>
          <div class="ovx-hero-assurances">
            <span><b>✓</b> تسليم فوري بعد تأكيد الدفع</span>
            <span><b>✓</b> أسعار الباقات قبل الطلب</span>
            <span><b>✓</b> متابعة حالة الطلب</span>
            <span><b>✓</b> دعم مباشر</span>
          </div>
          <div class="ovx-payment-methods" aria-label="طرق الدفع المدعومة">
            <span class="ovx-payment-badge">💳 <b>Chargily</b> Pay</span>
            <span class="ovx-payment-badge">🏦 <b>بريدي</b> موب</span>
            <span class="ovx-payment-badge">📮 <b>CCP</b></span>
            <span class="ovx-payment-badge">₿ <b>Binance</b> Pay</span>
          </div>
          <div class="ovx-live-stats" aria-label="إحصاءات الكتالوج الحالي">
            <div><strong>${P.length}</strong><span>منتجات منشورة</span></div>
            <i></i>
            <div><strong>${categories.length}</strong><span>تصنيفات</span></div>
            <i></i>
            <div><strong>${planCount}</strong><span>باقات منشورة</span></div>
          </div>
        </div>

        <div class="ovx-hero-art" aria-label="هوية OVIRA PLAY الرقمية">
          <div class="ovx-art-glow"></div>
          <div class="ovx-art-ring ovx-art-ring-a"></div>
          <div class="ovx-art-ring ovx-art-ring-b"></div>
          <div class="ovx-art-main">
            <div class="ovx-art-top"><span>OVIRA <b>PLAY</b></span><small>DIGITAL EXPERIENCE</small></div>
            <div class="ovx-art-emblem"><span>▶</span></div>
            <strong>YOUR DIGITAL<br><em>WORLD</em></strong>
            <div class="ovx-art-bottom"><span>STREAMING</span><span>GAMING</span><span>MORE</span></div>
          </div>
          ${P.slice(0, 2).map((p, i) => `
            <div class="ovx-floating-product ovx-floating-product-${i + 1}" style="--float-color:${esc(p.c || '#315BEA')}">
              <span class="ovx-floating-mark">${esc(p.l || 'O')}</span>
              <span><b>${esc(p.n || p.t)}</b><small>${esc(p.cat || 'DIGITAL')}</small></span>
            </div>
          `).join('')}
          <span class="ovx-art-caption">OVIRA PLAY · YOUR DIGITAL DESTINATION</span>
        </div>
      </section>

      <section class="ovx-category-strip" aria-label="تصفح التصنيفات">
        <div class="ovx-strip-label"><span>01</span><b>تصفّح حسب اهتمامك</b></div>
        <div class="ovx-category-list">
          ${categories.slice(0, 6).map((c) => `<a href="#/shop" class="ovx-category-pill">${esc(c)} <span>↗</span></a>`).join('')}
          <a href="#/shop" class="ovx-category-pill ovx-category-all">كل المنتجات <span>←</span></a>
        </div>
      </section>

      <section class="ovx-section">
        <div class="ovx-section-heading">
          <div><span class="ovx-kicker">CURATED FOR YOU · 02</span><h2>اختيارات تستحق التجربة</h2><p>المنتجات المنشورة فعلياً في كتالوج المتجر.</p></div>
          <a class="ovx-text-link" href="#/shop">عرض كل المنتجات <span>←</span></a>
        </div>
        ${P.length
          ? `<div class="g ov-home-product-grid ovx-product-grid">${P.slice(0, 6).map(card).join('')}</div>`
          : catalogEmpty()}
      </section>

      <section class="ovx-service-section">
        <div class="ovx-section-heading">
          <div><span class="ovx-kicker">WHAT WE DO · 03</span><h2>أكثر من متجر اشتراكات</h2><p>وجهتك للخدمات الرقمية، والاستفسار، والمساعدة.</p></div>
        </div>
        <div class="ov-home-service-grid ovx-service-grid">
          ${services.map((service, index) => `
            <a class="ov-home-service ovx-service-card" href="${serviceUrl(service.message)}" ${CFG.wa ? 'target="_blank" rel="noopener noreferrer"' : ''}>
              <span class="ov-home-service-top"><i>${service.icon}</i><small>0${index + 1}</small></span>
              <b>${esc(service.title)}</b><p>${esc(service.description)}</p>
              <span class="ov-home-service-link">${CFG.wa ? 'استفسر الآن' : 'تواصل مع الدعم'} <span>↗</span></span>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="ovx-how-section">
        <div class="ovx-how-intro"><span class="ovx-kicker">A SIMPLE FLOW · 04</span><h2>طلبك، بخطوات واضحة.</h2><p>لا مفاجآت في السعر. اختر الباقة، راجع بياناتك، ثم تابع حالة طلبك.</p><a class="ovx-text-link" href="#/shop">ابدأ التسوق <span>←</span></a></div>
        <div class="ovx-how-steps">
          <article><span>01</span><b>اختر المنتج</b><p>تعرّف على المميزات والباقات المتاحة.</p></article>
          <article><span>02</span><b>أرسل طلبك</b><p>راجع السعر وبيانات التواصل وطريقة الدفع.</p></article>
          <article><span>03</span><b>تابع واستلم</b><p>تابع حالة الطلب واستلام الخدمة من حسابك.</p></article>
        </div>
      </section>

      <footer class="ovx-footer">
        <a class="logo" href="#/"><i>▶</i><span>OVIRA <b>PLAY</b></span></a>
        <p>تجربتك الرقمية، بطريقة أوضح.</p>
        <div><a href="#/shop">المتجر</a><a href="#/account">حسابي</a><a href="#/support">الدعم</a><a href="#/track">تتبع الطلب</a></div>
        <small>© ${new Date().getFullYear()} OVIRA PLAY. جميع الحقوق محفوظة.</small>
      </footer>
    </div>
  `;
};

const shop = () => {
  if (!P.length) return catalogEmpty();
  const cats = ['الكل', ...new Set(P.map((p) => p.cat).filter(Boolean))];
  let products = P.filter((p) => cat === 'الكل' || p.cat === cat);
  if (shopQuery.trim()) {
    const q = shopQuery.trim().toLocaleLowerCase();
    products = products.filter((p) => [p.t, p.n, p.cat, p.sub].filter(Boolean).join(' ').toLocaleLowerCase().includes(q));
  }
  const priceOf = (p) => {
    const prices = (p.pl || []).map((x) => Number(x[1])).filter(Number.isFinite);
    return prices.length ? Math.min(...prices) : Number.MAX_SAFE_INTEGER;
  };
  if (shopSort === 'price-low') products.sort((a, b) => priceOf(a) - priceOf(b));
  else if (shopSort === 'price-high') products.sort((a, b) => priceOf(b) - priceOf(a));
  else if (shopSort === 'name') products.sort((a, b) => String(a.t).localeCompare(String(b.t), 'ar'));
  else products.sort((a, b) => P.indexOf(a) - P.indexOf(b));

  return `<div class="w ovx-shop">
    <section class="ovx-shop-heading">
      <div><span class="ovx-kicker">OVIRA PLAY / STORE</span><h1>اكتشف المتجر.</h1><p>تصفّح المنتجات الرقمية والباقات المنشورة، واختر ما يناسبك.</p></div>
      <div class="ovx-shop-count"><strong>${P.length}</strong><span>منتج<br>في الكتالوج</span></div>
    </section>
    <section class="ovx-shop-tools" aria-label="البحث والتصفية">
      <label class="ovx-search-box"><span aria-hidden="true">⌕</span><input id="ovShopSearch" type="search" value="${esc(shopQuery)}" placeholder="ابحث عن منتج أو منصة..." autocomplete="off" oninput="filterShopProducts(this.value)"><kbd>بحث</kbd></label>
      <label class="ovx-sort-box"><span>ترتيب حسب</span><select id="ovShopSort" onchange="sortShopProducts(this.value)">
        <option value="featured" ${shopSort === 'featured' ? 'selected' : ''}>المقترحة</option>
        <option value="price-low" ${shopSort === 'price-low' ? 'selected' : ''}>السعر: الأقل أولاً</option>
        <option value="price-high" ${shopSort === 'price-high' ? 'selected' : ''}>السعر: الأعلى أولاً</option>
        <option value="name" ${shopSort === 'name' ? 'selected' : ''}>الاسم</option>
      </select></label>
    </section>
    <div class="ovx-shop-category-row">
      <div class="chips ovx-shop-chips">${cats.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-category="${esc(c)}" onclick="setCat(this.dataset.category)">${esc(c)}</button>`).join('')}</div>
      <span id="ovShopResultCount">${products.length} نتيجة</span>
    </div>
    <div class="g ovx-product-grid ovx-shop-grid" id="ovShopGrid">${products.map(card).join('')}</div>
    <div class="ovx-shop-empty" id="ovShopEmpty" ${products.length ? 'hidden' : ''}><span>⌕</span><h2>لم نعثر على نتيجة</h2><p>جرّب كلمة أخرى أو اختر تصنيفاً مختلفاً.</p><button class="ovx-btn ovx-btn-primary" type="button" onclick="clearShopFilters()">إظهار كل المنتجات</button></div>
  </div>`;
};

window.filterShopProducts = (value) => {
  shopQuery = String(value || '');
  const q = shopQuery.trim().toLocaleLowerCase();
  const cards = [...document.querySelectorAll('#ovShopGrid .ovx-product-card')];
  let visible = 0;
  cards.forEach((node) => {
    const show = !q || (node.dataset.search || '').includes(q);
    node.hidden = !show;
    if (show) visible++;
  });
  const count = document.getElementById('ovShopResultCount');
  if (count) count.textContent = `${visible} نتيجة`;
  const empty = document.getElementById('ovShopEmpty');
  if (empty) empty.hidden = visible > 0;
};

window.sortShopProducts = (value) => {
  shopSort = value || 'featured';
  const grid = document.getElementById('ovShopGrid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.ovx-product-card')];
  cards.sort((a, b) => {
    if (shopSort === 'price-low') return Number(a.dataset.price) - Number(b.dataset.price);
    if (shopSort === 'price-high') return Number(b.dataset.price) - Number(a.dataset.price);
    if (shopSort === 'name') return (a.dataset.title || '').localeCompare(b.dataset.title || '', 'ar');
    return Number(a.dataset.index) - Number(b.dataset.index);
  }).forEach((node) => grid.appendChild(node));
};

window.clearShopFilters = () => {
  shopQuery = '';
  cat = 'الكل';
  shopSort = 'featured';
  draw();
};

function landingList(title, values, caution = false) {
  const lines = Array.isArray(values) ? values.filter((v) => typeof v === 'string' && v.trim()) : [];
  if (!lines.length) return '';
  return `<section class="ov-landing-section"><h2>${esc(title)}</h2><ul class="ov-landing-list ${caution ? 'ov-cautions' : ''}">
    ${lines.map((value) => `<li><span class="ov-mark">${caution ? '•' : '✓'}</span><span>${esc(value)}</span></li>`).join('')}
  </ul></section>`;
}
function landingText(title, value, icon) {
  if (typeof value !== 'string' || !value.trim()) return '';
  return `<section class="ov-landing-section"><h2>${icon} ${esc(title)}</h2><p class="ov-landing-note">${esc(value.trim())}</p></section>`;
}
function formatDeliveryTime(minutes) {
  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 60) return `${n} دقيقة`;
  const h = Math.floor(n / 60), m = n % 60;
  return `${h} ساعة${m ? ` و${m} دقيقة` : ''}`;
}
function deliveryEvidence(p) {
  const hasText = typeof p.dlv === 'string' && !!p.dlv.trim();
  const s = deliveryStats;
  const median = s && formatDeliveryTime(s.medianMinutes);
  const p80 = s && formatDeliveryTime(s.p80Minutes);
  if (!hasText && !median) return '';
  return `<section class="ov-evidence" aria-label="معلومات التسليم">
    <h2>📦 التسليم</h2>
    ${hasText ? `<p class="ov-landing-note" style="color:var(--ink)">${esc(p.dlv.trim())}</p>` : ''}
    ${median ? `<div class="ov-delivery-metrics">
      <div class="ov-metric"><small>الوسيط الفعلي لمدة التسليم</small><b>${median}</b></div>
      ${p80 ? `<div class="ov-metric"><small>80% من الطلبات خلال</small><b>${p80}</b></div>` : ''}
    </div><p>إحصاء عام للمتجر، من تأكيد الدفع إلى التسليم، لعينة من ${Number(s.sample).toLocaleString('ar-DZ')} طلبًا خلال آخر ${Number(s.days)} يومًا؛ لا يمثل وعدًا بمدة تسليم هذا المنتج.</p>` : ''}
  </section>`;
}
function reviewEvidence(id) {
  const d = productReviewsCache.get(id);
  const summary = d?.status === 'done' ? { ...(productReviewSummary[id] || {}), ...d.data } : productReviewSummary[id];
  const count = Number(summary?.count) || 0;
  const average = Number(summary?.average);

  if (count < 1 || !Number.isFinite(average) || average < 1 || average > 5) return '';

  const reviews = d?.status === 'done' && Array.isArray(d.data.reviews) ? d.data.reviews : [];
  const distribution = summary?.distribution || {};
  const starRows = [5, 4, 3, 2, 1].map((stars) => {
    const value = Number(distribution[stars]) || 0;
    const width = count ? Math.min(100, Math.round((value / count) * 100)) : 0;
    return `<div class="ov-rating-row">
      <span>${stars} نجوم</span>
      <span class="ov-rating-track"><i style="width:${width}%"></i></span>
      <b>${value.toLocaleString('ar-DZ')}</b>
    </div>`;
  }).join('');

  const reviewCards = reviews.map((v) => {
    const stars = Math.max(1, Math.min(5, Math.round(Number(v.stars) || 1)));
    const date = v.createdAt && !Number.isNaN(new Date(v.createdAt).getTime())
      ? new Date(v.createdAt).toLocaleDateString('ar-DZ')
      : '';
    const name = String(v.displayName || 'عميل OVIRA');
    const initial = esc(name.trim().slice(0, 1) || 'ع');

    return `<article class="ov-review-card">
      <div class="ov-review-meta">
        <div class="ov-review-author">
          <span class="ov-review-avatar" aria-hidden="true">${initial}</span>
          <b>${esc(name)}</b>
        </div>
        <span class="ov-review-stars" aria-label="${stars} من 5">
          ${'★'.repeat(stars)}<span class="ov-review-stars-empty">${'★'.repeat(5 - stars)}</span>
        </span>
        ${date ? `<time>${esc(date)}</time>` : ''}
      </div>
      ${v.comment ? `<p>${esc(v.comment)}</p>` : ''}
    </article>`;
  }).join('');

  const loading = d?.status === 'loading'
    ? '<p class="ov-reviews-status" role="status">جارٍ تحميل آراء العملاء…</p>'
    : '';
  const failed = d?.status === 'failed'
    ? '<p class="ov-reviews-status" role="status">تعذّر تحميل الآراء الآن. أعد تحديث الصفحة للمحاولة مجدداً.</p>'
    : '';

  const more = d?.status === 'done' && d.data.hasMore
    ? `<div class="ov-reviews-actions">
        <button type="button" class="ov-load-more" onclick="loadMoreProductReviews()" ${d.loadingMore ? 'disabled' : ''}>
          ${d.loadingMore ? 'جارٍ تحميل المزيد…' : d.loadMoreError ? 'إعادة المحاولة' : 'عرض المزيد'}
        </button>
        <small>عرض ${reviews.length.toLocaleString('ar-DZ')} من ${count.toLocaleString('ar-DZ')} رأياً</small>
      </div>`
    : d?.status === 'done' && reviews.length
      ? '<p class="ov-reviews-end">تم عرض جميع الآراء</p>'
      : '';

  return `<section class="ov-evidence ov-reviews-panel" aria-label="آراء العملاء">
    <div class="ov-reviews-heading">
      <div>
        <span class="ov-reviews-kicker">OVIRA PLAY COMMUNITY</span>
        <h2>آراء العملاء</h2>
        <p>تجارب وآراء عملائنا بعد اعتمادها.</p>
      </div>
      <span class="ov-review-count">${count.toLocaleString('ar-DZ')} رأي</span>
    </div>

    <div class="ov-reviews-overview">
      <div class="ov-rating-score">
        <strong>${esc(average.toFixed(1))}</strong>
        <span class="ov-review-stars" aria-label="متوسط ${esc(average.toFixed(1))} من 5">★★★★★</span>
        <small>متوسط التقييم من ${count.toLocaleString('ar-DZ')} رأي</small>
      </div>
      <div class="ov-rating-breakdown" aria-label="توزيع التقييمات">
        ${starRows}
      </div>
    </div>

    <div class="ov-review-list">${reviewCards}</div>
    ${loading}
    ${failed}
    ${more}
  </section>`;
}
function updateProductEvidence() {
  const holder = document.getElementById('productReviews');
  if (holder) holder.innerHTML = reviewEvidence(holder.dataset.product);
  const deliveryHolder = document.getElementById('productDeliveryEvidence');
  const id = deliveryHolder?.dataset.product;
  if (id) {
    const p = pr(id);
    if (p) deliveryHolder.innerHTML = deliveryEvidence(p);
  }
}
const prod = (p) => {
  const selected = p.pl[sel] || p.pl[0];
  const item = editK >= 0 ? cart[editK] : null;

  const plansBlock = p.pl.length ? `
    <div class="ov-plan-list">
      ${p.pl.map((plan, i) => `
        <button type="button"
          class="pl ov-plan-option ${i === sel ? 'on' : ''}"
          onclick="pickPlan(${i})"
          aria-pressed="${i === sel ? 'true' : 'false'}">

          <span class="rd" aria-hidden="true"></span>

          <span class="d">
            ${dur(plan[0])}
            ${plan[3] ? `<small class="plan-label">${esc(plan[3])}</small>` : ''}
          </span>

          <span class="ov-plan-price">
            <b>${fmt(plan[1])}</b>
            ${plan[2] ? '<span class="ov-plan-value">الأوفر</span>' : ''}
          </span>
        </button>
      `).join('')}
    </div>
  ` : '<p class="ov-price-empty">لا توجد باقات متاحة لهذا المنتج حالياً.</p>';

  const quantityBlock = item && selected ? `
    <div class="ov-quantity-block">
      <div class="ov-quantity-label">الكمية</div>
      <div class="qrow">
        <div class="q lg">
          <button onclick="editQty(-1)" aria-label="إنقاص">−</button>
          <span>${item.q}</span>
          <button onclick="editQty(1)" aria-label="زيادة">+</button>
        </div>
        <b class="qtot">${fmt(selected[1] * item.q)}</b>
      </div>
    </div>
  ` : '';

  const steps = Array.isArray(p.steps)
    ? p.steps.filter((s) => s && (String(s.title || '').trim() || String(s.desc || '').trim()))
    : [];

  const stepsBlock = steps.length ? `
    <section class="ov-landing-section ov-steps-section">
      <h2>كيف يتم طلبك؟</h2>
      <div class="tr ov-steps-grid">
        ${steps.map((s, i) => `
          <div class="ov-step-card">
            <span class="ov-step-index">${String(i + 1).padStart(2, '0')}</span>
            <b>${esc(s.title)}</b>
            <p>${esc(s.desc)}</p>
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  const faqs = Array.isArray(p.faq)
    ? p.faq.filter((f) => f && String(f.q || '').trim() && String(f.a || '').trim())
    : [];

  const faqBlock = faqs.length ? `
    <section class="ov-landing-section ov-faq">
      <h2>الأسئلة الشائعة</h2>
      ${faqs.map((v) => `
        <details>
          <summary>${esc(v.q)}</summary>
          <p>${esc(v.a)}</p>
        </details>
      `).join('')}
    </section>
  ` : '';

  const badgeBlock = String(p.badge || '').trim()
    ? `<span class="ov-product-badge">${esc(p.badge)}</span>`
    : '';

  return `
    <section class="ov-product-hero"
      style="--c:${esc(p.c)};--c2:${esc(p.c2)}">

      <div class="ov-product-hero-inner">

        <div class="ov-product-visual">
          <div class="ov-product-visual-card">

            <div class="ov-product-visual-meta">
              <b>OVIRA PLAY</b>
              <span>${esc(p.cat)}</span>
            </div>

            <div class="ov-product-brand-art">
              ${gc(p, true)}
            </div>

            <div class="ov-product-visual-foot">
              <span>YOUR DIGITAL WORLD</span>
              <span>OV / PLAY</span>
            </div>

          </div>
          <span class="ov-product-orbit-label">${esc(p.n)}</span>
        </div>

        <div class="ov-product-copy">

          <div class="ov-product-breadcrumb">
            <a href="#/shop">المتجر</a>
            <span>/</span>
            <span>${esc(p.cat)}</span>
          </div>

          <div class="ov-product-brandline">
            <span class="ov-brand-dot"></span>
            <span>${esc(p.n)}</span>
          </div>

          ${badgeBlock}

          <h1>${esc(p.t)}</h1>

          ${p.sub ? `
            <p class="ov-product-sub">${esc(p.sub)}</p>
          ` : ''}

          <div class="ov-product-highlights">
            ${p.pl.length ? `
              <span><i>✓</i>${p.pl.length} باقات للاختيار</span>
            ` : ''}
            <span><i>✓</i>السعر واضح قبل تأكيد الطلب</span>
          </div>

          <button class="ov-product-jump"
            type="button"
            onclick="document.getElementById('ovProductPurchase').scrollIntoView({behavior:'smooth',block:'start'})">
            اختر باقتك
            <span>↓</span>
          </button>

        </div>
      </div>
    </section>

    <div class="ov-product-layout">

      <aside class="ov-product-buy" id="ovProductPurchase">

        <div class="ov-buy-card">

          <div class="ov-buy-topline">
            <span>OVIRA PLAY / STORE</span>
            <span class="ov-buy-chip">اختيار الباقة</span>
          </div>

          <h2>اختر الباقة المناسبة</h2>

          <p class="ov-buy-description">
            اختر المدة التي تناسبك وراجع السعر قبل إتمام طلبك.
          </p>

          ${plansBlock}

          ${quantityBlock}

          ${selected ? `
            <div class="ov-buy-total">
              <span>${item ? 'الإجمالي الحالي' : 'السعر الحالي'}</span>
              <strong>${fmt(selected[1] * (item?.q || 1))}</strong>
            </div>
          ` : ''}

          <div class="ov-buy-note">
            <span>i</span>
            <p>راجع مدة الاشتراك ومعلومات المنتج قبل تأكيد الطلب.</p>
          </div>

        </div>

        <div class="ov-buy-help">
          <span class="ov-buy-help-icon">?</span>
          <div>
            <b>هل تحتاج إلى مساعدة؟</b>
            <small>تواصل مع فريق الدعم للاستفسار عن الباقات.</small>
          </div>
          <a href="#/support">الدعم ←</a>
        </div>

      </aside>

      <div class="ov-product-main">

        ${item ? `
          <div class="edit-note">
            ${ico(I.edit, 16)}
            <span>أنت تعدّل اشتراكاً من السلة. سيتم حفظ التغييرات عند التأكيد.</span>
          </div>
        ` : ''}

        <div class="ov-product-proof-grid">

          <div id="productReviews" data-product="${esc(p.id)}">
            ${reviewEvidence(p.id)}
          </div>

          <div id="productDeliveryEvidence" data-product="${esc(p.id)}">
            ${deliveryEvidence(p)}
          </div>

        </div>

        ${landingList('مميزات الاشتراك', p.f)}

        ${landingList('يناسبك هذا الاشتراك إذا', p.aud)}

        ${landingList('معلومات مهمة قبل الشراء', p.lim, true)}

        ${landingText('الضمان وسياسة الاستبدال', p.guar, '🛡️')}

        ${stepsBlock}

        ${faqBlock}

        <section class="ov-landing-section ov-review-form">

          <h2>قيّم تجربتك بعد استلام الطلب</h2>

          <p class="ov-review-caption">
            نرحب بتقييم تجربتك الفعلية بعد استلام الاشتراك.
          </p>

          ${custToken ? `
            <div class="sm">
              <label class="lb">تقييمك (بعد استلام الطلب)</label>

              <select id="reviewStars" class="in2">
                ${[5,4,3,2,1].map((n) => `
                  <option value="${n}">${n} ⭐</option>
                `).join('')}
              </select>

              <textarea class="in2" id="reviewText"
                rows="3" maxlength="800"
                placeholder="شارك تجربتك الفعلية مع المنتج"></textarea>

              <button class="btn"
                data-product="${esc(p.id)}"
                onclick="submitReview(this.dataset.product)">
                إرسال التقييم للمراجعة
              </button>
            </div>
          ` : `
            <p class="note">
              سجّل الدخول لتقييم مشترياتك بعد التسليم.
              لن يظهر التقييم حتى تعتمده الإدارة.
            </p>
          `}

        </section>

      </div>
    </div>

    ${selected ? (item ? `
      <div class="bar ov-product-action-bar">
        <button class="btn o" onclick="editRemove()">حذف</button>
        <button class="btn" onclick="editDone()">حفظ · ${fmt(selected[1] * item.q)}</button>
      </div>
    ` : `
      <div class="bar ov-product-action-bar">
        <button class="btn o"
          data-product="${esc(p.id)}"
          onclick="add(this.dataset.product,${Number(selected[0])})">
          أضف للسلة
        </button>

        <button class="btn"
          data-product="${esc(p.id)}"
          onclick="add(this.dataset.product,${Number(selected[0])},1)">
          اطلب الآن · ${fmt(selected[1])}
        </button>
      </div>
    `) : ''}
  `;
};

const cartV = () => {
  if (!cart.length) {
    return `<div class="w em"><div>🛒</div><h2>سلتك فارغة</h2><p class="note" style="margin-bottom:18px">تصفّح الاشتراكات المتاحة واقرأ شروطها قبل الشراء</p><a class="btn" href="#/shop">تصفّح الاشتراكات</a></div>`;
  }
  return `<div class="w">
    <h1 class="ttl">سلة التسوق</h1>
    ${cartAlert ? `<div class="cart-note" role="alert">${esc(cartAlert)}</div>` : ''}
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

function checkoutItemsMarkup() {
  return cart.map((i) => {
    const p = pr(i.id), plan = pl(i);
    if (!p || !plan) return '';
    const logo = p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.n)}" loading="lazy" decoding="async">`
      : `<span style="background:${esc(p.c)}">${esc(p.l)}</span>`;
    return `<article class="ovx-checkout-product">
      <div class="ovx-checkout-product-icon">${logo}</div>
      <div class="ovx-checkout-product-meta">
        <b>${esc(p.t)}</b>
        <small>${esc(p.cat)} · ${dur(plan[0])}${plan[3] ? ` · ${esc(plan[3])}` : ''}</small>
        <small>الكمية: ${Number(i.q)}</small>
      </div>
      <strong class="ovx-checkout-product-price">${fmt(plan[1] * i.q)}</strong>
    </article>`;
  }).join('');
}

function checkoutProgress(stage) {
  return `<nav class="ovx-checkout-progress" aria-label="مراحل إتمام الطلب">
    <span class="done"><b>01</b> اختيار المنتج</span>
    <span class="${stage === 'details' ? 'current' : 'done'}"><b>02</b> بياناتك والدفع</span>
    <span class="${stage === 'review' ? 'current' : ''}"><b>03</b> المراجعة والتأكيد</span>
  </nav>`;
}

const chk = () => {
  if (!cart.length) return cartV();
  const u = me();
  const pm = PAY.find((x) => x.id == payId);
  const items = checkoutItemsMarkup();

  if (checkoutStage === 'review') {
    const n = String(chkDraft.n || '').trim();
    const ph = normPh(chkDraft.p || '');
    const em = String(chkDraft.e || '').trim().toLowerCase();
    return `<div class="w ovx-checkout">
      <div class="ovx-checkout-heading"><span class="ovx-kicker">OVIRA PLAY / SECURE ORDER</span><h1 class="ttl">راجع طلبك قبل التأكيد</h1><p>تأكد من المنتج والباقة وبيانات التواصل وطريقة الدفع.</p></div>
      ${checkoutProgress('review')}
      <section class="ovx-checkout-panel ovx-checkout-order-panel">
        <div class="ovx-checkout-panel-heading"><div><span class="ovx-kicker">01 / ORDER SUMMARY</span><h2>ملخص المنتجات</h2></div><a href="#/cart" class="ovx-checkout-text-link">تعديل السلة</a></div>
        <div class="ovx-checkout-products">${items}</div>
        <div class="ovx-checkout-total-row"><span>الإجمالي النهائي</span><strong>${fmt(tot())}</strong></div>
      </section>
      <div class="ovx-checkout-review-grid">
        <section class="ovx-checkout-panel">
          <div class="ovx-checkout-panel-heading"><div><span class="ovx-kicker">02 / CUSTOMER</span><h2>بيانات الاستلام</h2></div><button type="button" class="ovx-checkout-text-link" onclick="editCheckoutDetails()">تعديل</button></div>
          <dl class="ovx-checkout-kv">
            <div><dt>الاسم الكامل</dt><dd>${esc(n)}</dd></div>
            <div><dt>رقم واتساب</dt><dd dir="ltr">${esc(ph)}</dd></div>
            <div><dt>البريد الإلكتروني</dt><dd dir="ltr">${esc(em)}</dd></div>
          </dl>
          <div class="ovx-checkout-account-note">${custToken ? '✓ سيتم ربط الطلب بحسابك الحالي تلقائياً.' : 'سيُنشأ رمز آمن لربط هذا الطلب بحسابك لاحقاً إذا رغبت.'}</div>
        </section>
        <section class="ovx-checkout-panel">
          <div class="ovx-checkout-panel-heading"><div><span class="ovx-kicker">03 / PAYMENT</span><h2>طريقة الدفع</h2></div><button type="button" class="ovx-checkout-text-link" onclick="editCheckoutDetails()">تغيير</button></div>
          <div class="ovx-checkout-payment-name">${esc(pm?.n || 'لم يتم اختيار طريقة دفع')}</div>
          <div class="ovx-checkout-payment-info">${pbox()}</div>
        </section>
      </div>
      <div class="checkout-trust ovx-checkout-final-note">🔒 السعر النهائي يُعاد التحقق منه داخل الخادم قبل إنشاء الطلب. لا يتم تأكيد الدفع اليدوي بمجرد إرسال صورة الوصل.</div>
      <div class="ovx-checkout-actions">
        <button type="button" class="btn o" onclick="editCheckoutDetails()">العودة للتعديل</button>
        <button type="button" class="btn" id="submitBtn" onclick="send()">${submitLabel()}</button>
      </div>
    </div>`;
  }

  return `<div class="w ovx-checkout">
    <div class="ovx-checkout-heading"><span class="ovx-kicker">OVIRA PLAY / CHECKOUT</span><h1 class="ttl">إتمام طلبك</h1><p>خطوتان واضحتان: أدخل بياناتك، ثم راجع الطلب قبل إرساله.</p></div>
    ${checkoutProgress('details')}
    <div class="ovx-checkout-grid">
      <section class="ovx-checkout-panel ovx-checkout-order-panel">
        <div class="ovx-checkout-panel-heading"><div><span class="ovx-kicker">01 / YOUR ORDER</span><h2>ملخص طلبك</h2></div><a href="#/cart" class="ovx-checkout-text-link">تعديل السلة</a></div>
        <div class="ovx-checkout-products">${items}</div>
        <div class="ovx-checkout-total-row"><span>الإجمالي المطلوب</span><strong>${fmt(tot())}</strong></div>
        <p class="ovx-checkout-summary-note">راجع اسم المنتج والمدة والكمية قبل المتابعة.</p>
      </section>
      <section class="ovx-checkout-panel ovx-checkout-form-panel">
        <div class="ovx-checkout-panel-heading"><div><span class="ovx-kicker">02 / CONTACT & PAYMENT</span><h2>بياناتك وطريقة الدفع</h2></div></div>
        ${custToken ? '<div class="ovx-checkout-account-note">✓ أنت مسجل الدخول. سيُربط الطلب بحسابك تلقائياً.</div>' : '<div class="ovx-checkout-account-note">يمكنك إتمام الطلب كزائر، ثم ربطه بحسابك لاحقاً.</div>'}
        <label class="lb" for="fn">الاسم الكامل *</label>
        <input class="in2" id="fn" autocomplete="name" maxlength="80" value="${esc(chkDraft.n ?? u.n ?? '')}" oninput="chkDraft.n=this.value" placeholder="اكتب اسمك الكامل" required>
        <label class="lb" for="fp">رقم واتساب *</label>
        <input class="in2" id="fp" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" value="${esc(chkDraft.p ?? u.p ?? '')}" oninput="chkDraft.p=this.value" dir="ltr" placeholder="05XX XX XX XX" required>
        <label class="lb" for="fe">البريد الإلكتروني *</label>
        <input class="in2" id="fe" type="email" inputmode="email" autocomplete="email" maxlength="150" value="${esc(chkDraft.e ?? u.e ?? '')}" oninput="chkDraft.e=this.value" dir="ltr" placeholder="example@gmail.com" required>
        <div class="checkout-help"><strong>كيف نستخدم بياناتك؟</strong><p>للتواصل بشأن الطلب وإشعارات الدفع والتسليم والضمان فقط.</p></div>
        <label class="lb">اختر طريقة الدفع</label>
        <div class="pms" id="pms">${payButtons()}</div>
        <div class="box" id="pbox">${pbox()}</div>
        <label class="ovx-checkout-consent"><input type="checkbox" id="orderConfirm" ${chkDraft.accepted ? 'checked' : ''} onchange="chkDraft.accepted=this.checked"><span>أؤكد أن بيانات التواصل صحيحة وأنني راجعت المنتج والباقة والسعر.</span></label>
        <button type="button" class="btn ovx-checkout-review-button" id="reviewOrderBtn" onclick="reviewCheckout()">مراجعة الطلب قبل التأكيد ←</button>
        <p class="ovx-checkout-footnote">لن يُنشأ الطلب حتى تضغط على زر التأكيد في خطوة المراجعة.</p>
      </section>
    </div>
  </div>`;
};

function reviewCheckout() {
  const name = String($('#fn')?.value ?? chkDraft.n ?? '').trim();
  const phoneRaw = String($('#fp')?.value ?? chkDraft.p ?? '').trim();
  const phone = normPh(phoneRaw);
  const email = String($('#fe')?.value ?? chkDraft.e ?? '').trim().toLowerCase();
  const accepted = Boolean($('#orderConfirm')?.checked ?? chkDraft.accepted);
  chkDraft = { n: name, p: phoneRaw, e: email, accepted };
  if (name.length < 3 || name.length > 80) { $('#fn')?.focus(); return toast('اكتب اسمك الكامل بشكل صحيح'); }
  if (!/^0[567]\d{8}$/.test(phone)) { $('#fp')?.focus(); return toast('أدخل رقم واتساب جزائري صحيح من 10 أرقام'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#fe')?.focus(); return toast('أدخل بريدك الإلكتروني بشكل صحيح'); }
  if (!payLoaded || !PAY.some((x) => x.id == payId)) return toast('اختر طريقة دفع متاحة وانتظر تحميل إعداداتها');
  if (!accepted) { $('#orderConfirm')?.focus(); return toast('أكد صحة بياناتك ومراجعة الطلب أولاً'); }
  checkoutStage = 'review';
  draw();
  window.scrollTo(0, 0);
}
window.reviewCheckout = reviewCheckout;
window.editCheckoutDetails = () => { checkoutStage = 'details'; draw(); window.scrollTo(0, 0); };

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

// A signed-in customer already sees live statuses and deliveries in حسابي.
const trackV = () => custToken ? `<div class="w"><h1 class="ttl">طلباتي</h1><div class="sm"><p>طلبات حسابك تظهر في صفحة «حسابي» مباشرة دون طلب رمز أو آخر أرقام الهاتف.</p><a class="btn" href="#/account">عرض طلباتي</a></div></div>` : `<div class="w">
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
  if (custToken) { location.hash = '#/account'; return; }
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
      </div>
      ${renderPaymentReceiptBox(t.paymentDetails, t.totalPrice)}`;
  } catch (e) {
    $('#tk_res').innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
};

// ===== صفحة الحساب + شحن الرصيد + الشكاوى + قوقل وتيليغرام و2FA =====
let topupOpen = false, topupAmt = 1000;
const CMP_COL = { 'مفتوحة': '#F59E0B', 'تم الرد': '#16A34A', 'مغلقة': '#64748B' };

// ===== FOOTER شامل =====
const FOOTER_LINKS = {
  quick: [
    ['#/shop', 'المتجر'],
    ['#/account', 'حسابي'],
    ['#/track', 'تتبع الطلب'],
    ['#/support', 'الدعم الفني']
  ],
  categories: [],
  legal: [
    ['#/privacy', 'سياسة الخصوصية'],
    ['#/terms', 'شروط الاستخدام'],
    ['#/refund', 'سياسة الاستبدال والاسترجاع'],
    ['#/faq', 'الأسئلة الشائعة']
  ]
};

function renderFooter() {
  const cats = [...new Set(P.map((p) => p.cat).filter(Boolean))].slice(0, 6);
  FOOTER_LINKS.categories = cats.map((c) => ['#/shop', c]);
  return `
    <div class="w">
      <div class="ov-footer-grid">
        <div class="ov-footer-brand">
          <a class="logo" href="#/"><i>▶</i>OVIRA <b>PLAY</b></a>
          <p>متجر الاشتراكات الرقمية — تسليم فوري وآمن مع دعم متواصل. وجهتك الرقمية الموثوقة في الجزائر.</p>
          <div class="ov-footer-social">
            <a href="https://wa.me/${CFG.wa}" target="_blank" rel="noopener" aria-label="واتساب">💬</a>
            <a href="https://t.me/${CFG.tg}" target="_blank" rel="noopener" aria-label="تيليغرام">📲</a>
          </div>
        </div>
        <div class="ov-footer-col">
          <h4>روابط سريعة</h4>
          ${FOOTER_LINKS.quick.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
        </div>
        <div class="ov-footer-col">
          <h4>التصنيفات</h4>
          ${FOOTER_LINKS.categories.length ? FOOTER_LINKS.categories.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('') : '<a href="#/shop">جميع المنتجات</a>'}
        </div>
        <div class="ov-footer-col">
          <h4>القانونية</h4>
          ${FOOTER_LINKS.legal.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
          <h4 style="margin-top:16px">طرق الدفع</h4>
          <div class="ov-footer-payments">
            <span>💳 Chargily Pay</span>
            <span>🏦 بريدي موب</span>
            <span>📮 CCP</span>
            <span>₿ Binance Pay</span>
          </div>
        </div>
      </div>
      <div class="ov-footer-bottom">
        <span>© ${new Date().getFullYear()} OVIRA PLAY. جميع الحقوق محفوظة.</span>
        <span>منصة رقمية جزائرية — التسليم اليدوي خلال 24 ساعة من تأكيد الدفع.</span>
      </div>
    </div>`;
}

// ===== الصفحات القانونية (Modal/Page) =====
function legalPage(type) {
  const pages = {
    privacy: {
      title: 'سياسة الخصوصية',
      content: `<h2>مقدمة</h2>
      <p>نحن في OVIRA PLAY نلتزم بحماية خصوصية زوارنا وعملائنا. توضح هذه السياسة كيفية جمع واستخدام وحماية معلوماتك الشخصية.</p>
      <h2>المعلومات التي نجمعها</h2>
      <p>عند استخدامك لخدماتنا، قد نجمع المعلومات التالية: الاسم الكامل، رقم الهاتف (واتساب)، البريد الإلكتروني، معلومات الطلب والاشتراك، وسجل التواصل مع الدعم الفني.</p>
      <h2>كيف نستخدم معلوماتك</h2>
      <p>نستخدم معلوماتك للأغراض التالية فقط: معالجة طلباتك وتأكيدها، التواصل معك بشأن حالة طلبك والتسليم، تحسين خدماتنا وتجربة المستخدم، والامتثال للالتزامات القانونية.</p>
      <h2>حماية البيانات</h2>
      <p>نستخدم إجراءات أمنية مشددة لحماية بياناتك، بما في ذلك التشفير (SHA-256, bcrypt)، التحقق بخطوتين (2FA)، وتقييد الوصول إلى البيانات الحساسة للموظفين المصرح لهم فقط.</p>
      <h2>مشاركة البيانات</h2>
      <p>لا نشارك معلوماتك الشخصية مع أطراف ثالثة إلا للضرورة القصوى (مثل معالجة الدفع عبر Chargily Pay) ووفقاً للقوانين الجزائرية لحماية البيانات.</p>
      <h2>حقوقك</h2>
      <p>لديك الحق في: الوصول إلى بياناتك الشخصية وتصحيحها، طلب حذف بياناتك، وسحب الموافقة على معالجة بياناتك في أي وقت.</p>
      <h2>اتصل بنا</h2>
      <p>للاستفسار عن سياسة الخصوصية، تواصل معنا عبر واتساب أو تيليغرام.</p>`
    },
    terms: {
      title: 'شروط الاستخدام والخدمة',
      content: `<h2>قبول الشروط</h2>
      <p>باستخدامك لموقع OVIRA PLAY، فإنك توافق على هذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام خدماتنا.</p>
      <h2>وصف الخدمة</h2>
      <p>OVIRA PLAY هي منصة رقمية جزائرية تقدم اشتراكات وخدمات رقمية. نحن نعمل كوسيط بين الموردين والعملاء، ونسهل عملية الشراء والتسليم.</p>
      <h2>المسؤولية</h2>
      <p>نبذل قصارى جهدنا لضمان جودة الخدمات المقدمة. مع ذلك، لا نتحمل مسؤولية أي انقطاع في الخدمة من طرف الموردين الأصليين (مثل Netflix، Crunchyroll، إلخ) بعد تسليم الاشتراك.</p>
      <h2>الاستخدام المسموح</h2>
      <p>أنت توافق على استخدام خدماتنا للأغراض المشروعة فقط، وعدم محاولة اختراق المنصة أو إساءة استخدامها.</p>
      <h2>التعديلات</h2>
      <p>نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إشعارك بالتغييرات الجوهرية عبر البريد الإلكتروني أو الإعلانات في الموقع.</p>`
    },
    refund: {
      title: 'سياسة الاستبدال والاسترجاع والضمان',
      content: `<h2>سياسة الاسترجاع</h2>
      <p>نظراً للطبيعة الرقمية لخدماتنا (اشتراكات وحسابات رقمية)، لا يمكن استرجاع المبلغ بعد تسليم بيانات الاشتراك بنجاح، لأن الخدمة تُستهلك فور التسليم.</p>
      <h2>حالات الاسترجاع</h2>
      <p>يحق لك طلب استرجاع المبلغ في الحالات التالية فقط: عدم تسليم الاشتراك خلال المدة المتفق عليها (أكثر من 48 ساعة من تأكيد الدفع)، بيانات حساب غير صالحة تماماً وغير قابلة للإصلاح، إلغاء الطلب قبل بدء التجهيز.</p>
      <h2>الضمان</h2>
      <p>نقدم ضماناً على صحة بيانات الاشتراك المسلمة. إذا واجهتك مشكلة في الدخول خلال أول 24 ساعة من التسليم، يرجى التواصل معنا فوراً لإصلاح المشكلة أو استبدال البيانات.</p>
      <h2>كيفية طلب الاسترجاع</h2>
      <p>تواصل مع فريق الدعم عبر واتساب أو تيليغرام مع ذكر رقم الطلب وسبب طلب الاسترجاع. سيتم مراجعة طلبك والرد خلال 24 ساعة.</p>
      <h2>الاستثناءات</h2>
      <p>لا ينطبق الضمان في الحالات التالية: مشاركة بيانات الحساب مع طرف ثالث، تغيير كلمة المرور من قبلك، انتهاء صلاحية الاشتراك، أو إيقاف الخدمة من المورد الأصلي بسبب خرق شروط الاستخدام.</p>`
    },
    faq: {
      title: 'الأسئلة الشائعة',
      content: `<h2>كيف أطلب اشتراكاً؟</h2>
      <p>تصفح المنتجات في المتجر، اختر الباقة التي تناسبك، أضف المنتج إلى السلة، ثم اتبع خطوات إتمام الطلب. ستتلقى تأكيداً فورياً برقم الطلب.</p>
      <h2>ما هي طرق الدفع المتاحة؟</h2>
      <p>نقبل الدفع عبر: Chargily Pay (البطاقات الذهبية/CIB)، بريدي موب (BaridiMob)، CCP، وBinance Pay. يتم تفعيل كل طريقة حسب توفرها.</p>
      <h2>كم يستغرق التسليم؟</h2>
      <p>متوسط وقت التسليم من تأكيد الدفع هو 30-60 دقيقة. في بعض الحالات قد يستغرق حتى 24 ساعة حسب المنتج.</p>
      <h2>كيف أتلقى بيانات اشتراكي؟</h2>
      <p>تظهر بيانات الاشتراك في صفحة الطلب فور التسليم، ويمكنك متابعتها عبر تيليغرام أو من حسابك في الموقع.</p>
      <h2>هل يمكنني تغيير الباقة بعد الطلب؟</h2>
      <p>يمكنك تعديل الباقة قبل تأكيد الدفع. بعد الدفع والتسليم، لا يمكن تغيير الباقة.</p>
      <h2>ماذا لو واجهت مشكلة في الحساب المسلَّم؟</h2>
      <p>تواصل مع الدعم الفني فوراً عبر واتساب أو تيليغرام مع ذكر رقم الطلب. سنقوم بإصلاح المشكلة أو استبدال البيانات خلال 24 ساعة.</p>
      <h2>هل يمكنني إلغاء الطلب؟</h2>
      <p>يمكنك إلغاء الطلب قبل بدء التجهيز (حالة "قيد المراجعة"). بعد تأكيد الدفع وبدء التجهيز، لا يمكن الإلغاء.</p>
      <h2>كيف أنشئ حساباً في OVIRA PLAY؟</h2>
      <p>يمكنك إنشاء حساب عبر صفحة "حسابي" باستخدام البريد الإلكتروني وكلمة المرور، أو عبر الدخول الموحد بواسطة Google أو Telegram.</p>`
    }
  };
  const page = pages[type];
  if (!page) return home();
  return `<div class="w ov-legal-page">
    <div class="ov-legal-header">
      <h1>${page.title}</h1>
      <p>آخر تحديث: نوفمبر 2026</p>
    </div>
    <div class="ov-legal-content">
      ${page.content}
    </div>
    <div class="ov-legal-back">
      <a class="ovx-btn-primary" href="#/">← العودة للرئيسية</a>
    </div>
  </div>`;
}

const brandFoot = () => `
  <div class="brand-foot" style="display:none">
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

window.redeemOwnerSupportCode=async()=>{
 const supportCode=document.getElementById('accountSupportCode')?.value.trim()||'';
 if(!/^OVS-[A-Fa-f0-9]{18}$/.test(supportCode))return toast('أدخل رمز دعم صحيحًا من المالك');
 try{const r=await fetch(ACC_URL+'/support/redeem-code',{method:'POST',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},body:JSON.stringify({supportCode})});
 const d=await r.json();toast(d.message||(d.success?'تم التحقق':'الرمز غير صالح أو انتهت صلاحيته'));
 if(d.success){const field=document.getElementById('accountSupportCode');if(field)field.value='';}}
 catch(_){toast('تعذر الاتصال بخادم الدعم');}
};
window.requestProfileCode=async()=>{
 if(!custToken)return toast('سجّل الدخول أولًا');
 try{const r=await fetch(ACC_URL+'/profile/request-change-code',{method:'POST',headers:{Authorization:'Bearer '+custToken}});
 const d=await r.json();toast(d.message||(r.ok?'تحقق من Telegram أو تطبيق TOTP':'تعذر إرسال الرمز'));}
 catch(_){toast('تعذر طلب رمز التحقق');}
};
window.secureProfileUpdate=async()=>{
 const email=document.getElementById('profileNewEmail')?.value.trim()||'';
 const phone=document.getElementById('profileNewPhone')?.value.trim()||'';
 const code=document.getElementById('profileStepOtp')?.value.trim()||'';
 if(!/^[0-9]{6}$/.test(code)||(!email&&!phone))return toast('أدخل البيانات الجديدة ورمز OTP من حسابك');
 try{const r=await fetch(ACC_URL+'/profile/secure-update',{method:'POST',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},body:JSON.stringify({email,phone,code})});
 const d=await r.json();toast(d.message||(r.ok?'تم التحديث':'تعذر تحديث الحساب'));
 if(d.success)custLogout();}
 catch(_){toast('تعذر الاتصال بخادم الحساب');}
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

const conversationsBlock = () => `
  <div class="sec-head"><h2 class="sh" style="margin:0">💬 محادثات الدعم</h2><a class="chip on" href="#/support">فتح مركز الرسائل</a></div>
  <div class="sm"><p>تواصل مع الإدارة واحصل على ردودك داخل المتجر. يمكنك طلب مراجعة Qwen للأسئلة العامة عند توفر الوكيل.</p></div>`;

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


// Account-owned notifications: polling only while account page is open. No marketing without opt-in.
let siteNoteItems=[],siteNoteUnread=0,siteMarketingOptIn=false,siteNoteLoaded=false;
// Header notification badge polls only the authenticated user's own inbox.
async function updateSiteBellCount(){
  if(!custToken||document.hidden)return;
  try{
    const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});
    const data=await r.json();if(!r.ok||!data.success)return;
    const next=Math.max(0,Number(data.unread)||0);
    if(next!==siteNoteUnread){siteNoteUnread=next;chrome();}
  }catch(_){/* keep existing counter if offline */}
}
setInterval(updateSiteBellCount,60000);

function siteNotificationsBlock(){
 if(!custToken)return '';
 return `<section class="sm ov-site-notifications" aria-label="إشعارات حسابي"><h2 class="sh">🔔 إشعارات حسابي ${siteNoteUnread?'('+siteNoteUnread+' جديدة)':''}</h2>
 <button class="btn o" onclick="loadSiteNotifications()">تحديث الإشعارات</button>
 <label class="ov-optin"><input type="checkbox" ${siteMarketingOptIn?'checked':''} onchange="setSiteMarketingOptIn(this.checked)"> أوافق على عروض الاشتراكات الجديدة داخل حسابي (اختياري)</label>
 ${!siteNoteLoaded?'<p>اضغط تحديث الإشعارات لعرضها.</p>':siteNoteItems.length?siteNoteItems.map(n=>`<article class="ov-note ${n.readAt?'':'unread'}"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${esc(new Date(n.createdAt).toLocaleString('ar-DZ'))}</small>${!n.readAt?`<button class="chip" onclick="markSiteNoteRead('${esc(n._id)}')">تمت القراءة</button>`:''}</article>`).join(''):'<p>لا توجد إشعارات لهذا الحساب حاليًا.</p>'}</section>`;
}
async function loadSiteNotifications(){if(!custToken)return;
 try{const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});const d=await r.json();if(!r.ok||!d.success)throw Error('تعذر تحميل إشعارات الحساب');siteNoteItems=d.notifications||[];siteNoteUnread=d.unread||0;siteMarketingOptIn=!!d.marketingOptIn;siteNoteLoaded=true;draw();}catch(e){toast(e.message);}}
async function setSiteMarketingOptIn(value){try{const r=await fetch(API_BASE+'/api/v2/site-notifications/preferences',{method:'PATCH',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},body:JSON.stringify({marketingOptIn:value})});if(!r.ok)throw Error('لم تُحفظ تفضيلات العروض');siteMarketingOptIn=value;toast('تم حفظ اختيارك');}catch(e){toast(e.message);draw();}}
async function markSiteNoteRead(id){try{const r=await fetch(API_BASE+'/api/v2/site-notifications/'+encodeURIComponent(id)+'/read',{method:'POST',headers:{Authorization:'Bearer '+custToken}});if(!r.ok)throw Error('تعذر تحديث الإشعار');await loadSiteNotifications();}catch(e){toast(e.message)}}

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
          <button class="btn tg" style="margin:12px 0 0" onclick="startBotLogin()">📲 الدخول عبر بوت تيليغرام (الأسهل)</button>
          <div id="tg_bot_status"></div>
          <div class="note tg-hint">أو عبر نافذة تيليغرام: اكتب رقمك <b>بدون الصفر</b> بعد +213 (مثال: <span dir="ltr">+213 77 64 14 485</span>)</div>
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
    <details class="sm ov-account-verify"><summary>🪪 التحقق برمز دعم المالك</summary>
      <p class="note">إذا أعطاك المالك رمز دعم، أدخله هنا فقط بعد تسجيل الدخول. لا يُستخدم لتغيير كلمة السر ولا يغني عن OTP.</p>
      <input class="in2" id="accountSupportCode" maxlength="22" placeholder="OVS-..." dir="ltr" autocomplete="off">
      <button class="btn" onclick="redeemOwnerSupportCode()">تأكيد رمز الدعم</button>
    </details>
    <details class="sm ov-account-verify"><summary>🔐 تغيير البريد أو الهاتف بعد التحقق</summary>
      <p class="note">اطلب رمز OTP من هنا، ثم أدخله في هذه الصفحة، وليس في محادثة الدعم. يجب ربط Telegram أو تفعيل TOTP أولًا.</p>
      <button class="chip" onclick="requestProfileCode()">إرسال رمز تحقق إلى Telegram / استعمال TOTP</button>
      <label class="lb" for="profileNewEmail">بريد إلكتروني جديد (اختياري)</label>
      <input class="in2" id="profileNewEmail" type="email" autocomplete="email" placeholder="name@example.com" dir="ltr">
      <label class="lb" for="profileNewPhone">رقم هاتف جديد (اختياري)</label>
      <input class="in2" id="profileNewPhone" type="tel" autocomplete="tel" placeholder="05XXXXXXXX" dir="ltr">
      <label class="lb" for="profileStepOtp">رمز التحقق</label>
      <input class="in2" id="profileStepOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" dir="ltr">
      <button class="btn" onclick="secureProfileUpdate()">تأكيد التغيير</button>
    </details>

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

    ${siteNotificationsBlock()}
    ${conversationsBlock()}
    ${brandFoot()}
  </div>`;
};

// تهيئة أزرار Google وTelegram بعد رسم صفحة الدخول
function mountSocialButtons() {
  renderTgBotStatus();
  resumeBotLogin();
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

// ===== الدخول عبر بوت تيليغرام (رابط عميق + استطلاع) =====
// لا يحتاج رقم الهاتف ولا نافذة منبثقة، ويعمل في Brave وفي متصفح فيسبوك.
function renderTgBotStatus() {
  const box = document.getElementById('tg_bot_status');
  if (!box) return;
  if (!tgBot) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="tgbot-status">
    <div>${esc(tgBot.msg || '')}</div>
    ${tgBot.url ? `<a class="chip on" target="_blank" rel="noopener" href="${esc(tgBot.url)}">فتح تيليغرام ←</a>` : ''}
  </div>`;
}

function stopBotLogin(clear) {
  if (tgBotTimer) { clearTimeout(tgBotTimer); tgBotTimer = null; }
  if (clear) { try { sessionStorage.removeItem('ov_tgl'); } catch (e) {} }
}

async function pollBotLogin() {
  tgBotTimer = null;
  if (!document.getElementById('tg_bot_status')) return; // خرج المستخدم من صفحة الدخول؛ يُستأنف عند عودته
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('ov_tgl') || 'null'); } catch (e) {}
  if (!saved || Date.now() - saved.t > 290000) {
    stopBotLogin(true);
    tgBot = { msg: 'انتهت صلاحية المحاولة، اضغط الزر من جديد.' };
    return renderTgBotStatus();
  }
  try {
    const r = await fetch(ACC_URL + '/oauth/telegram/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: saved.k })
    });
    const d = await r.json();
    if (d.success && d.pending) {
      tgBot = {
        url: saved.u,
        msg: d.state === 'awaiting'
          ? '✅ وصلك الطلب في تيليغرام: اضغط «نعم، أنا من طلب الدخول» ثم ارجع هنا.'
          : '⏳ اضغط Start في بوت تيليغرام ثم أكّد الدخول…'
      };
      renderTgBotStatus();
    } else if (d.success) {
      stopBotLogin(true);
      tgBot = null;
      return processAuthResult(d, 'تم تسجيل الدخول عبر تيليغرام بنجاح ✓');
    } else {
      stopBotLogin(true);
      tgBot = { msg: d.message || 'تعذّر الدخول عبر تيليغرام.' };
      return renderTgBotStatus();
    }
  } catch (e) { /* انقطاع شبكة أو الخادم يستيقظ: نكمل المحاولة */ }
  tgBotTimer = setTimeout(pollBotLogin, 2500);
}

function resumeBotLogin() {
  if (tgBotTimer || custToken) return;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('ov_tgl') || 'null'); } catch (e) {}
  if (!saved || Date.now() - saved.t > 290000) return;
  if (!tgBot) tgBot = { url: saved.u, msg: '⏳ بانتظار تأكيدك داخل تيليغرام…' };
  renderTgBotStatus();
  tgBotTimer = setTimeout(pollBotLogin, 1500);
}

window.startBotLogin = async () => {
  stopBotLogin(true);
  tgBot = { msg: 'جارٍ تجهيز رابط الدخول…' };
  renderTgBotStatus();
  try {
    const r = await fetch(ACC_URL + '/oauth/telegram/start', { method: 'POST' });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    try { sessionStorage.setItem('ov_tgl', JSON.stringify({ k: d.token, u: d.botUrl, t: Date.now() })); } catch (e) {}
    tgBot = { url: d.botUrl, msg: 'افتح تيليغرام واضغط Start، ثم ارجع إلى هنا.' };
    renderTgBotStatus();
    window.open(d.botUrl, '_blank', 'noopener'); // إن حُجبت النافذة يبقى زر «فتح تيليغرام» ظاهرًا
    tgBotTimer = setTimeout(pollBotLogin, 2500);
  } catch (e) {
    tgBot = { msg: e.message || 'تعذّر بدء الدخول عبر تيليغرام، حاول مجددًا.' };
    renderTgBotStatus();
  }
};

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

// Unified support: customers use JWT, guests keep a high-entropy capability on this device.
const CHAT_BASE = API_BASE + '/api/v2/conversations';
let supportChats = [], supportCurrent = '', supportMessages = [], supportBusy = false, supportError = '';
const chatKeyStore = 'ovira_guest_chats_v2';
function guestChats() {
  try { const x=JSON.parse(localStorage.getItem(chatKeyStore)||'[]');return Array.isArray(x)?x.filter(i=>/^[a-f0-9]{24}$/.test(i.id)&&/^[a-f0-9]{64}$/.test(i.key)).slice(0,10):[]; } catch (_) {return [];} 
}
function saveGuestChat(id,key) {
  const list=[{id,key},...guestChats().filter(x=>x.id!==id)].slice(0,10);
  try {localStorage.setItem(chatKeyStore,JSON.stringify(list));}catch(_){}
}
function supportHeaders(id,json=false) {
  const head={};
  if(json)head['Content-Type']='application/json';
  if(custToken)head.Authorization='Bearer '+custToken;
  else if(id) {const item=guestChats().find(x=>x.id===id);if(item)head['X-Conversation-Key']=item.key;}
  return head;
}
async function supportAPI(url,options={}) {
  const r=await fetch(url,{cache:'no-store',...options});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success)throw new Error(d.message||({LOGIN_REQUIRED:'سجّل الدخول لمتابعة محادثات حسابك',CONVERSATION_CLOSED:'هذه المحادثة مغلقة',NOT_FOUND:'المحادثة غير موجودة أو غير مملوكة لك'}[d.code]||'تعذّر تنفيذ طلب الرسائل'));
  return d;
}
function supportBubbleMarkup(m){
  return `<div class="ov-bubble ${['customer','guest'].includes(m.author)?'mine':''}"><b>${esc(m.author==='ai'?'المساعد الذكي':m.author==='admin'?'الإدارة':m.author==='system'?'إشعار النظام':'الزبون')}</b><p>${esc(m.text)}</p><small>${esc(new Date(m.createdAt).toLocaleString('ar-DZ'))}</small></div>`;
}
function supportV() {
  const u=me();
  return `<div class="w ov-chat-page ${supportCurrent?'has-thread':'show-list'}"><h1 class="ttl">💬 مركز الرسائل</h1>
    <p class="note">راسل إدارة OVIRA PLAY مباشرة. يمكنك إرسال عدة رسائل متتابعة، وسيرد فريق الدعم البشري هنا.</p>
    ${supportError?`<div class="sm" role="alert">${esc(supportError)}</div>`:''}
    <div class="ov-chat-layout">
      <section class="sm ov-chat-directory"><h2 class="sh">محادثاتي</h2>
        ${custToken&&supportChats.some(x=>x.isPrimarySupportThread)?`<button class="ov-chat-choice" onclick="openSupportChat('${esc(supportChats[0]._id)}')"><strong>الإدارة — OVIRA PLAY</strong><small>${esc((supportChats[0].lastMessageText||'').slice(0,100))}</small></button>
          ${supportChats.length>1?`<details class="ov-chat-archives"><summary>المحادثات السابقة (${supportChats.length-1}) — للرجوع إلى السجل</summary>${supportChats.slice(1).map(x=>`<button class="ov-chat-choice" onclick="openSupportChat('${esc(x._id)}')">${esc(x.subject||'سجل سابق')} · ${esc(x.status)}</button>`).join('')}</details>`:''}`:
        `<button class="btn o" onclick="newSupportChat()">${custToken?'ابدأ مراسلة الإدارة':'+ تذكرة للزائر'}</button><div class="ov-chat-list">${supportChats.map(x=>`<button class="ov-chat-choice ${supportCurrent===x._id?'chosen':''}" onclick="openSupportChat('${esc(x._id)}')"><strong>${esc(x.subject||'استفسار')}</strong><small>${esc(x.status)}</small></button>`).join('')}</div>`} 
      </section>
      <section class="sm ov-chat-thread" aria-label="المحادثة">
      ${supportCurrent ? `<div class="ov-chat-thread-head"><button class="chip ov-chat-back" onclick="supportBackToList()" aria-label="العودة إلى محادثاتي">← المحادثات</button><h2 class="sh">سجل الرسائل</h2></div><div class="ov-chat-history" role="log" aria-live="polite">${supportMessages.length?supportMessages.map(supportBubbleMarkup).join(''):'<p>لم تصل رسائل بعد.</p>'}}</div>
        <p class="ov-chat-hint">يمكنك إرسال عدة رسائل متتالية. سيقرأ فريق الإدارة جميع التفاصيل في هذه المحادثة.</p><label class="lb" for="supportReply">اكتب رسالتك</label><textarea class="in2" id="supportReply" maxlength="1500" placeholder="اكتب التفاصيل هنا، رسالة بعد رسالة. لا تشارك رمز OTP."></textarea>
        <button class="btn" onclick="sendSupportReply()" ${supportBusy?'disabled':''}>إرسال الرسالة</button>`
        : `<h2 class="sh">${custToken?'مراسلة الإدارة':'فتح تذكرة دعم للزائر'}</h2>
        ${!custToken?`<label class="lb" for="supportGuestName">الاسم *</label><input class="in2" id="supportGuestName" maxlength="80" value="${esc(u.n||'')}" placeholder="اسمك">`:''}
        <label class="lb" for="supportSubject">موضوع المحادثة</label><input class="in2" id="supportSubject" maxlength="120" placeholder="مثال: استفسار عن الخدمة" value="استفسار">
        <label class="lb" for="supportFirst">رسالتك *</label><textarea class="in2" id="supportFirst" maxlength="1500" placeholder="اكتب سؤالك هنا، دون معلومات حساسة"></textarea>
        <button class="btn" onclick="createSupportChat()" ${supportBusy?'disabled':''}>${custToken?'بدء المحادثة':'فتح تذكرة دعم للزائر'}</button>
        ${!custToken?'<p class="note">للزائر: يُحفظ مفتاح متابعة المحادثة على هذا الجهاز فقط. لا تربط الرسائل بحساب اعتمادًا على رقم الهاتف.</p>':''}`}
      </section>
    </div>
    ${brandFoot()}
  </div>`;
}
async function loadSupportChats() {
  try {
    supportError='';
    if(custToken) {
      const d=await supportAPI(CHAT_BASE,{headers:supportHeaders()});
      supportChats=(d.conversations||[]).sort((a,b)=>Number(!!b.isPrimarySupportThread)-Number(!!a.isPrimarySupportThread));
    } else {
      const ids=guestChats();
      const data=await Promise.all(ids.map(async x=>{
        try {const d=await supportAPI(CHAT_BASE+'/'+x.id,{headers:supportHeaders(x.id)});return d.conversation;}catch(_){return null;}
      }));
      supportChats=data.filter(Boolean);
    }
    if(supportCurrent && !supportChats.some(x=>x._id===supportCurrent))supportCurrent='';
    // Opening support on a signed-in account goes straight to its main admin thread.
    if(custToken && supportChats.some(x=>x.isPrimarySupportThread) && !supportCurrent && location.hash.startsWith('#/support')) {
      await openSupportChat(supportChats[0]._id); return;
    }
    if(location.hash.startsWith('#/support'))draw();
  } catch(e){supportError=e.message;if(location.hash.startsWith('#/support'))draw();}
}
window.newSupportChat=()=>{if(custToken&&supportChats.some(x=>x.isPrimarySupportThread))return openSupportChat(supportChats[0]._id);supportCurrent='';supportMessages=[];draw();};
window.supportBackToList=()=>{supportCurrent='';supportMessages=[];draw();};
window.openSupportChat=async(id)=>{
  try{
    supportCurrent=id;supportMessages=[];draw();
    const d=await supportAPI(CHAT_BASE+'/'+encodeURIComponent(id),{headers:supportHeaders(id)});
    if(supportCurrent!==id)return;
    supportMessages=d.messages||[];draw();
  }catch(e){supportError=e.message;draw();}
};
window.createSupportChat=async()=>{
  if(supportBusy)return;
  const subject=$('#supportSubject')?.value.trim()||'استفسار';
  const text=$('#supportFirst')?.value.trim()||'';
  const name=$('#supportGuestName')?.value.trim()||'';
  if(text.length<2||text.length>1500||(!custToken&&name.length<2))return toast('أدخل الاسم والرسالة بشكل صحيح');
  supportBusy=true;
  try{
    const d=await supportAPI(CHAT_BASE,{method:'POST',headers:supportHeaders('',true),body:JSON.stringify({subject,text,...(!custToken?{name}:{})})});
    if(d.guestKey)saveGuestChat(d.conversation._id,d.guestKey);
    supportCurrent=d.conversation._id;supportMessages=[d.message];
    // A server may reuse an existing administration thread; fetch the complete history.
    if(custToken){await openSupportChat(supportCurrent);return;}
    await loadSupportChats();draw();toast('بدأت المحادثة، ويمكنك متابعتها هنا');
  }catch(e){toast(e.message)}finally{supportBusy=false;}
};
window.sendSupportReply=async()=>{
  if(supportBusy||!supportCurrent)return;
  const text=$('#supportReply')?.value.trim()||'';
  if(text.length<2||text.length>1500)return toast('الرسالة يجب أن تكون بين حرفين و1500 حرف');
  supportBusy=true;
  try{
    const id=supportCurrent;
    const result=await supportAPI(CHAT_BASE+'/'+id+'/messages',{method:'POST',headers:supportHeaders(id,true),body:JSON.stringify({text})});
    if(id===supportCurrent){
      supportMessages.push(result.message);
      const field=$('#supportReply');if(field)field.value='';
      const history=document.querySelector('.ov-chat-history');
      if(history){ history.insertAdjacentHTML('beforeend',supportBubbleMarkup(result.message));history.scrollTop=history.scrollHeight; }
    }
    toast('تم إرسال الرسالة. يمكنك متابعة الكتابة');
  }catch(e){toast(e.message)}finally{supportBusy=false;}
};

// Refresh an open website conversation without discarding what the customer is typing.
// This is foreground polling, not a promise of background push notifications.
let supportPollBusy = false;
setInterval(async () => {
  if (supportPollBusy || supportBusy || document.hidden || !location.hash.startsWith('#/support') || !supportCurrent) return;
  supportPollBusy = true;
  const id = supportCurrent;
  try {
    const data = await supportAPI(CHAT_BASE+'/'+encodeURIComponent(id), {headers:supportHeaders(id)});
    if (id !== supportCurrent || !location.hash.startsWith('#/support')) return;
    const incoming = data.messages || [];
    const signature = list => list.map(x=>String(x._id||'')+':'+String(x.text||'')).join('|');
    if (signature(incoming) !== signature(supportMessages)) {
      supportMessages = incoming;
      const history=document.querySelector('.ov-chat-history');
      if(history){
        const nearBottom=history.scrollHeight-history.scrollTop-history.clientHeight<100;
        history.innerHTML=incoming.map(supportBubbleMarkup).join('');
        if(nearBottom)history.scrollTop=history.scrollHeight;
      }
    }
  } catch (_) { /* display last known messages; manual refresh remains available */ }
  finally { supportPollBusy = false; }
}, 15000);

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
  supportCurrent = ''; supportChats = []; supportMessages = [];
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
  document.body.dataset.page = v;
  const prodSlug = decodeURIComponent(h[1] || '');

  // Legal pages (no catalog needed)
  if (['privacy', 'terms', 'refund', 'faq'].includes(v)) {
    updatePageSEO(null);
    document.title = `${{privacy:'سياسة الخصوصية',terms:'شروط الاستخدام',refund:'سياسة الاسترجاع',faq:'الأسئلة الشائعة'}[v]} | OVIRA PLAY`;
    return legalPage(v);
  }

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

  const needsCatalog = ['home', 'shop', 'p', 'cart', 'checkout'].includes(v);
  if (needsCatalog && catalogStatus !== 'ready') {
    document.body.className = '';
    updatePageSEO(null);
    return catalogStatus === 'error' ? catalogUnavailable() : catalogLoading();
  }
  const product = v === 'p' ? pr(prodSlug) : null;
  document.body.className = product ? 'pp' : '';
  updatePageSEO(product);
  if (v === 'p') return product ? prod(product) : `<div class="w ov-state"><h2>هذا الاشتراك غير متاح حالياً</h2><p>لم يعد هذا المنتج منشوراً في قائمة المتجر.</p><a href="#/shop" class="btn">العودة إلى المتجر</a></div>`;
  return v == 'shop' ? shop()
    : v == 'cart' ? cartV()
    : v == 'checkout' ? chk()
    : v == 'done' ? doneV()
    : v == 'track' ? trackV()
    : v == 'account' ? accountV()
    : v == 'support' ? supportV()
    : home();
}

let siteNavOpen=false;
function toggleSiteNav(next){siteNavOpen=typeof next==='boolean'?next:!siteNavOpen;document.body.classList.toggle('site-nav-open',siteNavOpen);document.getElementById('siteMenuButton')?.setAttribute('aria-expanded',String(siteNavOpen));}
function chrome() {
  const h = location.hash.slice(2).split('?')[0].split('/');
  const v = h[0] || 'home';
  const n = cart.reduce((s, i) => s + i.q, 0);
  const isLegal = ['privacy', 'terms', 'refund', 'faq'].includes(v);
  const showFooter = !['p', 'checkout'].includes(v) && !isLegal;

  const links = [
    ['home', 'الرئيسية', '#/'],
    ['shop', 'المتجر', '#/shop'],
    ['track', 'تتبع الطلب', '#/track'],
    ['account', 'حسابي', '#/account']
  ];

  // Bottom bar للموبايل
  const bottomTabs = [
    ['home', I.home, '#/', 'الرئيسية'],
    ['shop', I.shop, '#/shop', 'المتجر'],
    ['track', I.track, '#/track', 'التتبع'],
    ['account', I.user, '#/account', 'حسابي'],
    ['support', I.support, '#/support', 'الدعم']
  ];
  const bb = document.getElementById('ov-bottom-bar');
  if (bb) {
    bb.innerHTML = bottomTabs.map(([key, icon, href, label]) =>
      `<a href="${href}" class="${key === v ? 'on' : ''}" aria-label="${label}">
        ${ico(icon, 20)}
        <span>${label}</span>
      </a>`
    ).join('');
  }

  // Footer
  const footerEl = document.getElementById('ov-footer');
  if (footerEl) {
    footerEl.hidden = !showFooter;
    if (showFooter) footerEl.innerHTML = renderFooter();
  }

  $('#hd').classList.toggle('tight', v !== 'home' && !!custProfile);
  $('#hd').innerHTML = `
    ${v !== 'home' ? `<button class="ib ovx-back" onclick="back()" aria-label="رجوع">${ico(I.back)}</button>` : ''}
    <a class="logo ovx-logo" href="#/" aria-label="OVIRA PLAY الرئيسية"><i>▶</i><span class="lt">OVIRA <b>PLAY</b></span></a>
    <div class="ov-header-search" role="search">
      <span aria-hidden="true">⌕</span>
      <input id="ovGlobalSearch" type="search" placeholder="ابحث عن منتج..." autocomplete="off"
        oninput="if(location.hash.startsWith('#/shop'))filterShopProducts(this.value); else if(this.value.length>=2)quickSearch(this.value);"
        onkeydown="if(event.key==='Enter'&&this.value.trim()){location.hash='#/shop';setTimeout(()=>filterShopProducts(this.value.trim()),100);}">
    </div>
    <div class="ovx-header-links" aria-label="التنقل الرئيسي">
      ${links.map(([key, label, href]) => `<a href="${href}" class="${key === v ? 'active' : ''}">${label}</a>`).join('')}
    </div>
    <div class="ovx-header-actions">
      <button class="ovx-install-app" type="button" onclick="oviraInstallApp()" aria-label="تثبيت تطبيق OVIRA PLAY"><span>↓</span><b>تثبيت</b></button>
      ${custToken ? `<a class="ib ov-bell" href="#/account" aria-label="إشعارات حسابي">🔔${siteNoteUnread ? `<span class="cnt">${siteNoteUnread}</span>` : ''}</a>` : ''}
      ${custProfile ? `<a class="wallet-pill" href="#/account" aria-label="رصيد محفظتك">${ico(I.wallet, 18)}<span class="wt"><small>رصيدك</small><b>${fmt(custProfile.balance || 0)}</b></span></a>` : ''}
      <button class="ib" onclick="theme()" aria-label="تغيير المظهر">${ico(I.moon)}</button>
      <a class="ib" href="#/cart" aria-label="السلة">${ico(I.cart)}${n ? `<span class="cnt">${n}</span>` : ''}</a>
      <button class="ib ov-site-menu-button" id="siteMenuButton" aria-label="فتح قائمة التنقل" aria-controls="nv" aria-expanded="${siteNavOpen}" onclick="toggleSiteNav()">☰</button>
    </div>`;

  const drawerTabs = [
    ['home', 'الرئيسية', '/'],
    ['shop', 'المتجر', '/shop'],
    ...(!custToken ? [['track', 'تتبع الطلب', '/track']] : []),
    ['account', custToken ? 'طلباتي / حسابي' : 'حسابي', '/account'],
    ['support', 'الرسائل والمساعدة', '/support']
  ];
  $('#nv').innerHTML = '<div class="ov-drawer-title"><b>OVIRA PLAY</b><button aria-label="إغلاق القائمة" onclick="toggleSiteNav(false)">✕</button></div>' +
    drawerTabs.map((x) => `<a href="#${x[2]}" class="${x[0] === v ? 'on' : ''}" onclick="toggleSiteNav(false)">${ico(I[x[0]] || I.user)}${x[1]}</a>`).join('') +
    '<div class="ovx-drawer-install"><button type="button" onclick="oviraInstallApp()">↓ تثبيت تطبيق OVIRA PLAY</button></div>';
  document.body.classList.toggle('site-nav-open', siteNavOpen);
}

// Quick search from header
window.quickSearch = (value) => {
  const q = String(value || '').trim().toLocaleLowerCase();
  if (q.length < 2) return;
  const matches = P.filter((p) => [p.t, p.n, p.cat, p.sub].filter(Boolean).join(' ').toLocaleLowerCase().includes(q));
  if (matches.length === 1) {
    location.hash = '#/p/' + encodeURIComponent(matches[0].id);
  }
};

function draw() {
  clean();
  app.innerHTML = view();
  chrome();
  mountSocialButtons();
  if (document.getElementById('productReviews')) loadProductReviews();
  if ((location.hash.slice(2).split('?')[0].split('/')[0] || 'home') === 'shop') {
    filterShopProducts(shopQuery);
    sortShopProducts(shopSort);
  }
}

async function loadProductReviews() {
  const holder = document.getElementById('productReviews');
  if (!holder || catalogStatus !== 'ready') return;

  const id = holder.dataset.product;
  if (!pr(id)) return;

  const cached = productReviewsCache.get(id);
  if (cached?.status === 'loading' || cached?.status === 'done') return;

  productReviewsCache.set(id, { status: 'loading' });
  updateProductEvidence();

  try {
    const response = await fetch(`${API_URL}/reviews/${encodeURIComponent(id)}?page=1&limit=6`, {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();

    if (!response.ok || !data.success || !Array.isArray(data.reviews)) {
      throw new Error('REVIEWS_UNAVAILABLE');
    }

    productReviewsCache.set(id, {
      status: 'done',
      data: {
        ...data,
        page: Number(data.page) || 1,
        hasMore: Boolean(data.hasMore)
      },
      loadingMore: false,
      loadMoreError: false
    });

    if (Number(data.count) > 0) {
      productReviewSummary[id] = {
        count: data.count,
        average: Number(data.average) || productReviewSummary[id]?.average || 0,
        distribution: data.distribution || productReviewSummary[id]?.distribution || {}
      };
    } else {
      delete productReviewSummary[id];
    }
  } catch (_) {
    productReviewsCache.set(id, { status: 'failed' });
  }

  updateProductEvidence();
}

window.loadMoreProductReviews = async () => {
  const holder = document.getElementById('productReviews');
  if (!holder) return;

  const id = holder.dataset.product;
  const cached = productReviewsCache.get(id);

  if (!cached || cached.status !== 'done' || cached.loadingMore || !cached.data?.hasMore) return;

  cached.loadingMore = true;
  cached.loadMoreError = false;
  updateProductEvidence();

  try {
    const nextPage = (Number(cached.data.page) || 1) + 1;
    const response = await fetch(
      `${API_URL}/reviews/${encodeURIComponent(id)}?page=${nextPage}&limit=6`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await response.json();

    if (!response.ok || !data.success || !Array.isArray(data.reviews)) {
      throw new Error('REVIEWS_PAGE_UNAVAILABLE');
    }

    cached.data.reviews = [...cached.data.reviews, ...data.reviews];
    cached.data.page = Number(data.page) || nextPage;
    cached.data.hasMore = Boolean(data.hasMore);
    cached.data.count = Number(data.count) || cached.data.count;
    cached.data.average = Number(data.average) || cached.data.average;
    cached.data.distribution = data.distribution || cached.data.distribution;
  } catch (_) {
    cached.loadMoreError = true;
  } finally {
    cached.loadingMore = false;
    updateProductEvidence();
  }
};


window.submitReview = async (productId) => {
  const stars = Number(document.getElementById('reviewStars')?.value);
  const comment = document.getElementById('reviewText')?.value || '';
  try {
    const r = await fetch(ACC_URL+'/reviews', {method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+custToken},
      body:JSON.stringify({productId,stars,comment})});
    const d = await r.json();toast(d.message || 'تم إرسال التقييم');
  } catch(e){toast('تعذر إرسال التقييم');}
};

function route(shouldScroll = true) {
  captureSource();
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
  if (h[0] == 'track' && custToken) { location.hash = '#/account'; return; }
  if (h[0] == 'account' && custToken) { fetchCustomerProfile().then(() => { app.innerHTML = view(); chrome(); }); loadSiteNotifications(); }
  if (h[0] == 'support') loadSupportChats();
  draw();
  if (shouldScroll) scrollTo(0, 0);
}

function back() { history.length > 1 ? history.back() : (location.hash = '#/'); }
function setCat(c) { cat = c; draw(); }
function pickPlan(i) {
  sel = i;
  if (editK >= 0 && cart[editK]) { const v = pr(cart[editK].id).pl[i]; cart[editK].m = v[0]; cart[editK].k = v[4] || ''; save(); }
  draw();
}
function add(id, m, go) {
  if (catalogStatus !== 'ready') return toast('انتظر تحميل الأسعار الحالية أولاً');
  const product = pr(id);
  const chosen = product?.pl[sel] || product?.pl.find((p) => Number(p[0]) === Number(m));
  if (!chosen) return toast('هذه الباقة غير متاحة حالياً');
  const months = Number(chosen[0]);
  const key = chosen[4] || '';
  const existing = cart.find((i) => i.id === id && (key ? i.k === key : !i.k && Number(i.m) === months));
  const had = !!existing;
  if (existing) existing.q = Math.min(9, existing.q + 1);
  else cart.push({ id, m: months, k: key, q: 1 });
  save();
  const current = existing || cart[cart.length - 1];
  if (go) {
    if (cart.length === 1 && current.q === 1) { location.hash = '#/checkout'; return; }
    const t = product.t + ' — ' + dur(months) + (chosen[3] ? ' · ' + chosen[3] : '');
    cartNote = had
      ? `«${t}» كان في سلتك أصلاً فأصبحت كميته ${current.q}. راجع الكمية قبل المتابعة.`
      : `تمت إضافة «${t}». راجع كل ما في سلتك ثم تابع للدفع.`;
    location.hash = '#/cart';
  } else {
    draw();
    toast(had ? `في سلتك الآن ${current.q} من هذه الباقة` : 'تمت الإضافة إلى السلة ✓');
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
  if (catalogStatus !== 'ready' || !cart.length) return toast('تأكد من تحميل الكتالوج والسلة قبل تأكيد الطلب');
  if (checkoutStage !== 'review') return reviewCheckout();
  const n = String(chkDraft.n || '').trim();
  const ph = normPh(chkDraft.p || '');
  const em = String(chkDraft.e || '').trim().toLowerCase();

  if (n.length < 3 || n.length > 80 || !/^0[567]\d{8}$/.test(ph) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || !chkDraft.accepted) {
    checkoutStage = 'details';
    draw();
    return toast('راجع بياناتك وأكد صحتها قبل إرسال الطلب');
  }

  const pm = PAY.find((x) => x.id == payId);
  if (!pm) return toast('اختر طريقة دفع متاحة أولاً');
  const submitBtn = $('#submitBtn');
  if (!submitBtn) return toast('تعذر عرض زر التأكيد، أعد المحاولة');
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري معالجة الطلب...';

  const returnOrigin = location.origin + location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  const attribution = currentSource();
  const payload = {
    customerName: n,
    whatsappNumber: ph,
    customerEmail: em,
    paymentMethod: pm.n,
    totalPrice: tot(),
    cartItems: cart.map((i) => ({ id: i.id, m: i.m, k: i.k || '', q: i.q })),
    returnOrigin,
    ...(attribution ? { source: attribution } : {})
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
        ...cart.map((i, k) => (k + 1) + ') ' + pr(i.id).t + ' (' + dur(pl(i)[0]) + (pl(i)[3] ? ' · ' + pl(i)[3] : '') + ' × ' + i.q + ')'),
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
      cart = []; save(); chkDraft = { n: null, p: null, e: null, accepted: false }; checkoutStage = 'details'; location.hash = '#/done';
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

// Support is handled inside the storefront. WhatsApp integration is postponed.
const f = $('#fab'); if(f){f.href='#/support';f.removeAttribute('target');f.setAttribute('aria-label','محادثات دعم الموقع');}


addEventListener('hashchange', ()=>{toggleSiteNav(false);route();});
route();
loadCatalog();
loadReviewSummary();
loadDeliveryStats();


// Public announcements are independent of authenticated account notifications.
let ovAnnouncementTimer=null;
async function loadPublicAnnouncements(){
 const node=document.getElementById('ovAnnouncements');if(!node)return;
 try{
  const r=await fetch(API_BASE+'/api/v2/announcements',{cache:'no-store'});
  const d=await r.json();if(!r.ok||!d.success)throw Error('unavailable');
  const rows=(d.announcements||[]).slice(0,3);
  node.hidden=!rows.length;
  node.innerHTML=rows.map(a=>`<article class="ov-announcement"><strong>📢 ${esc(a.title)}</strong><span>${esc(a.body)}</span></article>`).join('');
 }catch(_){node.hidden=true;node.replaceChildren();}
}
loadPublicAnnouncements();
ovAnnouncementTimer=setInterval(()=>{if(!document.hidden)loadPublicAnnouncements();},120000);

// Keep the notification badge fresh without re-rendering an active chat composer.
let ovNotePollBusy=false;
async function refreshAccountNotificationBadge(){
 if(ovNotePollBusy||!custToken||document.hidden)return;
 ovNotePollBusy=true;
 try{
  const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});
  if(!r.ok)return;
  const d=await r.json();if(!d.success)return;
  siteNoteUnread=Number(d.unread)||0;
  const bell=document.querySelector('#hd .ov-bell');
  if(bell){
    let mark=bell.querySelector('.cnt');
    if(siteNoteUnread){if(!mark){mark=document.createElement('span');mark.className='cnt';bell.appendChild(mark);}mark.textContent=String(siteNoteUnread);}
    else if(mark)mark.remove();
  }
 }catch(_){/* keep current display on network loss */}
 finally{ovNotePollBusy=false;}
}
setInterval(refreshAccountNotificationBadge,60000);
refreshAccountNotificationBadge();
