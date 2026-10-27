const API_BASE = 'https://ovira-api.onrender.com';
const API_URL = API_BASE + '/api/orders';
const ACC_URL = API_BASE + '/api/account';

const CFG = { wa: '213557235850', tg: 'oviraplay_bot' };
const $ = (s) => document.querySelector(s);
const app = $('#app');

const fmt = (n) => '<bdi>' + Number(n || 0).toLocaleString('en-US') + ' DA</bdi>';
const dur = (m) => (m == 1 ? 'شهر واحد' : m < 11 ? m + ' أشهر' : m + ' شهر');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const ico = (d) => `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const I = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  shop: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  track: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  support: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  back: '<path d="M9 18l6-6-6-6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
};

const P = [
  { id: 'netflix', n: 'Netflix', t: 'نتفلكس بروفايل خاص', cat: 'أفلام ومسلسلات', c: '#E50914', c2: '#5C060C', l: 'N', f: ['شاشة خاصة باسمك', 'رمز PIN سري خاص بك', 'جودة 4K Ultra HD', 'تسليم فوري للبيانات'], pl: [[1, 900], [3, 2700], [6, 4900], [12, 9500, 1]] },
  { id: 'cr-mega', n: 'Crunchyroll', t: 'كرانشي رول Mega Fan', cat: 'أنمي', c: '#F47521', c2: '#8A3A0A', l: 'C', f: ['بدون إعلانات', 'حلقات بعد ساعة من اليابان', 'تحميل للمشاهدة بدون إنترنت', 'تسليم فوري للحساب'], pl: [[1, 600], [3, 1650], [6, 3000], [12, 5500, 1]] },
  { id: 'cr-fan', n: 'Crunchyroll', t: 'كرانشي رول Fan', cat: 'أنمي', c: '#F47521', c2: '#8A3A0A', l: 'C', f: ['مشاهدة بدون إعلانات', 'مكتبة الأنمي كاملة', 'جودة 1080p', 'تسليم فوري للبيانات'], pl: [[1, 500], [3, 1350], [6, 2500], [12, 4500, 1]] },
  { id: 'shahid', n: 'Shahid VIP', t: 'شاهد VIP (باقة شاملة)', cat: 'أفلام ومسلسلات', c: '#005FF9', c2: '#002E8A', l: 'S', f: ['الباقة الرياضية الشاملة', 'شاشة خاصة برقم سري', 'بدون إعلانات', 'تسليم فوري'], pl: [[1, 800], [12, 7500, 1]] },
  { id: 'prime', n: 'Prime Video', t: 'أمازون برايم فيديو', cat: 'أفلام ومسلسلات', c: '#00A8E1', c2: '#005B7F', l: 'P', f: ['شاشة خاصة بك', 'مكتبة أفلام أمازون الحصرية', 'جودة 4K HDR', 'تسليم فوري'], pl: [[1, 600], [6, 3200], [12, 6000, 1]] }
];

const PAY = [
  { id: 'chargily', n: 'Chargily Pay (الذهبية / CIB)', auto: true, desc: 'دفع إلكتروني فوري ومؤمّن 100% عبر البطاقة الذهبية أو CIB (يتم تأكيد طلبك تلقائياً)' },
  { id: 'wallet', n: 'رصيد المحفظة', wallet: true, desc: 'ادفع فوراً من رصيد حسابك في المتجر دون انتظار' },
  { id: 'baridimob', n: 'بريدي موب', k: 'RIP', v: '00799999004244734853' },
  { id: 'binance', n: 'Binance', k: 'Binance ID', v: '732478828' },
  { id: 'redotpay', n: 'Redotpay', k: 'Redotpay ID', v: '1090594184' },
  { id: 'bybit', n: 'Bybit', k: 'Bybit ID', v: '67421194' }
];

const FAQ = [
  ['هل الحسابات رسمية وتعمل بدون انقطاع؟', 'نعم، جميع اشتراكاتنا يتم تفعيلها بطرق رسمية 100% لضمان مشاهدة مستقرة طوال فترة اشتراكك.'],
  ['كيف أستلم بيانات الحساب والشاشة؟', 'تصلك بيانات الحساب واسم الشاشة ورمز PIN تلقائياً على بوت تيليغرام، كما تظهر داخل صفحة (حسابي) وصفحة (تتبع طلبي) في الموقع.'],
  ['كيف يعمل الدفع عبر شارجيلي؟', 'اختر Chargily Pay عند إتمام الطلب، وستنتقل لبوابة الدفع الرسمية لإدخال بيانات البطاقة الذهبية أو CIB، ويتأكد طلبك في ثوانٍ.']
];

const COL = { 'قيد المراجعة': '#F59E0B', 'مؤكد': '#2447C9', 'تم التسليم': '#16A34A', 'ملغي': '#EF4444' };
const pr = (id) => P.find((p) => p.id == id);
const pl = (i) => { const p = pr(i.id); return p && p.pl.find((x) => x[0] == i.m); };
const sv = (p, x) => Math.round((1 - x[1] / (p.pl[0][1] * x[0])) * 100);

let cart = [], sel = 0, cat = 'الكل', payId = 'chargily', msg = '', chargilyMode = 'test';
let custToken = localStorage.getItem('ov_ctk') || '';
let custProfile = null;
let custOrders = [];
let custComplaints = [];
let authTab = 'login';
let ord = { n: '', code: '', ids: [], claimToken: '', paid: false, paymentDetails: null };

try { cart = JSON.parse(localStorage.getItem('oc') || '[]'); } catch (e) {}
if (!Array.isArray(cart)) cart = [];

const clean = () => { cart = cart.filter((i) => i && pl(i) && i.q > 0); };
const save = () => { try { localStorage.setItem('oc', JSON.stringify(cart)); } catch (e) {} };
const tot = () => cart.reduce((s, i) => s + pl(i)[1] * i.q, 0);
const saved = () => cart.reduce((s, i) => s + (pr(i.id).pl[0][1] * pl(i)[0] - pl(i)[1]) * i.q, 0);
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

// جلب إعدادات الدفع وحساب الزبون عند الإقلاع
fetch(API_URL + '/payment-config').then((r) => r.json()).then((d) => {
  if (d && d.chargily) chargilyMode = d.chargily.mode;
}).catch(() => {});

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

// عرض صندوق بيانات الحساب والشاشة المسلمة للزبون
function renderDeliveredBox(da) {
  if (!da || !da.credentials) return '';
  return `
    <div class="ok-box">
      <h4>🔐 بيانات الحساب والشاشة الخاصة بك:</h4>
      <div class="cred-row">
        <span>بيانات الحساب: <code>${esc(da.credentials)}</code></span>
        <button class="cp" onclick="cp('${esc(da.credentials)}')">${ico(I.copy)} نسخ</button>
      </div>
      ${da.profileName ? `
      <div class="cred-row">
        <span>👤 اسم الشاشة: <code>${esc(da.profileName)}</code></span>
        <button class="cp" onclick="cp('${esc(da.profileName)}')">${ico(I.copy)} نسخ</button>
      </div>` : ''}
      ${da.pinCode ? `
      <div class="cred-row">
        <span>🔢 كود الشاشة (PIN): <code>${esc(da.pinCode)}</code></span>
        <button class="cp" onclick="cp('${esc(da.pinCode)}')">${ico(I.copy)} نسخ</button>
      </div>` : ''}
      ${da.extraNote ? `<p style="font-size:12px;color:var(--mut);margin-top:6px">📌 <b>ملاحظة:</b> ${esc(da.extraNote)}</p>` : ''}
    </div>`;
}

// عرض تفاصيل وصل الدفع الإلكتروني
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

const gc = (p) => `<div class="gc"><i class="ic" style="background:${p.c}">${p.l}</i><small>${p.n}</small></div>`;
const card = (p) => {
  const m = Math.max(...p.pl.map((x) => sv(p, x)));
  return `<a class="pc" href="#/p/${p.id}" style="--c:${p.c};--c2:${p.c2}">
    <div class="pv">
      <div class="bds"><span class="bd fl">⚡ فوري</span>${m > 0 ? `<span class="bd sv">وفّر ${m}%</span>` : ''}</div>
      ${gc(p)}
    </div>
    <div class="pi">
      <small>${p.cat}</small>
      <h3>${p.t}</h3>
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
    <div class="chips">${cs.map((c) => `<button class="chip ${c == cat ? 'on' : ''}" onclick="setCat('${c}')">${c}</button>`).join('')}</div>
    <div class="g" style="margin-top:8px">${P.filter((p) => cat == 'الكل' || p.cat == cat).map(card).join('')}</div>
  </div>`;
};

const prod = (p) => {
  const x = p.pl[sel];
  return `<div class="ph" style="--c:${p.c};--c2:${p.c2}">${gc(p)}<h1>${p.t}</h1><p>${p.cat}</p></div>
  <div class="w">
    <h2 class="sh">ما ستحصل عليه</h2>
    <ul class="ft">${p.f.map((f) => `<li><i>✓</i>${f}</li>`).join('')}</ul>
    <h2 class="sh">اختر مدة الاشتراك</h2>
    ${p.pl.map((y, i) => `<button class="pl ${i == sel ? 'on' : ''}" onclick="pickPlan(${i})">${y[2] ? '<span class="tag">الأوفر</span>' : ''}<span class="rd"></span><span class="d">${dur(y[0])}${sv(p, y) > 0 ? `<em>وفّر ${sv(p, y)}%</em>` : ''}</span><b>${fmt(y[1])}</b></button>`).join('')}
  </div>
  <div class="bar">
    <button class="btn o" onclick="add('${p.id}',${x[0]})">أضف للسلة</button>
    <button class="btn" onclick="add('${p.id}',${x[0]},1)">اشترِ الآن · ${fmt(x[1])}</button>
  </div>`;
};

const cartV = () => {
  if (!cart.length) {
    return `<div class="w em"><div>🛒</div><h2>سلتك فارغة</h2><p class="note" style="margin-bottom:18px">اختر اشتراكك المفضل وابدأ المشاهدة اليوم</p><a class="btn" href="#/shop">تصفّح الاشتراكات</a></div>`;
  }
  const sv2 = saved();
  return `<div class="w">
    <h1 class="ttl">سلة التسوق</h1>
    ${cart.map((i, k) => {
      const p = pr(i.id), x = pl(i);
      return `<div class="ci">
        <i class="ic" style="background:${p.c}">${p.l}</i>
        <div class="in">
          <b>${p.t}</b>
          <select class="sel" onchange="chg(${k},+this.value)">${p.pl.map((y) => `<option value="${y[0]}" ${y[0] == i.m ? 'selected' : ''}>${dur(y[0])} — ${y[1]} DA</option>`).join('')}</select>
          <div class="q"><button onclick="qty(${k},-1)">−</button><span>${i.q}</span><button onclick="qty(${k},1)">+</button></div>
        </div>
        <div class="cr"><button onclick="del(${k})">✕</button><b>${fmt(x[1] * i.q)}</b></div>
      </div>`;
    }).join('')}
    <div class="sm">
      <h3>ملخص الطلب</h3>
      <div class="row"><span>عدد الاشتراكات</span><b>${cart.reduce((s, i) => s + i.q, 0)}</b></div>
      ${sv2 > 0 ? `<div class="row" style="color:var(--ok)"><span>توفيرك</span><b>${fmt(sv2)}</b></div>` : ''}
      <hr>
      <div class="tt"><span>الإجمالي</span>${fmt(tot())}</div>
    </div>
    <a class="btn" href="#/checkout">المتابعة لإتمام الطلب</a>
  </div>`;
};

const pbox = () => {
  const m = PAY.find((x) => x.id == payId);
  if (m.auto) {
    return `💳 <b>الدفع التلقائي عبر Chargily Pay</b><p style="margin-top:6px">${m.desc}</p>${chargilyMode === 'test' ? '<span style="display:inline-block;margin-top:6px;background:#F59E0B;color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:800">وضع التجربة مفعل (Test Mode)</span>' : ''}`;
  }
  if (m.wallet) {
    const bal = custProfile ? custProfile.balance || 0 : 0;
    return `💰 <b>الدفع من رصيد المحفظة</b><p style="margin-top:6px">رصيدك المتاح حالياً: <b>${fmt(bal)}</b></p>${!custProfile ? '<p style="color:var(--bad);margin-top:4px">يرجى تسجيل الدخول من تبويب (حسابي) لاستخدام المحفظة.</p>' : ''}`;
  }
  return `حوّل المبلغ إلى ${m.k}:<b class="num">${m.v}</b><button class="cp" onclick="cp('${m.v}')">${ico(I.copy)} نسخ الرقم</button>`;
};

const chk = () => {
  if (!cart.length) return cartV();
  const u = me();
  return `<div class="w">
    <h1 class="ttl">إتمام الطلب</h1>
    <div class="sm">
      ${cart.map((i) => `<div class="row"><span>${pr(i.id).t} · ${dur(pl(i)[0])} × ${i.q}</span><b>${fmt(pl(i)[1] * i.q)}</b></div>`).join('')}
      <hr>
      <div class="tt"><span>الإجمالي المطلوب</span>${fmt(tot())}</div>
    </div>

    <label class="lb" for="fn">الاسم الكامل *</label>
    <input class="in2" id="fn" autocomplete="name" value="${esc(u.n || '')}" placeholder="اكتب اسمك الكامل" required>

    <label class="lb" for="fp">رقم واتساب لاستلام الإشعارات *</label>
    <input class="in2" id="fp" type="tel" value="${esc(u.p || '')}" dir="ltr" placeholder="05XX XX XX XX" required>

    <label class="lb" for="fe">البريد الإلكتروني الشخصي للتواصل والضمان *</label>
    <input class="in2" id="fe" type="email" value="${esc(u.e || '')}" dir="ltr" placeholder="example@gmail.com" required>

    <label class="lb">اختر طريقة الدفع</label>
    <div class="pms">
      ${PAY.map((m) => `<button class="pm ${m.auto ? 'full' : ''} ${m.id == payId ? 'on' : ''}" data-i="${m.id}" onclick="pick('${m.id}')">${m.auto ? '⚡ ' : m.wallet ? '💰 ' : ''}${m.n}</button>`).join('')}
    </div>
    <div class="box" id="pbox">${pbox()}</div>
    <button class="btn" id="submitBtn" onclick="send()">${payId === 'chargily' ? 'الدفع الآن عبر شارجيلي ⚡' : 'تأكيد وإنهاء الطلب'}</button>
  </div>`;
};

const doneV = () => {
  if (!ord.code) return home();
  const showClaim = ord.claimToken && !custProfile;
  return `<div class="w em">
    <div class="okc">✓</div>
    <h2>شكرًا ${esc(ord.n || 'لك')}، استلمنا طلبك 🎉</h2>
    <p class="note" style="font-size:15px;margin:4px 0">رقم طلبك: <b dir="ltr">${esc(ord.code)}</b></p>
    <p class="note" id="paidStatusNote">${ord.paid ? '✅ تم تأكيد دفعك الإلكتروني بنجاح! سيصلك الحساب والشاشة قريباً.' : 'أرسل صورة وصل الدفع عبر بوت تيليغرام لتأكيد طلبك واستلام الحساب والشاشة.'}</p>

    <div id="receiptContainer">${renderPaymentReceiptBox(ord.paymentDetails, ord.totalPrice)}</div>

    ${msg ? `<pre>${esc(msg)}</pre>` : ''}

    ${CFG.tg ? `<a class="btn tg" target="_blank" rel="noopener" href="https://t.me/${CFG.tg}?start=${encodeURIComponent(ord.code)}">📲 متابعة الطلب واستلام الحساب عبر تيليغرام</a>` : ''}
    ${CFG.wa ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${CFG.wa}?text=${encodeURIComponent(msg || ('مرحباً، قمت بإتمام الطلب رقم ' + ord.code))}">💬 مراسلتنا عبر واتساب</a>` : ''}

    ${showClaim ? `
    <div class="sm" id="claimBox" style="text-align:start;margin-top:20px;border:2px solid var(--pri2)">
      <h3 style="color:var(--pri2)">🎁 احفظ طلبك وأنشئ حسابك الآن</h3>
      <p style="font-size:13px;color:var(--mut);margin-bottom:10px">ضع كلمة سر لحسابك لتتمكن من رؤية بيانات الشاشة والـ PIN واستخدام المحفظة مستقبلاً.</p>
      <label class="lb">اختر كلمة سر لحسابك (6 أحرف فأكثر)</label>
      <input class="in2" id="cl_pw" type="password" dir="ltr" placeholder="••••••••">
      <label style="display:flex;gap:8px;font-size:12px;font-weight:700;margin-top:10px;align-items:center">
        <input type="checkbox" id="cl_ok" checked> أوافق على حفظ بياناتي لمتابعة طلباتي
      </label>
      <button class="btn" onclick="claimAccount()">إنشاء حسابي وربط الطلب</button>
    </div>` : ''}

    <a class="btn o" href="#/shop" style="margin-top:14px">العودة للمتجر</a>
  </div>`;
};

// واجهة تتبع الطلب الذكية
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
      </div>
      ${renderPaymentReceiptBox(t.paymentDetails, t.totalPrice)}`;
  } catch (e) {
    $('#tk_res').innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
};

