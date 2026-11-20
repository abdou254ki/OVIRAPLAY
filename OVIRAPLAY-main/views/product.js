// =========================================================
// OVIRA PLAY — PRODUCT DETAILS VIEW (views/product.js)
// =========================================================

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


window.landingList = landingList;
window.landingText = landingText;
window.formatDeliveryTime = formatDeliveryTime;
window.deliveryEvidence = deliveryEvidence;
window.reviewEvidence = reviewEvidence;
window.updateProductEvidence = updateProductEvidence;
window.prod = prod;
window.pickPlan = pickPlan;
window.add = add;
window.leaveEdit = leaveEdit;
