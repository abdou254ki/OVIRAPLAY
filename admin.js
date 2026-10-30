const API = 'https://ovira-api.onrender.com/api/admin';
let token = localStorage.getItem('adm_tk') || sessionStorage.getItem('adm_tk') || '';
let tab = 'overview', stFilter = '', qFilter = '', compFilter = '';
let orderFrom = '', orderTo = '', productQuery = '';
let activityLimit = 30;
let globalSearch = '';
let panelRequestSerial = 0;
let createAfterLoad = false;
let openComplaintsCount = 0;
let isLoggingIn = false;
let adm2FaPending = null; // { tempToken, method, message }
let adm2FaSetup = null;   // { method, secret, otpauthUrl, message }
let payMethodsState = [];
let ordersPage = 1;
let renewalFilter = 'urgent';
let openProductId = null;

const COL = {
  'قيد المراجعة': '#F59E0B',
  'مؤكد': '#1E40AF',
  'تم التسليم': '#16A34A',
  'ملغي': '#EF4444'
};

const PRESETS = {
  crunchyroll: { brand: 'Crunchyroll', cat: 'أنمي', c1: '#F47521', c2: '#8A3A0A', ic: 'C' },
  netflix: { brand: 'Netflix', cat: 'أفلام ومسلسلات', c1: '#E50914', c2: '#5C060C', ic: 'N' },
  shahid: { brand: 'Shahid VIP', cat: 'أفلام ومسلسلات', c1: '#005FF9', c2: '#002E8A', ic: 'S' },
  prime: { brand: 'Prime Video', cat: 'أفلام ومسلسلات', c1: '#00A8E1', c2: '#005B7F', ic: 'P' },
  youtube: { brand: 'YouTube', cat: 'ترفيه وموسيقى', c1: '#FF0000', c2: '#7A0000', ic: '▶' },
  spotify: { brand: 'Spotify', cat: 'ترفيه وموسيقى', c1: '#1DB954', c2: '#0B5E28', ic: 'S' },
  chatgpt: { brand: 'ChatGPT Plus', cat: 'ذكاء اصطناعي وبرامج', c1: '#10A37F', c2: '#074F3D', ic: 'AI' },
  canva: { brand: 'Canva Pro', cat: 'ذكاء اصطناعي وبرامج', c1: '#7D2AE8', c2: '#3B1078', ic: 'C' },
  gemini: { brand: 'Gemini Pro', cat: 'ذكاء اصطناعي وبرامج', c1: '#4285F4', c2: '#8E44AD', ic: '✦' }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const fmt = (n) => Number(n || 0).toLocaleString('en-US') + ' DA';

let tt;
function toast(msg) {
  const el = document.getElementById('admToast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => el.classList.remove('on'), 2800);
}

function renderLogin(err = '') {
  // إذا كان المدير في خطوة إدخال كود التحقق بخطوتين (2FA)
  if (adm2FaPending) {
    document.getElementById('root').innerHTML = `
      <form class="card login-box" onsubmit="event.preventDefault(); verifyAdmin2FALogin();">
        <div style="font-size:42px;margin-bottom:6px">${adm2FaPending.method === 'telegram' ? '📲' : '🔑'}</div>
        <h1>التحقق بخطوتين (2FA)</h1>
        <p>${esc(adm2FaPending.message)}</p>
        <label class="lbl" for="adm_otp">رمز التحقق (6 أرقام)</label>
        <input class="inp otp-inp" id="adm_otp" type="text" inputmode="numeric" maxlength="6" dir="ltr" placeholder="000000" required autofocus>
        <button class="btn-pri" id="verify2faBtn" type="submit">تأكيد الرمز والدخول</button>
        <button class="btn-sm" type="button" style="width:100%;margin-top:8px" onclick="adm2FaPending=null;document.getElementById('root').innerHTML='';renderLogin();">العودة لتسجيل الدخول</button>
        ${err ? `<div class="err-msg">${esc(err)}</div>` : ''}
      </form>`;
    return;
  }

  const existingErr = document.getElementById('loginErrBox');
  if (existingErr && document.getElementById('em')) {
    existingErr.textContent = err;
    existingErr.style.display = err ? 'block' : 'none';
    return;
  }

  document.getElementById('root').innerHTML = `
    <form class="card login-box" onsubmit="event.preventDefault(); doLogin();">
      <h1>🔒 لوحة الإدارة</h1>
      <p>OVIRA PLAY — تسجيل الدخول المحمي</p>
      <label class="lbl" for="em">البريد الإلكتروني</label>
      <input class="inp" id="em" name="username" type="email" autocomplete="username" dir="ltr" placeholder="admin@oviraplaydz.com" required>
      <label class="lbl" for="pw">كلمة السر</label>
      <input class="inp" id="pw" name="password" type="password" autocomplete="current-password" dir="ltr" placeholder="••••••••" required>
      <button class="btn-pri" id="loginBtn" type="submit">تسجيل الدخول</button>
      <div class="err-msg" id="loginErrBox" style="display:${err ? 'block' : 'none'}">${esc(err)}</div>
    </form>`;
}

async function doLogin() {
  if (isLoggingIn) return;
  const emEl = document.getElementById('em');
  const pwEl = document.getElementById('pw');
  const btn = document.getElementById('loginBtn');

  const email = (emEl ? emEl.value : '').trim();
  const password = (pwEl ? pwEl.value : '').trim();

  if (!email || !password) {
    return renderLogin('أدخل البريد الإلكتروني وكلمة السر.');
  }

  isLoggingIn = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'جاري التحقق والدخول...';
  }
  renderLogin('');

  try {
    const r = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    isLoggingIn = false;

    if (!r.ok || !d.success) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'تسجيل الدخول';
      }
      return renderLogin(d.message || 'بيانات الدخول غير صحيحة.');
    }

    if (d.requires2FA) {
      adm2FaPending = {
        tempToken: d.tempToken,
        method: d.method,
        message: d.message
      };
      document.getElementById('root').innerHTML = '';
      return renderLogin();
    }

    token = d.token;
    localStorage.setItem('adm_tk', token);
    sessionStorage.setItem('adm_tk', token);
    loadPanel();
  } catch (e) {
    isLoggingIn = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'تسجيل الدخول';
    }
    renderLogin('الخادم يستيقظ الآن، اضغط تسجيل الدخول مرة أخرى بعد ثانيتين.');
  }
}

async function verifyAdmin2FALogin() {
  const codeEl = document.getElementById('adm_otp');
  const btn = document.getElementById('verify2faBtn');
  const code = (codeEl ? codeEl.value : '').trim();
  if (code.length !== 6) return renderLogin('أدخل الرمز المكون من 6 أرقام.');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'جاري التحقق...';
  }

  try {
    const r = await fetch(API + '/2fa/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: adm2FaPending.tempToken, code })
    });
    const d = await r.json();
    if (!r.ok || !d.success || !d.token) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'تأكيد الرمز والدخول';
      }
      return renderLogin(d.message || 'رمز التحقق غير صحيح.');
    }

    adm2FaPending = null;
    token = d.token;
    localStorage.setItem('adm_tk', token);
    sessionStorage.setItem('adm_tk', token);
    loadPanel();
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'تأكيد الرمز والدخول';
    }
    renderLogin('تعذّر الاتصال بالخادم، حاول مرة أخرى.');
  }
}

function logout() {
  token = '';
  adm2FaPending = null;
  adm2FaSetup = null;
  localStorage.removeItem('adm_tk');
  sessionStorage.removeItem('adm_tk');
  document.getElementById('root').innerHTML = '';
  renderLogin();
}

