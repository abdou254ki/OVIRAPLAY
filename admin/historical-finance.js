// Real MongoDB-backed staging and partial finance reports; no fake figures.
let historicalPage = 1;
function historicUrl() {return new URL(API).origin + '/api/v2/admin/historical-sales';}
function financeUrl() {return new URL(API).origin + '/api/v2/admin/finance/summary';}
function renderHistoricalSales(d) {
  const sales = d.sales || [];
  const channels = {instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',telegram:'Telegram',offline:'بيع مباشر',other:'أخرى'};
  return `<div class="card"><h2>📦 مبيعات خارجية وتاريخية</h2><p class="ov-caption">بيانات فعلية من MongoDB. الإدخالات هنا مسودات؛ لا تُضاف إلى ربح المتجر ولا تُربط آليًا بحسابات العملاء.</p>
    <p class="ov-main-caption">إجمالي السجلات: ${Number(d.total)||0} · آخر تحديث: ${esc(d.generatedAt ? new Date(d.generatedAt).toLocaleString('fr-DZ') : 'غير معروف')}</p></div>
    <section class="card"><h3>➕ إدخال بيع تاريخي للمراجعة</h3>
      <div class="ov-sale-grid">
        <label class="landing-field">قناة البيع<select class="inp" id="hs_channel">${Object.entries(channels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
        <label class="landing-field">مرجع خارجي فريد<input class="inp" id="hs_ref" maxlength="80" placeholder="IG-2021-0001"></label>
        <label class="landing-field">تاريخ البيع الفعلي<input class="inp" id="hs_when" type="date"></label>
        <label class="landing-field">المبلغ بالدينار الجزائري<input class="inp" id="hs_amount" type="number" min="0.01" step="0.01" placeholder="2500"></label>
        <label class="landing-field">اسم الزبون كما في المصدر<input class="inp" id="hs_customer" maxlength="100"></label>
        <label class="landing-field">وصف المنتج / الخدمة<input class="inp" id="hs_desc" maxlength="300"></label>
      </div>
      <label class="landing-field">ملاحظة عن مصدر إثبات العملية (لا تضع كلمات مرور)<textarea class="inp" id="hs_evidence" maxlength="300"></textarea></label>
      <label class="lbl">كلمة السر الحالية للمالك</label><input class="inp" type="password" id="hs_password" autocomplete="current-password">
      <label class="lbl">رمز 2FA (TOTP / تيليغرام)</label><input class="inp" id="hs_otp" inputmode="numeric" maxlength="6" dir="ltr">
      <div class="ov-ai-actions"><button class="btn-pri" onclick="createHistoricalSale()">حفظ مسودة في MongoDB</button><button class="btn-sm" onclick="requestHistoricalTelegramOtp()">إرسال رمز تيليغرام</button></div>
    </section>
    <section class="card"><h3>سجل الإدخالات غير المربوطة</h3>
    ${sales.map(s=>`<div class="ov-sale-record"><b>${esc(s.externalRef)}</b><span>${esc(channels[s.sourceChannel]||s.sourceChannel)} · ${esc(new Date(s.occurredAt).toLocaleDateString('fr-DZ'))}</span><span>${esc(s.customerLabel)} — ${esc(s.description)}</span><strong>${(Number(s.amountMinor)/100).toLocaleString('fr-DZ',{minimumFractionDigits:2})} DA</strong><small>مسودة · غير مرتبطة</small></div>`).join('') || '<p class="ov-empty">لا توجد مبيعات تاريخية مسجلة بعد.</p>'}
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
  const occurredAt=val('hs_when')?val('hs_when')+'T12:00:00+01:00':'';
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
