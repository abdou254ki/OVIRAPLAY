// =========================================================
// OVIRA PLAY — HOME VIEW (views/home.js)
// Redesigned with modern, premium subscription storefront UX
// =========================================================

const gc = (p, eager = false) => `
  <div class="gc">
    ${p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.n)}" width="56" height="56" loading="${eager ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${eager ? 'high' : 'auto'}" style="width:56px;height:56px;object-fit:contain;border-radius:14px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3))">`
      : `<i class="ic" style="background:${esc(p.c)}">${esc(p.l)}</i>`}
    <small>${esc(p.n)}</small>
  </div>`;

const card = (p) => {
  const plans = (Array.isArray(p.pl) ? p.pl : []).filter((x) => Number.isFinite(Number(x[1])));
  const cheapest = plans.length ? Math.min(...plans.map((x) => Number(x[1]))) : null;
  const searchable = [p.t, p.n, p.cat, p.sub].filter(Boolean).join(' ').toLowerCase();

  const catIcon = (p.cat || '').includes('أنمي') || (p.cat || '').includes('أفلام') || (p.cat || '').includes('بث') ? '🎬'
    : (p.cat || '').includes('ذكاء') || (p.cat || '').includes('برامج') ? '🤖'
    : (p.cat || '').includes('ألعاب') || (p.cat || '').includes('Gaming') ? '🎮'
    : (p.cat || '').includes('موسيقى') ? '🎵'
    : '✨';

  return `<a class="pc ovx-product-card"
      href="#/p/${encodeURIComponent(p.id)}"
      style="--c:${esc(p.c)};--c2:${esc(p.c2)}"
      data-search="${esc(searchable)}"
      data-price="${cheapest === null ? 999999999 : cheapest}"
      data-title="${esc(String(p.t || '').toLocaleLowerCase())}"
      data-index="${Math.max(0, P.indexOf(p))}">
    <div class="ovx-product-card-art">
      <div class="ovx-card-badge-row">
        <span class="ovx-card-cat-badge">${catIcon} ${esc(p.cat || 'اشتراك رقمي')}</span>
        <span class="ovx-card-guarantee-badge">⚡ تسليم فوري</span>
      </div>
      <div class="ovx-card-logo-wrap">${gc(p)}</div>
    </div>
    <div class="ovx-product-card-body">
      <div class="ovx-card-title-line">
        <div>
          <h3>${esc(p.t)}</h3>
          <p class="ovx-card-sub">${esc(p.sub || p.n || 'اشتراك أصلي ومضمون طوال المدة')}</p>
        </div>
        <span class="ovx-card-arrow" aria-hidden="true">↗</span>
      </div>
      <div class="ovx-card-features">
        <span>✓ جودة أصلية وباقات متعددة</span>
        <span>✓ ضمان استرجاع ودعم متواصل</span>
      </div>
      <div class="ovx-card-divider"></div>
      <div class="ovx-card-bottom">
        <div class="ovx-card-price">
          <small>${cheapest !== null ? 'السعر يبدأ من' : 'السعر'}</small>
          <strong>${cheapest !== null ? fmt(cheapest) : 'غير متاح'}</strong>
        </div>
        <span class="ovx-card-cta">اكتشف الباقات <b>←</b></span>
      </div>
    </div>
  </a>`;
};

const home = () => {
  const categories = [...new Set(P.map((p) => p.cat).filter(Boolean))];
  const planCount = P.reduce((total, product) => total + (Array.isArray(product.pl) ? product.pl.length : 0), 0);
  const services = [
    { icon: '🎬', title: 'الترفيه والبث', description: 'نتفلكس، شاهد VIP، يوتيوب بريميوم وغيرها بأعلى جودة 4K.', message: 'مرحباً، أريد الاستفسار عن اشتراكات الترفيه والبث.' },
    { icon: '🤖', title: 'الذكاء الاصطناعي', description: 'ChatGPT Plus و Canva Pro وغيرها لزيادة إنتاجيتك.', message: 'مرحباً، أريد الاستفسار عن أدوات الذكاء الاصطناعي.' },
    { icon: '🎮', title: 'الألعاب والمنصات', description: 'اشتراكات وخدمات مخصصة لعشاق الألعاب الإلكترونية.', message: 'مرحباً، أريد الاستفسار عن خدمات الألعاب.' },
    { icon: '🛡️', title: 'خدمات الويب والحماية', description: 'حسابات مطورين وخدمات VPN متقدمة وتطوير مواقع.', message: 'مرحباً، أريد الاستفسار عن خدمات تطوير المواقع والحماية.' }
  ];
  const serviceUrl = (message) => CFG.wa
    ? `https://wa.me/${CFG.wa}?text=${encodeURIComponent(message)}`
    : '#/support';

  return `
    <div class="w ov-home ovx-home">
      <!-- HERO SECTION -->
      <section class="ovx-hero" aria-labelledby="ovHomeTitle">
        <div class="ovx-hero-copy">
          <div class="ovx-eyebrow">
            <span class="ovx-live-dot"></span>
            <b>OVIRA PLAY</b> · المتجر الجزائري الأول للاشتراكات الرقمية
          </div>
          <h1 id="ovHomeTitle">
            اشتراكاتك الرقمية المفضلة،<br>
            <span>بأفضل الأسعار والتسليم الفوري.</span>
          </h1>
          <p class="ovx-hero-description">
            شاهد، ابتكر، والعب دون انقطاع. باقات متنوعة لـ Netflix و ChatGPT و YouTube و Spotify مع دعم الدفع عبر بريدي موب والذهبية وضمان كامل طوال الاشتراك.
          </p>
          <div class="ovx-hero-actions">
            <a class="ovx-btn ovx-btn-primary" href="#/shop">تصفح كل الاشتراكات <span>←</span></a>
            <a class="ovx-btn ovx-btn-glass" href="#/account">حسابي وطلباتي</a>
          </div>
          <div class="ovx-hero-assurances">
            <span><b>✓</b> تسليم سريع ومباشر</span>
            <span><b>✓</b> أسعار شفافة وثابتة</span>
            <span><b>✓</b> ضمان استرجاع واستبدال</span>
            <span><b>✓</b> دعم متواصل 24/7</span>
          </div>
          <div class="ovx-payment-methods" aria-label="طرق الدفع المدعومة">
            <span class="ovx-payment-badge">💳 <b>Chargily</b> Pay (الذهبية/CIB)</span>
            <span class="ovx-payment-badge">🏦 <b>بريدي</b> موب (BaridiMob)</span>
            <span class="ovx-payment-badge">📮 <b>CCP</b></span>
            <span class="ovx-payment-badge">₿ <b>Binance</b> Pay</span>
          </div>
          <div class="ovx-live-stats" aria-label="إحصاءات الكتالوج الحالي">
            <div><strong>${P.length}</strong><span>خدمة رقمية</span></div>
            <i></i>
            <div><strong>${categories.length}</strong><span>تصنيفات رئيسية</span></div>
            <i></i>
            <div><strong>${planCount}</strong><span>باقة متاحة</span></div>
            <i></i>
            <div><strong>4.9 ★</strong><span>تقييم العملاء</span></div>
          </div>
        </div>

        <div class="ovx-hero-art" aria-label="هوية OVIRA PLAY الرقمية">
          <div class="ovx-art-glow"></div>
          <div class="ovx-art-main">
            <div class="ovx-art-top">
              <span>OVIRA <b>PLAY</b></span>
              <span class="ovx-pulse-status">متاح أونلاين ⚡</span>
            </div>
            <div class="ovx-art-emblem"><span>▶</span></div>
            <strong>YOUR PREMIUM<br><em>DIGITAL HUB</em></strong>
            <div class="ovx-art-bottom">
              <span>NETFLIX</span>
              <span>CHATGPT</span>
              <span>SPOTIFY</span>
              <span>CANVA</span>
            </div>
          </div>
          ${P.slice(0, 2).map((p, i) => `
            <div class="ovx-floating-product ovx-floating-product-${i + 1}" style="--float-color:${esc(p.c || '#0EA5E9')}">
              <span class="ovx-floating-mark">${esc(p.l || '✦')}</span>
              <span><b>${esc(p.n || p.t)}</b><small>${esc(p.cat || 'DIGITAL')}</small></span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- CATEGORY NAVIGATION STRIP -->
      <section class="ovx-category-strip" aria-label="تصفح التصنيفات">
        <div class="ovx-strip-label"><span>01</span><b>تصفّح حسب الفئة:</b></div>
        <div class="ovx-category-list">
          <button class="ovx-category-pill on" onclick="setCat('الكل'); location.hash='#/shop';">🌟 كل المنتجات</button>
          ${categories.slice(0, 6).map((c) => `<button class="ovx-category-pill" onclick="setCat('${esc(c)}'); location.hash='#/shop';">${esc(c)} <span>↗</span></button>`).join('')}
        </div>
      </section>

      <!-- FEATURED PRODUCTS -->
      <section class="ovx-section">
        <div class="ovx-section-heading">
          <div>
            <span class="ovx-kicker">CURATED SELECTION · 02</span>
            <h2>الاشتراكات الأكثر طلباً</h2>
            <p>اختر الخدمة، حدد مدة الباقة، واستلم بيانات حسابك فوراً.</p>
          </div>
          <a class="ovx-text-link" href="#/shop">عرض كل المنتجات (${P.length}) <span>←</span></a>
        </div>
        ${P.length
          ? `<div class="g ov-home-product-grid ovx-product-grid">${P.slice(0, 6).map(card).join('')}</div>`
          : catalogEmpty()}
      </section>

      <!-- VALUE PROPOSITIONS -->
      <section class="ovx-service-section">
        <div class="ovx-section-heading">
          <div>
            <span class="ovx-kicker">SERVICES & SUPPORT · 03</span>
            <h2>لماذا يفضل العملاء OVIRA PLAY؟</h2>
            <p>حلول متكاملة تضمن لك راحة البال طوال فترة الاشتراك.</p>
          </div>
        </div>
        <div class="ov-home-service-grid ovx-service-grid">
          ${services.map((service, index) => `
            <a class="ov-home-service ovx-service-card" href="${serviceUrl(service.message)}" ${CFG.wa ? 'target="_blank" rel="noopener noreferrer"' : ''}>
              <span class="ov-home-service-top"><i style="font-style:normal">${service.icon}</i><small>0${index + 1}</small></span>
              <b>${esc(service.title)}</b>
              <p>${esc(service.description)}</p>
              <span class="ov-home-service-link">${CFG.wa ? 'استفسار عبر واتساب' : 'الدعم الفني'} <span>↗</span></span>
            </a>
          `).join('')}
        </div>
      </section>

      <!-- STEP-BY-STEP WORKFLOW -->
      <section class="ovx-how-section">
        <div class="ovx-how-intro">
          <span class="ovx-kicker">SIMPLE WORKFLOW · 04</span>
          <h2>كيف يعمل المتجر؟</h2>
          <p>3 خطوات سهلة ومباشرة من اختيار الباقة حتى استلام الحساب.</p>
          <a class="ovx-text-link" href="#/shop">ابدأ التسوق الآن <span>←</span></a>
        </div>
        <div class="ovx-how-steps">
          <article>
            <span class="step-num">01</span>
            <b>اختر الباقة المناسبة</b>
            <p>تصفح كتالوج الخدمات، قارن بين الشاشات والمدد الشهرية أو السنوية والأسعار.</p>
          </article>
          <article>
            <span class="step-num">02</span>
            <b>اختر وسيلة الدفع وأكد طلبك</b>
            <p>ادفع فورياً عبر الذهبية/CIB، أو حول عبر بريدي موب مع وصل التحويل.</p>
          </article>
          <article>
            <span class="step-num">03</span>
            <b>استلم حسابك فوراً</b>
            <p>تصلك بيانات الحساب والشاشة مباشرة مع كود PIN وإرشادات التشغيل والضمان.</p>
          </article>
        </div>
      </section>

      <!-- FOOTER TEASER -->
      <footer class="ovx-footer">
        <a class="logo" href="#/"><i>▶</i><span>OVIRA <b>PLAY</b></span></a>
        <p>متجرك الموثوق للاشتراكات والخدمات الرقمية في الجزائر.</p>
        <div class="ovx-footer-links">
          <a href="#/shop">المتجر</a>
          <a href="#/account">حسابي</a>
          <a href="#/support">الدعم الفني</a>
          <a href="#/track">تتبع الطلب</a>
        </div>
        <small>© ${new Date().getFullYear()} OVIRA PLAY. جميع الحقوق محفوظة.</small>
      </footer>
    </div>
  `;
};

window.gc = gc;
window.card = card;
window.home = home;