async function loadPanel() {
  if (!token) return renderLogin();
  const requestSerial = ++panelRequestSerial;

  let endpoint = '';
  const params = new URLSearchParams();

  if (tab === 'orders' || tab === 'delivered') {
    if (orderFrom) params.set('from', orderFrom);
    if (orderTo) params.set('to', orderTo);
    if (tab === 'delivered') params.set('scope', 'delivered');
    if (stFilter && tab === 'orders') params.set('status', stFilter);
    if (qFilter) params.set('q', qFilter);
    params.set('page', String(ordersPage));
    endpoint = 'orders?' + params.toString();
  } else if (tab === 'overview') {
    endpoint = 'overview';
  } else if (tab === 'activity') {
    endpoint = 'activity?limit=' + activityLimit;
  } else if (tab === 'search') {
    endpoint = 'search?q=' + encodeURIComponent(globalSearch);
  } else if (tab === 'products') {
    endpoint = 'products';
  } else if (tab === 'renewals') {
    endpoint = 'renewals?filter=' + encodeURIComponent(renewalFilter);
  } else if (tab === 'reviews') {
    endpoint = 'reviews';
  } else if (tab === 'payments') {
    endpoint = 'payment-methods';
  } else if (tab === 'complaints') {
    if (compFilter) params.set('status', compFilter);
    endpoint = 'complaints?' + params.toString();
  } else if (tab === 'customers') {
    if (qFilter) params.set('q', qFilter);
    endpoint = 'customers?' + params.toString();
  } else {
    endpoint = 'settings';
  }

  try {
    const r = await fetch(`${API}/${endpoint}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (r.status === 401) return logout();
    const d = await r.json();
    if (requestSerial !== panelRequestSerial) return;
    if (!d.success) {
      return toast(d.message || 'تعذّر جلب البيانات، أعد المحاولة.');
    }
    if (typeof d.openComplaints === 'number') openComplaintsCount = d.openComplaints;
    if (tab === 'payments' && Array.isArray(d.methods)) {
      payMethodsState = d.methods;
      // إعدادات شارجيلي لا تظهر إلا للمالك؛ أبقِ بقية طرق الدفع قابلة للعرض عند تعذرها
      try {
        const sr = await fetch(`${API}/settings`, { headers: { 'Authorization': 'Bearer ' + token } });
        if (sr.ok) {
          const sd = await sr.json();
          if (sd.success) d.chargily = sd.chargily;
        }
      } catch (err) { console.warn('تعذّر تحميل إعدادات Chargily'); }
    }
    if (requestSerial !== panelRequestSerial) return;
    renderMain(d);
  } catch (e) {
    if (requestSerial === panelRequestSerial) toast('جاري إعادة الاتصال بالخادم...');
  }
}

function onProductToggle(node, id) {
  if (!node.open) return;
  openProductId = id;
  document.querySelectorAll('details.compact-product').forEach((other) => { if (other !== node) other.open = false; });
}

window.applyPreset = (key) => {
  const p = PRESETS[key];
  if (!p) return;
  document.getElementById('np_brand').value = p.brand;
  document.getElementById('np_cat').value = p.cat;
  document.getElementById('np_c1').value = p.c1;
  document.getElementById('np_c2').value = p.c2;
  document.getElementById('np_ic').value = p.ic;
};

function renderMain(d) {
  let content = '';

  // لوحة رئيسية: لا توجد أرقام ثابتة، جميع القيم من API بعد المصادقة.
  if (tab === 'overview') {
    const v = d.overview || {};
    const bars = (v.series || []).map((day) => {
      const max = Math.max(1, ...(v.series || []).map((s) => Number(s.value) || 0));
      return `<div class="ov-chart-col" title="${esc(day.day)}: ${fmt(day.value)}"><b>${Number(day.value) ? Math.round(Number(day.value) / 1000) + 'k' : '0'}</b><span style="height:${Math.max(5, (Number(day.value) || 0) / max * 98)}px"></span><small>${esc(day.day.slice(5))}</small></div>`;
    }).join('');
    const tasks = (v.recentOrders || []).map((o) => `<button class="ov-task" onclick="goAdmin('orders','${esc(o.orderCode)}')"><span class="status-dot ${o.status === 'مؤكد' ? 'confirmed' : 'review'}"></span><span><b dir="ltr">${esc(o.orderCode)}</b><small>${esc(o.customerName)} · ${esc(o.status)}</small></span><b>${fmt(o.totalPrice)}</b></button>`).join('');
    content = `<section class="ov-hero"><div><span class="ov-eyebrow">مركز الإدارة · OVIRA PLAY</span><h2>مرحبًا بك 👋</h2><p>نظرة مباشرة على العمليات التي تحتاج اهتمامك، دون أرقام تجريبية.</p></div><button class="btn-sm" onclick="loadPanel()">⟳ تحديث</button></section>
      <div class="ov-kpis">
        <button class="ov-kpi" onclick="goAdmin('orders','', 'قيد المراجعة')"><small>🧾 تنتظر المراجعة</small><strong>${Number(v.review) || 0}</strong><span>عرض الطلبات</span></button>
        <button class="ov-kpi" onclick="goAdmin('orders','', 'مؤكد')"><small>📦 جاهزة للتسليم</small><strong>${Number(v.confirmed) || 0}</strong><span>عرض المؤكدة</span></button>
        <button class="ov-kpi" onclick="goAdmin('delivered')"><small>✅ تم التسليم</small><strong>${Number(v.delivered) || 0}</strong><span>أرشيف مستقل</span></button>
        <button class="ov-kpi" onclick="goAdmin('payments')"><small>💳 مدفوعات إلكترونية اليوم</small><strong>${fmt(v.paidToday)}</strong><span>${Number(v.paidTodayCount) || 0} عملية موثقة</span></button>
        <button class="ov-kpi" onclick="goAdmin('complaints')"><small>🎫 شكاوى مفتوحة</small><strong>${Number(v.complaints) || 0}</strong><span>تحتاج المتابعة</span></button>
        <button class="ov-kpi" onclick="goAdmin('reviews')"><small>⭐ تقييمات للمراجعة</small><strong>${Number(v.pendingReviews) || 0}</strong><span>قبل النشر</span></button>
      </div>
      <div class="card ov-actions"><h3>⚡ إجراءات سريعة</h3><div class="ov-action-grid">
        <button onclick="goAdmin('orders','', 'مؤكد')">🚀 تسليم طلب</button>
        <button onclick="startCreateProduct()">➕ منتج جديد</button>
        <button onclick="goAdmin('renewals')">🔔 التجديدات</button>
        <button onclick="goAdmin('payments')">💳 مراجعة الدفع</button>
        <button onclick="goAdmin('customers')">👥 إدارة الزبائن</button>
        <button onclick="goAdmin('activity')">🛡️ سجل النشاط</button>
      </div></div>
      ${Number(v.riskCount) ? `<div class="card ov-alert"><b>⚠️ ${Number(v.riskCount)} طلبات تحتاج مراجعة مخاطر</b><p>لا تُلغِ طلبًا تلقائيًا بناءً على درجة المخاطر؛ راجع الطلب وطريقة الدفع أولًا.</p><button class="btn-sm" onclick="goAdmin('orders','', 'قيد المراجعة')">عرض الطلبات</button></div>` : ''}
      <div class="card"><h3>📈 المدفوعات الإلكترونية الموثقة — آخر 7 أيام</h3><p class="ov-caption">إجمالي المدفوعات الإلكترونية المسجلة حسب وقت الدفع؛ لا يشمل التحويلات اليدوية غير المؤكدة.</p><div class="ov-chart">${bars}</div></div>
      <div class="card"><h3>📌 طلبات تحتاج معالجة</h3>${tasks || '<p class="ov-empty">لا توجد طلبات بانتظار المعالجة حاليًا 🎉</p>'}</div>
      <div class="card"><h3>🏆 المنتجات الأكثر طلبًا خلال 30 يومًا</h3><p class="ov-caption">عدد الوحدات ضمن الطلبات المؤكدة أو المسلّمة، وليس تقرير أرباح.</p>${(v.topProducts || []).map((item, i) => `<div class="preview-row"><span>${i+1}. ${esc(item._id)}</span><b>${Number(item.quantity) || 0} اشتراك</b></div>`).join('') || '<p class="ov-caption">لا توجد بيانات كافية.</p>'}</div>`;
  }
  else if (tab === 'search') {
    const results = d.results || {};
    const orders = (results.orders || []).map(o => `<button class="ov-task" onclick="goAdmin('${o.status === 'تم التسليم' ? 'delivered' : 'orders'}','${esc(o.orderCode)}')"><span>📦</span><span><b>${esc(o.orderCode)}</b><small>${esc(o.customerName)} · ${esc(o.status)}</small></span><b>${fmt(o.totalPrice)}</b></button>`).join('');
    const customers = (results.customers || []).map(c => `<button class="ov-task" data-customer-key="${esc(c.phone || c.name)}" onclick="goAdmin('customers',this.dataset.customerKey)"><span>👤</span><span><b>${esc(c.name)}</b><small>${esc(c.phone || c.email || '')}</small></span></button>`).join('');
    const products = (results.products || []).map(p => `<button class="ov-task" data-product-title="${esc(p.title)}" onclick="searchProduct(this.dataset.productTitle)"><span>🛍️</span><span><b>${esc(p.title)}</b><small>${esc(p.brandName)}</small></span></button>`).join('');
    content = `<div class="card"><h3>🔍 نتائج البحث عن: ${esc(globalSearch)}</h3><p class="ov-caption">يُظهر حتى 8 نتائج من كل قسم. اضغط على النتيجة لفتح تفاصيلها.</p></div>
      <div class="card"><h3>📦 الطلبات</h3>${orders || '<p class="ov-caption">لا توجد نتائج.</p>'}</div>
      <div class="card"><h3>👥 الزبائن</h3>${customers || '<p class="ov-caption">لا توجد نتائج.</p>'}</div>
      <div class="card"><h3>🛍️ المنتجات</h3>${products || '<p class="ov-caption">لا توجد نتائج.</p>'}</div>`;
  }
  else if (tab === 'activity') {
    content = `<div class="card"><h3>🛡️ سجل نشاط الإدارة</h3><p class="ov-caption">آخر الأحداث المسجلة على الخادم. للمالك فقط، ويحتفظ الخادم بالأحداث وفق إعدادات قاعدة البيانات.</p>
      <div class="chips"><button class="chip ${activityLimit === 30 ? 'on' : ''}" onclick="activityLimit=30;loadPanel()">آخر 30</button><button class="chip ${activityLimit === 80 ? 'on' : ''}" onclick="activityLimit=80;loadPanel()">آخر 80</button></div></div>
      ${(d.events || []).map((e) => `<div class="card activity-row"><b>${esc(e.action)}</b><small>${new Date(e.at).toLocaleString('fr-DZ')}</small><p>${esc(e.summary)}</p><small>المدير: ${Number(e.adminId) || 0} · ${esc(e.entity)}</small></div>`).join('') || '<div class="card">لا توجد أحداث مسجلة.</div>'}`;
  }

  // ==================== 1. تبويب الطلبات وتسليم الشاشات ====================
  else if (tab === 'orders' || tab === 'delivered') {
    const statuses = ['', 'قيد المراجعة', 'مؤكد', 'ملغي'];
    const list = (d.orders || []).map((o) => {
      const pd = o.paymentDetails || {};
      const da = o.deliveredAccount || {};
      return `
      <details class="card compact-order">
        <summary class="order-summary"><span class="badge" style="background:${COL[o.status] || '#666'}">${esc(o.status)}</span><b dir="ltr">${esc(o.orderCode)}</b><span>${esc(o.customerName)}</span><b>${fmt(o.totalPrice)}</b><span class="summary-hint">فتح التفاصيل ▾</span></summary>
        <div class="order-detail"><div class="ord-head">
          <span class="badge" style="background:${COL[o.status] || '#666'}">${esc(o.status)}</span>
          <b style="font-size:17px" dir="ltr">${esc(o.orderCode)} ${o.isPaidOnline ? '⚡' : ''} ${o.telegram ? '📲' : ''}</b>
        </div>
        <div class="meta">🕒 تاريخ الطلب: ${new Date(o.createdAt).toLocaleString('fr-DZ')}</div>

        <div class="cust-box">
          <div>👤 <b>الاسم:</b> ${esc(o.customerName)}</div>
          <div>📱 <b>واتساب:</b> <a href="https://wa.me/213${esc(String(o.whatsappNumber || '').replace(/^0/, ''))}" target="_blank" dir="ltr">${esc(o.whatsappNumber)} 💬</a></div>
          ${o.customerEmail ? `<div>📧 <b>الإيميل الشخصي:</b> <span dir="ltr">${esc(o.customerEmail)}</span></div>` : ''}
        </div>

        <div class="items">
          ${o.cartItems.map((i) => `• ${esc(i.productName)} — ${i.months} شهر ${i.planLabel ? `(${esc(i.planLabel)})` : ''} × ${i.quantity}`).join('<br>')}
        </div>

        <div class="tot-row">
          <span>${fmt(o.totalPrice)}</span>
          <span style="color:var(--mut);font-size:14px">${esc(o.paymentMethod)}</span>
        </div>

        ${o.isPaidOnline && pd.paidAtFormatted ? `
        <div class="chargily-receipt">
          <b class="title">${o.paymentMethod === 'رصيد المحفظة' ? '💰 تفاصيل الخصم من المحفظة:' : '⚡ تفاصيل وصل الدفع الإلكتروني المؤكّد:'}</b>
          <div>• المبلغ المدفوع: <b>${fmt(pd.amountPaid || o.totalPrice)}</b> (${esc(pd.paymentMethodUsed || 'Chargily Pay')})</div>
          <div>• وقت الدفع: <b dir="ltr">${esc(pd.paidAtFormatted)}</b></div>
          <div>• اسم الدافع: ${esc(pd.payerName || o.customerName)} | الإيميل: ${esc(pd.payerEmail || o.customerEmail || '—')}</div>
          ${pd.transactionId ? `<div>• مرجع العملية: <code dir="ltr">${esc(pd.transactionId)}</code></div>` : ''}
        </div>` : ''}

        <details class="deliver-box delivery-wizard"><summary>🔑 تسليم الطلب · افتح النموذج</summary>
          <p class="ov-caption">1. اختر نوع التسليم ← 2. أدخل البيانات ← 3. راجع وأرسل. تُرسل المعلومات إلى صاحب الطلب فقط.</p>
          <label class="lbl">نوع التسليم</label>
          <select class="inp" id="dlv_type_${o._id}" onchange="toggleDeliveryFields('${o._id}')">
            <option value="screen" ${(!da.type || da.type === 'screen') ? 'selected' : ''}>📺 شاشة / بروفايل</option>
            <option value="account" ${da.type === 'account' ? 'selected' : ''}>🔐 حساب كامل</option>
            <option value="invite" ${da.type === 'invite' ? 'selected' : ''}>🔗 رابط تفعيل / دعوة</option>
          </select>
          <div id="dlv_invite_wrap_${o._id}" ${da.type === 'invite' ? '' : 'hidden'}>
            <label class="lbl">رابط التفعيل (https://)</label>
            <input class="inp" id="dlv_invite_${o._id}" dir="ltr" type="url" value="${esc(da.invitationUrl || '')}" placeholder="https://example.com/invite/...">
          </div>
          <div id="dlv_account_wrap_${o._id}" ${da.type === 'invite' ? 'hidden' : ''}>
          <label class="lbl">بيانات الحساب (البريد وكلمة المرور) *</label>
          <input class="inp" id="dlv_cred_${o._id}" dir="ltr" value="${esc(da.credentials || '')}" placeholder="email@domain.com : password123">
          <div class="grid-2">
            <div>
              <label class="lbl">👤 اسم الشاشة (Profile Name)</label>
              <input class="inp" id="dlv_prof_${o._id}" value="${esc(da.profileName || '')}" placeholder="مثال: الشاشة 2 - باسم العميل">
            </div>
            <div>
              <label class="lbl">🔢 كود الشاشة (PIN Code)</label>
              <input class="inp" id="dlv_pin_${o._id}" dir="ltr" value="${esc(da.pinCode || '')}" placeholder="مثال: 4455">
            </div>
          </div>
          </div>
          <label class="lbl">📌 ملاحظة أو تعليمات إضافية للزبون (اختياري)</label>
          <input class="inp" id="dlv_note_${o._id}" value="${esc(da.extraNote || '')}" placeholder="مثال: ممنوع تغيير كلمة السر أو الدخول لشاشة أخرى">
          <button class="btn-sm" onclick="previewDelivery('${o._id}')">👁️ مراجعة بيانات التسليم</button>
          <button class="btn-ok" onclick="deliverAccount('${o._id}')">🚀 تأكيد إرسال التسليم</button>
          <details style="margin-top:12px"><summary>🔐 إرسال رمز مصادقة مؤقت عند الحاجة</summary>
            <p class="meta">يرسل مباشرة إلى Telegram المرتبط بالزبون، ولا يتم حفظ الرمز في قاعدة البيانات.</p>
            <input class="inp" type="text" id="tempcode_${o._id}" autocomplete="off" placeholder="رمز لمرة واحدة" dir="ltr" maxlength="12">
            <button class="btn-sm" onclick="sendTemporaryCode('${o._id}')">📲 إرسال الرمز للزبون</button>
          </details>
        </details>

        <div class="note-row">
          <button class="btn-sm" onclick="copyOrderSummary('${o._id}','${esc(o.orderCode)}')">📋 نسخ رمز الطلب</button>
          <button class="btn-sm" onclick="saveNote('${o._id}')">حفظ الملاحظة</button>
          <input class="inp" id="nt_${o._id}" value="${esc(o.adminNote || '')}" placeholder="ملاحظة إدارية داخلية..." style="padding:8px 12px">
        </div>

        <div class="actions">
          <button class="act-btn ok" onclick="upStatus('${o._id}','تم التسليم')">تم التسليم</button>
          <button class="act-btn pri" onclick="upStatus('${o._id}','مؤكد')">مؤكد</button>
          <button class="act-btn warn" onclick="upStatus('${o._id}','قيد المراجعة')">مراجعة</button>
          <button class="act-btn bad" onclick="upStatus('${o._id}','ملغي')">ملغي</button>
        </div>
        <button class="btn-sm" style="margin-top:8px;color:var(--bad);width:100%" onclick="delOrder('${o._id}')">🗑️ حذف الطلب نهائياً</button>
      </div></details>`;
    }).join('');

    content = `
      <div class="chips">
        ${tab === 'orders' ? statuses.map((s) => `<button class="chip ${stFilter === s ? 'on' : ''}" onclick="stFilter='${s}';ordersPage=1;loadPanel()">${s || 'كل الطلبات'}</button>`).join('') : '<span class="chip on">✅ سجل الطلبات المسلّمة</span>'}
      </div>
      <form class="search-row" onsubmit="event.preventDefault();qFilter=this.querySelector('input[name=q]').value;ordersPage=1;loadPanel()">
        <input class="inp" name="q" aria-label="البحث عن طلب" placeholder="الاسم، الهاتف، البريد أو رمز الطلب" value="${esc(qFilter)}">
        <button class="btn-sm" type="submit">🔍 بحث</button>
      </form>
      <details class="card ov-filter"><summary>⚙️ تصفية حسب تاريخ الطلب</summary><div class="grid-2"><div><label class="lbl">من تاريخ</label><input class="inp" id="orderFrom" type="date" value="${esc(orderFrom)}"></div><div><label class="lbl">إلى تاريخ</label><input class="inp" id="orderTo" type="date" value="${esc(orderTo)}"></div></div><div class="grid-2"><button class="btn-pri" onclick="applyOrderDates()">تطبيق التصفية</button><button class="btn-sm" onclick="orderFrom='';orderTo='';ordersPage=1;loadPanel()">مسح التواريخ</button></div></details>
      <div class="card pager">
        <span>عدد الطلبات: <b>${Number(d.total) || 0}</b> — الصفحة ${d.page || 1} من ${d.pages || 1}</span>
        <div class="pager-actions">
          <button class="btn-sm" ${ordersPage <= 1 ? 'disabled' : ''} onclick="ordersPage=Math.max(1,ordersPage-1);loadPanel()">السابق</button>
          <button class="btn-sm" ${ordersPage >= (d.pages || 1) ? 'disabled' : ''} onclick="ordersPage++;loadPanel()">التالي</button>
        </div>
      </div>
      ${list || '<div class="card" style="text-align:center">لا توجد طلبات مطابقة حالياً</div>'}`;
  }

  // ==================== 2. تبويب بطاقات العرض وصفحات الهبوط ====================
  else if (tab === 'products') {
    const pList = (d.products || []).map((p) => {
      const plansStr = (p.plans || []).map((pl) => `${pl.months}:${pl.price}${pl.best ? '*' : ''}${pl.label ? '|' + pl.label : ''}`).join(', ');
      const featsStr = (p.features || []).join('\n');
      const stepsStr = (p.steps || []).map((s) => `${s.title} | ${s.desc}`).join('\n');
      return `
      <details class="card compact-product product-card" data-search="${esc((p.title + ' ' + p.brandName + ' ' + p.category).toLowerCase())}" ${openProductId === String(p._id) ? 'open' : ''} ontoggle="onProductToggle(this,'${p._id}')">
        <summary class="product-summary"><b>${esc(p.title)}</b><small>${esc(p.brandName)} · ${(p.plans || []).length} باقات</small><span class="badge" style="background:${p.active ? '#16A34A' : '#EF4444'}">${p.active ? 'منشورة' : 'مخفية'}</span><span>تعديل ▾</span></summary>
        <div class="product-detail"><div class="ord-head">
          <span class="badge" style="background:${p.active ? '#16A34A' : '#EF4444'}">${p.active ? '🟢 معروضة في الموقع' : '🔴 مخفية'}</span>
          <b dir="ltr">#/p/${esc(p.productId)}</b>
        </div>
        <div class="grid-2" style="margin-top:8px">
          <div>
            <label class="lbl">العلامة التجارية (مثل Crunchyroll)</label>
            <input class="inp" id="pr_br_${p._id}" value="${esc(p.brandName)}">
          </div>
          <div>
            <label class="lbl">عنوان البطاقة وصفحة الهبوط</label>
            <input class="inp" id="pr_tl_${p._id}" value="${esc(p.title)}">
          </div>
          <div>
            <label class="lbl">القسم / التصنيف</label>
            <input class="inp" id="pr_cat_${p._id}" value="${esc(p.category)}">
          </div>
          <div>
            <label class="lbl">نص الشارة العلوية</label>
            <input class="inp" id="pr_bdg_${p._id}" value="${esc(p.badgeText || '⚡ فوري')}">
          </div>
        </div>
        <label class="lbl">الوصف التفصيلي تحت العنوان في صفحة الهبوط</label>
        <input class="inp" id="pr_sub_${p._id}" value="${esc(p.subtitle || '')}">
        <div class="grid-2">
          <div>
            <label class="lbl">اللون الأساسي (Hex)</label>
            <input class="inp" id="pr_c1_${p._id}" dir="ltr" value="${esc(p.primaryColor)}">
          </div>
          <div>
            <label class="lbl">اللون الثانوي (Hex)</label>
            <input class="inp" id="pr_c2_${p._id}" dir="ltr" value="${esc(p.secondaryColor)}">
          </div>
          <div>
            <label class="lbl">حرف/أيقونة البطاقة</label>
            <input class="inp" id="pr_ic_${p._id}" value="${esc(p.iconText)}">
          </div>
          <div>
            <label class="lbl">رابط صورة مخصصة (اختياري)</label>
            <input class="inp" id="pr_img_${p._id}" dir="ltr" value="${esc(p.imageUrl || '')}" placeholder="https://...">
          </div>
        </div>
        <label class="lbl">الباقات والأسعار (الأشهر:السعر*|وصف الباقة، مثال 1:1500|حساب خاص)</label>
        <input type="hidden" id="pr_pl_${p._id}" value="${esc(plansStr)}">
        <div class="plan-editor" data-plan-target="pr_pl_${p._id}"></div>
        <details class="advanced-plan"><summary>⚙️ عرض أو تعديل الصيغة اليدوية (اختياري)</summary><textarea class="inp" dir="ltr" oninput="planRawChanged('pr_pl_${p._id}',this.value)">${esc(plansStr)}</textarea></details>
        <label class="lbl">مميزات صفحة الهبوط (كل ميزة في سطر)</label>
        <textarea class="inp" id="pr_ft_${p._id}">${esc(featsStr)}</textarea>
        <label class="lbl">خطوات الطلب في صفحة الهبوط (العنوان | الشرح)</label>
        <textarea class="inp" id="pr_st_${p._id}">${esc(stepsStr)}</textarea>
        <div class="grid-2" style="margin-top:10px">
          <button class="btn-ok" style="margin:0" onclick="updateProduct('${p._id}')">💾 حفظ التعديلات</button>
          <button class="btn-sm" onclick="toggleProduct('${p._id}', ${!p.active})">${p.active ? '🙈 إخفاء من الموقع' : '👁️ إظهار في الموقع'}</button>
        </div>
        <div class="grid-2"><button class="btn-sm" onclick="previewProduct('${p._id}')">👁️ معاينة المنتج</button><button class="btn-sm" onclick="loadProductRevisions('${p._id}')">🕘 سجل التعديلات / استعادة</button></div>
        <div id="pr_preview_${p._id}" class="product-preview" hidden></div>
        <div id="pr_hist_${p._id}" class="product-history" hidden></div>
        <button class="btn-bad" onclick="deleteProduct('${p._id}')">🗑️ حذف البطاقة نهائياً</button>
      </div></details>`;
    }).join('');

    content = `
      <div class="card"><h3>🛍️ إدارة المنتجات بسهولة</h3><p class="ov-caption">اضغط على بطاقة لتعديلها. يمكن إدخال الباقات من حقول منفصلة دون رموز خاصة.</p><input class="inp" id="productSearch" placeholder="ابحث عن منتج أو علامة تجارية" value="${esc(productQuery)}" oninput="filterProducts(this.value)"></div>
      <details class="card compact-product" id="createProductBlock" style="border:2px solid var(--pri2)">
        <summary class="product-summary"><b>➕ إنشاء منتج جديد</b><span>فتح النموذج ▾</span></summary>
        <div class="product-detail"><h3>إنشاء بطاقة عرض وصفحة هبوط كاملة جديدة</h3>
        <p style="font-size:12px;color:var(--mut);margin:6px 0">اختر قالباً جاهزاً لتعبئة الألوان والتصميم تلقائياً (أو خصصه كما تشاء):</p>
        <div class="chips">
          <button class="chip" onclick="applyPreset('crunchyroll')">🟠 Crunchyroll</button>
          <button class="chip" onclick="applyPreset('netflix')">🔴 Netflix</button>
          <button class="chip" onclick="applyPreset('shahid')">🔵 Shahid VIP</button>
          <button class="chip" onclick="applyPreset('prime')">💠 Prime Video</button>
          <button class="chip" onclick="applyPreset('youtube')">▶️ YouTube</button>
          <button class="chip" onclick="applyPreset('spotify')">🟢 Spotify</button>
          <button class="chip" onclick="applyPreset('chatgpt')">🤖 ChatGPT</button>
          <button class="chip" onclick="applyPreset('canva')">🟣 Canva Pro</button>
          <button class="chip" onclick="applyPreset('gemini')">✨ Gemini Pro</button>
        </div>
        <div class="grid-2">
          <div>
            <label class="lbl">اسم العلامة (مثل Crunchyroll) *</label>
            <input class="inp" id="np_brand" placeholder="Crunchyroll">
          </div>
          <div>
            <label class="lbl">عنوان البطاقة وصفحة الهبوط *</label>
            <input class="inp" id="np_title" placeholder="كرانشي رول حساب كامل">
          </div>
          <div>
            <label class="lbl">القسم / التصنيف</label>
            <input class="inp" id="np_cat" value="أنمي">
          </div>
          <div>
            <label class="lbl">الشارة العلوية</label>
            <input class="inp" id="np_bdg" value="⚡ فوري">
          </div>
          <div>
            <label class="lbl">اللون الأساسي</label>
            <input class="inp" id="np_c1" dir="ltr" value="#F47521">
          </div>
          <div>
            <label class="lbl">اللون الثانوي</label>
            <input class="inp" id="np_c2" dir="ltr" value="#8A3A0A">
          </div>
          <div>
            <label class="lbl">حرف/رمز الأيقونة</label>
            <input class="inp" id="np_ic" value="C">
          </div>
          <div>
            <label class="lbl">رابط صورة مخصصة (اختياري)</label>
            <input class="inp" id="np_img" dir="ltr" placeholder="https://...">
          </div>
        </div>
        <label class="lbl">الوصف التفصيلي تحت العنوان في صفحة الهبوط</label>
        <input class="inp" id="np_sub" placeholder="وصف دقيق للمنتج دون وعود غير مؤكدة">
        <button class="btn-sm" onclick="suggestProductDescription()">✨ اقتراح وصف أولي قابل للتعديل</button>
        <label class="lbl">الباقات والأسعار * (مثال: 1:1500|مشترك, 1:5000*|حساب خاص)</label>
        <input type="hidden" id="np_plans" value="1:600">
        <div class="plan-editor" data-plan-target="np_plans"></div>
        <details class="advanced-plan"><summary>⚙️ الصيغة اليدوية (اختياري)</summary><textarea class="inp" dir="ltr" oninput="planRawChanged('np_plans',this.value)">1:600</textarea></details>
        <label class="lbl">مميزات صفحة الهبوط (كل ميزة في سطر)</label>
        <textarea class="inp" id="np_feats" placeholder="بدون إعلانات نهائياً&#10;شاشة خاصة مقفلة برمز PIN&#10;تسليم فوري للبيانات"></textarea>
        <button class="btn-pri" onclick="createProduct()">🚀 نشر البطاقة وصفحة الهبوط في الموقع</button>
      </div></details>
      ${pList}`;
  }

  // ==================== تقييمات الزبائن ====================
  else if (tab === 'reviews') {
    content = `<div class="card"><h3>⭐ تقييمات حقيقية بعد التسليم</h3><p>تظهر للزوار فقط بعد موافقة الإدارة؛ لا يظهر هاتف أو بريد الزبون.</p></div>` +
      (d.reviews || []).map((r) => `<details class="card compact-product"><summary class="product-summary"><b>${esc(r.displayName)}</b><span>${'⭐'.repeat(r.stars)} · ${esc(r.productId)}</span><span>${r.approved ? '✅ منشور' : '⏳ للمراجعة'}</span></summary><div class="product-detail"><p>${esc(r.comment)}</p><button class="btn-sm" onclick="moderateReview('${r._id}',${!r.approved})">${r.approved ? 'إخفاء التقييم' : 'نشر التقييم'}</button></div></details>`).join('');
  }

  // ==================== 2.5 الاشتراكات والتجديدات ====================
  else if (tab === 'renewals') {
    const c = d.counts || {};
    const renewals = (d.renewals || []).map((r) => `
      <div class="card renewal-card">
        <div class="ord-head">
          <span class="badge" style="background:${r.renewalStatus === 'expired' ? 'var(--bad)' : r.renewalStatus === 'expiring_soon' ? 'var(--warn)' : 'var(--ok)'}">
            ${r.renewalStatus === 'expired' ? 'انتهى الاشتراك' : r.renewalStatus === 'expiring_soon' ? 'قريب الانتهاء' : 'نشط'}
          </span>
          <b dir="ltr">${esc(r.orderCode)}</b>
        </div>
        <div>👤 <b>${esc(r.customerName)}</b> — 📱 <span dir="ltr">${esc(r.whatsappNumber)}</span></div>
        <div>🎬 ${esc(r.itemsSummary)}</div>
        ${r.profileName ? `<div>🖥️ الشاشة: ${esc(r.profileName)}</div>` : ''}
        <div>📅 تاريخ الانتهاء: <b>${new Date(r.expiresAt).toLocaleDateString('fr-DZ')}</b></div>
        <div>⏳ الأيام المتبقية: <b>${Number(r.daysLeft)}</b></div>
        <div class="grid-2">
          <a class="btn-pri link-btn" href="${esc(r.waRemindUrl)}" target="_blank" rel="noopener noreferrer">💬 تذكير عبر واتساب</a>
          <button class="btn-pri" ${r.telegramLinked ? '' : 'disabled'} onclick="remindRenewal('${r._id}')">📲 إرسال عبر تيليغرام</button>
        </div>
      </div>`).join('');
    content = `
      <div class="card renewal-stats">
        <h3>🔔 إدارة الاشتراكات والتجديدات</h3>
        <div class="renewal-counts"><span>انتهت: ${c.expired || 0}</span><span>قريبة: ${c.expiringSoon || 0}</span><span>نشطة: ${c.active || 0}</span></div>
        <p>التذكير التلقائي مخصص للاشتراكات المرتبطة بتليغرام. باقي العملاء يمكن مراسلتهم عبر واتساب.</p>
      </div>
      <div class="chips">
        ${[['urgent','العاجلة'],['expired','المنتهية'],['expiring_soon','القريبة'],['active','النشطة'],['all','الكل']].map(([k, v]) => `<button class="chip ${renewalFilter === k ? 'on' : ''}" onclick="renewalFilter='${k}';loadPanel()">${v}</button>`).join('')}
      </div>
      ${renewals || '<div class="card">لا توجد اشتراكات مطابقة للفلتر حاليًا.</div>'}`;
  }

  // ==================== 3. تبويب طرق الدفع (الخطوة 2) ====================
  else if (tab === 'payments') {
    const ch = d.chargily || {};
    const methodsHtml = (payMethodsState || []).map((m, idx) => {
      const stateBadge = m.visible
        ? '<span class="vis-state ok">🟢 ظاهرة للعملاء</span>'
        : !m.enabled
        ? '<span class="vis-state off">⚪ معطّلة (مخفية)</span>'
        : `<span class="vis-state warn">⚠️ مفعّلة لكن مخفية: ${esc(m.hiddenReason || '')}</span>`;

      const isManual = m.type === 'manual';
      return `
      <div class="card pm-card ${m.enabled ? 'enabled' : ''}">
        <div class="pm-head">
          <div class="pm-title">
            <span>${m.type === 'auto' ? '⚡' : m.type === 'wallet' ? '💰' : '🏦'} ${esc(m.name)}</span>
            ${stateBadge}
          </div>
          <label class="pm-toggle">
            <input type="checkbox" id="pm_en_${idx}" ${m.enabled ? 'checked' : ''}>
            <span>تفعيل للزبائن</span>
          </label>
        </div>

        ${isManual ? `
          <div class="grid-2">
            <div>
              <label class="lbl">تسمية المعرّف (مثل RIP أو Binance ID)</label>
              <input class="inp" id="pm_lbl_${idx}" value="${esc(m.label || '')}" placeholder="مثال: RIP">
            </div>
            <div>
              <label class="lbl">رقم الحساب / المعرّف الذي ينسخه الزبون *</label>
              <input class="inp" id="pm_val_${idx}" dir="ltr" value="${esc(m.value || '')}" placeholder="00799999...">
            </div>
          </div>
        ` : ''}

        <label class="lbl">ملاحظة أو تعليمات تظهر للزبون عند اختيار هذه الطريقة (اختياري)</label>
        <input class="inp" id="pm_note_${idx}" value="${esc(m.note || '')}" placeholder="مثال: أرسل صورة الوصل في البوت بعد التحويل">
      </div>`;
    }).join('');

    content = `
      <div class="card" style="background:rgba(30,64,175,.06);border-color:rgba(30,64,175,.25)">
        <h3>💳 التحكم بطرق الدفع الظاهرة في المتجر</h3>
        <p style="font-size:13px;color:var(--mut);margin-top:4px">أي طريقة توقف تفعيلها هنا تختفي فوراً من صفحة إتمام الطلب عند الزبائن، ويرفض الخادم أي طلب بها.</p>
      </div>
      ${methodsHtml}
      <button class="btn-pri" onclick="savePaymentMethodsAll()">💾 حفظ جميع إعدادات طرق الدفع</button>
      ${d.chargily ? `      <div class="card">
        <h3>⚡ إعدادات الدفع التلقائي (Chargily Pay V2)</h3>
        <label class="lbl">وضع التشغيل الحالي</label>
        <select class="inp" id="ch_mode">
          <option value="test" ${ch.mode === 'test' ? 'selected' : ''}>🧪 وضع التجربة (Test Mode)</option>
          <option value="live" ${ch.mode === 'live' ? 'selected' : ''}>🟢 الوضع الحقيقي (Live Mode)</option>
        </select>

        <label class="lbl">رابط الـ Webhook (انسخه وضعه في لوحة شارجيلي)</label>
        <input class="inp" dir="ltr" readonly value="${esc(ch.webhookUrl || '')}" onclick="this.select()">

        <hr style="margin:16px 0;border:0;border-top:1px solid var(--line)">
        <h4>🧪 مفاتيح وضع التجربة (Test Keys)</h4>
        <label class="lbl">المفتاح العام التجريبي (Test Public Key)</label>
        <input class="inp" id="ch_tpk" dir="ltr" value="${esc(ch.testPublicKey || '')}">
        <label class="lbl">المفتاح السري التجريبي (Test Secret Key)</label>
        <input class="inp" id="ch_tsk" dir="ltr" type="password" autocomplete="new-password" placeholder="اتركه فارغاً للاحتفاظ بالمفتاح الحالي">

        <hr style="margin:16px 0;border:0;border-top:1px solid var(--line)">
        <h4>🟢 مفاتيح الوضع الحقيقي (Live Keys)</h4>
        <label class="lbl">المفتاح العام الحقيقي (Live Public Key)</label>
        <input class="inp" id="ch_lpk" dir="ltr" value="${esc(ch.livePublicKey || '')}" placeholder="live_pk_...">
        <label class="lbl">المفتاح السري الحقيقي (Live Secret Key)</label>
        <input class="inp" id="ch_lsk" dir="ltr" type="password" autocomplete="new-password" placeholder="اتركه فارغاً للاحتفاظ بالمفتاح الحالي">

        <button class="btn-pri" onclick="saveChargily()">💾 حفظ إعدادات ومفاتيح شارجيلي</button>
      </div>` : `<div class="card"><b>🔐 إعدادات Chargily</b><p>غير متاحة لهذا الحساب أو تحتاج صلاحية المالك.</p></div>`}`;
  }

  // ==================== 4. تبويب شكاوى الزبائن ====================
  else if (tab === 'complaints') {
    const cStatuses = ['', 'مفتوحة', 'تم الرد', 'مغلقة'];
    const cList = (d.complaints || []).map((c) => `
      <div class="card">
        <div class="ord-head">
          <span class="badge" style="background:${c.status === 'مفتوحة' ? '#EF4444' : c.status === 'تم الرد' ? '#16A34A' : '#66708A'}">${esc(c.status)}</span>
          <b dir="ltr">${esc(c.ticketCode)} ${c.orderCode ? `· الطلب: ${esc(c.orderCode)}` : ''}</b>
        </div>
        <div class="meta">🕒 ${new Date(c.createdAt).toLocaleString('fr-DZ')}</div>
        <div class="cust-box">
          <div>👤 <b>العميل:</b> ${esc(c.customerName)}</div>
          <div>📱 <b>واتساب:</b> <a href="https://wa.me/213${esc(String(c.whatsappNumber || '').replace(/^0/, ''))}" target="_blank" dir="ltr">${esc(c.whatsappNumber)} 💬</a></div>
          ${c.customerEmail ? `<div>📧 <b>الإيميل:</b> ${esc(c.customerEmail)}</div>` : ''}
        </div>
        <div class="items">
          <div style="color:var(--pri2);margin-bottom:4px">📌 الموضوع: ${esc(c.subject)}</div>
          <div style="font-weight:600">${esc(c.message)}</div>
        </div>
        <label class="lbl">💬 رد الإدارة (يصل للزبون في تيليغرام وفي حسابه بالموقع)</label>
        <div class="chips"><button class="chip" onclick="setComplaintTemplate('${c._id}','progress')">⏳ جارٍ العمل</button><button class="chip" onclick="setComplaintTemplate('${c._id}','details')">📋 طلب تفاصيل</button><button class="chip" onclick="setComplaintTemplate('${c._id}','solved')">✅ تم الحل</button></div>
        <textarea class="inp" id="crep_${c._id}" placeholder="اكتب ردك لحل مشكلة العميل...">${esc(c.adminReply || '')}</textarea>
        <div class="grid-2" style="margin-top:8px">
          <button class="btn-pri" style="margin:0" onclick="replyComplaint('${c._id}','تم الرد')">إرسال الرد للعميل</button>
          <button class="btn-sm" onclick="replyComplaint('${c._id}','مغلقة')">🔒 إغلاق التذكرة</button>
        </div>
      </div>`).join('');

    content = `
      <div class="chips">
        ${cStatuses.map((s) => `<button class="chip ${compFilter === s ? 'on' : ''}" onclick="compFilter='${s}';loadPanel()">${s || 'كل الشكاوى'}</button>`).join('')}
      </div>
      ${cList || '<div class="card" style="text-align:center">لا توجد شكاوى أو تذاكر دعم حالياً</div>'}`;
  }

  // ==================== 5. تبويب الزبائن وإدارة أرصدتهم ====================
  else if (tab === 'customers') {
    const custList = (d.customers || []).map((c) => `
      <details class="card compact-product customer-card"><summary class="product-summary"><b>${esc(c.name)}</b><span>💰 ${fmt(c.balance || 0)}</span><span>${c.blocked ? '🚫 محظور' : c.twoFactorEnabled ? '🔐 محمي' : 'فتح التفاصيل ▾'}</span></summary>
        <div class="product-detail"><div class="ord-head">
          <div>
            <b style="font-size:16px">${esc(c.name)}</b>
            ${c.blocked ? '<span class="badge" style="background:var(--bad);margin-right:6px">محظور</span>' : ''}
            ${c.twoFactorEnabled ? '<span class="badge" style="background:var(--ok);margin-right:6px">🔐 2FA</span>' : ''}
          </div>
          <span class="wallet-badge">💰 الرصيد: ${fmt(c.balance || 0)}</span>
        </div>
        <div class="cust-box">
          <div>📱 <b>الهاتف:</b> ${c.phone ? `<a href="https://wa.me/213${esc(String(c.phone || '').replace(/^0/, ''))}" target="_blank" dir="ltr">${esc(c.phone)}</a>` : 'غير مضاف'}</div>
          <div>📧 <b>الإيميل:</b> <span dir="ltr">${esc(c.email || 'غير محدد')}</span></div>
          <div>📦 <b>عدد الطلبات:</b> ${c.ordersCount || 0} طلب · <b>إجمالي المشتريات:</b> ${fmt(c.totalSpent || 0)}</div>
        </div>

        <div class="grid-2" style="margin-top:10px">
          <div>
            <label class="lbl">💰 تحديد الرصيد الجديد (DA)</label>
            <div style="display:flex;gap:6px">
              <input class="inp" id="bal_${c._id}" type="number" dir="ltr" value="${c.balance || 0}">
              <button class="btn-sm" style="background:var(--ok);color:#fff" onclick="setCustBalance('${c._id}')">حفظ الرصيد</button>
            </div>
          </div>
          <div>
            <label class="lbl">🔑 تعيين كلمة سر جديدة للزبون</label>
            <div style="display:flex;gap:6px">
              <input class="inp" id="cpw_${c._id}" type="password" dir="ltr" placeholder="6 أحرف فأكثر">
              <button class="btn-sm" onclick="setCustPass('${c._id}')">تحديث</button>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn-sm" onclick="addQuickBalance('${c._id}', 500)">+500 DA</button>
          <button class="btn-sm" onclick="addQuickBalance('${c._id}', 1000)">+1000 DA</button>
          <button class="btn-sm" onclick="addQuickBalance('${c._id}', -500)">-500 DA</button>
          <button class="btn-sm" style="margin-inline-start:auto;color:${c.blocked ? 'var(--ok)' : 'var(--bad)'}" onclick="toggleBlockCust('${c._id}', ${!c.blocked})">
            ${c.blocked ? '✅ فك الحظر' : '🚫 حظر الحساب'}
          </button>
        </div>
      </div></details>`).join('');

    content = `
      <div class="card">
        <h3>➕ إضافة حساب زبون جديد / شحن رصيد ابتدائي</h3>
        <div class="grid-2">
          <div>
            <label class="lbl">الاسم الكامل *</label>
            <input class="inp" id="nc_name" placeholder="اسم الزبون">
          </div>
          <div>
            <label class="lbl">رقم الهاتف *</label>
            <input class="inp" id="nc_phone" dir="ltr" placeholder="05XX XX XX XX">
          </div>
          <div>
            <label class="lbl">البريد الإلكتروني</label>
            <input class="inp" id="nc_email" dir="ltr" placeholder="client@gmail.com">
          </div>
          <div>
            <label class="lbl">الرصيد الابتدائي (DA)</label>
            <input class="inp" id="nc_bal" type="number" dir="ltr" value="0">
          </div>
        </div>
        <label class="lbl">كلمة سر الحساب (6 أحرف فأكثر)</label>
        <input class="inp" id="nc_pass" dir="ltr" placeholder="••••••••">
        <button class="btn-pri" onclick="createCustomer()">إضافة الزبون وحفظ الرصيد</button>
      </div>

      <div class="search-row">
        <input class="inp" placeholder="ابحث عن زبون بالاسم أو الهاتف أو الإيميل..." value="${esc(qFilter)}" onchange="qFilter=this.value;loadPanel()">
        <button class="btn-sm" onclick="loadPanel()">بحث</button>
      </div>
      ${custList || '<div class="card" style="text-align:center">لا يوجد زبائن مسجلون حالياً</div>'}`;
  }

  // ==================== 6. تبويب الإعدادات والتحقق بخطوتين (2FA) وشارجيلي ====================
  else if (tab === 'settings') {
    const ch = d.chargily || {};
    const sec = d.adminSecurity || {};
    const is2FA = !!sec.twoFactorEnabled;
    const methodText = sec.twoFactorMethod === 'telegram' ? 'عبر بوت تيليغرام 📲' : 'عبر Google Authenticator 🔑';

    content = `
      <div class="card" style="border:2px solid var(--pri2)">
        <div class="ord-head">
          <h3>🔐 التحقق بخطوتين (2FA) للوحة الإدارة</h3>
          <span class="badge" style="background:${is2FA ? 'var(--ok)' : '#64748B'}">${is2FA ? `🟢 مفعّل (${methodText})` : '⚪ غير مفعّل (اختياري)'}</span>
        </div>
        <p style="font-size:13px;color:var(--mut);margin:6px 0">أضف طبقة حماية إضافية عند دخولك للوحة التحكم عبر كود يصلك في بوت تيليغرام أو عبر تطبيق Google Authenticator.</p>

        ${is2FA ? `
          <button class="btn-bad" onclick="disableAdmin2FA()">🔓 إيقاف التحقق بخطوتين للوحة التحكم</button>
        ` : `
          <div class="grid-2" style="margin-top:10px">
            <button class="btn-pri" style="margin:0;background:#229ED9" onclick="startAdmin2FASetup('telegram')">📲 تفعيل عبر بوت تيليغرام</button>
            <button class="btn-pri" style="margin:0" onclick="startAdmin2FASetup('totp')">🔑 تفعيل عبر Google Authenticator</button>
          </div>
        `}

        ${adm2FaSetup ? `
          <div class="deliver-box" style="margin-top:14px;text-align:center">
            <h4>${adm2FaSetup.method === 'totp' ? '🔑 مسح باركود Google Authenticator' : '📲 إدخال كود تيليغرام'}</h4>
            ${adm2FaSetup.method === 'totp' ? `
              <p style="font-size:13px;color:var(--mut)">امسح الباركود بتطبيق <b>Google Authenticator</b> أو أدخل المفتاح يدوياً:</p>
              <p style="font-size:12px;color:var(--mut)">لأمان مفتاح 2FA، أدخله يدوياً في تطبيق المصادقة. لا يتم رفع هذا المفتاح إلى أي خدمة QR خارجية.</p>
              <div style="font-size:13px;font-weight:800;margin-bottom:8px" dir="ltr">Secret: <code>${esc(adm2FaSetup.secret)}</code></div>
            ` : `
              <p style="font-size:13px;color:var(--mut);margin-bottom:8px">${esc(adm2FaSetup.message)}</p>
            `}
            <input class="inp otp-inp" id="adm_setup_code" type="text" inputmode="numeric" maxlength="6" dir="ltr" placeholder="000000">
            <div class="grid-2" style="margin-top:10px">
              <button class="btn-ok" style="margin:0" onclick="confirmAdmin2FAEnable('${adm2FaSetup.method}')">✅ تأكيد وتفعيل 2FA</button>
              <button class="btn-sm" onclick="adm2FaSetup=null;loadPanel()">إلغاء</button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="card">
        <h3>🔑 تغيير البريد الإلكتروني وكلمة السر للمدير</h3>
        <label class="lbl">البريد الإلكتروني الجديد</label>
        <input class="inp" id="new_em" dir="ltr" value="${esc(sec.email || '')}" placeholder="admin@oviraplaydz.com">
        <label class="lbl">كلمة السر الجديدة (8 أحرف فأكثر)</label>
        <input class="inp" id="new_pw" type="password" dir="ltr" placeholder="••••••••">
        <label class="lbl">كلمة السر الحالية (إلزامية)</label>
        <input class="inp" id="current_pw" type="password" autocomplete="current-password" placeholder="أدخل كلمة السر الحالية">
        <button class="btn-pri" onclick="saveCreds()">تحديث بيانات الدخول</button>
      </div>

      <div class="card">
        <h3>🧹 تصفية وتنظيف قاعدة البيانات</h3>
        <p style="font-size:13px;color:var(--mut);margin:8px 0">لحذف أي حسابات مدراء وهمية أو مسح الطلبات التجريبية السابقة والبدء بقاعدة بيانات نظيفة.</p>
        <button class="btn-bad" onclick="cleanDb(false)">حذف المدراء الوهميين فقط</button>
        <button class="btn-bad" onclick="cleanDb(true)">تصفير شامل (حذف الطلبات التجريبية + الشكاوى + المدراء الوهميين)</button>
      </div>`;
  }

  document.getElementById('root').innerHTML = `
    <div class="top-bar">
      <button class="btn-sm" onclick="logout()">خروج 🔒</button>
      <button class="btn-sm" onclick="loadPanel()">تحديث 🔄</button>
      <h2>لوحة إدارة OVIRA PLAY</h2>
    </div>
    <form class="ov-global-search" onsubmit="event.preventDefault();runGlobalSearch(this.elements.globalQuery.value)"><input class="inp" name="globalQuery" aria-label="بحث شامل" value="${esc(globalSearch)}" placeholder="🔍 بحث شامل في الطلبات والعملاء والمنتجات"><button class="btn-sm">بحث</button></form>
    <div class="tabs" aria-label="أقسام لوحة التحكم">
      <button class="tab ${tab === 'overview' ? 'on' : ''}" onclick="goAdmin('overview')">🏠 الرئيسية</button>
      <button class="tab ${tab === 'activity' ? 'on' : ''}" onclick="goAdmin('activity')">🛡️ النشاط</button>
      <button class="tab ${tab === 'orders' ? 'on' : ''}" onclick="tab='orders';ordersPage=1;qFilter='';stFilter='';loadPanel()">📋 الطلبات</button>
      <button class="tab ${tab === 'delivered' ? 'on' : ''}" onclick="tab='delivered';ordersPage=1;qFilter='';loadPanel()">✅ تم التسليم</button>
      <button class="tab ${tab === 'reviews' ? 'on' : ''}" onclick="tab='reviews';loadPanel()">⭐ التقييمات</button>
      <button class="tab ${tab === 'products' ? 'on' : ''}" onclick="tab='products';loadPanel()">🛍️ البطاقات</button>
      <button class="tab ${tab === 'payments' ? 'on' : ''}" onclick="tab='payments';loadPanel()">💳 الدفع</button>
      <button class="tab ${tab === 'renewals' ? 'on' : ''}" onclick="tab='renewals';loadPanel()">🔔 التجديدات</button>
      <button class="tab ${tab === 'complaints' ? 'on' : ''}" onclick="tab='complaints';loadPanel()">🎫 الشكاوى ${openComplaintsCount ? `<span class="badge-cnt">${openComplaintsCount}</span>` : ''}</button>
      <button class="tab ${tab === 'customers' ? 'on' : ''}" onclick="tab='customers';qFilter='';loadPanel()">👥 الزبائن</button>
      <button class="tab ${tab === 'settings' ? 'on' : ''}" onclick="tab='settings';loadPanel()">⚙️ الإعدادات</button>
    </div>
    ${content}`;
  if (tab === 'products') {
    initPlanEditors();
    if (productQuery) filterProducts(productQuery);
    if (createAfterLoad) { createAfterLoad = false; openCreateProduct(); }
  }
}

// أدوات الواجهة: جميع العمليات الحساسة تُؤكَّد وتُنفَّذ من الخادم، لا من المتصفح.
function runGlobalSearch(q) {
  globalSearch = String(q || '').trim().slice(0,64);
  if (globalSearch.length < 2) return toast('أدخل حرفين على الأقل للبحث');
  goAdmin('search');
}
function searchProduct(title) {
  productQuery = title.toLowerCase();
  goAdmin('products');
}
function goAdmin(section, search = '', status = '') {
  tab = section;
  qFilter = search;
  stFilter = status;
  ordersPage = 1;
  loadPanel();
}
function startCreateProduct() { createAfterLoad = true; goAdmin('products'); }
function openCreateProduct() {
  const block = document.getElementById('createProductBlock');
  if (block) { block.open = true; block.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function applyOrderDates() {
  orderFrom = document.getElementById('orderFrom')?.value || '';
  orderTo = document.getElementById('orderTo')?.value || '';
  if (orderFrom && orderTo && orderFrom > orderTo) return toast('تاريخ البداية بعد النهاية');
  ordersPage = 1;
  loadPanel();
}
function filterProducts(term) {
  productQuery = String(term || '').toLowerCase().trim();
  document.querySelectorAll('.product-card[data-search]').forEach((el) => {
    el.hidden = Boolean(productQuery && !el.dataset.search.includes(productQuery));
  });
}
function previewDelivery(id) {
  const type = document.getElementById('dlv_type_' + id)?.value;
  const creds = document.getElementById('dlv_cred_' + id)?.value.trim() || '';
  const url = document.getElementById('dlv_invite_' + id)?.value.trim() || '';
  const profile = document.getElementById('dlv_prof_' + id)?.value.trim() || '';
  if (type === 'invite' && !/^https:\/\/\S+$/i.test(url)) return toast('أدخل رابط تفعيل HTTPS صالحًا');
  if (type !== 'invite' && !creds) return toast('بيانات الحساب مطلوبة');
  const typeName = { screen: 'شاشة / بروفايل', account: 'حساب كامل', invite: 'رابط دعوة' }[type] || type;
  // لا نكشف كلمة المرور أو رمز المصادقة في نافذة المعاينة.
  alert('معاينة آمنة للتسليم\nالنوع: ' + typeName + '\nبيانات الحساب: ' + (creds ? 'تم إدخالها' : 'غير مطلوبة') + '\nالرابط: ' + (url ? 'تم إدخاله' : 'غير مطلوب') + '\nالشاشة: ' + (profile || 'لا توجد') + '\n\nراجع الطلب ثم اضغط تأكيد إرسال التسليم.');
}

// لوحة أسعار مرئية؛ الصيغة اليدوية محفوظة للخادم كما كانت حفاظًا على التوافق.
function readPlanRows(source) {
  const entries = String(source || '').split(/[,\n]+/).map(x => x.trim()).filter(Boolean);
  return entries.map((entry) => {
    const m = entry.match(/^(\d{1,2}):(\d+)(\*)?(?:\|([^\n,]*))?$/);
    if (!m) return null;
    return { months: m[1], price: m[2], featured: Boolean(m[3]), label: m[4] || '' };
  }).filter(Boolean);
}
function initPlanEditors() {
  document.querySelectorAll('[data-plan-target]').forEach((editor) => {
    renderPlanEditor(editor.dataset.planTarget);
  });
}
function renderPlanEditor(id, rows) {
  const field = document.getElementById(id);
  const editor = document.querySelector(`[data-plan-target="${id}"]`);
  if (!field || !editor) return;
  const plans = Array.isArray(rows) ? rows : readPlanRows(field.value);
  editor.innerHTML = `<div class="plan-editor-heading"><b>📦 الباقات (${plans.length})</b><span>كل سطر = باقة مستقلة</span></div>` +
    (plans.length ? plans.map((item, index) => `<div class="plan-row" data-row="${index}">
      <div class="plan-row-label">باقة ${index + 1}</div>
      <label>الشهور<input type="number" min="1" max="36" step="1" value="${esc(item.months)}" data-f="months" oninput="syncPlanEditor('${id}')"></label>
      <label>السعر (DA)<input type="number" min="0" step="1" value="${esc(item.price)}" data-f="price" oninput="syncPlanEditor('${id}')"></label>
      <label>نوع / وصف الباقة<input maxlength="80" value="${esc(item.label)}" data-f="label" placeholder="عائلي / خاص" oninput="syncPlanEditor('${id}')"></label>
      <label class="plan-best"><input type="checkbox" data-f="featured" ${item.featured ? 'checked' : ''} onchange="onlyFeatured('${id}',${index})">الأوفر</label>
      <button type="button" class="plan-remove" aria-label="حذف الباقة" onclick="removePlanRow('${id}',${index})">✕</button>
      </div>`).join('') : '<p class="ov-caption">أضف باقة لبدء إدخال الأسعار.</p>') +
    `<button class="btn-sm plan-add" type="button" onclick="addPlanRow('${id}')">＋ إضافة باقة جديدة</button><p class="ov-caption">يمكن إضافة باقتين بنفس المدة بأسعار مختلفة، مثل Family وPersonal.</p>`;
  syncPlanEditor(id);
}
function planEditorRows(id) {
  const editor = document.querySelector(`[data-plan-target="${id}"]`);
  if (!editor) return [];
  return [...editor.querySelectorAll('.plan-row')].map((row) => ({
    months: row.querySelector('[data-f="months"]').value,
    price: row.querySelector('[data-f="price"]').value,
    label: row.querySelector('[data-f="label"]').value.trim(),
    featured: row.querySelector('[data-f="featured"]').checked
  }));
}
function syncPlanEditor(id) {
  const field = document.getElementById(id);
  if (!field) return;
  field.value = planEditorRows(id).map(p => `${p.months}:${p.price}${p.featured ? '*' : ''}${p.label ? '|' + p.label.replace(/[|,\n]/g, ' ') : ''}`).join(', ');
}
function addPlanRow(id) {
  const rows = planEditorRows(id);
  if (rows.length >= 20) return toast('الحد الأقصى 20 باقة للمنتج');
  rows.push({ months: '1', price: '', label: '', featured: false });
  renderPlanEditor(id, rows);
}
function removePlanRow(id, n) {
  const rows = planEditorRows(id);
  rows.splice(n, 1);
  renderPlanEditor(id, rows);
}
function onlyFeatured(id, i) {
  const rows = planEditorRows(id);
  if (rows[i]?.featured) rows.forEach((row, n) => { if (n !== i) row.featured = false; });
  renderPlanEditor(id, rows);
}
function planRawChanged(id, raw) {
  const parsed = readPlanRows(raw);
  if (parsed.length !== raw.split(/[,\n]+/).filter(x => x.trim()).length) {
    toast('صيغة غير صالحة؛ استخدم المحرر المرئي بدلاً منها');
    return;
  }
  document.getElementById(id).value = raw;
  renderPlanEditor(id, parsed);
}
function plansValid(id) {
  const rows = planEditorRows(id);
  return rows.length > 0 && rows.every(r => Number.isInteger(Number(r.months)) && Number(r.months) >= 1 && Number(r.months) <= 36 &&
    /^\d+$/.test(r.price) && Number(r.price) >= 0 && r.label.length <= 80);
}
function previewProduct(id) {
  const dest = document.getElementById('pr_preview_' + id);
  if (!dest) return;
  dest.hidden = !dest.hidden;
  if (dest.hidden) return;
  const title = document.getElementById('pr_tl_' + id)?.value || 'منتج';
  const subtitle = document.getElementById('pr_sub_' + id)?.value || '';
  dest.innerHTML = `<b>${esc(title)}</b><p>${esc(subtitle)}</p>` + planEditorRows('pr_pl_' + id)
    .map(p=>`<div class="preview-row"><span>${esc(p.months)} شهر · ${esc(p.label)}</span><strong>${fmt(p.price)}</strong></div>`).join('');
}
async function loadProductRevisions(id) {
  const box = document.getElementById('pr_hist_' + id);
  if (!box) return;
  box.hidden = false;
  box.textContent = 'جاري جلب سجل التعديلات...';
  try {
    const r = await fetch(`${API}/products/${id}/revisions`, { headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json();
    if (!d.success) return box.textContent = d.message || 'غير متاح (للمالك فقط)';
    box.innerHTML = (d.revisions || []).map(rev => `<div class="history-row"><span>${new Date(rev.createdAt).toLocaleString('fr-DZ')} · ${esc(rev.label)}</span><button class="btn-sm" onclick="restoreProductRevision('${id}','${rev._id}')">استعادة</button></div>`).join('') || '<p>لا توجد نسخ سابقة بعد.</p>';
  } catch (_) { box.textContent = 'تعذّر تحميل السجل'; }
}
async function restoreProductRevision(id, revId) {
  if (!confirm('استعادة النسخة السابقة؟ ستُحفظ الحالة الحالية في سجل التعديلات أيضًا.')) return;
  try {
    const r = await fetch(`${API}/products/${id}/restore/${revId}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json();
    toast(d.message || 'تعذّر الاستعادة');
    if (d.success) { openProductId = id; loadPanel(); }
  } catch (_) { toast('فشل الاتصال بالخادم'); }
}
function copyOrderSummary(id, code) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code)
    .then(() => toast('تم نسخ رمز الطلب')).catch(() => toast('تعذّر النسخ'));
  else toast('النسخ غير مدعوم هنا');
}
function suggestProductDescription() {
  const brand = document.getElementById('np_brand')?.value.trim();
  if (!brand) return toast('أدخل اسم العلامة أولًا');
  const title = document.getElementById('np_title');
  const sub = document.getElementById('np_sub');
  const feat = document.getElementById('np_feats');
  if (title && !title.value.trim()) title.value = brand + ' — باقات اشتراك';
  if (sub && !sub.value.trim()) sub.value = 'اختر باقة ' + brand + ' المناسبة من حيث المدة والنوع. تظهر التفاصيل والسعر النهائي قبل إتمام الطلب، مع إرشادات التسليم بعد التحقق من الدفع.';
  if (feat && !feat.value.trim()) feat.value = '📅 مدد اشتراك متعددة حسب الباقة\n📩 متابعة حالة الطلب من الموقع أو Telegram\n💬 دعم عند الحاجة';
  toast('تم إنشاء وصف أولي؛ راجع دقته وعدّله قبل النشر');
}
function setComplaintTemplate(id, kind) {
  const box = document.getElementById('crep_' + id);
  if (!box) return;
  const messages = {
    progress: 'مرحبًا، استلمنا طلب الدعم الخاص بك ونراجع التفاصيل الآن. سنرسل لك التحديث فور توفره. شكرًا لصبرك.',
    details: 'مرحبًا، لمساعدتك بسرعة يرجى إرسال رقم طلبك وتوضيح المشكلة بدقة، دون إرسال كلمة مرورك أو رمز المصادقة.',
    solved: 'مرحبًا، تم معالجة البلاغ من طرف فريق OVIRA PLAY. يُرجى التجربة وإخبارنا إذا استمرت المشكلة. شكرًا لتواصلك.'
  };
  box.value = messages[kind] || '';
  box.focus();
}

// ==================== إجراءات التحقق بخطوتين (2FA) للمدير ====================

async function startAdmin2FASetup(method) {
  try {
    const r = await fetch(`${API}/2fa/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ method })
    });
    const d = await r.json();
    if (!d.success) return toast(d.message || 'تعذّر بدء الإعداد');
    adm2FaSetup = d;
    loadPanel();
  } catch (e) {
    toast('تعذّر الاتصال بالخادم');
  }
}

async function confirmAdmin2FAEnable(method) {
  const codeEl = document.getElementById('adm_setup_code');
  const code = (codeEl ? codeEl.value : '').trim();
  if (code.length !== 6) return toast('أدخل الرمز المكون من 6 أرقام');
  try {
    const r = await fetch(`${API}/2fa/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ method, code })
    });
    const d = await r.json();
    if (!d.success) return toast(d.message || 'الرمز غير صحيح');
    adm2FaSetup = null;
    toast(d.message);
    loadPanel();
  } catch (e) {
    toast('تعذّر الاتصال بالخادم');
  }
}

async function disableAdmin2FA() {
  if (!confirm('هل تريد إيقاف التحقق بخطوتين للوحة التحكم؟')) return;
  try {
    const r = await fetch(`${API}/2fa/disable`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const d = await r.json();
    toast(d.message || 'تم الإيقاف');
    loadPanel();
  } catch (e) {
    toast('تعذّر الاتصال بالخادم');
  }
}

async function remindRenewal(id) {
  if (!confirm('إرسال تذكير تجديد للزبون عبر بوت تيليغرام؟')) return;
  try {
    const r = await fetch(`${API}/renewals/${encodeURIComponent(id)}/remind`, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }
    });
    const d = await r.json();
    toast(d.message || 'تعذّر إرسال التذكير');
  } catch { toast('تعذّر الاتصال بالخادم'); }
}

// ==================== حفظ طرق الدفع (الخطوة 2) ====================

async function savePaymentMethodsAll() {
  const updated = (payMethodsState || []).map((m, idx) => {
    const enEl = document.getElementById('pm_en_' + idx);
    const lblEl = document.getElementById('pm_lbl_' + idx);
    const valEl = document.getElementById('pm_val_' + idx);
    const noteEl = document.getElementById('pm_note_' + idx);
    return {
      id: m.id,
      enabled: enEl ? !!enEl.checked : m.enabled,
      label: lblEl ? lblEl.value.trim() : (m.label || ''),
      value: valEl ? valEl.value.trim() : (m.value || ''),
      note: noteEl ? noteEl.value.trim() : (m.note || '')
    };
  });

  try {
    const r = await fetch(`${API}/payment-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ methods: updated })
    });
    const d = await r.json();
    toast(d.message || 'تم الحفظ ✓');
    if (d.success) loadPanel();
  } catch (e) {
    toast('تعذّر حفظ طرق الدفع');
  }
}

// ==================== باقي العمليات الإدارية ====================

async function moderateReview(id, approved) {
  const r = await fetch(`${API}/reviews/${id}`, { method:'PATCH',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body:JSON.stringify({approved}) });
  const d = await r.json();
  toast(d.success ? 'تم تحديث التقييم' : (d.message || 'تعذّر تحديث التقييم'));
  if(d.success)loadPanel();
}

async function createProduct() {
  if (!plansValid('np_plans')) return toast('أكمل كل باقة: مدة صحيحة وسعر صحيح');
  const payload = {
    brandName: document.getElementById('np_brand').value.trim(),
    title: document.getElementById('np_title').value.trim(),
    category: document.getElementById('np_cat').value.trim(),
    badgeText: document.getElementById('np_bdg').value.trim(),
    primaryColor: document.getElementById('np_c1').value.trim(),
    secondaryColor: document.getElementById('np_c2').value.trim(),
    iconText: document.getElementById('np_ic').value.trim(),
    imageUrl: document.getElementById('np_img').value.trim(),
    subtitle: document.getElementById('np_sub').value.trim(),
    plansText: document.getElementById('np_plans').value.trim(),
    featuresText: document.getElementById('np_feats').value.trim()
  };
  const r = await fetch(`${API}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  const d = await r.json();
  toast(d.message || 'تم الإنشاء ✓');
  if (d.success) loadPanel();
}

async function updateProduct(id) {
  if (!plansValid('pr_pl_' + id)) return toast('أكمل كل باقة: مدة صحيحة وسعر صحيح');
  const payload = {
    brandName: document.getElementById('pr_br_' + id).value.trim(),
    title: document.getElementById('pr_tl_' + id).value.trim(),
    category: document.getElementById('pr_cat_' + id).value.trim(),
    badgeText: document.getElementById('pr_bdg_' + id).value.trim(),
    subtitle: document.getElementById('pr_sub_' + id).value.trim(),
    primaryColor: document.getElementById('pr_c1_' + id).value.trim(),
    secondaryColor: document.getElementById('pr_c2_' + id).value.trim(),
    iconText: document.getElementById('pr_ic_' + id).value.trim(),
    imageUrl: document.getElementById('pr_img_' + id).value.trim(),
    plansText: document.getElementById('pr_pl_' + id).value.trim(),
    featuresText: document.getElementById('pr_ft_' + id).value.trim(),
    stepsText: document.getElementById('pr_st_' + id).value.trim()
  };
  const r = await fetch(`${API}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ ...payload })
  });
  const d = await r.json();
  toast(d.message || 'تم حفظ التعديلات ✓');
  if (d.success) { openProductId = id; loadPanel(); }
}

