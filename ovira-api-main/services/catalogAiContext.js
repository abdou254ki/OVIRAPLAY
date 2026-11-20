// Read-only, current-price context. No seed data and no direct agent DB access.
const MAX_CONTEXT = 1850;
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const priceIntent = (text) => /(?:اسعار|أسعار|الاسعار|الأسعار|السعر|سعر|كم|بكم|ثمن|اشتراكات|باقات|prix|price|tarif|combien|abonnement)/i.test(String(text || ''));
function selectProducts(products, question) {
  const q = norm(question);
  const words = q.split(' ').filter(x => x.length >= 3 && !/^(?:كيف|يمكن|معرفة|سعر|اسعار|اشتراك|اشتراكات|باقات|بكم|الاسعار|السعر|كم|ثمن|prix|price|tarif)$/.test(x));
  const matched = (products || []).filter(p => {
    const desc = norm([p.title, p.brandName, p.productId].join(' '));
    return words.some(w => desc.includes(w));
  });
  return matched.length ? matched : products;
}
function renderCatalog(products, question, maxChars = MAX_CONTEXT) {
  if (!priceIntent(question)) return '';
  const all = Array.isArray(products) ? products.filter(p => p.active !== false) : [];
  if (!all.length) return 'الأسعار: لا توجد منتجات نشطة متاحة من قاعدة البيانات؛ لا تذكر سعرًا.';
  const selected = selectProducts(all, question);
  const entries = [];
  let used = 0;
  for (const product of selected) {
    const safeName = String(product.title || product.brandName || '').replace(/[\r\n<>]/g, ' ').slice(0, 85);
    const plans = Array.isArray(product.plans) ? product.plans : [];
    const valid = plans.filter(p => Number.isSafeInteger(p.months) && p.months > 0 && Number.isFinite(p.price) && p.price >= 0);
    if (!safeName || !valid.length) continue;
    const line = safeName + ': ' + valid.slice(0, 8).map(p => `${p.months} شهر = ${p.price} دج`).join('، ') + '.';
    if (used + line.length + 1 > maxChars) break;
    entries.push(line);
    used += line.length + 1;
  }
  if (!entries.length) return 'لم تتوفر أسعار صالحة مؤكدة في الكتالوج لهذا السؤال؛ اطلب تحديد الاشتراك.';
  const partial = entries.length < selected.length;
  return 'كتالوج حي من MongoDB (منتجات نشطة فقط، وقت سحب المهمة):\n' + entries.join('\n') + (partial ? '\nهذه قائمة جزئية؛ اسأل الزبون عن اسم الاشتراك للحصول على سعره.' : '');
}
async function liveContext(question) {
  const Product = require('../models/Product');
  if (!priceIntent(question)) return '';
  // Explicit whitelist: no customer, cost, stock, fulfilment or secret fields.
  const products = await Product.find({ active: true }).select('productId brandName title plans.months plans.price active sortOrder -_id')
    .sort({ sortOrder: 1, productId: 1 }).limit(250).lean();
  return renderCatalog(products, question);
}
module.exports = { liveContext, renderCatalog, priceIntent, selectProducts };
