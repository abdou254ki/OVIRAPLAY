/* Owner-only AI integration UI; server is the sole authority for policies and tokens. */
let agentOneTimeToken = '';
function aiUrl(path) { return new URL(API).origin + '/api/v2/admin/ai/' + path; }
function renderAIControl(d) {
  const ai = d.ai || {};
  const labels = {unpaired:'غير مربوط',pending:'رمز صادر — بانتظار الهاتف',connected:'متصل — وضع تجربة',offline:'منقطع',stopped:'متوقف بقرار المالك'};
  const credential = ai.credential || {};
  const moment = (v) => v ? new Date(v).toLocaleString('fr-DZ') : 'لم يصل بعد';
  return `<div class="card"><span class="ov-ai-status">📱 ${esc(labels[ai.status] || 'حالة غير معروفة')}</span>
    <h2 style="font-size:21px;margin-top:12px">الوكيل الذكي المحلي — Local AI Agent</h2>
    <p class="ov-caption">هاتف Android / Termux يتصل لاحقًا بخادم Render عبر HTTPS. لا نغيّر GitHub Pages أو MongoDB Atlas. التنفيذ التلقائي معطّل افتراضيًا.</p></div>
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
        <div class="ov-ai-meta"><div><span>ردود العملاء</span><b>assist (مراجعة بشرية)</b></div>
        <div><span>حد الرسائل</span><b>${Number(ai.maxMessagesPerHour) || 20} لكل عميل / 60 دقيقة</b></div>
        <div><span>تكلفة WhatsApp</span><b>free — حظر المجهول التكلفة</b></div>
        <div><span>وضع التشغيل</span><b>Shadow — تنفيذ معطّل</b></div>
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
    <section class="card"><h3>📘 التوصيل لاحقاً في Termux</h3>
      <p>1. جهّز Qwen وTermux محليًا، واحتفظ بـllama-server على 127.0.0.1 فقط.</p>
      <p>2. ضع <code>OVIRA_API_BASE</code> على رابط خادم Render، و<code>OVIRA_AGENT_TOKEN</code> في متغير بيئة سري بالهاتف.</p>
      <p>3. شغّل عامل Heartbeat الاختباري؛ ستظهر حالة «متصل» عند استقبال النبضات الموثقة، دون السماح بمهام مالية أو ردود WhatsApp.</p>
      <div class="ov-ai-footer">لا يُنقل أي طلب أو مفتاح دفع إلى الهاتف. تخضع المهام الفعلية لموافقة مستقلة بعد الاختبارات.</div>
    </section>`;
}
function aiAuthValues() {
  return {currentPassword:document.getElementById('aiCurrentPassword')?.value || '',code:document.getElementById('aiOtp')?.value || ''};
}
async function aiAction(path, payload) {
  try {
    const response = await fetch(aiUrl(path), { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+token }, body:JSON.stringify(payload) });
    const data = await response.json();
    if (response.status === 401 && data.code !== 'BAD_REAUTH' && data.code !== 'BAD_OTP') return logout();
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
