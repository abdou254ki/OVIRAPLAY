// =========================================================
// OVIRA PLAY — ADMIN ORDERS MANAGEMENT (admin/orders.js)
// =========================================================

function applyOrderDates() {
  orderFrom = document.getElementById('orderFrom')?.value || '';
  orderTo = document.getElementById('orderTo')?.value || '';
  if (orderFrom && orderTo && orderFrom > orderTo) return toast('تاريخ البداية بعد النهاية');
  ordersPage = 1;
  loadPanel();
}

function previewDelivery(id) {
  const type = document.getElementById('dlv_type_' + id)?.value;
  const creds = document.getElementById('dlv_cred_' + id)?.value.trim() || '';
  const url = document.getElementById('dlv_invite_' + id)?.value.trim() || '';
  const profile = document.getElementById('dlv_prof_' + id)?.value.trim() || '';
  if (type === 'invite' && !/^https:\/\/\S+$/i.test(url)) return toast('أدخل رابط تفعيل HTTPS صالحًا');
  if (type !== 'invite' && !creds) return toast('بيانات الحساب مطلوبة');
  const typeName = { screen: 'شاشة / بروفايل', account: 'حساب كامل', invite: 'رابط دعوة' }[type] || type;
  // لا نكشف كلمة المرور أو رمز المصادقة في نافذة المعاينة.
  alert('معاينة آمنة للتسليم\nالنوع: ' + typeName + '\nبيانات الحساب: ' + (creds ? 'تم إدخالها' : 'غير مطلوبة') + '\nالرابط: ' + (url ? 'تم إدخاله' : 'غير مطلوب') + '\nالشاشة: ' + (profile || 'لا توجد') + '\n\nراجع الطلب ثم اضغط تأكيد إرسال التسليم.');
}

function copyOrderSummary(id, code) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code)
    .then(() => toast('تم نسخ رمز الطلب')).catch(() => toast('تعذّر النسخ'));
  else toast('النسخ غير مدعوم هنا');
}

async function sendTemporaryCode(orderId) {
  const field = document.getElementById('tempcode_' + orderId);
  const code = field?.value.trim() || '';
  if (!/^[a-zA-Z0-9]{4,12}$/.test(code)) return toast('أدخل رمزًا مؤقتًا صالحًا (4–12)');
  const r = await fetch(`${API}/orders/${orderId}/temporary-code`, { method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({code}) });
  field.value = '';
  const d = await r.json(); toast(d.message || 'تعذر إرسال الرمز');
}

function toggleDeliveryFields(orderId) {
  const t = document.getElementById('dlv_type_' + orderId).value;
  document.getElementById('dlv_invite_wrap_' + orderId).hidden = t !== 'invite';
  document.getElementById('dlv_account_wrap_' + orderId).hidden = t === 'invite';
  const profile = document.getElementById('dlv_prof_' + orderId)?.closest('.grid-2');
  if (profile) profile.hidden = t !== 'screen';
}

async function deliverAccount(orderId) {
  const type = document.getElementById('dlv_type_' + orderId).value;
  const invitationUrl = document.getElementById('dlv_invite_' + orderId).value.trim();
  const credentials = document.getElementById('dlv_cred_' + orderId).value.trim();
  const profileName = document.getElementById('dlv_prof_' + orderId).value.trim();
  const pinCode = document.getElementById('dlv_pin_' + orderId).value.trim();
  const extraNote = document.getElementById('dlv_note_' + orderId).value.trim();

  if (type !== 'invite' && !credentials) return toast('أدخل بيانات الحساب أولاً');
  if (type === 'invite' && !/^https:\/\/\S+$/i.test(invitationUrl)) return toast('أدخل رابط تفعيل يبدأ بـ https://');
  if (!confirm('سيتم حفظ بيانات التسليم وإرسالها للزبون المرتبط بهذا الطلب. هل تأكدت من هوية الزبون ومعلومات الحساب؟')) return;

  const r = await fetch(`${API}/orders/${orderId}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ type, credentials, invitationUrl, profileName, pinCode, extraNote })
  });
  const d = await r.json();
  toast(d.message || (d.success ? 'تم التسليم ✓' : 'تعذّر التسليم'));
  if (d.success) loadPanel();
}

async function upStatus(id, status) {
  await fetch(`${API}/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ status })
  });
  toast('تم تحديث الحالة ✓');
  loadPanel();
}

