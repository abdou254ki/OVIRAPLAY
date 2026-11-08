// Real MongoDB-backed staging and partial finance reports; no fake figures.
let historicalPage = 1;
function historicUrl() {return new URL(API).origin + '/api/v2/admin/historical-sales';}
function financeUrl() {return new URL(API).origin + '/api/v2/admin/finance/summary';}
function renderHistoricalSales(d) {
  const sales = d.sales || [];
  const channels = {instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',telegram:'Telegram',offline:'بيع مباشر',other:'أخرى'};
  return `<div class="card"><h2>🧾 قيود مبيعات يدوية</h2><p class="ov-caption">هذه الصفحة لإدخال المالك معاملات يدويًا فقط. التواريخ من اختيارك. لا تُحتسب القيود مسكًا محاسبيًا ولا تُربط بحسابات العملاء تلقائيًا.</p>
    ${d.featureDisabled?`<p class="ov-ai-alert">الإدخال اليدوي غير مفعل في Render. بعد النسخ الاحتياطي اضبط HISTORICAL_SALES_ENABLED=true. لا تُفعلها قبل اختبار قواعد البيانات.</p>`:""}<p class="ov-main-caption">عدد القيود: ${Number(d.total)||0} · آخر تحديث: ${esc(d.generatedAt ? new Date(d.generatedAt).toLocaleString('fr-DZ') : 'غير معروف')}</p></div>
    <section class="card"><h3>➕ إدخال معاملة يدوية بتاريخ تختاره</h3>
      <p class="ov-caption">اختيار اليوم والشهر والسنة متاح؛ هذا التاريخ مستقل عن وقت إدخال القيد. يلزم 2FA للمالك.</p><div class="ov-sale-grid">
        <label class="landing-field">قناة البيع<select class="inp" id="hs_channel">${Object.entries(channels).map(([v,l])=>`<option value="${v}" ${v==='offline'?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="landing-field">مرجع المعاملة اليدوية (فريد)<input class="inp" id="hs_ref" maxlength="80" placeholder="IG-2021-0001"></label>
        <label class="landing-field">تاريخ المعاملة (اختر أي يوم)<input class="inp" id="hs_when" type="date"></label>
        <label class="landing-field">المبلغ بالدينار الجزائري<input class="inp" id="hs_amount" type="number" min="0.01" step="0.01" placeholder="2500"></label>
        <label class="landing-field">الزبون / الطرف المعني<input class="inp" id="hs_customer" maxlength="100"></label>
        <label class="landing-field">وصف المنتج / الخدمة<input class="inp" id="hs_desc" maxlength="300"></label>
      </div>
      <label class="landing-field">ملاحظة أو رقم وصل العملية (لا تضع كلمات مرور)<textarea class="inp" id="hs_evidence" maxlength="300"></textarea></label>
      <label class="lbl">كلمة السر الحالية للمالك</label><input class="inp" type="password" id="hs_password" autocomplete="current-password">
      <label class="lbl">رمز 2FA (TOTP / تيليغرام)</label><input class="inp" id="hs_otp" inputmode="numeric" maxlength="6" dir="ltr">
      <div class="ov-ai-actions"><button class="btn-pri" onclick="createHistoricalSale()">حفظ القيد اليدوي كمسودة</button><button class="btn-sm" onclick="requestHistoricalTelegramOtp()">إرسال رمز تيليغرام</button></div>
    </section>
    <section class="card"><h3>سجل القيود اليدوية (لا تمس الطلبات الآلية)</h3>
    ${sales.map(s=>`<div class="ov-sale-record"><b>${esc(s.externalRef)}</b><span>${esc(channels[s.sourceChannel]||s.sourceChannel)} · ${esc(new Date(s.occurredAt).toLocaleDateString('fr-DZ'))}</span><span>${esc(s.customerLabel)} — ${esc(s.description)}</span><strong>${(Number(s.amountMinor)/100).toLocaleString('fr-DZ',{minimumFractionDigits:2})} DA</strong><small>مسودة · غير مرتبطة</small></div>`).join('') || '<p class="ov-empty">لا توجد قيود يدوية مسجلة بعد.</p>'}
    <div class="ov-ai-actions"><button class="btn-sm" ${historicalPage<=1?'disabled':''} onclick="historicalPage--;loadPanel()">السابق</button><span>صفحة ${Number(d.page)||1} من ${Number(d.pages)||1}</span><button class="btn-sm" ${historicalPage>=Number(d.pages)?'disabled':''} onclick="historicalPage++;loadPanel()">التالي</button></div></section>`;
}
async function historicalAction(path,body) {
  try {
    const r=await fetch(new URL(API).origin+'/api/v2/admin/'+path,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();if(!r.ok||!d.success)throw new Error(d.message || 'خطأ في الخادم');return d;
  }catch(e){toast(e.message);return null}
}
async function createHistoricalSale(){
  const val=id=>document.getElementById(id)?.value?.trim()||'';
  const amount=Number(val('hs_amount'));const cents=Math.round(amount*100);
  const occurredAt=val('hs_when');
  if(!occurredAt || !(amount>0) || !Number.isSafeInteger(cents) || !val('hs_ref') || !val('hs_customer') || !val('hs_desc'))return toast('أكمل حقول البيع والمبلغ والتاريخ');
  if(!val('hs_password') || !/^\d{6}$/.test(val('hs_otp')))return toast('أدخل كلمة سر المالك ورمز 2FA');
  if(!confirm('سوف يُحفظ كمسودة مستقلة غير مرتبطة بأي زبون أو أرباح. هل تؤكد؟'))return;
  const d=await historicalAction('historical-sales',{sourceChannel:val('hs_channel'),externalRef:val('hs_ref'),occurredAt,
    amountMinor:cents,customerLabel:val('hs_customer'),description:val('hs_desc'),sourceEvidenceNote:val('hs_evidence'),
    currentPassword:val('hs_password'),code:val('hs_otp')});
  if(d){toast(d.message);historicalPage=1;loadPanel();}
}
async function requestHistoricalTelegramOtp(){
  const pass=document.getElementById('hs_password')?.value||'';
  if(!pass)return toast('أدخل كلمة السر أولاً');
  const d=await historicalAction('ai/step-up/telegram',{currentPassword:pass});if(d)toast(d.message);
}
function renderFinanceSummary(d){
  return `<section class="card"><h2>📊 المركز المالي — بيانات قابلة للتحقق فقط</h2>
    <p class="ov-caption">التقرير يقرأ طلبات الدفع من قاعدة MongoDB الحالية عبر Render، لكنه ليس دفتر محاسبة نهائيًا.</p>
    <div class="ov-main-caption">الفترة ${esc(new Date(d.period.start).toLocaleDateString('fr-DZ'))} — ${esc(new Date(d.period.end).toLocaleDateString('fr-DZ'))} · آخر توليد ${esc(new Date(d.generatedAt).toLocaleString('fr-DZ'))}</div>
    <div class="ov-finance-grid"><div><small>طلبات بعلامة دفع إلكتروني</small><strong>${Number(d.verifiedOnlineOrderCount)||0}</strong></div>
    <div><small>قيمة الطلبات المعلمة كمدفوعة</small><strong>${(Number(d.verifiedOnlineOrderAmount)||0).toLocaleString('fr-DZ')} DA</strong></div>
    <div><small>صافي الربح</small><strong>غير متاح</strong></div><div><small>الذمم المدينة والمصاريف</small><strong>غير متاحة</strong></div></div>
    <div class="ov-ai-alert"><b>⚠️ بيانات جزئية — لا تُستعمل كميزانية أو تقرير أرباح</b><p>${esc(d.explanation)}</p></div>
    <button class="btn-sm" onclick="loadPanel()">⟳ إعادة قراءة البيانات</button></section>`;
}
