// =========================================================
// OVIRA PLAY — API LAYER (core/api.js)
// =========================================================

const API_BASE = (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  ? 'http://127.0.0.1:5001'
  : 'https://ovira-api.onrender.com';
const API_URL = API_BASE + '/api/orders';
const ACC_URL = API_BASE + '/api/account';
const CHAT_BASE = API_BASE + '/api/v2/conversations';

async function loadCatalog() {
  if (catalogRequest) return catalogRequest;
  catalogStatus = 'loading';
  catalogErrorCode = '';
  draw();
  catalogRequest = (async () => {
    try {
      const response = await fetch(API_URL + '/catalog', { cache: 'no-cache' });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('INVALID_RESPONSE'); }
      if (!response.ok || !data || !data.success || !Array.isArray(data.products)) {
        const err = new Error('CATALOG_FAILED');
        err.code = data?.code === 'RATE_LIMITED' || response.status === 429 ? 'RATE_LIMITED' : 'CATALOG_FAILED';
        throw err;
      }
      P = data.products.filter((p) => p && typeof p.id === 'string' && Array.isArray(p.pl));
      catalogStatus = 'ready';
      try { localStorage.removeItem('ov_catalog'); } catch (_) {}
      route(false);
    } catch (e) {
      P = [];
      catalogStatus = 'error';
      catalogErrorCode = e.code || 'CONNECTION_FAILED';
      draw();
    } finally {
      catalogRequest = null;
    }
  })();
  return catalogRequest;
}
function retryCatalog() { if (!catalogRequest) loadCatalog(); }

async function loadReviewSummary() {
  try {
    const response = await fetch(`${API_URL}/reviews-summary`);
    const data = await response.json();
    if (response.ok && data.success && data.summary && !Array.isArray(data.summary)) {
      productReviewSummary = data.summary;
      updateProductEvidence();
    }
  } catch (_) { /* لا نعرض رقماً غير موثق عند انقطاع الاتصال */ }
}
async function loadDeliveryStats() {
  try {
    const response = await fetch(`${API_URL}/delivery-stats`);
    const data = await response.json();
    const s = data?.stats;
    if (response.ok && data.success && s && Number.isFinite(Number(s.medianMinutes)) && Number(s.sample) >= 10) {
      deliveryStats = s;
      updateProductEvidence();
    }
  } catch (_) { /* لا نعرض وقت تسليم تخمينياً */ }
}


function applyPay(methods) {
  PAY = (methods || []).map(mapPay);
  payLoaded = true;
  if (!PAY.some((x) => x.id == payId)) {
    payId = ((PAY.find((x) => x.id == 'chargily') || PAY[0]) || {}).id || '';
  }
}

function loadPayConfig() {
  return fetch(API_URL + '/payment-config').then((r) => r.json()).then((d) => {
    if (d && d.chargily) chargilyMode = d.chargily.mode;
    if (d && Array.isArray(d.methods)) {
      try { localStorage.setItem('ov_pay', JSON.stringify(d.methods)); } catch (e) {}
      payFailed = false;
      applyPay(d.methods);
      refreshPayUI();
    } else if (!payLoaded) {
      payFailed = true;
      refreshPayUI();
    }
  }).catch(() => {
    if (!payLoaded) { payFailed = true; refreshPayUI(); }
  });
}
loadPayConfig();

async function fetchCustomerProfile() {
  if (!custToken) { custProfile = null; return; }
  try {
    const r = await fetch(ACC_URL + '/me', { headers: { 'Authorization': 'Bearer ' + custToken } });
    if (!r.ok) {
      custToken = '';
      localStorage.removeItem('ov_ctk');
      custProfile = null;
      chrome();
      return;
    }
    const d = await r.json();
    if (d.success) {
      custProfile = d.customer;
      if (location.hash.split('?')[0] === '#/track') location.hash = '#/account';
      custOrders = d.orders || [];
      custComplaints = d.complaints || [];
      chrome();
    }
  } catch (e) {}
}
if (custToken) fetchCustomerProfile();

async function loadSiteNotifications(){if(!custToken)return;
 try{const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});const d=await r.json();if(!r.ok||!d.success)throw Error('تعذر تحميل إشعارات الحساب');siteNoteItems=d.notifications||[];siteNoteUnread=d.unread||0;siteMarketingOptIn=!!d.marketingOptIn;siteNoteLoaded=true;draw();}catch(e){toast(e.message);}}
async function setSiteMarketingOptIn(value){try{const r=await fetch(API_BASE+'/api/v2/site-notifications/preferences',{method:'PATCH',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},body:JSON.stringify({marketingOptIn:value})});if(!r.ok)throw Error('لم تُحفظ تفضيلات العروض');siteMarketingOptIn=value;toast('تم حفظ اختيارك');}catch(e){toast(e.message);draw();}}
async function markSiteNoteRead(id){try{const r=await fetch(API_BASE+'/api/v2/site-notifications/'+encodeURIComponent(id)+'/read',{method:'POST',headers:{Authorization:'Bearer '+custToken}});if(!r.ok)throw Error('تعذر تحديث الإشعار');await loadSiteNotifications();}catch(e){toast(e.message)}}