async function toggleProduct(id, active) {
  const r = await fetch(`${API}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ active })
  });
  const d = await r.json();
  toast(d.message || 'تم التحديث ✓');
  loadPanel();
}

async function deleteProduct(id) {
  if (!confirm('هل أنت متأكد من حذف هذه البطاقة وصفحة الهبوط نهائياً؟')) return;
  await fetch(`${API}/products/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  toast('تم حذف البطاقة');
  loadPanel();
}

async function sendTemporaryCode(orderId) {
  const field = document.getElementById('tempcode_' + orderId);
  const code = field?.value.trim() || '';
  if (!/^[a-zA-Z0-9]{4,12}$/.test(code)) return toast('أدخل رمزًا مؤقتًا صالحًا (4–12)');
  const r = await fetch(`${API}/orders/${orderId}/temporary-code`, { method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({code}) });
  field.value = '';
  const d = await r.json(); toast(d.message || 'تعذر إرسال الرمز');
}

function toggleDeliveryFields(orderId) {
  const t = document.getElementById('dlv_type_' + orderId).value;
  document.getElementById('dlv_invite_wrap_' + orderId).hidden = t !== 'invite';
  document.getElementById('dlv_account_wrap_' + orderId).hidden = t === 'invite';
  const profile = document.getElementById('dlv_prof_' + orderId)?.closest('.grid-2');
  if (profile) profile.hidden = t !== 'screen';
}

async function deliverAccount(orderId) {
  const type = document.getElementById('dlv_type_' + orderId).value;
  const invitationUrl = document.getElementById('dlv_invite_' + orderId).value.trim();
  const credentials = document.getElementById('dlv_cred_' + orderId).value.trim();
  const profileName = document.getElementById('dlv_prof_' + orderId).value.trim();
  const pinCode = document.getElementById('dlv_pin_' + orderId).value.trim();
  const extraNote = document.getElementById('dlv_note_' + orderId).value.trim();

  if (type !== 'invite' && !credentials) return toast('أدخل بيانات الحساب أولاً');
  if (type === 'invite' && !/^https:\/\/\S+$/i.test(invitationUrl)) return toast('أدخل رابط تفعيل يبدأ بـ https://');
  if (!confirm('سيتم حفظ بيانات التسليم وإرسالها للزبون المرتبط بهذا الطلب. هل تأكدت من هوية الزبون ومعلومات الحساب؟')) return;

  const r = await fetch(`${API}/orders/${orderId}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ type, credentials, invitationUrl, profileName, pinCode, extraNote })
  });
  const d = await r.json();
  toast(d.message || (d.success ? 'تم التسليم ✓' : 'تعذّر التسليم'));
  if (d.success) loadPanel();
}

async function upStatus(id, status) {
  await fetch(`${API}/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ status })
  });
  toast('تم تحديث الحالة ✓');
  loadPanel();
}

