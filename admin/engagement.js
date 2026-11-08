/* Owner-only live engagement center; Qwen generates drafts, does not autonomously send. */
const EG_BASE='https://ovira-api.onrender.com/api/v2/admin/engagement';
async function egRequest(path='',method='GET',body){
 const r=await fetch(EG_BASE+(path?'/'+path:''),{method,headers:{'Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw Error(d.message||d.code||'فشل الطلب');return d;
}
function renderEngagement(d){
 const kb=(d.knowledge||[]).map(x=>`<div class="ov-kb-entry"><b>${esc(x.question)}</b><p>${esc(x.answer)}</p><small>${esc(x.category)} · ${x.active?'نشط':'موقوف'}</small> <button class="btn-sm" onclick="egToggle('${esc(x._id)}',${!x.active})">${x.active?'إيقاف':'تفعيل'}</button></div>`).join('');
 return `<div class="card"><h3>🧠 استوديو تدريب واختبار Qwen</h3><p>التدريب هنا يعني إضافة معرفة معتمدة يسترجعها الخادم عند السؤال، وليس تعديل أوزان النموذج. نتائج Qwen مسودات لا تُرسل آليًا.</p>
 <label class="lbl">سؤال تجريبي عام</label><textarea class="inp" id="egTest" maxlength="1000" placeholder="كيف أنشئ حسابًا؟ أو ما أسعار الاشتراكات؟"></textarea><button class="btn-pri" onclick="egTest()">إرسال تجربة إلى Qwen</button>
 <p class="ov-caption">لا تدخل بيانات زبون حقيقية هنا. يتم حفظ سجل الاختبارات كمسودات لدى الخادم.</p><button class="btn-sm" onclick="egLoadTests()">↻ عرض نتائج الأسئلة التجريبية</button><div id="egTestHistory" aria-live="polite"></div></div>
 <div class="card"><h3>🔒 ترخيص تعديل تدريب Qwen والإعدادات</h3><p>لتعديل المعرفة أو تكامل البريد، أدخل كلمة سر المالك ورمز 2FA لكل تغيير. الاختبارات النصية لا تحتاج صلاحية التعديل.</p>
 <input class="inp" id="egOwnerPassword" type="password" autocomplete="current-password" placeholder="كلمة سر المالك"><input class="inp" id="egOwnerOtp" inputmode="numeric" maxlength="6" placeholder="رمز OTP"><button class="btn-sm" onclick="egRequestOtp()">إرسال OTP عبر تيليغرام إن كان مضبوطًا</button></div>
 <div class="card"><h3>📚 المعرفة المعتمدة ومهارات خدمة الزبائن</h3><label class="lbl">السؤال</label><input class="inp" id="egQ" maxlength="240" placeholder="كيف أطلب اشتراكًا؟"><label class="lbl">إجابة معتمدة</label><textarea class="inp" id="egA" maxlength="1400" placeholder="خطوات صحيحة وموثقة فقط"></textarea>
 <label class="lbl">التصنيف</label><select class="inp" id="egCategory"><option value="faq">أسئلة متكررة</option><option value="sales">المبيعات</option><option value="delivery">التسليم</option><option value="renewal">التجديد</option><option value="policy">السياسات</option></select>
 <button class="btn-pri" onclick="egSaveKB()">حفظ معلومة جديدة</button><div class="ov-kb-list">${kb||'<p>لا توجد معلومات مخصصة بعد؛ لا توجد بيانات تدريب وهمية.</p>'}</div></div>
 <div class="card"><h3>🔔 إشعارات المالك على هذا الجهاز</h3><p>عندما تكون لوحة الإدارة مفتوحة، يمكن للمتصفح إشعارك بزيادة المحادثات أو المسودات المطلوب مراجعتها. لا تصل عند إغلاق الصفحة؛ الإشعارات الخلفية تحتاج Web Push منفصلًا.</p><button class="btn-pri" onclick="egEnableBrowserAlerts()">تفعيل تنبيهات المتصفح أثناء فتح اللوحة</button></div><div class="card"><h3>🔔 إشعار مباشر لحساب زبون محدد</h3><p>يُعرض داخل حساب الزبون. العروض لا تُرسل إلا لمن اختار استقبالها.</p><label class="lbl">معرف حساب الزبون من الإدارة</label><input class="inp" id="egCustomer" placeholder="MongoDB Customer ID" dir="ltr"><label class="lbl">نوع الإشعار</label><select class="inp" id="egKind"><option value="order">تحديث طلب</option><option value="support">رد دعم</option><option value="renewal">تذكير تجديد</option><option value="offer">عرض (يتطلب موافقة)</option><option value="general">عام</option></select>
 <label class="lbl">عنوان</label><input class="inp" id="egTitle" maxlength="100"><label class="lbl">الرسالة</label><textarea class="inp" id="egBody" maxlength="600"></textarea><button class="btn-pri" onclick="egNotify()">إرسال الإشعار إلى الحساب المحدد</button></div>
 <div class="card"><h3>✉️ تكامل البريد المهني — تحضير آمن</h3><p>يمكنك حفظ بيانات الموصل العامة الآن. كلمة مرور SMTP ومفتاح API لا يوضعان في المتصفح ولا يتم إرسال بريد حتى تنفيذ موصل آمن واختباره.</p>
 <label class="lbl">نوع الموصل</label><select class="inp" id="egProvider"><option value="disabled">معطل</option><option value="smtp">SMTP لاحقًا</option><option value="api">API لاحقًا</option></select>
 <label class="lbl">اسم المرسل</label><input class="inp" id="egFromName" maxlength="80" value="${esc(d.email?.fromName||'OVIRA PLAY')}"><label class="lbl">البريد المهني</label><input class="inp" id="egFromAddress" dir="ltr" maxlength="150" value="${esc(d.email?.fromAddress||'')}">
 <label class="lbl">نقطة HTTPS للـ API (اختياري)</label><input class="inp" id="egEndpoint" dir="ltr" maxlength="250" value="${esc(d.email?.endpoint||'')}"><button class="btn-sm" onclick="egSaveEmail()">حفظ بيانات الموصل دون تفعيل الإرسال</button></div>`;
}
async function egTest(){try{const d=await egRequest('test','POST',{text:document.getElementById('egTest').value.trim()});toast('أُرسلت المهمة للمراجعة: '+d.jobId);}catch(e){toast(e.message)}}
async function egSaveKB(){try{await egRequest('knowledge','POST',{...egStepUp(),question:document.getElementById('egQ').value.trim(),answer:document.getElementById('egA').value.trim(),category:document.getElementById('egCategory').value});toast('حفظت المعرفة');loadPanel()}catch(e){toast(e.message)}}
async function egToggle(id,active){try{await egRequest('knowledge/'+id,'PATCH',{...egStepUp(),active});loadPanel()}catch(e){toast(e.message)}}
async function egNotify(){if(!confirm('هل تؤكد إرسال هذا الإشعار إلى الحساب المحدد؟'))return;try{await egRequest('notify','POST',{customerId:document.getElementById('egCustomer').value.trim(),kind:document.getElementById('egKind').value,title:document.getElementById('egTitle').value.trim(),body:document.getElementById('egBody').value.trim()});toast('أُرسل الإشعار إلى حساب الزبون')}catch(e){toast(e.message)}}
async function egSaveEmail(){try{await egRequest('email-settings','PATCH',{...egStepUp(),provider:document.getElementById('egProvider').value,fromName:document.getElementById('egFromName').value.trim(),fromAddress:document.getElementById('egFromAddress').value.trim(),endpoint:document.getElementById('egEndpoint').value.trim()});toast('حفظت إعدادات الموصل؛ الإرسال معطل')}catch(e){toast(e.message)}}

async function egLoadTests(){const box=document.getElementById('egTestHistory');if(!box)return;box.textContent='يُحمّل السجل…';try{const d=await egRequest('test-jobs');box.innerHTML=(d.jobs||[]).map(j=>`<article class="ov-kb-entry"><b>${esc(j.inputText)}</b> <small>${esc(j.status)}</small><p>${esc(j.resultText||'لم تُنتج مسودة بعد')}</p></article>`).join('')||'<p>لا توجد اختبارات بعد</p>'}catch(e){box.textContent=e.message}}
// Browser notifications only while dashboard tab remains open. Closed-app push requires separate VAPID/service-worker enrollment.
let egOwnerTimer=null,egLastCount=null;
async function egEnableBrowserAlerts(){
 if(!('Notification' in window))return toast('متصفحك لا يدعم إشعارات الصفحات');
 const permission=await Notification.requestPermission();if(permission!=='granted')return toast('لم يتم منح الإذن');
 if(egOwnerTimer)clearInterval(egOwnerTimer);
 egLastCount=null;const check=async()=>{if(!token||document.hidden)return;try{const d=await egRequest('owner-alerts');const count=Number(d.conversations||0)+Number(d.reviewJobs||0);if(egLastCount!==null&&count>egLastCount){new Notification('OVIRA PLAY — مهام جديدة',{body:'رسائل أو مسودات تحتاج مراجعتك في لوحة الإدارة'});}egLastCount=count;}catch(_){}};
 await check();egOwnerTimer=setInterval(check,60000);toast('فُعلت إشعارات المتصفح أثناء فتح اللوحة');
}

function egStepUp(){
 const currentPassword=document.getElementById('egOwnerPassword')?.value||'';
 const code=document.getElementById('egOwnerOtp')?.value||'';
 if(!currentPassword||!/^\d{6}$/.test(code))throw new Error('يلزم كلمة سر المالك وOTP صحيح لتعديل معرفة الوكيل');
 return {currentPassword,code};
}
async function egRequestOtp(){
 const currentPassword=document.getElementById('egOwnerPassword')?.value||'';
 if(!currentPassword)return toast('أدخل كلمة سر المالك أولاً');
 const d=await aiAction('step-up/telegram',{currentPassword});if(d)toast('تم طلب OTP من قناة التحقق المفعلة');
}
// Trainer and live agent are distinct fixed contacts, not fake customer accounts.
let ownerTrainingDraft='';
async function openOwnerTraining(){
 if (selectedAdminConversation==='__trainer') {
   const input=document.getElementById('trainerQuestion');
   if(input)ownerTrainingDraft=input.value;
 }
 rememberAdminConversationDraft();
 selectedAdminConversation='__trainer';
 const box=document.getElementById('conversationDetail');if(!box)return;
 delete box.dataset.conversationId; delete box.dataset.rowState;
 box.innerHTML='<p>تحميل سجل تدريب Qwen…</p>';
 try {
  const data=await egRequest('test-jobs');
  if(selectedAdminConversation!=='__trainer'||!document.getElementById('conversationDetail'))return;
  const statusNames={queued:'بانتظار الهاتف',leased:'Qwen يحضّر المسودة',review:'مسودة للمراجعة',failed:'تعذّر التوليد',cancelled:'أُلغيت'};
  const history=(data.jobs||[]).slice().reverse().map(j=>`<div class="ov-training-turn"><div class="ov-admin-bubble mine"><b>👤 تدريب المالك</b><p>${esc(j.inputText)}</p></div><div class="ov-admin-bubble"><b>🧠 Qwen — ${esc(statusNames[j.status]||j.status)}</b><p>${esc(j.status==='failed'?'تعذّر معالجة هذا الاختبار؛ تحقق من اتصال Qwen وأعد المحاولة بسؤال جديد.':j.resultText||'لم تصل المسودة بعد؛ تأكد من تشغيل الهاتف.')}</p></div></div>`).join('');
  box.innerHTML=`<div class="ov-inbox-thread-head"><button class="ov-inbox-back" onclick="inboxBack()" aria-label="الرجوع إلى المحادثات">→</button><span class="ov-inbox-avatar ov-inbox-icon">🧠</span><span class="ov-inbox-thread-name"><b>تدريب Qwen</b><small>اختبارات خاصة بالمالك — لا تُرسل إلى الزبائن</small></span></div>
  <p class="ov-caption">الأسئلة التجريبية لا تصبح معرفة دائمة. اعتمد الإجابات الصحيحة في قسم المعرفة.</p>
  <div class="ov-conv-messages">${history||'<p class="ov-inbox-empty">لا توجد اختبارات سابقة.</p>'}</div><label class="lbl" for="trainerQuestion">سؤالك التجريبي</label><textarea class="inp" id="trainerQuestion" maxlength="900" placeholder="مثلاً: كيف يمكن إنشاء حساب؟">${esc(ownerTrainingDraft)}</textarea><div class="ov-ai-actions"><button class="btn-pri" onclick="ownerSendTraining()">إرسال إلى Qwen</button><button class="btn-sm" onclick="openOwnerTraining()">تحديث الإجابات</button><button class="btn-sm" onclick="goAdmin('engagement')">📚 تعديل المعرفة المعتمدة</button></div>`;
 }catch(e){box.textContent=e.message;}
}
async function ownerSendTraining(){
 const text=document.getElementById('trainerQuestion')?.value.trim()||'';
 if(text.length<2)return toast('اكتب سؤالاً للتجربة');
 ownerTrainingDraft=text;
 try{await egRequest('test','POST',{text});toast('أرسلت المهمة إلى Qwen؛ ستظهر مسودتها بعد المعالجة');await openOwnerTraining();}catch(e){toast(e.message);}
}
async function openAgentStatusPane(){
 rememberAdminConversationDraft();
 selectedAdminConversation='__agent';
 const box=document.getElementById('conversationDetail');if(!box)return;
 delete box.dataset.conversationId; delete box.dataset.rowState;
 box.innerHTML='<p>تحميل حالة الوكيل…</p>';
 try{
  const r=await fetch(aiUrl('settings'),{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'تعذر تحميل حالة الوكيل');
  const ai=d.ai||{};
  box.innerHTML=`<div class="ov-inbox-thread-head"><button class="ov-inbox-back" onclick="inboxBack()" aria-label="الرجوع إلى المحادثات">→</button><span class="ov-inbox-avatar ov-inbox-icon">🤖</span><span class="ov-inbox-thread-name"><b>الوكيل الفعلي</b><small>الحالة والإعدادات</small></span></div><p>الحالة: <strong>${esc(ai.status||'غير معروف')}</strong></p><p>توليد المسودات: <b>${ai.executionEnabled?'نشط':'متوقف'}</b></p><p>الإجابات المعتمدة داخل الموقع: <b>${ai.autoSiteFaqEnabled?'نشطة':'متوقفة'}</b></p><p class="ov-caption">التشغيل والإيقاف وتغيير إعدادات الذكاء يتطلب OTP في لوحة تكامل الوكيل.</p><button class="btn-pri" onclick="goAdmin('ai')">🎛️ فتح التحكم بالوكيل وOTP</button>`;
 }catch(e){box.textContent=e.message;}
}
