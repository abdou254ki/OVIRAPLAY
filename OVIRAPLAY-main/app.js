// =========================================================
// OVIRA PLAY — MAIN ENTRY POINT (app.js)
// Bootstrap & Event Listeners
// Checkout architecture (views/cart.js): checkout-steps | الدفع اليدوي لا يُؤكَّد تلقائيًا
// =========================================================

window.addEventListener('hashchange', () => route(true));

const fab = $('#fab');
if (fab) {
  fab.href = '#/support';
  fab.removeAttribute('target');
  fab.setAttribute('aria-label', 'الدعم المباشر والمحادثات');
}

window.addEventListener('offline', () => {
  toast('انقطع الاتصال بالإنترنت — وضع التصفح دون اتصال');
});
window.addEventListener('online', () => {
  toast('تم استعادة الاتصال بالإنترنت ✓');
  if (catalogStatus !== 'ready') loadCatalog();
});

// بدء التشغيل
loadCatalog();
loadReviewSummary();
loadDeliveryStats();
loadPublicAnnouncements();

setInterval(() => {
  if (!document.hidden) loadPublicAnnouncements();
}, 120000);

setInterval(refreshAccountNotificationBadge, 60000);
refreshAccountNotificationBadge();

route(false);
