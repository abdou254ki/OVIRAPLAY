// =========================================================
// OVIRA PLAY — ADMIN MAIN ORCHESTRATOR (admin.js)
// =========================================================

// Fallback global declarations for isolated sandbox tests
if (typeof token === 'undefined') var token = '';
if (typeof tab === 'undefined') var tab = 'overview';
if (typeof panelRequestSerial === 'undefined') var panelRequestSerial = 0;
if (typeof activityLimit === 'undefined') var activityLimit = 30;
if (typeof ordersPage === 'undefined') var ordersPage = 1;
if (typeof orderFrom === 'undefined') var orderFrom = '';
if (typeof orderTo === 'undefined') var orderTo = '';
if (typeof stFilter === 'undefined') var stFilter = '';
if (typeof qFilter === 'undefined') var qFilter = '';
if (typeof compFilter === 'undefined') var compFilter = '';
if (typeof renewalFilter === 'undefined') var renewalFilter = 'all';
if (typeof marketingDays === 'undefined') var marketingDays = 30;
if (typeof globalSearch === 'undefined') var globalSearch = '';
if (typeof productQuery === 'undefined') var productQuery = '';
if (typeof createAfterLoad === 'undefined') var createAfterLoad = false;
if (typeof openComplaintsCount === 'undefined') var openComplaintsCount = 0;
if (typeof payMethodsState === 'undefined') var payMethodsState = [];
if (typeof COL === 'undefined') var COL = { 'قيد المراجعة': '#F59E0B', 'مؤكد': '#10B981', 'تم التسليم': '#3B82F6', 'ملغي': '#EF4444' };
if (typeof esc === 'undefined') var esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
if (typeof fmt === 'undefined') var fmt = (n) => Number(n || 0).toLocaleString('en-US') + ' DA';
if (typeof navButton === 'undefined') var navButton = (id, label, count = '') => `<button class="tab ${tab === id ? 'on' : ''}" onclick="goAdmin('${id}')">${label}${count ? ` <span class="badge-cnt">${count}</span>` : ''}</button>`;
if (typeof renderLogin === 'undefined') var renderLogin = () => {};
if (typeof goAdmin === 'undefined') var goAdmin = (s) => { tab = s; };
if (typeof toggleAdminNav === 'undefined') var toggleAdminNav = () => {};
if (typeof toggleAdminTheme === 'undefined') var toggleAdminTheme = () => {};
if (typeof logout === 'undefined') var logout = () => {};
if (typeof updateAdminNav === 'undefined') var updateAdminNav = () => {};
if (typeof runGlobalSearch === 'undefined') var runGlobalSearch = () => {};
if (typeof adminInboxRole === 'undefined') var adminInboxRole = () => 'owner';
if (typeof openProductId === 'undefined') var openProductId = '';
if (typeof onProductToggle === 'undefined') var onProductToggle = (node, id) => { if (!node.open) return; openProductId = id; };
if (typeof readPlanRows === 'undefined') var readPlanRows = (source) => {
  const entries = String(source || '').split(/[,\n]+/).map(x => x.trim()).filter(Boolean);
  return entries.map((entry) => {
    const m = entry.match(/^(\d{1,2}):(\d+)(\*)?(?:\|([^\n,]*))?$/);
    if (!m) return null;
    return { months: m[1], price: m[2], featured: Boolean(m[3]), label: m[4] || '' };
  }).filter(Boolean);
};
if (typeof readPlanRows === 'undefined') var readPlanRows = (t) => (t || '').split(',').map(s => { const [mp, l] = s.trim().split('|'); const [m, p] = mp.split(':'); return { months: m, price: p.replace('*',''), featured: p.includes('*'), label: l || '' }; });

