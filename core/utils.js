// =========================================================
// OVIRA PLAY — CORE UTILITIES (core/utils.js)
// =========================================================

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

const BASE_TITLE = document.title || 'OVIRA PLAY | متجر الاشتراكات الرقمية';
const BASE_META = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
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


// 2.2: دالة Debounce لتأخير عمليات البحث والتصفية (300ms)
function debounce(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

window.$ = $;
window.$$ = $$;
window.fmt = fmt;
window.dur = dur;
window.esc = esc;
window.ico = ico;
window.I = I;
window.toast = toast;
window.cp = cp;
window.theme = theme;
window.debounce = debounce;
window.updatePageSEO = updatePageSEO;
