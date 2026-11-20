/* Owner-only AI integration UI; server is the sole authority for policies and tokens. */
let agentOneTimeToken = '';
let aiControlSession='';let aiSessionExpiry=0;
function aiUrl(path) { return new URL(API).origin + '/api/v2/admin/ai/' + path; }
function renderAIControl(d) {
  const ai = d.ai || {};
  const labels = {unpaired:'غير مربوط',pending:'رمز صادر — بانتظار الهاتف',connected: ai.executionEnabled ? 'متصل — توليد مسودات' : 'متصل — وضع تجربة',offline:'منقطع',stopped:'متوقف بقرار المالك'};
  const credential = ai.credential || {};
  const moment = (v) => v ? new Date(v).toLocaleString('fr-DZ') : 'لم يصل بعد';
  return `<div class="card"><span class="ov-ai-status">📱 ${esc(labels[ai.status] || 'حالة غير معروفة')}</span>
    <h2 style="font-size:21px;margin-top:12px">الوكيل الذكي المحلي — Local AI Agent</h2>
    <p class="ov-caption">Qwen على هاتف Android/Termux عبر HTTPS صادر إلى Render. يمكنه إعداد المسودات والرد على الأسئلة العامة داخل الموقع بعد تفعيل مستقل من المالك. لا يغيّر الطلبات أو الأرصدة أو كلمات السر، ولا يرسل WhatsApp.</p></div>
    <div class="ov-ai-grid">
      <section class="card"><h3>🔌 حالة الاتصال الحقيقية</h3>
        <div class="ov-ai-meta"><div><span>الجهاز</span><b>${esc(credential.deviceName || 'غير مُعد')}</b></div>
        <div><span>آخر Heartbeat</span><b>${esc(moment(credential.lastHeartbeatAt))}</b></div>
        <div><span>انتهاء الرمز</span><b>${esc(moment(credential.expiresAt))}</b></div>
        <div><span>إصدار العامل</span><b>${esc(credential.workerVersion || 'غير متوفر')}</b></div>
        <div><span>الخادم</span><code dir="ltr">${esc(ai.serverUrl || 'غير متاح')}</code></div></div>
        <div class="ov-ai-actions"><button class="btn-sm" onclick="loadPanel()">⟳ تحديث الحالة</button></div>
      </section>
      <section class="card"><h3>🛡️ السياسة الحالية</h3>
        <div class="ov-ai-meta"><div><span>ردود العملاء</span><b>${ai.autoSiteRepliesEnabled?'ردود Qwen العامة مفعلة':'مسودات / مراجعة'}</b></div>
        <div><span>حد الرسائل</span><b>${Number(ai.maxMessagesPerHour) || 20} لكل عميل / 60 دقيقة</b></div>
        <div><span>تكلفة WhatsApp</span><b>free — حظر المجهول التكلفة</b></div>
        <div><span>وضع التشغيل</span><b>${ai.executionEnabled ? 'Assist — توليد مسودات' : 'Shadow — لا سحب للمهام'}</b></div>
        <div><span>الإيقاف الطارئ</span><b>${ai.killSwitch ? 'مفعّل' : 'جاهز عند الحاجة'}</b></div></div>
        <p class="ov-caption">هذه سياسة الربط والتحضير، وليست موافقة على إرسال رسائل أو تنفيذ تغييرات في الطلبات.</p>
      </section>
    </div>
    <section class="card"><h3>🔑 إنشاء / تدوير رمز ربط الهاتف</h3>
      <p class="ov-caption">للمالك فقط. يتطلب كلمة السر الحالية ورمز 2FA؛ وسيُعرض رمز الوكيل الجديد مرة واحدة. التدوير يلغي الرمز السابق.</p>
      ${agentOneTimeToken ? `<div class="ov-ai-token"><b>رمز الاقتران الجديد — انسخه الآن</b><code id="aiOneTimeToken">${esc(agentOneTimeToken)}</code><button class="btn-pri" onclick="copyAgentToken()">نسخ الرمز</button><p class="ov-caption">بعد مغادرة الصفحة أو تحديث المتصفح لن يظهر مرة أخرى.</p></div>` : ''}
      <label class="lbl" for="aiDeviceName">اسم الهاتف (لاتيني)</label><input class="inp" id="aiDeviceName" maxlength="64" value="${esc(credential.deviceName || 'OVIRA-PHONE-01')}">
      <label class="lbl" for="aiCurrentPassword">كلمة سر المالك الحالية</label><input class="inp" id="aiCurrentPassword" type="password" autocomplete="current-password">
      <label class="lbl" for="aiOtp">رمز 2FA الحالي (TOTP أو تيليغرام)</label><input class="inp" id="aiOtp" inputmode="numeric" maxlength="6" placeholder="000000" dir="ltr">
      <div class="ov-ai-actions">
        <button class="btn-pri" onclick="createAgentCredential()">إنشاء رمز آمن</button>
        <button class="btn-sm" onclick="requestAgentTelegramCode()">إرسال رمز 2FA عبر تيليغرام</button>
        <button class="btn-sm" onclick="revokeAgentCredential()">إلغاء الرمز الحالي</button>
        <button class="btn-bad" onclick="killAgentConnection()">إيقاف طارئ</button>
        ${ai.killSwitch ? '<button class="btn-sm" onclick="restoreAgentConnection()">إعادة السماح بالربط فقط</button>' : ''}
      </div>
      <div class="ov-ai-alert">لا تدخل رمز العامل في كود الموقع أو GitHub أو بيانات محادثة عامة. تأكد من تفعيل 2FA في الإعدادات أولاً؛ ربط الهاتف وحده لا يفعّل الرد التلقائي.</div>
    </section>
    <section class="card"><h3>🎛️ مفتاح الوكيل الذكي — تفعيل وإيقاف مستقل</h3>
      <p class="ov-caption">للتحكم اليومي: تحقق مرة واحدة لتحصل على جلسة قصيرة مدتها 15 دقيقة في هذه الصفحة فقط. إصدار/إلغاء توكن الهاتف وإيقاف الطوارئ ما زالت تتطلب OTP جديداً. الدعم البشري هو الوضع الافتراضي.</p>
      <div class="ov-ai-actions"><button class="btn-sm" onclick="unlockAiControls()">🔐 تحقق مرة واحدة لجلسة التحكم</button><small>${aiControlSession&&Date.now()<aiSessionExpiry?'جلسة التحكم مفتوحة':'جلسة التحكم غير مفتوحة'}</small></div>
      <div class="ov-ai-human-switch"><b>الرد على الزبائن: ${ai.supportHumanOnly!==false?'بشري فقط':'AI متاح بعد تفعيل خاص'}</b><button class="${ai.supportHumanOnly!==false?'btn-sm':'btn-bad'}" onclick="setSupportHumanOnly(${ai.supportHumanOnly===false})">${ai.supportHumanOnly!==false?'إعدادات الرد الآلي (بعد تحقق)':'⏸ إيقاف ردود AI فوراً وإبقاء الربط'}</button></div>
      <p class="ov-caption">يجب وجود هاتف متصل برمز جديد وصلاحية jobs:claim، وضبط AI_EXECUTION_ENABLED=true في Render. يتطلب التفعيل موافقة المالك + 2FA. توليد المسودات وحده لا يرسل أي رسالة. رد Qwen التلقائي إعداد مختلف ومقفل افتراضيًا.</p>
      <div class="ov-ai-actions">
        ${ai.executionEnabled ? '<button class="btn-sm" onclick="changeAgentDraftMode(false)">⏸ إيقاف توليد المسودات</button>' : '<button class="btn-pri" onclick="changeAgentDraftMode(true)">▶ تفعيل توليد مسودات Qwen</button>'}
      </div>
      <h4>إجابات AI الآلية للأسئلة العامة على الموقع فقط</h4>
      <p class="ov-caption">مقفلة افتراضيًا؛ بعد تجربة الوكيل يمكن للمالك السماح بردود ثابتة معتمدة (التحية، طريقة الاشتراك، مكان الأسعار). لا تُرسل صياغة Qwen الحرة تلقائيًا ولا رسائل WhatsApp.</p>
      <div class="ov-ai-actions">${ai.autoSiteFaqEnabled ? '<button class="btn-sm" onclick="setAutoFaq(false)">إيقاف إجابات الموقع الآلية</button>' : '<button class="btn-sm" onclick="setAutoFaq(true)">تفعيل الإجابات المعتمدة بعد الاختبار</button>'}</div>
      <h4 style="margin-top:18px">💬 ردود Qwen العامة التلقائية — موقع المتجر فقط</h4>
      <p class="ov-caption">ميزة مستقلة مقفلة افتراضيًا. يلزم العلم AI_SITE_AUTO_REPLY_ALLOWED=true في Render، وكلمة السر وOTP، وتشغيل الهاتف. يرد على الاستفسارات العامة فقط؛ الحالات الخاصة بالحساب أو الدفع أو الأسرار تذهب إلى الدعم البشري. لا يرسل على WhatsApp.</p>
      <div class="ov-ai-actions">${ai.autoSiteRepliesEnabled?'<button class="btn-bad" onclick="setSiteAutoReplies(false)">⏸ إيقاف ردود Qwen التلقائية</button>':'<button class="btn-pri" onclick="setSiteAutoReplies(true)">▶ تفعيل ردود Qwen للموقع بعد الاختبار</button>'}</div>
      <h4 style="margin-top:18px">🧪 مختبر أسئلة المالك (بدون فلتر الكلمات العامة)</h4>
      <p class="ov-caption">يمكنك اختبار أي سؤال نصي أو محاولات كشف المعلومات، لكن لا تضع رموزًا حقيقية؛ النموذج لا يحصل على أسرار Render أو بيانات عملاء حقيقية.</p>
      <textarea class="inp" id="aiTestQuestion" maxlength="1200" rows="3" aria-label="سؤال تجربة المالك">مرحبا كيف يمكن معرفة أسعار الاشتراكات؟</textarea>
      <div class="ov-ai-actions"><button class="btn-sm" onclick="queueAgentTest()">إرسال اختبار إلى الهاتف</button><button class="btn-sm" onclick="refreshAIOperations()">تحديث مهام Qwen</button></div>
      <div id="ov-ai-jobs" class="ov-ai-list">جارٍ تحميل قائمة المهام…</div>
    </section>
    <section class="card"><h3>💬 مركز الرسائل الموحد</h3>
      <p class="ov-caption">رسائل الموقع وWhatsApp الواردة ومسودات Qwen في شاشة واحدة. الرد من الإدارة يصل مباشرة إلى محادثات الموقع. إرسال WhatsApp عبر API يظل معطلاً إلى حين إثبات أهلية الإرسال المجاني.</p>
      <button class="btn-pri" onclick="goAdmin('conversations')">فتح محادثات العملاء والتدريب</button>
    </section>
    <section class="card"><h3>🔐 إصدار رمز دعم خاص بحساب زبون</h3>
      <p class="ov-caption">رمز تحقق منفصل محدود بـ15 دقيقة ومرة واحدة؛ الزبون يدخله من «حسابي»، ولا يعطي Qwen أي كلمة مرور أو تحكمًا في بيانات الحساب. تغيير البيانات يتطلب OTP للحساب أيضًا.</p>
      <label class="lbl" for="ownerSupportCustomerId">معرّف حساب الزبون (من صفحة الزبائن)</label>
      <input class="inp" id="ownerSupportCustomerId" maxlength="24" placeholder="24 حرفًا" dir="ltr">
      <button class="btn-sm" onclick="issueOwnerSupportCode()">إنشاء رمز الدعم بعد كلمة السر وOTP</button>
      <div id="ownerSupportCodeResult" class="ov-caption" role="status"></div>
    </section>
    <section class="card"><h3>📘 التشغيل عبر Termux</h3>
      <p>1. جهّز Qwen وTermux محليًا، واحتفظ بـllama-server على 127.0.0.1 فقط.</p>
      <p>2. ضع <code>OVIRA_API_URL</code> على رابط خادم Render، و<code>OVIRA_WORKER_TOKEN</code> في متغير بيئة سري بالهاتف.</p>
      <p>3. شغّل <code>ovira_worker.py</code> من حزمة Termux مع Qwen. ستُسحب مهام الأسئلة العامة وتعود مسوداتها إلى MongoDB. فعّل وضع المسودات بعد الاختبار فقط.</p>
      <div class="ov-ai-footer">لا يُنقل أي طلب أو مفتاح دفع إلى الهاتف. الرسائل الشخصية والحساسة تظل مع الدعم البشري.</div>
    </section>`;
}
function aiAuthValues() {
  return {currentPassword:document.getElementById('aiCurrentPassword')?.value || '',code:document.getElementById('aiOtp')?.value || ''};
}
async function aiAction(path, payload) {
  try {
    const response = await fetch(aiUrl(path), { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+token,...(aiControlSession&&Date.now()<aiSessionExpiry?{'X-AI-Control-Session':aiControlSession}:{}) }, body:JSON.stringify(payload) });
    const data = await response.json();
    if (data.code==='CONTROL_SESSION_INVALID'){aiControlSession='';aiSessionExpiry=0;}
    if (response.status === 401 && !['BAD_REAUTH','BAD_OTP','CONTROL_SESSION_INVALID'].includes(data.code)) return logout();
    if (!response.ok || !data.success) throw new Error(data.message || 'لم تنجح العملية');
    return data;
  } catch(e) {toast(e.message || 'تعذر الاتصال بالخادم'); return null;}
}
async function requestAgentTelegramCode() {
  const {currentPassword} = aiAuthValues();
  if (!currentPassword) return toast('أدخل كلمة السر أولاً');
  const d = await aiAction('step-up/telegram',{currentPassword}); if(d) toast(d.message);
}
async function createAgentCredential() {
  const auth = aiAuthValues();
  const deviceName = document.getElementById('aiDeviceName')?.value.trim() || '';
  if (!auth.currentPassword || !/^\d{6}$/.test(auth.code)) return toast('أدخل كلمة السر ورمز 2FA');
  if (!/^[a-zA-Z0-9 _-]{3,64}$/.test(deviceName)) return toast('اسم الجهاز يجب أن يكون 3–64 حرفاً لاتينياً');
  if (!confirm('سيُلغى رمز الربط القديم فور إنشاء رمز جديد. هل تؤكد؟')) return;
  const d = await aiAction('credentials',{...auth,deviceName});
  if (d) { agentOneTimeToken = d.pairingToken; toast('تم إنشاء رمز الربط؛ انسخه الآن'); loadPanel(); }
}
function copyAgentToken() {
  if (!agentOneTimeToken) return toast('لم يعد الرمز متاحاً');
  navigator.clipboard.writeText(agentOneTimeToken).then(()=>toast('تم نسخ رمز الربط')).catch(()=>toast('حدد الرمز وانسخه يدوياً'));
}
async function revokeAgentCredential() {
  const auth = aiAuthValues();
  if (!auth.currentPassword || !/^\d{6}$/.test(auth.code)) return toast('أدخل كلمة السر ورمز 2FA');
  if (!confirm('إلغاء المفتاح الحالي فوراً؟')) return;
  const d = await aiAction('credentials/revoke',auth);
  if (d) { agentOneTimeToken=''; toast('تم إلغاء الرمز'); loadPanel(); }
}
async function killAgentConnection() {
  const auth = aiAuthValues();
  if (!auth.currentPassword || !/^\d{6}$/.test(auth.code)) return toast('أدخل كلمة السر ورمز 2FA');
  if (!confirm('إيقاف طارئ: سيُلغى كل اتصال للهاتف، ولن تعمل المهام. تأكيد؟')) return;
  const d = await aiAction('kill-switch',auth);
  if (d) { agentOneTimeToken=''; toast(d.message); loadPanel(); }
}

