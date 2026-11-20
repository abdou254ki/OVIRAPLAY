// =========================================================
// OVIRA PLAY — HEADER COMPONENT (components/header.js)
// =========================================================

let siteNavOpen = false;
function toggleSiteNav(next) {
  siteNavOpen = typeof next === 'boolean' ? next : !siteNavOpen;
  document.body.classList.toggle('site-nav-open', siteNavOpen);
  document.getElementById('siteMenuButton')?.setAttribute('aria-expanded', String(siteNavOpen));
}

async function updateSiteBellCount(){
  if(!custToken||document.hidden)return;
  try{
    const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});
    const data=await r.json();if(!r.ok||!data.success)return;
    const next=Math.max(0,Number(data.unread)||0);
    if(next!==siteNoteUnread){siteNoteUnread=next;chrome();}
  }catch(_){/* keep existing counter if offline */}
}
setInterval(updateSiteBellCount,60000);


window.toggleSiteNav = toggleSiteNav;
window.updateSiteBellCount = updateSiteBellCount;
