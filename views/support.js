// =========================================================
// OVIRA PLAY — SUPPORT & CHAT VIEW (views/support.js)
// =========================================================

function guestChats() {
  try { const x=JSON.parse(localStorage.getItem(chatKeyStore)||'[]');return Array.isArray(x)?x.filter(i=>/^[a-f0-9]{24}$/.test(i.id)&&/^[a-f0-9]{64}$/.test(i.key)).slice(0,10):[]; } catch (_) {return [];} 
}
function saveGuestChat(id,key) {
  const list=[{id,key},...guestChats().filter(x=>x.id!==id)].slice(0,10);
  try {localStorage.setItem(chatKeyStore,JSON.stringify(list));}catch(_){}
}
function supportHeaders(id,json=false) {
  const head={};
  if(json)head['Content-Type']='application/json';
  if(custToken)head.Authorization='Bearer '+custToken;
  else if(id) {const item=guestChats().find(x=>x.id===id);if(item)head['X-Conversation-Key']=item.key;}
  return head;
}
async function supportAPI(url,options={}) {
  const r=await fetch(url,{cache:'no-store',...options});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success)throw new Error(d.message||({LOGIN_REQUIRED:'سجّل الدخول لمتابعة محادثات حسابك',CONVERSATION_CLOSED:'هذه المحادثة مغلقة',NOT_FOUND:'المحادثة غير موجودة أو غير مملوكة لك'}[d.code]||'تعذّر تنفيذ طلب الرسائل'));
  return d;
}
function supportBubbleMarkup(m){
  return `<div class="ov-bubble ${['customer','guest'].includes(m.author)?'mine':''}"><b>${esc(m.author==='ai'?'المساعد الذكي':m.author==='admin'?'الإدارة':m.author==='system'?'إشعار النظام':'الزبون')}</b><p>${esc(m.text)}</p><small>${esc(new Date(m.createdAt).toLocaleString('ar-DZ'))}</small></div>`;
}
function supportV() {
  const u=me();
  return `<div class="w ov-chat-page ${supportCurrent?'has-thread':'show-list'}"><h1 class="ttl">💬 مركز الرسائل</h1>
    <p class="note">راسل إدارة OVIRA PLAY مباشرة. يمكنك إرسال عدة رسائل متتابعة، وسيرد فريق الدعم البشري هنا.</p>
    ${supportError?`<div class="sm" role="alert">${esc(supportError)}</div>`:''}
    <div class="ov-chat-layout">
      <section class="sm ov-chat-directory"><h2 class="sh">محادثاتي</h2>
        ${custToken&&supportChats.some(x=>x.isPrimarySupportThread)?`<button class="ov-chat-choice" onclick="openSupportChat('${esc(supportChats[0]._id)}')"><strong>الإدارة — OVIRA PLAY</strong><small>${esc((supportChats[0].lastMessageText||'').slice(0,100))}</small></button>
          ${supportChats.length>1?`<details class="ov-chat-archives"><summary>المحادثات السابقة (${supportChats.length-1}) — للرجوع إلى السجل</summary>${supportChats.slice(1).map(x=>`<button class="ov-chat-choice" onclick="openSupportChat('${esc(x._id)}')">${esc(x.subject||'سجل سابق')} · ${esc(x.status)}</button>`).join('')}</details>`:''}`:
        `<button class="btn o" onclick="newSupportChat()">${custToken?'ابدأ مراسلة الإدارة':'+ تذكرة للزائر'}</button><div class="ov-chat-list">${supportChats.map(x=>`<button class="ov-chat-choice ${supportCurrent===x._id?'chosen':''}" onclick="openSupportChat('${esc(x._id)}')"><strong>${esc(x.subject||'استفسار')}</strong><small>${esc(x.status)}</small></button>`).join('')}</div>`} 
      </section>
      <section class="sm ov-chat-thread" aria-label="المحادثة">
      ${supportCurrent ? `<div class="ov-chat-thread-head"><button class="chip ov-chat-back" onclick="supportBackToList()" aria-label="العودة إلى محادثاتي">← المحادثات</button><h2 class="sh">سجل الرسائل</h2></div><div class="ov-chat-history" role="log" aria-live="polite">${supportMessages.length?supportMessages.map(supportBubbleMarkup).join(''):'<p>لم تصل رسائل بعد.</p>'}}</div>
        <p class="ov-chat-hint">يمكنك إرسال عدة رسائل متتالية. سيقرأ فريق الإدارة جميع التفاصيل في هذه المحادثة.</p><label class="lb" for="supportReply">اكتب رسالتك</label><textarea class="in2" id="supportReply" maxlength="1500" placeholder="اكتب التفاصيل هنا، رسالة بعد رسالة. لا تشارك رمز OTP."></textarea>
        <button class="btn" onclick="sendSupportReply()" ${supportBusy?'disabled':''}>إرسال الرسالة</button>`
        : `<h2 class="sh">${custToken?'مراسلة الإدارة':'فتح تذكرة دعم للزائر'}</h2>
        ${!custToken?`<label class="lb" for="supportGuestName">الاسم *</label><input class="in2" id="supportGuestName" maxlength="80" value="${esc(u.n||'')}" placeholder="اسمك">`:''}
        <label class="lb" for="supportSubject">موضوع المحادثة</label><input class="in2" id="supportSubject" maxlength="120" placeholder="مثال: استفسار عن الخدمة" value="استفسار">
        <label class="lb" for="supportFirst">رسالتك *</label><textarea class="in2" id="supportFirst" maxlength="1500" placeholder="اكتب سؤالك هنا، دون معلومات حساسة"></textarea>
        <button class="btn" onclick="createSupportChat()" ${supportBusy?'disabled':''}>${custToken?'بدء المحادثة':'فتح تذكرة دعم للزائر'}</button>
        ${!custToken?'<p class="note">للزائر: يُحفظ مفتاح متابعة المحادثة على هذا الجهاز فقط. لا تربط الرسائل بحساب اعتمادًا على رقم الهاتف.</p>':''}`}
      </section>
    </div>
    ${brandFoot()}
  </div>`;
}
async function loadSupportChats() {
  try {
    supportError='';
    if(custToken) {
      const d=await supportAPI(CHAT_BASE,{headers:supportHeaders()});
      supportChats=(d.conversations||[]).sort((a,b)=>Number(!!b.isPrimarySupportThread)-Number(!!a.isPrimarySupportThread));
    } else {
      const ids=guestChats();
      const data=await Promise.all(ids.map(async x=>{
        try {const d=await supportAPI(CHAT_BASE+'/'+x.id,{headers:supportHeaders(x.id)});return d.conversation;}catch(_){return null;}
      }));
      supportChats=data.filter(Boolean);
    }
    if(supportCurrent && !supportChats.some(x=>x._id===supportCurrent))supportCurrent='';
    // Opening support on a signed-in account goes straight to its main admin thread.
    if(custToken && supportChats.some(x=>x.isPrimarySupportThread) && !supportCurrent && location.hash.startsWith('#/support')) {
      await openSupportChat(supportChats[0]._id); return;
    }
    if(location.hash.startsWith('#/support'))draw();
  } catch(e){supportError=e.message;if(location.hash.startsWith('#/support'))draw();}
}
window.newSupportChat=()=>{if(custToken&&supportChats.some(x=>x.isPrimarySupportThread))return openSupportChat(supportChats[0]._id);supportCurrent='';supportMessages=[];draw();};
window.supportBackToList=()=>{supportCurrent='';supportMessages=[];draw();};
window.openSupportChat=async(id)=>{
  try{
    supportCurrent=id;supportMessages=[];draw();
    const d=await supportAPI(CHAT_BASE+'/'+encodeURIComponent(id),{headers:supportHeaders(id)});
    if(supportCurrent!==id)return;
    supportMessages=d.messages||[];draw();
  }catch(e){supportError=e.message;draw();}
};
window.createSupportChat=async()=>{
  if(supportBusy)return;
  const subject=$('#supportSubject')?.value.trim()||'استفسار';
  const text=$('#supportFirst')?.value.trim()||'';
  const name=$('#supportGuestName')?.value.trim()||'';
  if(text.length<2||text.length>1500||(!custToken&&name.length<2))return toast('أدخل الاسم والرسالة بشكل صحيح');
  supportBusy=true;
  try{
    const d=await supportAPI(CHAT_BASE,{method:'POST',headers:supportHeaders('',true),body:JSON.stringify({subject,text,...(!custToken?{name}:{})})});
    if(d.guestKey)saveGuestChat(d.conversation._id,d.guestKey);
    supportCurrent=d.conversation._id;supportMessages=[d.message];
    // A server may reuse an existing administration thread; fetch the complete history.
    if(custToken){await openSupportChat(supportCurrent);return;}
    await loadSupportChats();draw();toast('بدأت المحادثة، ويمكنك متابعتها هنا');
  }catch(e){toast(e.message)}finally{supportBusy=false;}
};
window.sendSupportReply=async()=>{
  if(supportBusy||!supportCurrent)return;
  const text=$('#supportReply')?.value.trim()||'';
  if(text.length<2||text.length>1500)return toast('الرسالة يجب أن تكون بين حرفين و1500 حرف');
  supportBusy=true;
  try{
    const id=supportCurrent;
    const result=await supportAPI(CHAT_BASE+'/'+id+'/messages',{method:'POST',headers:supportHeaders(id,true),body:JSON.stringify({text})});
    if(id===supportCurrent){
      supportMessages.push(result.message);
      const field=$('#supportReply');if(field)field.value='';
      const history=document.querySelector('.ov-chat-history');
      if(history){ history.insertAdjacentHTML('beforeend',supportBubbleMarkup(result.message));history.scrollTop=history.scrollHeight; }
    }
    toast('تم إرسال الرسالة. يمكنك متابعة الكتابة');
  }catch(e){toast(e.message)}finally{supportBusy=false;}
};