async function restoreAgentConnection() {
  const auth = aiAuthValues();
  if (!auth.currentPassword || !/^\d{6}$/.test(auth.code)) return toast('أدخل كلمة السر ورمز 2FA');
  if (!confirm('إعادة السماح باتصال Heartbeat فقط؛ كل المفاتيح القديمة ملغاة. هل تؤكد؟')) return;
  const d = await aiAction('restore-connection',auth);
  if (d) {agentOneTimeToken='';toast(d.message);loadPanel();}
}

async function changeAgentDraftMode(activate) {
  const auth = aiAuthValues();
  if(activate&&!aiRoutineReady())return;
  if (!confirm(activate ? 'تفعيل توليد مسودات Qwen دون إرسال WhatsApp؟' : 'إيقاف سحب مهام Qwen الجديدة؟')) return;
  const d = await aiAction(activate ? 'enable-drafts' : 'pause-drafts', auth);
  if (d) { toast(d.message); loadPanel(); }
}
async function queueAgentTest() {
  const text = document.getElementById('aiTestQuestion')?.value.trim() || '';
  const d = await aiAction('test-job', {text});
  if (d) {toast(d.message); refreshAIOperations();}
}
async function closeAIMsg(id) {
  if (!confirm('إغلاق الرسالة بعد مراجعتها دون إرسال تلقائي؟')) return;
  const d = await aiAction('inbox/'+encodeURIComponent(id)+'/close', {});
  if (d) {toast(d.message); refreshAIOperations();}
}
async function retryAIMsg(id) {
  const d = await aiAction('inbox/'+encodeURIComponent(id)+'/retry', {});
  if (d) {toast(d.message); refreshAIOperations();}
}
function copyAIDraft(id) {
  const node = document.getElementById('draft_'+id);
  if (!node) return;
  navigator.clipboard.writeText(node.textContent || '').then(()=>toast('تم نسخ مسودة الرد')).catch(()=>toast('حدد النص وانسخه يدويًا'));
}
async function refreshAIOperations() {
  const j = document.getElementById('ov-ai-jobs');
  if (!j || !token) return;
  try {
    const r=await fetch(aiUrl('jobs'),{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(r.status===401)return logout();
    const d=await r.json();
    if(!r.ok||!d.success)throw new Error('تعذر تحميل سجل المهام');
    if(!document.getElementById('ov-ai-jobs'))return;
    j.innerHTML=`<p class="ov-caption">الحالات: ${Object.entries(d.counts||{}).map(([k,v])=>esc(k)+': '+Number(v)).join(' | ')||'لا مهام'}</p>`+
      ((d.jobs||[]).length?`<div class="ov-ai-table">${d.jobs.map(x=>`<div class="ov-ai-entry"><b>${esc(x.kind)}</b> — ${esc(x.status)} · محاولات ${Number(x.attempts)||0}<small>${esc(new Date(x.createdAt).toLocaleString('fr-DZ'))}</small>${x.resultText?`<blockquote>${esc(x.resultText)}</blockquote>`:''}</div>`).join('')}</div>`:'<p>لا توجد مهام بعد.</p>');
  }catch(e){if(j)j.textContent='تعذّر تحميل المهام؛ تحقق من اتصال API ثم أعد المحاولة.';}
}

async function setAutoFaq(on){
 const auth=aiAuthValues();if(on&&!aiRoutineReady())return;
 if(!confirm(on?'هل أجريت اختبار Qwen وتؤكد تفعيل الإجابات الثابتة للموقع فقط؟':'تعطيل إجابات الموقع الآلية؟'))return;
 const d=await aiAction('site-auto-faq/'+(on?'enable':'disable'),auth);
 if(d){toast(d.message);loadPanel();}
}

async function setSiteAutoReplies(on){
 const auth=aiAuthValues();
 if(on&&!aiRoutineReady())return;
 if(!confirm(on?'تفعيل الردود العامة من Qwen على محادثات الموقع؟ لن يغيّر أي حساب أو يرسل WhatsApp.':'إيقاف الردود التلقائية وإبقاء المسودات؟'))return;
 const d=await aiAction('site-auto-replies/'+(on?'enable':'disable'),auth);
 if(d){toast(d.message);loadPanel();}
}

async function issueOwnerSupportCode(){
 const auth=aiAuthValues(),customerId=document.getElementById('ownerSupportCustomerId')?.value.trim()||'';
 if(!/^[a-f0-9]{24}$/i.test(customerId))return toast('أدخل معرّف زبون صحيحًا');
 if(!auth.currentPassword||!/^[0-9]{6}$/.test(auth.code))return toast('أدخل كلمة سر المالك وOTP');
 const d=await aiAction('support-code',{...auth,customerId});
 const box=document.getElementById('ownerSupportCodeResult');
 if(d&&box){box.textContent='رمز الدعم (يظهر مرة واحدة؛ انسخه الآن): '+d.code+' — ينتهي بعد 15 دقيقة.';toast(d.message);}
}

async function unlockAiControls(){const auth=aiAuthValues();if(!auth.currentPassword||!/^[0-9]{6}$/.test(auth.code))return toast('أدخل كلمة السر ورمز 2FA في الأعلى لمرة واحدة');const d=await aiAction('control-session',auth);if(d){aiControlSession=d.controlSession;aiSessionExpiry=Date.now()+Number(d.expiresIn||900)*1000;const pass=document.getElementById('aiCurrentPassword');const otp=document.getElementById('aiOtp');if(pass)pass.value='';if(otp)otp.value='';toast('تم فتح جلسة تحكم لمدة 15 دقيقة');loadPanel();}}
function aiRoutineReady(){if(aiControlSession&&Date.now()<aiSessionExpiry)return true;toast('افتح جلسة التحكم أولاً بكلمة السر وOTP مرة واحدة');return false;}
async function setSupportHumanOnly(humanOnly){if(!humanOnly&&!aiRoutineReady())return;if(!confirm(humanOnly?'إيقاف جميع ردود الموقع الآلية وإبقاء اقتران الهاتف؟':'السماح مستقبلاً بتفعيل الوكيل؟ ستبقى محادثات الزبائن بشرية حتى تفعيل منفصل.'))return;const d=await aiAction('human-support',{humanOnly});if(d){toast(humanOnly?'الدعم البشري فقط مفعل':'الاتصال بالوكيل متاح، دون ردود تلقائية');loadPanel();}}