// واجهة حساب الزبون ومحفظته
const accountV = () => {
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
          <input class="in2" id="au_name" placeholder="اسمك الكامل">
          <label class="lb">رقم واتساب *</label>
          <input class="in2" id="au_phone" type="tel" dir="ltr" placeholder="05XX XX XX XX">
          <label class="lb">البريد الإلكتروني الشخصي *</label>
          <input class="in2" id="au_email" type="email" dir="ltr" placeholder="example@gmail.com">
          <label class="lb">كلمة السر (6 أحرف فأكثر) *</label>
          <input class="in2" id="au_pass" type="password" dir="ltr" placeholder="••••••••">
          <button class="btn" onclick="doCustRegister()">إنشاء الحساب الآن</button>
        ` : `
          <label class="lb">رقم الهاتف أو البريد الإلكتروني</label>
          <input class="in2" id="au_id" dir="ltr" placeholder="05XX XX XX XX">
          <label class="lb">كلمة السر</label>
          <input class="in2" id="au_pass" type="password" dir="ltr" placeholder="••••••••">
          <button class="btn" onclick="doCustLogin()">دخول إلى حسابي</button>
        `}
      </div>
    </div>`;
  }

  return `<div class="w">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px">
      <h1 class="ttl" style="margin:0">مرحباً، ${esc(custProfile.name)}</h1>
      <button class="chip" onclick="custLogout()">تسجيل الخروج</button>
    </div>

    <div class="sm" style="background:linear-gradient(135deg,var(--pri),var(--pri2));color:#fff">
      <div style="font-size:13px;opacity:.9">💰 رصيد محفظتك المتاح للشراء الفوري</div>
      <div style="font-size:28px;font-weight:900;margin:4px 0">${fmt(custProfile.balance || 0)}</div>
      <div style="font-size:12px;opacity:.85">📱 ${esc(custProfile.phone)} ${custProfile.email ? '· 📧 ' + esc(custProfile.email) : ''}</div>
    </div>

    <h2 class="sh">📦 طلباتي وحساباتي المسلمة (${custOrders.length})</h2>
    ${custOrders.length ? custOrders.map((o) => `
      <div class="sm">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b dir="ltr">${esc(o.orderCode)}</b>
          <span style="background:${COL[o.status] || '#666'};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:800">${esc(o.status)}</span>
        </div>
        <div style="font-size:12px;color:var(--mut);margin:4px 0">${new Date(o.createdAt).toLocaleString('fr-DZ')} · ${esc(o.paymentMethod)}</div>
        <div style="font-size:14px;font-weight:700;margin:6px 0">${o.items.map((i) => esc(i)).join(' | ')}</div>
        <div class="tt" style="font-size:15px"><span>الإجمالي</span>${fmt(o.totalPrice)}</div>
        ${renderDeliveredBox(o.deliveredAccount)}
      </div>
    `).join('') : '<div class="sm"><p class="note">لا توجد طلبات سابقة بعد.</p></div>'}

    ${custComplaints.length ? `
      <h2 class="sh">🎫 تذاكر الدعم والشكاوى (${custComplaints.length})</h2>
      ${custComplaints.map((c) => `
        <div class="sm">
          <div style="display:flex;justify-content:space-between">
            <b>${esc(c.subject)} (${esc(c.ticketCode)})</b>
            <span style="font-size:12px;font-weight:800;color:var(--pri2)">${esc(c.status)}</span>
          </div>
          <p style="font-size:13px;color:var(--mut);margin-top:6px">${esc(c.message)}</p>
          ${c.adminReply ? `<div class="ok-box" style="margin-top:10px"><h4>💬 رد الإدارة:</h4><p style="font-size:13px;font-weight:700">${esc(c.adminReply)}</p></div>` : ''}
        </div>
      `).join('')}
    ` : ''}
  </div>`;
};