// Refresh an open website conversation without discarding what the customer is typing.
// This is foreground polling, not a promise of background push notifications.
let supportPollBusy = false;
setInterval(async () => {
  if (supportPollBusy || supportBusy || document.hidden || !location.hash.startsWith('#/support') || !supportCurrent) return;
  supportPollBusy = true;
  const id = supportCurrent;
  try {
    const data = await supportAPI(CHAT_BASE+'/'+encodeURIComponent(id), {headers:supportHeaders(id)});
    if (id !== supportCurrent || !location.hash.startsWith('#/support')) return;
    const incoming = data.messages || [];
    const signature = list => list.map(x=>String(x._id||'')+':'+String(x.text||'')).join('|');
    if (signature(incoming) !== signature(supportMessages)) {
      supportMessages = incoming;
      const history=document.querySelector('.ov-chat-history');
      if(history){
        const nearBottom=history.scrollHeight-history.scrollTop-history.clientHeight<100;
        history.innerHTML=incoming.map(supportBubbleMarkup).join('');
        if(nearBottom)history.scrollTop=history.scrollHeight;
      }
    }
  } catch (_) { /* display last known messages; manual refresh remains available */ }
  finally { supportPollBusy = false; }
}, 15000);

window.doCustLogin = async () => {
  const identifier = $('#au_id').value.trim();
  const password = $('#au_pass').value;
  try {
    const r = await fetch(ACC_URL + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'مرحباً بك مجدداً ✓');
  } catch (e) {
    toast(e.message);
  }
};

