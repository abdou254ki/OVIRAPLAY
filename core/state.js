// =========================================================
// OVIRA PLAY — APPLICATION STATE (core/state.js)
// =========================================================

const CFG = {
  wa: '213557235850',
  tg: 'oviraplay_bot',
  googleClientId: '79336176422-fohod45r2nvme8st2kdcreb53fh8q426.apps.googleusercontent.com'
};

// المصدر الوحيد للمنتجات هو الكتالوج الحي من الخادم؛ لا منتجات وهمية ولا كاش قديم.
let P = [];
let catalogStatus = 'loading'; // loading | ready | error
let catalogErrorCode = '';
let catalogRequest = null;
let cartAlert = '';
let productReviewSummary = {};
const productReviewsCache = new Map();
let deliveryStats = null;

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

let topupOpen = false, topupAmt = 1000;
const CMP_COL = { 'مفتوحة': '#F59E0B', 'تم الرد': '#16A34A', 'مغلقة': '#64748B' };

let siteNoteItems=[],siteNoteUnread=0,siteMarketingOptIn=false,siteNoteLoaded=false;

let supportChats = [], supportCurrent = '', supportMessages = [], supportBusy = false, supportError = '';
const chatKeyStore = 'ovira_guest_chats_v2';


window.CFG = CFG;
window.COL = COL;
window.pr = pr;
window.pl = pl;
window.clean = clean;
window.save = save;
window.tot = tot;
window.me = me;
window.normPh = normPh;
