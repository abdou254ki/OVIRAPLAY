'use strict';
/* OVIRA inbox: presentation and list navigation only. All permissions are checked by Render. */
const ovInboxState={rows:[],nextCursor:null,hasMore:false,filter:'all',query:'',selected:'',loading:false,serial:0,searchTimer:null,listScroll:0};
const OV_INBOX_FILTERS=[['all','الكل'],['unread','غير المقروء'],['needs_reply','تنتظر ردي'],['agent','مسودات AI'],['human','بيد الموظف'],['closed','مغلقة']];
function ovInboxSafeId(value){return /^[a-f0-9]{24}$/i.test(String(value||''))?String(value):'';}
function ovInboxTime(value){
 const date=new Date(value||'');if(!Number.isFinite(date.getTime()))return '';
 const delta=Date.now()-date.getTime();
 if(delta>=0&&delta<60000)return 'الآن';
 if(delta>=0&&delta<3600000)return Math.max(1,Math.floor(delta/60000))+' د';
 const today=new Date();if(date.toDateString()===today.toDateString())return date.toLocaleTimeString('ar-DZ',{hour:'2-digit',minute:'2-digit'});
 return date.toLocaleDateString('ar-DZ',{month:'short',day:'numeric'});
}
function ovInboxInitial(name){return String(name||'ز').trim().slice(0,1).toUpperCase()||'ز';}
function ovInboxAvatarClass(id){let num=0;for(const c of String(id||''))num=(num+c.charCodeAt(0))%4;return 'tone-'+num;}
function ovInboxRowMarkup(item){
 const id=ovInboxSafeId(item._id);if(!id)return '';
 const name=String(item.displayName||item.guestName||item.subject||'زبون المتجر').slice(0,80);
 const snippet=String(item.lastMessageText||'بداية محادثة').slice(0,110);
 const unread=Math.max(0,Math.min(999,Number(item.unreadAdmin)||0));
 const badge=item.aiMode==='human'?'بشري':item.channel==='whatsapp'?'WhatsApp':'مسودات AI';
 return `<button class="ov-inbox-contact ${id===ovInboxState.selected?'is-current':''} ${unread?'has-unread':''}" onclick="inboxSelect('${id}')" data-inbox-id="${id}" aria-label="محادثة ${esc(name)}">
    <span class="ov-inbox-avatar ${ovInboxAvatarClass(id)}" aria-hidden="true">${esc(ovInboxInitial(name))}</span>
    <span class="ov-inbox-contact-text"><span class="ov-inbox-contact-title"><b>${esc(name)}</b><time>${esc(ovInboxTime(item.lastMessageAt))}</time></span>
    <span class="ov-inbox-excerpt">${item.lastSender==='admin'?'أنت: ':''}${esc(snippet)}</span>
    <span class="ov-inbox-tags"><span>${esc(badge)}</span>${item.needsReply?'<span class="ov-inbox-needs">تنتظر ردك</span>':''}</span></span>
    ${unread?`<span class="ov-inbox-unread" aria-label="${unread} رسالة غير مقروءة">${unread}</span>`:''}
   </button>`;
}
function ovInboxUpdateRows(){
 const box=document.getElementById('inboxCustomerRows');if(!box)return;
 const list=document.getElementById('inboxContacts');const previousScroll=list?.scrollTop||0;
 box.innerHTML=ovInboxState.rows.map(ovInboxRowMarkup).join('')||'<div class="ov-inbox-empty">لا توجد محادثات ضمن هذا التصنيف.</div>';
 const more=document.getElementById('inboxLoadMore');if(more){more.hidden=!ovInboxState.hasMore;more.disabled=ovInboxState.loading;more.textContent=ovInboxState.loading?'يُحمّل…':'عرض محادثات أقدم';}
 const count=document.getElementById('inboxUnreadCount');if(count){const unread=ovInboxState.rows.reduce((n,row)=>n+(Number(row.unreadAdmin)||0),0);count.textContent=unread?`${unread} غير مقروءة في القائمة`: 'كل الرسائل المعروضة مقروءة';}
 if(list)list.scrollTop=previousScroll;
 document.querySelectorAll('[data-inbox-filter]').forEach(el=>{const on=el.dataset.inboxFilter===ovInboxState.filter;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
}
function renderAdminInbox(data){
 if(!ovInboxState.query && !ovInboxState.filter)ovInboxState.filter='all';
 ovInboxState.rows=Array.isArray(data?.conversations)?data.conversations:[];
 ovInboxState.hasMore=!!data?.hasMore;
 ovInboxState.nextCursor=data?.nextCursor||null;
 ovInboxState.selected=typeof selectedAdminConversation==='string'?selectedAdminConversation:'';
 const unread=ovInboxState.rows.reduce((n,x)=>n+(Number(x.unreadAdmin)||0),0);
 return `<section class="ov-inbox" id="ovInbox" aria-label="مركز رسائل OVIRA PLAY" data-view="list">
 <div class="ov-inbox-header"><div><h3>الرسائل <span class="ov-inbox-heading-dot"></span></h3><p id="inboxUnreadCount" class="ov-inbox-muted">${unread?unread+' غير مقروءة في القائمة':'كل الرسائل المعروضة مقروءة'}</p></div><button class="ov-inbox-refresh" onclick="inboxRefresh()" aria-label="تحديث قائمة المحادثات" title="تحديث">⟳ <span>تحديث</span></button></div>
 <div class="ov-msg-layout">
  <aside class="ov-msg-list" id="inboxContacts" aria-label="قائمة المحادثات">
   <label class="ov-inbox-search"><span aria-hidden="true">⌕</span><input id="inboxSearch" value="${esc(ovInboxState.query)}" oninput="inboxSearchChange(this.value)" placeholder="ابحث عن زبون أو موضوع" autocomplete="off" aria-label="بحث في المحادثات"></label>
   <div class="ov-inbox-filters" role="group" aria-label="تصفية المحادثات">${OV_INBOX_FILTERS.map(([key,label])=>`<button class="ov-inbox-filter ${key===ovInboxState.filter?'active':''}" data-inbox-filter="${key}" aria-pressed="${String(key===ovInboxState.filter)}" onclick="inboxChooseFilter('${key}')">${label}</button>`).join('')}</div>
   <div class="ov-inbox-group-label">أدوات الإدارة</div>
   <button class="ov-inbox-contact ov-inbox-system" onclick="inboxSelect('__trainer')"><span class="ov-inbox-avatar ov-inbox-icon" aria-hidden="true">🧠</span><span class="ov-inbox-contact-text"><b>تدريب Qwen</b><span class="ov-inbox-excerpt">تجربة الأسئلة ومراجعة المسودات</span></span></button>
   <button class="ov-inbox-contact ov-inbox-system" onclick="inboxSelect('__agent')"><span class="ov-inbox-avatar ov-inbox-icon" aria-hidden="true">🤖</span><span class="ov-inbox-contact-text"><b>الوكيل الفعلي</b><span class="ov-inbox-excerpt">الحالة والصلاحيات وإعدادات المالك</span></span></button>
   <div class="ov-inbox-group-label">محادثات الزبائن</div>
   <div id="inboxCustomerRows">${ovInboxState.rows.map(ovInboxRowMarkup).join('')||'<div class="ov-inbox-empty">لا توجد محادثات ضمن هذا التصنيف.</div>'}</div>
   <button id="inboxLoadMore" class="ov-inbox-more" onclick="inboxLoadMore()" ${ovInboxState.hasMore?'':'hidden'}>عرض محادثات أقدم</button>
  </aside>
  <div class="ov-msg-detail" id="conversationDetail" aria-label="تفاصيل المحادثة"><div class="ov-inbox-placeholder"><span aria-hidden="true">💬</span><h3>اختر محادثة</h3><p>اقرأ الرسائل، راجع مسودات Qwen، أو ردّ مباشرةً من المتجر.</p></div></div>
 </div></section>`;
}
function inboxActivateThread(id){
 ovInboxState.selected=id;const panel=document.getElementById('ovInbox');if(panel)panel.dataset.view='thread';
 document.querySelectorAll('[data-inbox-id]').forEach(el=>el.classList.toggle('is-current',el.dataset.inboxId===id));
 const list=document.getElementById('inboxContacts');if(list)ovInboxState.listScroll=list.scrollTop;
}
function inboxSelect(id){
 if(!id.startsWith('__') && !ovInboxSafeId(id))return;
 if(typeof rememberAdminConversationDraft==='function')rememberAdminConversationDraft();
 if(selectedAdminConversation==='__trainer'){
  const field=document.getElementById('trainerQuestion');if(field)ownerTrainingDraft=field.value;
 }
 inboxActivateThread(id);
 if(id==='__trainer')return openOwnerTraining();
 if(id==='__agent')return openAgentStatusPane();
 loadConversationDetail(id);
}
function inboxBack(){
 if(typeof rememberAdminConversationDraft==='function')rememberAdminConversationDraft();
 if(selectedAdminConversation==='__trainer'){
  const field=document.getElementById('trainerQuestion');if(field)ownerTrainingDraft=field.value;
 }
 selectedAdminConversation='';ovInboxState.selected='';
 const panel=document.getElementById('ovInbox');if(panel)panel.dataset.view='list';
 const list=document.getElementById('inboxContacts');if(list)list.scrollTop=ovInboxState.listScroll;
 document.querySelectorAll('[data-inbox-id]').forEach(el=>el.classList.remove('is-current'));
}
function inboxOnMount(){
 const id=typeof selectedAdminConversation==='string'?selectedAdminConversation:'';
 const panel=document.getElementById('ovInbox');if(panel)panel.dataset.view=id?'thread':'list';
}
function inboxQuery(cursor){const qs=new URLSearchParams({v:'2',limit:'30',filter:ovInboxState.filter});if(ovInboxState.query)qs.set('q',ovInboxState.query);if(cursor)qs.set('cursor',cursor);return '?'+qs;}
async function inboxFetchRows(append=false){
 const serial=++ovInboxState.serial;
 const cursor=append?ovInboxState.nextCursor:null;
 if(append&&!cursor)return;
 ovInboxState.loading=true;ovInboxUpdateRows();
 try{
  const d=await convAdminRequest(inboxQuery(cursor));if(serial!==ovInboxState.serial||tab!=='conversations')return;
  const current=append?ovInboxState.rows:[];
  const seen=new Set(current.map(x=>String(x._id)));
  ovInboxState.rows=current.concat((d.conversations||[]).filter(x=>!seen.has(String(x._id))));
  ovInboxState.nextCursor=d.nextCursor||null;ovInboxState.hasMore=!!d.hasMore;
 }catch(e){if(serial===ovInboxState.serial)toast(e.message||'تعذّر تحديث المحادثات');}
 finally{if(serial===ovInboxState.serial){ovInboxState.loading=false;ovInboxUpdateRows();}}
}
function inboxChooseFilter(name){if(!OV_INBOX_FILTERS.some(x=>x[0]===name))return;ovInboxState.filter=name;ovInboxState.nextCursor=null;inboxFetchRows();}
function inboxSearchChange(value){ovInboxState.query=String(value||'').slice(0,60);clearTimeout(ovInboxState.searchTimer);ovInboxState.searchTimer=setTimeout(()=>inboxFetchRows(),350);}
function inboxRefresh(){inboxFetchRows();}
function inboxLoadMore(){if(!ovInboxState.loading)inboxFetchRows(true);}
// Explicit read acknowledgement, conditional on the last-message timestamp snapshot.
async function inboxMarkRead(id,lastMessageAt){
 if(!ovInboxSafeId(id)||!lastMessageAt)return;
 try{await convAdminRequest(encodeURIComponent(id)+'/read','POST',{seenAt:lastMessageAt});
  const row=ovInboxState.rows.find(r=>String(r._id)===id);
  if(row&&new Date(row.lastMessageAt).getTime()<=new Date(lastMessageAt).getTime()){row.unreadAdmin=0;ovInboxUpdateRows();}
 }catch(e){if(!/403/.test(String(e.message||'')))console.warn('Unable to acknowledge inbox read');}
}
// New functions are globally referenced by legacy inline handlers.
Object.assign(window,{renderAdminInbox,inboxActivateThread,inboxSelect,inboxBack,inboxOnMount,inboxChooseFilter,inboxSearchChange,inboxRefresh,inboxLoadMore,inboxMarkRead});