if (typeof initPlanEditors === 'undefined') var initPlanEditors = () => {
  document.querySelectorAll('[data-plan-target]').forEach((editor) => {
    if (typeof renderPlanEditor === 'function') renderPlanEditor(editor.dataset.planTarget);
  });
};
if (typeof renderPlanEditor === 'undefined') var renderPlanEditor = (id, rows) => {
  const field = document.getElementById(id);
  const editor = document.querySelector(`[data-plan-target="${id}"]`);
  if (!field || !editor) return;
  const plans = Array.isArray(rows) ? rows : readPlanRows(field.value);
  editor.innerHTML = `<div class="plan-editor-heading"><b>📦 الباقات (${plans.length})</b><span>كل سطر = باقة مستقلة</span></div>` +
    (plans.length ? plans.map((item, index) => `<div class="plan-row" data-row="${index}">
      <div class="plan-row-label">باقة ${index + 1}</div>
      <label>الشهور<input type="number" min="1" max="36" step="1" value="${esc(item.months)}" data-f="months"></label>
      <label>السعر (DA)<input type="number" min="0" step="1" value="${esc(item.price)}" data-f="price"></label>
      <label>نوع / وصف الباقة<input maxlength="80" value="${esc(item.label)}" data-f="label" placeholder="عائلي / خاص"></label>
      <label class="plan-best"><input type="checkbox" data-f="featured" ${item.featured ? 'checked' : ''}>الأوفر</label>
      <button type="button" class="plan-remove" aria-label="حذف الباقة">✕</button>
      </div>`).join('') : '<p class="ov-caption">أضف باقة لبدء إدخال الأسعار.</p>');
};
if (typeof landingForm === 'undefined') var landingForm = () => '';
if (typeof landingPayload === 'undefined') var landingPayload = () => ({});
if (typeof renderAdminFailure === 'undefined') var renderAdminFailure = () => {};

function renderAdminFailure(message, status) {
  const html = `<div class="card ov-failure" role="alert"><h3>${status === 403 ? 'صلاحيات غير كافية' : 'تعذّر تحميل البيانات'}</h3>
    <p>${esc(message || 'الخدمة غير متاحة مؤقتًا؛ لم تُحمّل أي أرقام جديدة.')}</p>
    <button class="btn-pri" onclick="loadPanel()">↻ إعادة المحاولة</button></div>`;
  const panel = document.getElementById('ov-panel');
  if (panel) panel.innerHTML = html;
  else document.getElementById('root').innerHTML = `<div class="card" style="margin:30px auto;max-width:520px"><button class="btn-sm" onclick="logout()">خروج</button>${html}</div>`;
}