async function saveNote(id) {
  const adminNote = document.getElementById('nt_' + id).value;
  await fetch(`${API}/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ adminNote })
  });
  toast('تم حفظ الملاحظة ✓');
  loadPanel();
}

async function delOrder(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) return;
  await fetch(`${API}/orders/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  toast('تم حذف الطلب');
  loadPanel();
}

function showOrderLink(orderId){
 const target=document.getElementById('orderLink_'+orderId);if(!target)return;
 target.innerHTML=`<div class="ov-link-form"><label class="lbl">ابحث بالبريد أو الهاتف أو اسم الحساب</label><div class="search-row"><input class="inp" id="orderLinkSearch_${orderId}" autocomplete="off" placeholder="البريد الإلكتروني أو رقم الهاتف"><button type="button" class="btn-sm" onclick="lookupOrderCustomer('${orderId}')">بحث</button></div><div id="orderLinkMatches_${orderId}" aria-live="polite"></div></div>`;
}
async function lookupOrderCustomer(orderId){
 const q=document.getElementById('orderLinkSearch_'+orderId)?.value.trim()||'';
 const result=document.getElementById('orderLinkMatches_'+orderId);if(!result)return;
 if(q.length<3){result.textContent='اكتب ثلاثة أحرف على الأقل.';return;}
 result.textContent='يتم البحث…';
 try{
  const r=await fetch(`${API}/orders/${encodeURIComponent(orderId)}/link-candidates?q=${encodeURIComponent(q)}`,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const data=await r.json();if(!r.ok||!data.success)throw Error(data.message||data.code||'فشل البحث');
  result.innerHTML=(data.candidates||[]).map(c=>`<div class="ov-link-candidate"><div><b>${esc(c.name)}</b><small>${esc(c.email||'')} · ${esc(c.phone||'')}</small><small>${c.match?.verified?'مطابقة موثقة':c.match?.email||c.match?.phone?'مطابقة تحتاج إثبات ملكية مستقل':'لا تطابق بيانات الطلب'}</small></div>${c.match?.email||c.match?.phone?`<button type="button" class="btn-sm" onclick="prepareOrderLink('${orderId}','${esc(c.id)}',${!!c.match?.verified})">اختيار</button>`:'<span class="ov-caption">غير قابل للربط</span>'}</div>`).join('')||'<p class="ov-caption">لم نجد حسابات مطابقة.</p>';
 }catch(e){result.textContent=e.message;}
}
function prepareOrderLink(orderId,customerId,verified){
 const result=document.getElementById('orderLinkMatches_'+orderId);if(!result)return;
 result.innerHTML=`<div class="ov-link-confirm"><b>تأكيد ربط الطلب بالحساب المحدد</b><p class="ov-caption">${verified?'هناك بريد أو هاتف موثق مطابق.':'لم يتم التحقق من وسيلة الاتصال. يلزم إثبات مستقل وملاحظة مفصلة.'}</p><label class="lbl">ملاحظة إثبات الملكية ${verified?'(اختيارية)':'(إلزامية)'}</label><textarea class="inp" id="orderProof_${orderId}" maxlength="300" placeholder="كيف تأكدت من ملكية الطلب والحساب؟"></textarea><label class="lbl">كلمة سر المالك</label><input class="inp" type="password" autocomplete="current-password" id="orderPass_${orderId}"><label class="lbl">رمز 2FA</label><input class="inp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" id="orderOtp_${orderId}" dir="ltr"><button type="button" class="btn-pri" onclick="confirmOrderLink('${orderId}','${customerId}')">تأكيد الربط النهائي</button></div>`;
}
async function confirmOrderLink(orderId,customerId){
 const currentPassword=document.getElementById('orderPass_'+orderId)?.value||'';
 const code=document.getElementById('orderOtp_'+orderId)?.value||'';
 const evidenceNote=document.getElementById('orderProof_'+orderId)?.value.trim()||'';
 if(!currentPassword||!/^[0-9]{6}$/.test(code))return toast('أدخل كلمة السر ورمز 2FA');
 if(!confirm('سيرى صاحب الحساب الطلب وتفاصيل التسليم الموجودة فيه. تأكد من هويته. هل تؤكد الربط؟'))return;
 try{
  const r=await fetch(`${API}/orders/${encodeURIComponent(orderId)}/link-customer`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({customerId,confirm:'LINK_ORDER_TO_ACCOUNT',evidenceNote,currentPassword,code})});
  const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||d.code||'فشل ربط الطلب');
  toast('تم ربط الطلب بالحساب مع الاحتفاظ بسجل العملية');loadPanel();
 }catch(e){toast(e.message);}
}


window.applyOrderDates = applyOrderDates;
window.previewDelivery = previewDelivery;
window.copyOrderSummary = copyOrderSummary;
window.sendTemporaryCode = sendTemporaryCode;
window.toggleDeliveryFields = toggleDeliveryFields;
window.deliverAccount = deliverAccount;
window.upStatus = upStatus;
window.saveNote = saveNote;
window.delOrder = delOrder;
window.showOrderLink = showOrderLink;
window.lookupOrderCustomer = lookupOrderCustomer;
window.prepareOrderLink = prepareOrderLink;
window.confirmOrderLink = confirmOrderLink;
