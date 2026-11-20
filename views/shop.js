// =========================================================
// OVIRA PLAY — SHOP VIEW (views/shop.js)
// =========================================================

const shop = () => {
  if (!P.length) return catalogEmpty();
  const cats = ['الكل', ...new Set(P.map((p) => p.cat).filter(Boolean))];
  let products = P.filter((p) => cat === 'الكل' || p.cat === cat);
  if (shopQuery.trim()) {
    const q = shopQuery.trim().toLocaleLowerCase();
    products = products.filter((p) => [p.t, p.n, p.cat, p.sub].filter(Boolean).join(' ').toLocaleLowerCase().includes(q));
  }
  const priceOf = (p) => {
    const prices = (p.pl || []).map((x) => Number(x[1])).filter(Number.isFinite);
    return prices.length ? Math.min(...prices) : Number.MAX_SAFE_INTEGER;
  };
  if (shopSort === 'price-low') products.sort((a, b) => priceOf(a) - priceOf(b));
  else if (shopSort === 'price-high') products.sort((a, b) => priceOf(b) - priceOf(a));
  else if (shopSort === 'name') products.sort((a, b) => String(a.t).localeCompare(String(b.t), 'ar'));
  else products.sort((a, b) => P.indexOf(a) - P.indexOf(b));

  return `<div class="w ovx-shop">
    <section class="ovx-shop-heading">
      <div><span class="ovx-kicker">OVIRA PLAY / STORE</span><h1>اكتشف المتجر.</h1><p>تصفّح المنتجات الرقمية والباقات المنشورة، واختر ما يناسبك.</p></div>
      <div class="ovx-shop-count"><strong>${P.length}</strong><span>منتج<br>في الكتالوج</span></div>
    </section>
    <section class="ovx-shop-tools" aria-label="البحث والتصفية">
      <label class="ovx-search-box"><span aria-hidden="true">⌕</span><input id="ovShopSearch" type="search" value="${esc(shopQuery)}" placeholder="ابحث عن منتج أو منصة..." autocomplete="off" oninput="filterShopProducts(this.value)"><kbd>بحث</kbd></label>
      <label class="ovx-sort-box"><span>ترتيب حسب</span><select id="ovShopSort" onchange="sortShopProducts(this.value)">
        <option value="featured" ${shopSort === 'featured' ? 'selected' : ''}>المقترحة</option>
        <option value="price-low" ${shopSort === 'price-low' ? 'selected' : ''}>السعر: الأقل أولاً</option>
        <option value="price-high" ${shopSort === 'price-high' ? 'selected' : ''}>السعر: الأعلى أولاً</option>
        <option value="name" ${shopSort === 'name' ? 'selected' : ''}>الاسم</option>
      </select></label>
    </section>
    <div class="ovx-shop-category-row">
      <div class="chips ovx-shop-chips">${cats.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-category="${esc(c)}" onclick="setCat(this.dataset.category)">${esc(c)}</button>`).join('')}</div>
      <span id="ovShopResultCount">${products.length} نتيجة</span>
    </div>
    <div class="g ovx-product-grid ovx-shop-grid" id="ovShopGrid">${products.map(card).join('')}</div>
    <div class="ovx-shop-empty" id="ovShopEmpty" ${products.length ? 'hidden' : ''}><span>⌕</span><h2>لم نعثر على نتيجة</h2><p>جرّب كلمة أخرى أو اختر تصنيفاً مختلفاً.</p><button class="ovx-btn ovx-btn-primary" type="button" onclick="clearShopFilters()">إظهار كل المنتجات</button></div>
  </div>`;
};


// 2.2: دمج دالة Debounce في تصفية المنتجات
const doFilterShopProducts = (value) => {
  shopQuery = String(value || '');
  const q = shopQuery.trim().toLocaleLowerCase();
  const cards = [...document.querySelectorAll('#ovShopGrid .ovx-product-card')];
  let visible = 0;
  cards.forEach((node) => {
    const show = !q || (node.dataset.search || '').includes(q);
    node.hidden = !show;
    if (show) visible++;
  });
  const count = document.getElementById('ovShopResultCount');
  if (count) count.textContent = `${visible} نتيجة`;
  const empty = document.getElementById('ovShopEmpty');
  if (empty) empty.hidden = visible > 0;
};

const debouncedFilter = debounce(doFilterShopProducts, 300);

window.filterShopProducts = (value) => {
  debouncedFilter(value);
};

window.sortShopProducts = (value) => {
  shopSort = value || 'featured';
  const grid = document.getElementById('ovShopGrid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.ovx-product-card')];
  cards.sort((a, b) => {
    if (shopSort === 'price-low') return Number(a.dataset.price) - Number(b.dataset.price);
    if (shopSort === 'price-high') return Number(b.dataset.price) - Number(a.dataset.price);
    if (shopSort === 'name') return (a.dataset.title || '').localeCompare(b.dataset.title || '', 'ar');
    return Number(a.dataset.index) - Number(b.dataset.index);
  }).forEach((node) => grid.appendChild(node));
};

window.clearShopFilters = () => {
  shopQuery = '';
  cat = 'الكل';
  shopSort = 'featured';
  draw();
};


window.shop = shop;
