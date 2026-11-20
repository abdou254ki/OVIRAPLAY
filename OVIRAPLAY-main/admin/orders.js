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

// =========================================================
// طلبات يدوية وإدارة المخزون والشاشات
// =========================================================

async function submitManualOrder() {
  const name = document.getElementById('mo_name')?.value.trim();
  const phone = document.getElementById('mo_phone')?.value.trim();
  const email = document.getElementById('mo_email')?.value.trim() || undefined;
  const prodSelect = document.getElementById('mo_prod');
  const productId = prodSelect?.value;
  const productName = prodSelect?.options[prodSelect.selectedIndex]?.text;
  const planId = document.getElementById('mo_plan')?.value || undefined;
  const price = Number(document.getElementById('mo_price')?.value) || 0;
  const months = Number(document.getElementById('mo_months')?.value) || 1;
  const quantity = Number(document.getElementById('mo_qty')?.value) || 1;
  const paymentMethod = document.getElementById('mo_pay_method')?.value || 'يدوي / إداري';
  const paymentStatus = document.getElementById('mo_pay_status')?.value || 'paid';
  const scheduledFor = document.getElementById('mo_sched_for')?.value || undefined;
  const scheduleNote = document.getElementById('mo_sched_note')?.value.trim() || undefined;
  const autoAssignStock = !!document.getElementById('mo_auto_stock')?.checked;
  const adminNote = document.getElementById('mo_note')?.value.trim() || undefined;

  if (!name || !phone) return toast('يرجى إدخال اسم الزبون ورقم الهاتف');
  if (!productId) return toast('يرجى اختيار المنتج المطلوب');

  const idempotencyKey = 'mo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  try {
    const r = await fetch(`${API}/orders/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        productId,
        productName,
        planId,
        price,
        months,
        quantity,
        paymentMethod,
        paymentStatus,
        scheduledFor,
        scheduleNote,
        autoAssignStock,
        adminNote,
        idempotencyKey
      })
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.message || 'فشل حفظ الطلب اليدوي');
    toast(d.message || 'تم إنشاء الطلب اليدوي بنجاح ✓');
    tab = 'orders';
    loadPanel();
  } catch (err) {
    toast(err.message);
  }
}

function onManualProductChange() {
  const prodSelect = document.getElementById('mo_prod');
  const planSelect = document.getElementById('mo_plan');
  const priceInput = document.getElementById('mo_price');
  const monthsInput = document.getElementById('mo_months');
  if (!prodSelect || !planSelect) return;

  const opt = prodSelect.options[prodSelect.selectedIndex];
  if (!opt || !opt.value) {
    planSelect.innerHTML = '<option value="">-- اختر الباقة --</option>';
    if (priceInput) priceInput.value = '';
    return;
  }

  let plans = [];
  try {
    plans = JSON.parse(opt.getAttribute('data-plans') || '[]');
  } catch (_) {}

  if (plans && plans.length > 0) {
    planSelect.innerHTML = plans.map(p => `<option value="${esc(p.id || p.planId || '')}" data-price="${p.price || 0}" data-months="${p.months || 1}">${esc(p.label || p.name || 'باقة')} — ${p.price || 0} دج</option>`).join('');
    onManualPlanChange();
  } else {
    planSelect.innerHTML = '<option value="standard" data-price="1000" data-months="1">باقة أساسية</option>';
    onManualPlanChange();
  }
}

function onManualPlanChange() {
  const planSelect = document.getElementById('mo_plan');
  const priceInput = document.getElementById('mo_price');
  const monthsInput = document.getElementById('mo_months');
  if (!planSelect) return;
  const opt = planSelect.options[planSelect.selectedIndex];
  if (opt && opt.getAttribute('data-price') && priceInput) {
    priceInput.value = opt.getAttribute('data-price');
  }
  if (opt && opt.getAttribute('data-months') && monthsInput) {
    monthsInput.value = opt.getAttribute('data-months');
  }
}

async function createStockAccountAdmin() {
  const productId = document.getElementById('stk_prod')?.value.trim();
  const email = document.getElementById('stk_email')?.value.trim();
  const password = document.getElementById('stk_pass')?.value.trim();
  const slotsCount = Number(document.getElementById('stk_slots')?.value) || 5;
  const costPrice = Number(document.getElementById('stk_cost')?.value) || 0;
  const masterDays = Number(document.getElementById('stk_days')?.value) || 30;
  const notes = document.getElementById('stk_notes')?.value.trim() || '';

  if (!productId || !email || !password) return toast('يرجى ملء معرف المنتج والبريد وكلمة المرور');

  try {
    const r = await fetch(`${API}/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ productId, email, password, slotsCount, costPrice, masterDays, notes })
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.message || 'فشل إضافة الحساب');
    toast(d.message || 'تمت إضافة حساب المخزون بنجاح ✓');
    loadPanel();
  } catch (err) {
    toast(err.message);
  }
}

