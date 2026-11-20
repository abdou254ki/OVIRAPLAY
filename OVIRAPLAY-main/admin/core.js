// =========================================================
// OVIRA PLAY — ADMIN CORE & AUTH (admin/core.js)
// =========================================================

const API_HOST = (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  ? 'http://127.0.0.1:5001'
  : 'https://ovira-api.onrender.com';
const API = API_HOST + '/api/admin';
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
let marketingDays = 30;
// Inbox state is kept outside the DOM so a routine refresh cannot erase a reply.
let selectedAdminConversation = '';
const adminConversationDrafts = new Map();
const adminReplyKeys = new Map();
const adminReplyInFlight = new Set();
let adminConversationRequestSerial = 0;
const adminInboxHistories = new Map();

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
// Navigation responsive with explicit text labels and stable legacy routes.

function toggleAdminNav(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  document.getElementById('ovMenuButton')?.setAttribute('aria-expanded', String(open));
}

function toggleAdminTheme() {
  const active = document.documentElement.getAttribute('data-theme');
  const next = active === 'dark' ? 'light' : active === 'light' ? 'dark' :
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ovira_admin_theme', next);
}

function navButton(id, label, count = '') {
  return `<button class="tab ${tab === id ? 'on' : ''}" ${tab === id ? 'aria-current="page"' : ''} onclick="goAdmin('${id}')">${label}${count ? ` <span class="badge-cnt">${count}</span>` : ''}</button>`;
}

function toast(msg) {
  const el = document.getElementById('admToast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => el.classList.remove('on'), 2800);
}

function renderLogin(err = '') {
  // إخفاء الشيل وإظهار نموذج الدخول
  const shell = document.querySelector('.ov-admin-shell');
  if (shell) shell.style.display = 'none';

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

  // إظهار الشيل
  let adminShell = document.querySelector('.ov-admin-shell');
  if (shell) shell.style.display = 'grid';

  // بناء القائمة الجانبية
  const adminNavGroups = [
    { label: 'الإدارة', items: [
      ['overview', '📊', 'نظرة عامة'],
      ['orders', '🧾', 'الطلبات'],
      ['delivered', '✅', 'تم التسليم'],
      ['products', '🛍️', 'المنتجات'],
      ['reviews', '⭐', 'التقييمات']
    ]},
    { label: 'المالية', items: [
      ['payments', '💳', 'طرق الدفع'],
      ['finance', '📈', 'التقارير'],
      ['marketing', '📣', 'التسويق'],
      ['renewals', '🔔', 'التجديدات']
    ]},
    { label: 'الخدمات', items: [
      ['customers', '👥', 'الزبائن'],
      ['complaints', '📋', 'الشكاوى'],
      ['conversations', '💬', 'المحادثات'],
      ['support', '🎫', 'الدعم']
    ]},
    { label: 'النظام', items: [
      ['activity', '🛡️', 'سجل النشاط'],
      ['notifications', '🔔', 'الإشعارات'],
      ['search', '🔍', 'بحث عام'],
      ['security', '🔒', 'الأمان']
    ]}
  ];

  const navHtml = adminNavGroups.map(group => `
    <div class="ov-admin-nav-group">
      <span class="ov-admin-nav-label">${group.label}</span>
      ${group.items.map(([id, icon, label]) => {
        const isActive = tab === id;
        const count = id === 'complaints' && openComplaintsCount > 0 ? openComplaintsCount : 0;
        return `<button class="ov-admin-nav-btn ${isActive ? 'on' : ''}" onclick="goAdmin('${id}')" ${isActive ? 'aria-current="page"' : ''}>
          <span>${icon}</span>
          <span>${label}</span>
          ${count ? `<span class="badge-cnt">${count}</span>` : ''}
        </button>`;
      }).join('')}
    </div>
  `).join('');
  document.getElementById('adminNav').innerHTML = navHtml;

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
  agentOneTimeToken = '';
  if(typeof aiControlSession!=='undefined'){aiControlSession='';aiSessionExpiry=0;}
  localStorage.removeItem('adm_tk');
  sessionStorage.removeItem('adm_tk');
  for(const key of Object.keys(sessionStorage))if(key.startsWith('ovira_inbox_draft:'))sessionStorage.removeItem(key);
  adminConversationDrafts.clear();adminInboxHistories.clear();
  const shell = document.querySelector('.ov-admin-shell');
  if (shell) shell.style.display = 'none';
  document.getElementById('root').innerHTML = '';
  renderLogin();
}

function updateAdminNav(activeTab) {
  document.querySelectorAll('.ov-admin-nav-btn').forEach((btn) => {
    const isActive = btn.getAttribute('onclick')?.includes(`'${activeTab}'`);
    btn.classList.toggle('on', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

function runGlobalSearch(q) {
  globalSearch = String(q || '').trim().slice(0,64);
  if (globalSearch.length < 2) return toast('أدخل حرفين على الأقل للبحث');
  goAdmin('search');
}

function goAdmin(section, search = '', status = '') {
  rememberAdminConversationDraft();
  if(selectedAdminConversation==='__trainer'){
    const field=document.getElementById('trainerQuestion');
    if(field)ownerTrainingDraft=field.value;
  }
  if (section !== 'ai') agentOneTimeToken = '';
  toggleAdminNav(false);
  tab = section;
  qFilter = search;
  stFilter = status;
  ordersPage = 1;
  loadPanel();
}

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


window.API_HOST = API_HOST;
window.API = API;
window.toggleAdminNav = toggleAdminNav;
window.toggleAdminTheme = toggleAdminTheme;
window.navButton = navButton;
window.toast = toast;
window.renderLogin = renderLogin;
window.doLogin = doLogin;
window.verifyAdmin2FALogin = verifyAdmin2FALogin;
window.logout = logout;
window.updateAdminNav = updateAdminNav;
window.goAdmin = goAdmin;
window.runGlobalSearch = runGlobalSearch;
window.startAdmin2FASetup = startAdmin2FASetup;
window.confirmAdmin2FAEnable = confirmAdmin2FAEnable;
window.disableAdmin2FA = disableAdmin2FA;
window.saveChargily = saveChargily;
window.saveCreds = saveCreds;
window.cleanDb = cleanDb;