async function saveNote(id) {
  const adminNote = document.getElementById('nt_' + id).value;
  await fetch(`${API}/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ adminNote })
  });
  toast('تم حفظ الملاحظة ✓');
  loadPanel();
}

async function delOrder(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) return;
  await fetch(`${API}/orders/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  toast('تم حذف الطلب');
  loadPanel();
}

async function replyComplaint(id, status) {
  const reply = document.getElementById('crep_' + id).value.trim();
  const r = await fetch(`${API}/complaints/${id}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ reply, status })
  });
  const d = await r.json();
  toast(d.message || 'تم التحديث ✓');
  loadPanel();
}

async function createCustomer() {
  const payload = {
    name: document.getElementById('nc_name').value.trim(),
    phone: document.getElementById('nc_phone').value.trim(),
    email: document.getElementById('nc_email').value.trim(),
    balance: Number(document.getElementById('nc_bal').value || 0),
    password: document.getElementById('nc_pass').value
  };
  const r = await fetch(`${API}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  const d = await r.json();
  toast(d.message || 'تمت العملية');
  if (d.success) loadPanel();
}

async function setCustBalance(id) {
  const exactBalance = Number(document.getElementById('bal_' + id).value || 0);
  if (!Number.isFinite(exactBalance) || exactBalance < 0) return toast('أدخل رصيدًا صحيحًا');
  if (!confirm('تأكيد ضبط رصيد الزبون على ' + fmt(exactBalance) + '؟')) return;
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ exactBalance })
  });
  const d = await r.json();
  toast(d.message || 'تم تحديث الرصيد ✓');
  loadPanel();
}

