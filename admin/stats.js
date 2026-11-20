// =========================================================
// OVIRA PLAY — ADMIN STATS, MARKETING & COMMUNICATIONS (admin/stats.js)
// =========================================================

function landingForm(prefix, landing = {}) {
  return `<details class="landing-editor"><summary>✍️ محتوى صفحة الهبوط، الشروط، FAQ وSEO</summary>
    <p class="ov-caption">كل قسم اختياري: تركه فارغاً يخفيه تماماً من صفحة المنتج. لا تكتب مزايا أو وعوداً غير مؤكدة.</p>
    <div class="landing-editor-grid">${LANDING_FIELDS.map(([field, suffix, title, placeholder, kind]) => {
      const value = esc(landing[field] || '');
      const id = `lp_${prefix}_${suffix}`;
      const control = kind === 'input'
        ? `<input class="inp" id="${id}" value="${value}" maxlength="70" placeholder="${esc(placeholder)}">`
        : `<textarea class="inp" id="${id}" rows="3" ${suffix === 'seoD' ? 'maxlength="200"' : ''} placeholder="${esc(placeholder)}">${value}</textarea>`;
      return `<label class="landing-field" for="${id}"><span>${esc(title)}</span>${control}</label>`;
    }).join('')}</div>
  </details>`;
}
function landingPayload(prefix) {
  const payload = {};
  LANDING_FIELDS.forEach(([field, suffix]) => {
    const el = document.getElementById(`lp_${prefix}_${suffix}`);
    payload[field] = el ? el.value.trim() : '';
  });
  return payload;
}
function setMarketingDays(days) {
  if (![7,30,90].includes(Number(days))) return;
  marketingDays = Number(days);
  loadPanel();
}

async function remindRenewal(id) {
  if (!confirm('إرسال تذكير تجديد للزبون عبر بوت تيليغرام؟')) return;
  try {
    const r = await fetch(`${API}/renewals/${encodeURIComponent(id)}/remind`, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }
    });
    const d = await r.json();
    toast(d.message || 'تعذّر إرسال التذكير');
  } catch { toast('تعذّر الاتصال بالخادم'); }
}

