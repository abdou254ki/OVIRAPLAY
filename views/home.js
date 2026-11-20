// =========================================================
// OVIRA PLAY — HOME VIEW (views/home.js)
// =========================================================

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


window.gc = gc;
window.card = card;
window.home = home;
