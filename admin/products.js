// =========================================================
// OVIRA PLAY — ADMIN PRODUCTS MANAGEMENT (admin/products.js)
// =========================================================

function onProductToggle(node, id) {
  if (!node.open) return;
  openProductId = id;
  document.querySelectorAll('details.compact-product').forEach((other) => { if (other !== node) other.open = false; });
}

function searchProduct(title) {
  productQuery = title.toLowerCase();
  goAdmin('products');
}

function startCreateProduct() { createAfterLoad = true; goAdmin('products'); }
function openCreateProduct() {
  const block = document.getElementById('createProductBlock');
  if (block) { block.open = true; block.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

function filterProducts(term) {
  productQuery = String(term || '').toLowerCase().trim();
  document.querySelectorAll('.product-card[data-search]').forEach((el) => {
    el.hidden = Boolean(productQuery && !el.dataset.search.includes(productQuery));
  });
}

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

function suggestProductDescription() {
  const brand = document.getElementById('np_brand')?.value.trim();
  if (!brand) return toast('أدخل اسم العلامة أولًا');
  const title = document.getElementById('np_title');
  const sub = document.getElementById('np_sub');
  const feat = document.getElementById('np_feats');
  if (title && !title.value.trim()) title.value = brand + ' — باقات اشتراك';
  if (sub && !sub.value.trim()) sub.value = 'اختر باقة ' + brand + ' المناسبة من حيث المدة والنوع. تظهر التفاصيل والسعر النهائي قبل إتمام الطلب، مع إرشادات التسليم بعد التحقق من الدفع.';
  // لا نقترح مميزات قد لا تكون متوفرة فعلاً في هذا الاشتراك.
  toast('تم إنشاء وصف أولي؛ أضف المميزات والضمان الفعليين بنفسك قبل النشر');
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
    featuresText: document.getElementById('np_feats').value.trim(),
    stepsText: document.getElementById('np_steps').value.trim(),
    ...landingPayload('np')
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
    stepsText: document.getElementById('pr_st_' + id).value.trim(),
    ...landingPayload('pr_' + id)
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


window.onProductToggle = onProductToggle;
window.searchProduct = searchProduct;
window.startCreateProduct = startCreateProduct;
window.openCreateProduct = openCreateProduct;
window.filterProducts = filterProducts;
window.readPlanRows = readPlanRows;
window.initPlanEditors = initPlanEditors;
window.renderPlanEditor = renderPlanEditor;
window.planEditorRows = planEditorRows;
window.syncPlanEditor = syncPlanEditor;
window.addPlanRow = addPlanRow;
window.removePlanRow = removePlanRow;
window.onlyFeatured = onlyFeatured;
window.planRawChanged = planRawChanged;
window.plansValid = plansValid;
window.previewProduct = previewProduct;
window.loadProductRevisions = loadProductRevisions;
window.restoreProductRevision = restoreProductRevision;
window.suggestProductDescription = suggestProductDescription;
window.createProduct = createProduct;
window.updateProduct = updateProduct;
window.toggleProduct = toggleProduct;
window.deleteProduct = deleteProduct;