async function addQuickBalance(id, balanceDelta) {
  if (!confirm('تأكيد تعديل رصيد الزبون بمقدار ' + fmt(balanceDelta) + '؟')) return;
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ balanceDelta })
  });
  const d = await r.json();
  toast(d.message || 'تم تعديل الرصيد ✓');
  loadPanel();
}

async function setCustPass(id) {
  const newPassword = document.getElementById('cpw_' + id).value;
  if (!newPassword || newPassword.length < 6) return toast('كلمة السر يجب أن تكون 6 أحرف على الأقل');
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ newPassword })
  });
  const d = await r.json();
  toast(d.message || 'تم تحديث كلمة سر الزبون ✓');
  loadPanel();
}

async function toggleBlockCust(id, blocked) {
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ blocked })
  });
  const d = await r.json();
  toast(d.message || 'تم التحديث ✓');
  loadPanel();
}

async function saveChargily() {
  const payload = {
    mode: document.getElementById('ch_mode').value,
    testPublicKey: document.getElementById('ch_tpk').value,
    ...(document.getElementById('ch_tsk').value.trim() ? { testSecretKey: document.getElementById('ch_tsk').value.trim() } : {}),
    livePublicKey: document.getElementById('ch_lpk').value,
    ...(document.getElementById('ch_lsk').value.trim() ? { liveSecretKey: document.getElementById('ch_lsk').value.trim() } : {})
  };
  const r = await fetch(`${API}/settings/chargily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  const d = await r.json();
  toast(d.message || 'تم حفظ إعدادات شارجيلي ✓');
  loadPanel();
}

async function saveCreds() {
  const currentPassword = document.getElementById('current_pw').value;
  if (!currentPassword) return toast('أدخل كلمة السر الحالية أولاً');
  const newEmail = document.getElementById('new_em').value.trim();
  const newPassword = document.getElementById('new_pw').value;
  const r = await fetch(`${API}/settings/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ currentPassword, newEmail, newPassword })
  });
  const d = await r.json();
  toast(d.message || 'تم تحديث بيانات الدخول ✓');
  if (d.success && d.token) { token = d.token; localStorage.setItem('adm_tk', token); sessionStorage.setItem('adm_tk', token); }
}

async function cleanDb(deleteOrders) {
  if (!confirm(deleteOrders ? 'هل أنت متأكد من مسح كل الطلبات التجريبية والشكاوى والمدراء الوهميين؟' : 'هل تريد مسح جميع المدراء الوهميين والإبقاء على حسابك فقط؟')) return;
  const r = await fetch(`${API}/settings/clean-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ deleteOrders })
  });
  const d = await r.json();
  toast(d.message || 'تم التنظيف بنجاح');
  loadPanel();
}

if (token) {
  loadPanel();
} else {
  renderLogin();
}