window.doCustRegister = async () => {
  const name = $('#au_name').value.trim();
  const phone = $('#au_phone').value.trim();
  const email = $('#au_email').value.trim();
  const password = $('#au_pass').value;
  try {
    const r = await fetch(ACC_URL + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    try { localStorage.setItem('oi', JSON.stringify({ n: name, p: phone, e: email })); } catch (e) {}
    await processAuthResult(d, d.message);
  } catch (e) {
    toast(e.message);
  }
};

window.custLogout = () => {
  custToken = '';
  custProfile = null;
  custOrders = [];
  custComplaints = [];
  supportCurrent = ''; supportChats = []; supportMessages = [];
  twoFaPending = null;
  twoFaSetup = null;
  localStorage.removeItem('ov_ctk');
  toast('تم تسجيل الخروج');
  draw();
};

window.claimAccount = async () => {
  if (!$('#cl_ok').checked) return toast('يرجى الموافقة على الشروط');
  const password = $('#cl_pw').value;
  try {
    const r = await fetch(ACC_URL + '/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken: ord.claimToken, password, consent: true })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    custToken = d.token;
    try { sessionStorage.removeItem('ov_claim_' + ord.code); } catch(e) {}
    localStorage.setItem('ov_ctk', custToken);
    await fetchCustomerProfile();
    toast('تم إنشاء حسابك وربط طلبك بنجاح 🎉');
    const box = $('#claimBox');
    if (box) box.innerHTML = '<div style="text-align:center;color:var(--ok);font-weight:800">✅ تم تفعيل حسابك وربط الطلب بنجاح! يمكنك متابعته من تبويب (حسابي).</div>';
  } catch (e) {
    toast(e.message);
  }
};


window.guestChats = guestChats;
window.saveGuestChat = saveGuestChat;
window.supportHeaders = supportHeaders;
window.supportAPI = supportAPI;
window.supportBubbleMarkup = supportBubbleMarkup;
window.supportV = supportV;
window.loadSupportChats = loadSupportChats;
