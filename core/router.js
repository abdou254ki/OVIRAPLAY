// =========================================================
// OVIRA PLAY — ROUTER & ORCHESTRATION (core/router.js)
// =========================================================

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

  // 2.5: مسار 404 مخصص للمسارات غير المعروفة
  const knownRoutes = ['home', '', 'shop', 'cart', 'checkout', 'done', 'track', 'account', 'support'];
  if (!knownRoutes.includes(v)) {
    document.title = '404 — الصفحة غير موجودة | OVIRA PLAY';
    return `<div class="w ov-404" role="region" aria-label="الصفحة غير موجودة">
      <div style="font-size: 64px; line-height: 1; margin-bottom: 16px;">🔍</div>
      <h1 style="font-size: 28px; margin: 0 0 12px; color: var(--text-primary);">404 — الصفحة غير موجودة</h1>
      <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 24px; line-height: 1.6;">عذراً، الرابط الذي تحاول الوصول إليه غير موجود أو تم تغييره. يمكنك العودة إلى الصفحة الرئيسية أو تصفح المتجر.</p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <a href="#/" class="ovx-btn ovx-btn-primary" style="text-decoration: none; padding: 12px 24px;">الصفحة الرئيسية</a>
        <a href="#/shop" class="ovx-btn" style="text-decoration: none; padding: 12px 24px; border: 1px solid var(--border-hairline);">تصفح المتجر</a>
      </div>
    </div>`;
  }

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


window.catalogLoading = catalogLoading;
window.catalogUnavailable = catalogUnavailable;
window.catalogEmpty = catalogEmpty;
window.view = view;
window.chrome = chrome;
window.draw = draw;
window.route = route;
window.back = back;
window.setCat = setCat;