async function loadPanel() {
  if (!token) return renderLogin();

  // إظهار الشيل وتحديث العنوان
  const shell = document.querySelector('.ov-admin-shell');
  if (shell) shell.style.display = 'grid';
  const pageTitle = document.getElementById('adminPageTitle');
  if (pageTitle) {
    const titles = {
      overview: 'نظرة عامة', orders: 'الطلبات', delivered: 'تم التسليم',
      products: 'المنتجات', reviews: 'التقييمات', payments: 'طرق الدفع',
      finance: 'التقارير المالية', marketing: 'التسويق', renewals: 'التجديدات',
      customers: 'الزبائن', complaints: 'الشكاوى', conversations: 'المحادثات',
      support: 'الدعم', activity: 'سجل النشاط', notifications: 'الإشعارات',
      search: 'بحث عام', security: 'الأمان'
    };
    pageTitle.textContent = titles[tab] || 'لوحة الإدارة';
  }
  updateAdminNav(tab);
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
  } else if (tab === 'marketing') {
    endpoint = 'marketing?days=' + marketingDays;
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
  } else if (tab === 'ai' || tab === 'historical' || tab === 'finance' || tab === 'conversations' || tab === 'security' || tab === 'engagement' || tab === 'notifications') {
    endpoint = null; // v2 API only; no placeholder numbers
  } else {
    endpoint = 'settings';
  }

  const panel = document.getElementById('ov-panel');
  if (tab==='conversations') {
    rememberAdminConversationDraft();
    if(selectedAdminConversation==='__trainer'){
      const field=document.getElementById('trainerQuestion');
      if(field)ownerTrainingDraft=field.value;
    }
  }
  if (panel) panel.innerHTML = '<div class="card ov-loading" role="status">يُحمّل من الخادم…</div>';
  try {
    const target = tab === 'conversations' ? API.replace('/api/admin','/api/v2/admin/conversations') + inboxQuery() : tab === 'security' ? API.replace('/api/admin','/api/v2/admin/security') : tab === 'engagement' ? EG_BASE : tab === 'notifications' ? notificationAdminUrl('') : tab === 'ai' ? aiUrl('settings') : tab === 'historical' ? historicUrl()+'?page='+historicalPage : tab === 'finance' ? financeUrl() : `${API}/${endpoint}`;
    const r = await fetch(target, {
      headers: { 'Authorization': 'Bearer ' + token }, cache:'no-store'
    });
    if (r.status === 401) return logout();
    const d = await r.json();
    if (requestSerial !== panelRequestSerial) return;
    if (tab==='historical' && r.status===423 && d.code==='FEATURE_DISABLED') {
      d.success=true; d.sales=[]; d.total=0; d.page=1; d.pages=1; d.featureDisabled=true;
    }
    if ((!r.ok && !d.featureDisabled) || !d.success) {
      return renderAdminFailure(d.message || 'تعذّر جلب البيانات من الخادم.', r.status);
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
    if (requestSerial === panelRequestSerial) renderAdminFailure('فشل الاتصال بالخادم. تحقق من الإنترنت أو Render ثم أعد المحاولة.');
  }
}

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
    content = `<section class="ov-hero"><div><span class="ov-eyebrow">مركز الإدارة · OVIRA PLAY</span><h2>مهام اليوم</h2><p>الطلبات والرسائل والمدفوعات الموثقة مباشرة من الخادم.</p></div><button class="btn-sm" onclick="loadPanel()">⟳ تحديث</button></section>
      <p class="ov-main-caption">بيانات الخادم فقط · آخر تحديث: ${esc(d.generatedAt ? new Date(d.generatedAt).toLocaleString('fr-DZ') : 'غير متاح')} · التوقيت: الجزائر</p>
      <div class="ov-kpis">
        <button class="ov-kpi" onclick="goAdmin('orders','', 'قيد المراجعة')"><small>🧾 تنتظر المراجعة</small><strong>${Number(v.review) || 0}</strong><span>عرض الطلبات</span></button>
        <button class="ov-kpi" onclick="goAdmin('orders','', 'مؤكد')"><small>📦 جاهزة للتسليم</small><strong>${Number(v.confirmed) || 0}</strong><span>عرض المؤكدة</span></button>
        <button class="ov-kpi" onclick="goAdmin('delivered')"><small>✅ تم التسليم</small><strong>${Number(v.delivered) || 0}</strong><span>أرشيف مستقل</span></button>
        <button class="ov-kpi" onclick="goAdmin('payments')"><small>💳 مدفوعات إلكترونية اليوم</small><strong>${fmt(v.paidToday)}</strong><span>${Number(v.paidTodayCount) || 0} عملية موثقة</span></button>
        <button class="ov-kpi" onclick="goAdmin('conversations')"><small>💬 محادثات تحتاج متابعة</small><strong>${Number(v.supportConversations) || 0}</strong><span>تحتاج المتابعة</span></button>
        <button class="ov-kpi" onclick="goAdmin('reviews')"><small>⭐ تقييمات للمراجعة</small><strong>${Number(v.pendingReviews) || 0}</strong><span>قبل النشر</span></button>
      </div>
      <div class="card ov-actions"><h3>⚡ إجراءات سريعة</h3><div class="ov-action-grid">
        <button onclick="goAdmin('orders','', 'مؤكد')">🚀 تسليم طلب</button>
        <button onclick="startCreateProduct()">➕ منتج جديد</button>
        <button onclick="goAdmin('renewals')">🔔 التجديدات</button>
        <button onclick="goAdmin('payments')">💳 مراجعة الدفع</button>
        <button onclick="goAdmin('customers')">👥 إدارة الزبائن</button>
        <button onclick="goAdmin('ai')">📱 ربط الوكيل المحلي (غير مفعّل)</button>
        <button onclick="goAdmin('historical')">➕ إدخال قيد يدوي</button>
        <button onclick="goAdmin('finance')">📊 تقارير مالية جزئية</button>
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

        ${tab==='delivered'&&adminInboxRole()==='owner'?`<section class="ov-link-order"><b>🔗 حساب المشتري</b><p class="ov-caption">${o.customerId?'مرتبط بحساب الزبون بالفعل.':'هذا الطلب غير مرتبط بحساب. يمكنك العثور على صاحبه وربطه بعد التحقق من الهوية.'}</p>${o.customerId?'':`<button type="button" class="btn-sm" onclick="showOrderLink('${esc(o._id)}')">ربط الطلب بحساب زبون</button><div id="orderLink_${esc(o._id)}"></div>`}</section>`:''}
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
      const landing = p.landing || {};
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
            <input class="inp" id="pr_bdg_${p._id}" value="${esc(p.badgeText || '')}">
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
        ${landingForm('pr_' + p._id, landing)}
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
            <input class="inp" id="np_bdg" placeholder="اختياري — اتركه فارغاً لإخفاء الشارة">
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
        <textarea class="inp" id="np_feats" placeholder="اكتب المميزات الفعلية المؤكدة؛ ميزة في كل سطر"></textarea>
        <label class="lbl">خطوات الطلب المخصصة (العنوان | الشرح) — اختياري</label>
        <textarea class="inp" id="np_steps" placeholder="اختر باقتك | اختر المدة المناسبة"></textarea>
        ${landingForm('np')}
        <button class="btn-pri" onclick="createProduct()">🚀 نشر البطاقة وصفحة الهبوط في الموقع</button>
      </div></details>
      ${pList}`;
  }

  // ==================== التسويق: بيانات المصدر الحقيقية فقط ====================
  else if (tab === 'marketing') {
    const rows = Array.isArray(d.rows) ? d.rows : [];
    const orders = rows.reduce((s, r) => s + Math.max(0, Number(r.orders) || 0), 0);
    const paid = rows.reduce((s, r) => s + Math.max(0, Number(r.paid) || 0), 0);
    const revenue = rows.reduce((s, r) => s + Math.max(0, Number(r.revenue) || 0), 0);
    const maxOrders = Math.max(1, ...rows.map(r => Number(r.orders) || 0));
    content = `<div class="card">
      <h3>📈 مصادر الزيارات والطلبات</h3>
      <p class="ov-caption">إحصائيات الطلبات المسجلة من الخادم فقط، وليست عدد زيارات الموقع. المدفوع = الطلبات المؤكدة أو المسلّمة، والإيراد مستمد من حالتها.</p>
      <div class="marketing-period" role="group" aria-label="الفترة">
        ${[7,30,90].map(n => `<button class="chip ${marketingDays === n ? 'on' : ''}" onclick="setMarketingDays(${n})">آخر ${n} يوم</button>`).join('')}
      </div>
      <div class="marketing-summary">
        <div><small>إجمالي الطلبات</small><b>${orders.toLocaleString('en-US')}</b></div>
        <div><small>طلبات مؤكدة أو مسلّمة</small><b>${paid.toLocaleString('en-US')}</b></div>
        <div><small>إيراد الطلبات المؤكدة أو المسلّمة</small><b>${fmt(revenue)}</b></div>
      </div>
      ${rows.length ? `<div class="marketing-table-wrap"><table class="marketing-table"><thead><tr><th>مصدر الطلب</th><th>الطلبات</th><th>المؤكدة/المسلّمة</th><th>الإيراد</th></tr></thead>
        <tbody>${rows.map(r => {
          const count = Math.max(0, Number(r.orders) || 0);
          const pct = Math.min(100, count / maxOrders * 100);
          return `<tr><td><b dir="auto">${esc(r.source || 'مباشر / غير محدد')}</b><div class="marketing-bar"><span style="width:${pct}%"></span></div></td>
            <td>${count}</td><td>${Math.max(0,Number(r.paid)||0)}</td><td>${fmt(r.revenue)}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<p class="marketing-empty">لا توجد طلبات مسجلة لهذه الفترة.</p>'}
    </div>`;
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

  // Dedicated inbox UI; data comes exclusively from the authenticated V2 endpoint.
  else if (tab === 'conversations') {
    content=renderAdminInbox(d);
  }
  else if (tab === 'notifications') {
    content=renderNotificationCenter(d);
  }
  else if (tab === 'engagement') {
    content=renderEngagement(d);
  }
  else if (tab === 'security') {
    content=`<div class="card"><h3>🛡️ حالة إعدادات الأمان</h3><p class="ov-caption">هذه فحوص إعدادات قابلة للقياس، وليست ضمانًا بعدم وجود ثغرات.</p>
      ${(d.checks||[]).map(x=>`<div class="ov-security-row"><b>${esc(x.label)}</b><span class="badge" style="background:${x.ok?'#178d55':'#ae4b20'}">${x.ok?'مستوفى':'يحتاج مراجعة'}</span><p>${esc(x.detail||'')}</p></div>`).join('')}
      <p class="ov-caption">استخدم الأمر npm run security:check محليًا أيضًا. لا تشارك أسرار Render أو مفاتيح الاتصال.</p></div>`;
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

  // قسم التكاملات الحقيقي: backend محمي بدور المالك، لا بيانات نموذجية.
  else if (tab === 'ai') {
    content = renderAIControl(d);
  }
  else if (tab === 'historical') {
    content = renderHistoricalSales(d);
  }
  else if (tab === 'finance') {
    content = renderFinanceSummary(d);
  }

  // ==================== 6. تبويب الإعدادات والتحقق بخطوتين (2FA) وشارجيلي ====================
  else if (tab === 'settings') {
    const ch = d.chargily || {};
    const sec = d.adminSecurity || {};
    const is2FA = !!sec.twoFactorEnabled;
    const methodText = sec.twoFactorMethod === 'telegram' ? 'عبر بوت تيليغرام 📲' : 'عبر Google Authenticator 🔑';

    content = `
      <div class="card"><h3>🔗 التكاملات</h3><p class="ov-caption">إعداد Chargily مستقل عن مفتاح الوكيل الذكي. كلاهما على خادم Render وMongoDB الحالية.</p><button class="btn-pri" onclick="goAdmin('ai')">📱 إعداد الوكيل المحلي — Local AI Agent</button></div>
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
        <p class="ov-caption">تم إلغاء أزرار حذف الحسابات والطلبات من لوحة الإدارة لحماية بيانات الإنتاج. استخدم النسخ الاحتياطي وأدوات الترحيل المعتمدة بدل المسح.</p>
      </div>`;
  }

  document.getElementById('root').innerHTML = `
    <div class="ov-shell">
      <button class="ov-nav-scrim" aria-label="إغلاق القائمة" onclick="toggleAdminNav(false)"></button>
      <aside class="ov-sidebar" id="ovAdminSidebar" aria-label="التنقل بين أقسام الإدارة">
        <div class="ov-brand">OVIRA PLAY <small style="font-size:11px;display:block;color:var(--mut)">إدارة المتجر</small></div>
        <button class="ov-nav-close" onclick="toggleAdminNav(false)">✕ إغلاق القائمة</button>
        <nav class="tabs" aria-label="أقسام لوحة التحكم">
          <div class="ov-nav-group"><span class="ov-nav-group-label">مركز العمل</span>
            ${navButton('overview','🏠 الرئيسية')}
            ${navButton('search','🔍 البحث')}
            ${navButton('activity','🛡️ سجل النشاط')}</div>
          <div class="ov-nav-group"><span class="ov-nav-group-label">المبيعات والتسليم</span>
            ${navButton('orders','📋 طلبات المتجر')}
            ${navButton('historical','🧾 قيود يدوية')}
            ${navButton('finance','📊 المركز المالي')}
            ${navButton('delivered','✅ تم التسليم')}
            ${navButton('renewals','🔔 التجديدات')}
            ${navButton('payments','💳 الدفع وChargily')}</div>
          <div class="ov-nav-group"><span class="ov-nav-group-label">الزبائن والدعم</span>
            ${navButton('customers','👥 العملاء')}
            ${navButton('conversations','💬 مركز الرسائل')}
            ${adminInboxRole()==='owner'?navButton('notifications','🔔 مركز الإشعارات'):''}</div>
          <div class="ov-nav-group"><span class="ov-nav-group-label">المنتجات والتسويق</span>
            ${navButton('products','🛍️ المنتجات')}
            ${navButton('reviews','⭐ التقييمات')}
            ${navButton('marketing','📈 التسويق')}</div>
          <div class="ov-nav-group"><span class="ov-nav-group-label">التكاملات والأمان</span>
            ${navButton('ai','📱 Local AI Agent')}
            ${navButton('engagement','📚 المعرفة والإشعارات')}
            ${navButton('security','🛡️ مركز الأمان')}
            ${navButton('settings','⚙️ الإعدادات و2FA')}</div>
        </nav>
      </aside>
      <div class="ov-workspace">
        <header class="top-bar">
          <button class="ov-menu-toggle" id="ovMenuButton" aria-expanded="false" aria-controls="ovAdminSidebar" aria-label="فتح القائمة" onclick="toggleAdminNav()">☰ القائمة</button>
          <h2>${esc(({overview:'الرئيسية',orders:'طلبات الموقع',historical:'القيود اليدوية',finance:'المركز المالي',delivered:'الطلبات المسلّمة',customers:'الزبائن',conversations:'مركز الرسائل',security:'مركز الأمان',complaints:'الشكاوى',ai:'تكامل الوكيل المحلي',engagement:'تدريب المساعد',notifications:'إشعارات الزبائن',settings:'الإعدادات',activity:'سجل الإدارة',products:'المنتجات',marketing:'التسويق',reviews:'التقييمات',payments:'الدفع',renewals:'التجديدات',search:'البحث'})[tab] || 'OVIRA PLAY')}</h2>
          <button class="btn-sm" aria-label="تبديل الوضع الفاتح والداكن" onclick="toggleAdminTheme()">◐</button>
          <button class="btn-sm" onclick="loadPanel()">⟳</button>
          <button class="btn-sm" onclick="logout()">خروج</button>
        </header>
        <form class="ov-global-search" onsubmit="event.preventDefault();runGlobalSearch(this.elements.globalQuery.value)">
          <input class="inp" name="globalQuery" aria-label="بحث شامل" value="${esc(globalSearch)}" placeholder="🔍 البحث في الطلبات والعملاء والمنتجات">
          <button class="btn-sm">بحث</button>
        </form>
        <main class="ov-panel" id="ov-panel">${content}</main>
      </div>
    </div>`;
  if (tab === 'conversations') inboxOnMount();
  if (tab === 'conversations' && selectedAdminConversation && !selectedAdminConversation.startsWith('__')) loadConversationDetail(selectedAdminConversation);
  else if (tab === 'conversations' && selectedAdminConversation === '__trainer') openOwnerTraining();
  else if (tab === 'conversations' && selectedAdminConversation === '__agent') openAgentStatusPane();
  if (tab === 'ai') refreshAIOperations();
  if (tab === 'products') {
    initPlanEditors();
    if (productQuery) filterProducts(productQuery);
    if (createAfterLoad) { createAfterLoad = false; openCreateProduct(); }
  }
}


window.renderAdminFailure = renderAdminFailure;
window.loadPanel = loadPanel;
window.renderMain = renderMain;

if (!token) {
  renderLogin();
} else {
  loadPanel();
}