async function savePaymentMethodsAll() {
  const updated = (payMethodsState || []).map((m, idx) => {
    const enEl = document.getElementById('pm_en_' + idx);
    const lblEl = document.getElementById('pm_lbl_' + idx);
    const valEl = document.getElementById('pm_val_' + idx);
    const noteEl = document.getElementById('pm_note_' + idx);
    return {
      id: m.id,
      enabled: enEl ? !!enEl.checked : m.enabled,
      label: lblEl ? lblEl.value.trim() : (m.label || ''),
      value: valEl ? valEl.value.trim() : (m.value || ''),
      note: noteEl ? noteEl.value.trim() : (m.note || '')
    };
  });

  try {
    const r = await fetch(`${API}/payment-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ methods: updated })
    });
    const d = await r.json();
    toast(d.message || 'تم الحفظ ✓');
    if (d.success) loadPanel();
  } catch (e) {
    toast('تعذّر حفظ طرق الدفع');
  }
}

async function moderateReview(id, approved) {
  try {
    const r = await fetch(`${API}/reviews/${id}`, { method:'PATCH',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body:JSON.stringify({approved}) });
    const d = await r.json();
    toast(d.success ? 'تم تحديث التقييم' : (d.message || 'تعذّر تحديث التقييم'));
    if (r.ok && d.success) loadPanel();
  } catch (_) { toast('تعذّر الاتصال أثناء تحديث التقييم'); }
}

function rememberAdminConversationDraft() {
 const input=document.getElementById('adminChatReply');
 if (!input || !selectedAdminConversation || selectedAdminConversation.startsWith('__')) return;
 const id=selectedAdminConversation;
 if(input.value){
  adminConversationDrafts.set(id,input.value);
  try{sessionStorage.setItem(adminDraftStorageKey(id),input.value.slice(0,1500));}catch(_){/* private mode */}
 }else{
  adminConversationDrafts.delete(id);
  try{sessionStorage.removeItem(adminDraftStorageKey(id));}catch(_){/* private mode */}
 }
}
function restoreAdminConversationDraft(id){
 if(adminConversationDrafts.has(id))return adminConversationDrafts.get(id);
 try{return sessionStorage.getItem(adminDraftStorageKey(id))||'';}catch(_){return '';}
}
async function convAdminRequest(path,method='GET',body) {
 const r=await fetch(convAdminUrl(path),{method,cache:'no-store',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));
 if(r.status===401)return logout();
 if(!r.ok||!d.success)throw new Error(d.message||d.code||'تعذر الاتصال بمركز الرسائل');
 return d;
}
function adminInboxRole(){
 try{
  const part=String(token||'').split('.')[1];if(!part||typeof atob!=='function')return '';
  return String(JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))).role||'');
 }catch(_){return '';}
}
function chatMessageMarkup(m,row){
 const who=m.author==='admin'?'الإدارة':m.author==='ai'?'Qwen':m.author==='customer'||m.author==='guest'?'الزبون':m.author==='whatsapp'?'WhatsApp':'النظام';
 const side=m.author==='admin'?'mine':m.author==='system'?'system':'customer';
 const clock=Number.isFinite(new Date(m.createdAt).getTime())?new Date(m.createdAt).toLocaleString('ar-DZ',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
 const id=String(m._id||'');
 return `<div class="ov-admin-bubble ${side}" data-chat-message="${esc(id)}"><div class="ov-inbox-author">${esc(who)}</div><p dir="auto">${esc(m.text)}</p><small>${esc(clock)}</small>
   ${m.aiDraft?`<div class="ov-inbox-ai-draft"><b>🧠 مسودة Qwen — لم تُرسل</b><p dir="auto">${esc(m.aiDraft)}</p>
   ${row.channel==='site'&&row.status!=='closed'&&adminInboxRole()!=='viewer'?`<button class="btn-sm" onclick="approveConversationDraft('${esc(row._id)}','${esc(id)}')">اعتماد وإرسال إلى الزبون</button>`:''}</div>`:''}</div>`;
}
function chatHistoryMarkup(row,history){
 return `${history.hasMore?`<button class="ov-inbox-older" onclick="loadOlderAdminMessages('${esc(row._id)}')">↑ تحميل الرسائل الأقدم</button>`:''}
  ${history.messages.map(m=>chatMessageMarkup(m,row)).join('')||'<p class="ov-inbox-empty">لا توجد رسائل بعد.</p>'}`;
}
function mergeInboxMessages(a,b){
 const byId=new Map();for(const row of [...a,...b])if(row&&row._id)byId.set(String(row._id),row);
 return [...byId.values()].sort((x,y)=>new Date(x.createdAt)-new Date(y.createdAt)||String(x._id).localeCompare(String(y._id)));
}
async function loadConversationDetail(id) {
 if(selectedAdminConversation!==id) rememberAdminConversationDraft();
 selectedAdminConversation=id;
 inboxActivateThread(id);
 const area=document.getElementById('conversationDetail');if(!area)return;
 const serial=++adminConversationRequestSerial;
 const hasThread=area.dataset.conversationId===id && !!area.querySelector('.ov-conv-messages');
 if(!hasThread)area.innerHTML='<div class="ov-inbox-loading" role="status">جاري تحميل المحادثة…</div>';
 try{
  const d=await convAdminRequest(encodeURIComponent(id)+'?v=2&limit=40');
  if(serial!==adminConversationRequestSerial||selectedAdminConversation!==id||document.getElementById('conversationDetail')!==area)return;
  const row=d.conversation;
  const existing=adminInboxHistories.get(id);
  const history=existing||{messages:[],nextBefore:d.nextBefore,hasMore:!!d.hasMore};
  if(!existing){history.nextBefore=d.nextBefore;history.hasMore=!!d.hasMore;}
  history.messages=mergeInboxMessages(history.messages,d.messages||[]);
  adminInboxHistories.set(id,history);
  const signature=JSON.stringify(history.messages.map(x=>[x._id,x.text,x.aiDraft,x.createdAt]));
  const state=[row.channel,row.status,row.aiMode].join(':');
  const keepComposer=hasThread&&area.dataset.rowState===state;
  if(keepComposer){
   const box=area.querySelector('.ov-conv-messages');
   if(box&&box.dataset.messageSignature!==signature){
    const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<75;
    const oldTop=box.scrollTop;
    box.innerHTML=chatHistoryMarkup(row,history);box.dataset.messageSignature=signature;
    if(nearBottom)box.scrollTop=box.scrollHeight;else box.scrollTop=oldTop;
   }
  }else{
   rememberAdminConversationDraft();
   const meta=(ovInboxState.rows||[]).find(x=>String(x._id)===id);
   const name=String(meta?.displayName||row.guestName||row.subject||'محادثة زبون');
   area.dataset.conversationId=id;area.dataset.rowState=state;
   area.innerHTML=`<div class="ov-inbox-thread-head"><button class="ov-inbox-back" onclick="inboxBack()" aria-label="العودة لقائمة المحادثات">→</button>
    <span class="ov-inbox-avatar ${'tone-0'}" aria-hidden="true">${esc(name.slice(0,1))}</span><span class="ov-inbox-thread-name"><b>${esc(name)}</b><small>${esc(row.channel==='site'?'المتجر':row.channel==='whatsapp'?'WhatsApp':'سجل سابق')} · ${esc(row.status)} · ${row.aiMode==='human'?'الموظف يتولى الرد':'مساعد AI'}${row.supportVerified?' · 🪪 التحقق من دعم الحساب ساري':''}</small></span>
    ${adminInboxRole()==='viewer'?'':`<details class="ov-inbox-actions"><summary aria-label="إجراءات المحادثة">⋯</summary><div class="ov-inbox-actions-menu"><button onclick="changeConversationMode('${esc(id)}','human')">استلام المحادثة بنفسي</button><button onclick="changeConversationStatus('${esc(id)}','closed')">إغلاق المحادثة</button><button onclick="changeConversationStatus('${esc(id)}','open')">إعادة فتح</button></div></details>`}</div>
    <div class="ov-conv-messages" role="log" aria-label="سجل الرسائل" aria-live="polite">${chatHistoryMarkup(row,history)}</div>
    ${adminInboxRole()==='owner'?`<details class="ov-otp-details"><summary>🛡️ إعادة السماح لـ Qwen بالمسودات (المالك فقط)</summary><p class="ov-caption">قد يرد Qwen تلقائيًا على الأسئلة العامة فقط إن فعّل المالك الميزة من الإعدادات. إعادة إسناد المحادثة تحتاج كلمة السر وOTP.</p>
      <input class="inp" type="password" autocomplete="current-password" id="convPwd" placeholder="كلمة مرور المالك"><input class="inp" id="convOtp" inputmode="numeric" maxlength="6" placeholder="رمز OTP"><button class="btn-sm" onclick="changeConversationMode('${esc(id)}','assist')">السماح لـ Qwen بالمحادثة</button></details>`:''}
    ${adminInboxRole()==='viewer'?'<div class="ov-inbox-disabled">وضع القراءة فقط: لا يسمح هذا الحساب بإرسال رسائل.</div>':row.channel==='whatsapp'?`<div class="ov-inbox-disabled">إرسال WhatsApp من اللوحة غير مفعّل؛ لا توجد رسالة صادرة تلقائيًا.${row.contactUrl?` <a target="_blank" rel="noopener noreferrer" href="${esc(row.contactUrl)}">فتح تطبيق WhatsApp يدويًا</a>`:''}</div>`:row.status==='closed'?'<p class="ov-inbox-disabled">المحادثة مغلقة؛ أعد فتحها للرد.</p>':`<div class="ov-inbox-composer"><label for="adminChatReply">اكتب ردًا للزبون</label><textarea class="inp" id="adminChatReply" maxlength="1500" oninput="rememberAdminConversationDraft()" placeholder="اكتب رسالتك…" rows="2"></textarea><button class="btn-pri" onclick="sendAdminConversationReply('${esc(id)}')">➤ إرسال الرد</button></div>`}`;
   const reply=area.querySelector('#adminChatReply');if(reply)reply.value=restoreAdminConversationDraft(id);
   const box=area.querySelector('.ov-conv-messages');if(box)box.scrollTop=box.scrollHeight;
  }
  const box=area.querySelector('.ov-conv-messages');if(box)box.dataset.messageSignature=signature;
  if(Number(row.unreadAdmin)>0&&adminInboxRole()!=='viewer')inboxMarkRead(id,row.lastMessageAt);
 }catch(e){
  if(serial!==adminConversationRequestSerial||selectedAdminConversation!==id||document.getElementById('conversationDetail')!==area)return;
  if(hasThread)toast('تعذّر تحديث الرسائل؛ النص غير المرسل محفوظ');
  else area.innerHTML=`<div role="alert" class="ov-inbox-empty">تعذر تحميل المحادثة. <button class="btn-sm" onclick="loadConversationDetail('${esc(id)}')">إعادة المحاولة</button><button class="ov-inbox-back" onclick="inboxBack()">عودة</button></div>`;
 }
}
async function loadOlderAdminMessages(id){
 const history=adminInboxHistories.get(id);if(!history?.nextBefore||selectedAdminConversation!==id)return;
 const box=document.querySelector('#conversationDetail .ov-conv-messages');if(!box)return;
 const beforeHeight=box.scrollHeight,oldScroll=box.scrollTop;
 try{
  const d=await convAdminRequest(encodeURIComponent(id)+'/messages?limit=40&before='+encodeURIComponent(history.nextBefore));
  history.messages=mergeInboxMessages(d.messages||[],history.messages);
  history.hasMore=!!d.hasMore;history.nextBefore=d.nextBefore;
  const meta=(ovInboxState.rows||[]).find(x=>String(x._id)===id)||{};
  box.innerHTML=chatHistoryMarkup({_id:id,channel:meta.channel||'site',status:meta.status||'open'},history);
  box.dataset.messageSignature=JSON.stringify(history.messages.map(x=>[x._id,x.text,x.aiDraft,x.createdAt]));
  box.scrollTop=oldScroll+(box.scrollHeight-beforeHeight);
 }catch(e){toast('تعذّر تحميل الرسائل القديمة: '+e.message);}
}
async function sendAdminConversationReply(id){
 if (adminReplyInFlight.has(id)) return;
 const text=document.getElementById('adminChatReply')?.value.trim()||'';if(text.length<2)return toast('اكتب ردًا واضحًا');
 const previous=adminReplyKeys.get(id);
 const key=previous?.text===text?previous.key:crypto.randomUUID();
 adminReplyKeys.set(id,{text,key});
 adminReplyInFlight.add(id);
 try{
  await convAdminRequest(encodeURIComponent(id)+'/reply','POST',{text,idempotencyKey:key});
  adminReplyKeys.delete(id);
  const input=document.getElementById('adminChatReply');
  if(input&&selectedAdminConversation===id){
    if(input.value.trim()===text)input.value='';
    if(input.value)adminConversationDrafts.set(id,input.value);else adminConversationDrafts.delete(id);
  }else adminConversationDrafts.delete(id);
  if(!adminConversationDrafts.has(id)){try{sessionStorage.removeItem(adminDraftStorageKey(id));}catch(_){}}
  toast('وصل الرد إلى محادثة الموقع');loadConversationDetail(id);
 }catch(e){toast(e.message)}finally{adminReplyInFlight.delete(id)}
}
async function approveConversationDraft(id,messageId){
 if(!confirm('هل راجعت المسودة وتؤكد إرسالها إلى زبون الموقع؟'))return;
 try{await convAdminRequest(encodeURIComponent(id)+'/ai-draft/send','POST',{messageId});toast('أرسلت المسودة للعميل');loadConversationDetail(id)}catch(e){toast(e.message)}
}
async function changeConversationMode(id,aiMode){
 try{
   const data={aiMode};
   if(aiMode==='assist'){
     data.currentPassword=document.getElementById('convPwd')?.value||'';
     data.code=document.getElementById('convOtp')?.value||'';
     if(!data.currentPassword||!/^[0-9]{6}$/.test(data.code))return toast('أدخل كلمة سر المالك ورمز 2FA');
   }
   await convAdminRequest(encodeURIComponent(id),'PATCH',data);
   toast(aiMode==='human'?'تم إيقاف Qwen لهذه المحادثة':'تم السماح بمسودات Qwen');
   loadConversationDetail(id);
 }catch(e){toast(e.message)}
}
async function changeConversationStatus(id,status){
 try{await convAdminRequest(encodeURIComponent(id),'PATCH',{status});loadConversationDetail(id)}catch(e){toast(e.message)}
}


window.landingForm = landingForm;
window.landingPayload = landingPayload;
window.setMarketingDays = setMarketingDays;
window.remindRenewal = remindRenewal;
window.savePaymentMethodsAll = savePaymentMethodsAll;
window.moderateReview = moderateReview;
window.rememberAdminConversationDraft = rememberAdminConversationDraft;
window.restoreAdminConversationDraft = restoreAdminConversationDraft;
window.convAdminRequest = convAdminRequest;
window.adminInboxRole = adminInboxRole;
window.chatMessageMarkup = chatMessageMarkup;
window.chatHistoryMarkup = chatHistoryMarkup;
window.mergeInboxMessages = mergeInboxMessages;
window.loadConversationDetail = loadConversationDetail;
window.loadOlderAdminMessages = loadOlderAdminMessages;
window.sendAdminConversationReply = sendAdminConversationReply;
window.approveConversationDraft = approveConversationDraft;
window.changeConversationMode = changeConversationMode;
window.changeConversationStatus = changeConversationStatus;