async function releaseStockSlotAdmin(stockId, slotNumber) {
  if (!confirm(`هل تريد بالتأكيد تحرير الشاشة رقم ${slotNumber} وجعلها متاحة في المخزون؟`)) return;
  try {
    const r = await fetch(`${API}/stock/${stockId}/release-slot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ slotNumber, rotatePin: true })
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.message || 'فشل تحرير الشاشة');
    toast(d.message || 'تم تحرير الشاشة بنجاح ✓');
    loadPanel();
  } catch (err) {
    toast(err.message);
  }
}

async function deleteStockAccountAdmin(stockId) {
  if (!confirm('هل أنت متأكد من حذف حساب المخزون هذا نهائياً؟')) return;
  try {
    const r = await fetch(`${API}/stock/${stockId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.message || 'فشل حذف الحساب');
    toast(d.message || 'تم حذف الحساب بنجاح ✓');
    loadPanel();
  } catch (err) {
    toast(err.message);
  }
}

async function fillDeliveryFromStock(orderId, productId) {
  if (!productId) return toast('لا يوجد معرف منتج محدد لهذا الطلب');
  try {
    const r = await fetch(`${API}/stock?productId=${encodeURIComponent(productId)}&active=true`, {
      headers: { 'Authorization': 'Bearer ' + token },
      cache: 'no-store'
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.message || 'تعذر جلب المخزون');
    const stocks = d.stocks || [];
    let matchedSlot = null;
    let matchedAccount = null;
    for (const st of stocks) {
      const avail = (st.slots || []).find(s => s.status === 'available');
      if (avail) {
        matchedSlot = avail;
        matchedAccount = st;
        break;
      }
    }
    if (!matchedSlot || !matchedAccount) {
      return toast('لا توجد شاشات فارغة متاحة لهذا المنتج في المخزون حالياً');
    }

    const typeField = document.getElementById('dlv_type_' + orderId);
    if (typeField) {
      typeField.value = 'screen';
      toggleDeliveryFields(orderId);
    }
    const credField = document.getElementById('dlv_cred_' + orderId);
    if (credField) credField.value = `${matchedAccount.email} : ${matchedAccount.password}`;
    const profField = document.getElementById('dlv_prof_' + orderId);
    if (profField) profField.value = matchedSlot.profileName || `شاشة ${matchedSlot.slotNumber}`;
    const pinField = document.getElementById('dlv_pin_' + orderId);
    if (pinField) pinField.value = matchedSlot.pin || '';

    toast(`تم استخراج بيانات شاشة ${matchedSlot.slotNumber} من الحساب ${matchedAccount.code} بنجاح ✓`);
  } catch (err) {
    toast(err.message);
  }
}

window.submitManualOrder = submitManualOrder;
window.onManualProductChange = onManualProductChange;
window.onManualPlanChange = onManualPlanChange;
window.createStockAccountAdmin = createStockAccountAdmin;
window.releaseStockSlotAdmin = releaseStockSlotAdmin;
window.deleteStockAccountAdmin = deleteStockAccountAdmin;
window.fillDeliveryFromStock = fillDeliveryFromStock;
