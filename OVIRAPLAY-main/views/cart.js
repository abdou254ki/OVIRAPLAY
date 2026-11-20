// =========================================================
// OVIRA PLAY — CART & CHECKOUT (views/cart.js)
// =========================================================

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



function qty(k, d) {
  cart[k].q = Math.min(9, Math.max(1, cart[k].q + d));
  save();
  draw();
}

// 2.2: تأكيد للمستخدم قبل الحذف
function del(k) {
  if (!confirm('هل تريد بالتأكيد إزالة هذا الاشتراك من السلة؟')) return;
  cart.splice(k, 1);
  save();
  draw();
  toast('تم الحذف من السلة');
}

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



window.renderDeliveredBox = renderDeliveredBox;
window.renderPaymentReceiptBox = renderPaymentReceiptBox;
window.cartV = cartV;
window.chk = chk;
window.doneV = doneV;
window.qty = qty;
window.del = del;
window.chg = chg;
window.pick = pick;
window.send = send;
