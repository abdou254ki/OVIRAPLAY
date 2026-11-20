// =========================================================
// OVIRA PLAY — ADMIN CUSTOMERS & COMPLAINTS (admin/customers.js)
// =========================================================

function setComplaintTemplate(id, kind) {
  const box = document.getElementById('crep_' + id);
  if (!box) return;
  const messages = {
    progress: 'مرحبًا، استلمنا طلب الدعم الخاص بك ونراجع التفاصيل الآن. سنرسل لك التحديث فور توفره. شكرًا لصبرك.',
    details: 'مرحبًا، لمساعدتك بسرعة يرجى إرسال رقم طلبك وتوضيح المشكلة بدقة، دون إرسال كلمة مرورك أو رمز المصادقة.',
    solved: 'مرحبًا، تم معالجة البلاغ من طرف فريق OVIRA PLAY. يُرجى التجربة وإخبارنا إذا استمرت المشكلة. شكرًا لتواصلك.'
  };
  box.value = messages[kind] || '';
  box.focus();
}

async function replyComplaint(id, status) {
  const reply = document.getElementById('crep_' + id).value.trim();
  const r = await fetch(`${API}/complaints/${id}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ reply, status })
  });
  const d = await r.json();
  toast(d.message || 'تم التحديث ✓');
  loadPanel();
}

async function createCustomer() {
  const payload = {
    name: document.getElementById('nc_name').value.trim(),
    phone: document.getElementById('nc_phone').value.trim(),
    email: document.getElementById('nc_email').value.trim(),
    balance: Number(document.getElementById('nc_bal').value || 0),
    password: document.getElementById('nc_pass').value
  };
  const r = await fetch(`${API}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  const d = await r.json();
  toast(d.message || 'تمت العملية');
  if (d.success) loadPanel();
}

async function setCustBalance(id) {
  const exactBalance = Number(document.getElementById('bal_' + id).value || 0);
  if (!Number.isFinite(exactBalance) || exactBalance < 0) return toast('أدخل رصيدًا صحيحًا');
  if (!confirm('تأكيد ضبط رصيد الزبون على ' + fmt(exactBalance) + '؟')) return;
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ exactBalance })
  });
  const d = await r.json();
  toast(d.message || 'تم تحديث الرصيد ✓');
  loadPanel();
}

async function addQuickBalance(id, balanceDelta) {
  if (!confirm('تأكيد تعديل رصيد الزبون بمقدار ' + fmt(balanceDelta) + '؟')) return;
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ balanceDelta })
  });
  const d = await r.json();
  toast(d.message || 'تم تعديل الرصيد ✓');
  loadPanel();
}

async function setCustPass(id) {
  const newPassword = document.getElementById('cpw_' + id).value;
  if (!newPassword || newPassword.length < 6) return toast('كلمة السر يجب أن تكون 6 أحرف على الأقل');
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ newPassword })
  });
  const d = await r.json();
  toast(d.message || 'تم تحديث كلمة سر الزبون ✓');
  loadPanel();
}

async function toggleBlockCust(id, blocked) {
  const r = await fetch(`${API}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ blocked })
  });
  const d = await r.json();
  toast(d.message || 'تم التحديث ✓');
  loadPanel();
}


window.setComplaintTemplate = setComplaintTemplate;
window.replyComplaint = replyComplaint;
window.createCustomer = createCustomer;
window.setCustBalance = setCustBalance;
window.addQuickBalance = addQuickBalance;
window.setCustPass = setCustPass;
window.toggleBlockCust = toggleBlockCust;