// واجهة الشكاوى والدعم الفني
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
    custToken = d.token;
    localStorage.setItem('ov_ctk', custToken);
    await fetchCustomerProfile();
    toast('مرحباً بك مجدداً ✓');
    draw();
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
    custToken = d.token;
    localStorage.setItem('ov_ctk', custToken);
    try { localStorage.setItem('oi', JSON.stringify({ n: name, p: phone, e: email })); } catch (e) {}
    await fetchCustomerProfile();
    toast(d.message);
    draw();
  } catch (e) {
    toast(e.message);
  }
};

window.custLogout = () => {
  custToken = '';
  custProfile = null;
  custOrders = [];
  custComplaints = [];
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

  if (v === 'done' && queryPart) {
    const params = new URLSearchParams(queryPart);
    const orderFromUrl = params.get('order');
    if (orderFromUrl) {
      ord.code = orderFromUrl;
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

  document.body.className = v == 'p' && pr(h[1]) ? 'pp' : '';
  if (v == 'p' && pr(h[1])) return prod(pr(h[1]));
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

  $('#hd').innerHTML = `
    ${v != 'home' ? `<button class="ib" onclick="back()" aria-label="رجوع">${ico(I.back)}</button>` : ''}
    <a class="logo" href="#/"><i>▶</i>OVIRA <b>PLAY</b></a>
    ${custProfile ? `<a class="wallet-pill" href="#/account">💰 ${fmt(custProfile.balance || 0)}</a>` : ''}
    <button class="ib" onclick="theme()" aria-label="تغيير المظهر">${ico(I.moon)}</button>
    <a class="ib" href="#/cart" aria-label="السلة">${ico(I.cart)}${n ? `<span class="cnt">${n}</span>` : ''}</a>`;

  const tabs = [
    ['home', 'الرئيسية', '/'],
    ['shop', 'المتجر', '/shop'],
    ['track', 'تتبع', '/track'],
    ['account', 'حسابي', '/account'],
    ['support', 'شكوى/دعم', '/support']
  ];
  $('#nv').innerHTML = tabs.map((x) => `<a href="#${x[2]}" class="${x[0] == v ? 'on' : ''}">${ico(I[x[0]])}${x[1]}</a>`).join('');
}

function draw() { clean(); app.innerHTML = view(); chrome(); }
function route() {
  const h = location.hash.slice(2).split('?')[0].split('/');
  if (h[0] == 'p' && pr(h[1])) sel = Math.max(0, pr(h[1]).pl.findIndex((x) => x[2]));
  if (h[0] == 'account' && custToken) fetchCustomerProfile().then(() => { app.innerHTML = view(); chrome(); });
  draw();
  scrollTo(0, 0);
}

function back() { history.length > 1 ? history.back() : (location.hash = '#/'); }
function setCat(c) { cat = c; draw(); }
function pickPlan(i) { sel = i; draw(); }
function add(id, m, go) {
  const e = cart.find((i) => i.id == id && i.m == m);
  if (e) e.q = Math.min(9, e.q + 1);
  else cart.push({ id, m, q: 1 });
  save();
  if (go) location.hash = '#/checkout';
  else { draw(); toast('تمت الإضافة إلى السلة ✓'); }
}
function qty(k, d) { cart[k].q = Math.min(9, Math.max(1, cart[k].q + d)); save(); draw(); }
function del(k) { cart.splice(k, 1); save(); draw(); toast('تم الحذف من السلة'); }
function chg(k, m) { cart[k].m = m; save(); draw(); }
function pick(id) {
  payId = id;
  document.querySelectorAll('.pm').forEach((b) => b.classList.toggle('on', b.dataset.i == id));
  $('#pbox').innerHTML = pbox();
  const sb = $('#submitBtn');
  if (sb) sb.textContent = id === 'chargily' ? 'الدفع الآن عبر شارجيلي ⚡' : 'تأكيد وإنهاء الطلب';
}

async function send() {
  const n = $('#fn').value.trim();
  const ph = normPh($('#fp').value);
  const em = $('#fe').value.trim().toLowerCase();

  if (n.length < 3) { $('#fn').focus(); return toast('اكتب اسمك الكامل'); }
  if (!/^0[567]\d{8}$/.test(ph)) { $('#fp').focus(); return toast('أدخل رقم واتساب جزائري صحيح من 10 أرقام'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $('#fe').focus(); return toast('أدخل بريدك الإلكتروني الشخصي بشكل صحيح'); }

  const pm = PAY.find((x) => x.id == payId);
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
    cartItems: cart.map((i) => ({ id: i.id, m: i.m, q: i.q })),
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

      try { localStorage.setItem('oi', JSON.stringify({ n, p: ph, e: em })); } catch (e) {}

      if (data.checkoutUrl) {
        location.href = data.checkoutUrl;
        return;
      }

      if (custToken) fetchCustomerProfile();
      cart = []; save(); location.hash = '#/done';
    } else {
      toast(data.message || 'حدث خطأ أثناء معالجة الطلب.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'تأكيد وإنهاء الطلب';
    }
  } catch (error) {
    toast('تعذّر الاتصال بالخادم، حاول مجدداً.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'تأكيد وإنهاء الطلب';
  }
}

if (CFG.wa) {
  const f = $('#fab');
  f.href = 'https://wa.me/' + CFG.wa;
}

addEventListener('hashchange', route);
route();
