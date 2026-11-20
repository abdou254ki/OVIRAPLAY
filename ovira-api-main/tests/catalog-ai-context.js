const assert = require('node:assert/strict');
const { renderCatalog, priceIntent } = require('../services/catalogAiContext');
const products = [
  {title:'اشتراك ألف',brandName:'A',productId:'a',active:true,plans:[{months:1,price:999},{months:3,price:2500}]},
  {title:'اشتراك باء',brandName:'B',productId:'b',active:false,plans:[{months:1,price:1}]},
  {title:'اشتراك جيم',brandName:'C',productId:'c',active:true,plans:[{months:1,price:-5},{months:6,price:3200}]}
];
assert(priceIntent('ما هي أسعار الاشتراكات؟'));
assert.equal(priceIntent('مرحبا'), false);
const x=renderCatalog(products,'ما هي أسعار الاشتراكات؟');
assert(x.includes('999 دج'));
assert(x.includes('2500 دج'));
assert(x.includes('3200 دج'));
assert(!x.includes('اشتراك باء'));
assert(!x.includes('-5 دج'));
assert(renderCatalog([], 'سعر الاشتراك').includes('لا توجد منتجات'));
assert.equal(renderCatalog(products,'كيف اتابع طلبي'), '');
assert(!renderCatalog(products,'اشتراك ألف سعر',500).includes('اشتراك جيم'));
console.log('catalog-ai-context: OK');