async function loadProductReviews() {
  const holder = document.getElementById('productReviews');
  if (!holder || catalogStatus !== 'ready') return;

  const id = holder.dataset.product;
  if (!pr(id)) return;

  const cached = productReviewsCache.get(id);
  if (cached?.status === 'loading' || cached?.status === 'done') return;

  productReviewsCache.set(id, { status: 'loading' });
  updateProductEvidence();

  try {
    const response = await fetch(`${API_URL}/reviews/${encodeURIComponent(id)}?page=1&limit=6`, {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();

    if (!response.ok || !data.success || !Array.isArray(data.reviews)) {
      throw new Error('REVIEWS_UNAVAILABLE');
    }

    productReviewsCache.set(id, {
      status: 'done',
      data: {
        ...data,
        page: Number(data.page) || 1,
        hasMore: Boolean(data.hasMore)
      },
      loadingMore: false,
      loadMoreError: false
    });

    if (Number(data.count) > 0) {
      productReviewSummary[id] = {
        count: data.count,
        average: Number(data.average) || productReviewSummary[id]?.average || 0,
        distribution: data.distribution || productReviewSummary[id]?.distribution || {}
      };
    } else {
      delete productReviewSummary[id];
    }
  } catch (_) {
    productReviewsCache.set(id, { status: 'failed' });
  }

  updateProductEvidence();
}

window.loadMoreProductReviews = async () => {
  const holder = document.getElementById('productReviews');
  if (!holder) return;

  const id = holder.dataset.product;
  const cached = productReviewsCache.get(id);

  if (!cached || cached.status !== 'done' || cached.loadingMore || !cached.data?.hasMore) return;

  cached.loadingMore = true;
  cached.loadMoreError = false;
  updateProductEvidence();

  try {
    const nextPage = (Number(cached.data.page) || 1) + 1;
    const response = await fetch(
      `${API_URL}/reviews/${encodeURIComponent(id)}?page=${nextPage}&limit=6`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await response.json();

    if (!response.ok || !data.success || !Array.isArray(data.reviews)) {
      throw new Error('REVIEWS_PAGE_UNAVAILABLE');
    }

    cached.data.reviews = [...cached.data.reviews, ...data.reviews];
    cached.data.page = Number(data.page) || nextPage;
    cached.data.hasMore = Boolean(data.hasMore);
    cached.data.count = Number(data.count) || cached.data.count;
    cached.data.average = Number(data.average) || cached.data.average;
    cached.data.distribution = data.distribution || cached.data.distribution;
  } catch (_) {
    cached.loadMoreError = true;
  } finally {
    cached.loadingMore = false;
    updateProductEvidence();
  }
};


window.submitReview = async (productId) => {
  const stars = Number(document.getElementById('reviewStars')?.value);
  const comment = document.getElementById('reviewText')?.value || '';
  try {
    const r = await fetch(ACC_URL+'/reviews', {method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+custToken},
      body:JSON.stringify({productId,stars,comment})});
    const d = await r.json();toast(d.message || 'تم إرسال التقييم');
  } catch(e){toast('تعذر إرسال التقييم');}
};

// Public announcements are independent of authenticated account notifications.
let ovAnnouncementTimer=null;
async function loadPublicAnnouncements(){
 const node=document.getElementById('ovAnnouncements');if(!node)return;
 try{
  const r=await fetch(API_BASE+'/api/v2/announcements',{cache:'no-store'});
  const d=await r.json();if(!r.ok||!d.success)throw Error('unavailable');
  const rows=(d.announcements||[]).slice(0,3);
  node.hidden=!rows.length;
  node.innerHTML=rows.map(a=>`<article class="ov-announcement"><strong>📢 ${esc(a.title)}</strong><span>${esc(a.body)}</span></article>`).join('');
 }catch(_){node.hidden=true;node.replaceChildren();}
}
loadPublicAnnouncements();
ovAnnouncementTimer=setInterval(()=>{if(!document.hidden)loadPublicAnnouncements();},120000);

// Keep the notification badge fresh without re-rendering an active chat composer.
let ovNotePollBusy=false;
async function refreshAccountNotificationBadge(){
 if(ovNotePollBusy||!custToken||document.hidden)return;
 ovNotePollBusy=true;
 try{
  const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});
  if(!r.ok)return;
  const d=await r.json();if(!d.success)return;
  siteNoteUnread=Number(d.unread)||0;
  const bell=document.querySelector('#hd .ov-bell');
  if(bell){
    let mark=bell.querySelector('.cnt');
    if(siteNoteUnread){if(!mark){mark=document.createElement('span');mark.className='cnt';bell.appendChild(mark);}mark.textContent=String(siteNoteUnread);}
    else if(mark)mark.remove();
  }
 }catch(_){/* keep current display on network loss */}
 finally{ovNotePollBusy=false;}
}


window.API_BASE = API_BASE;
window.API_URL = API_URL;
window.ACC_URL = ACC_URL;
window.CHAT_BASE = CHAT_BASE;
window.loadCatalog = loadCatalog;
window.retryCatalog = retryCatalog;
window.loadReviewSummary = loadReviewSummary;
window.loadDeliveryStats = loadDeliveryStats;
window.applyPay = applyPay;
window.loadPayConfig = loadPayConfig;
window.fetchCustomerProfile = fetchCustomerProfile;
window.loadSiteNotifications = loadSiteNotifications;
window.setSiteMarketingOptIn = setSiteMarketingOptIn;
window.markSiteNoteRead = markSiteNoteRead;
window.loadProductReviews = loadProductReviews;
window.loadPublicAnnouncements = loadPublicAnnouncements;
window.refreshAccountNotificationBadge = refreshAccountNotificationBadge;
