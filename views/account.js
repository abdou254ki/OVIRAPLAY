// =========================================================
// OVIRA PLAY — ACCOUNT & AUTH VIEW (views/account.js)
// =========================================================

const trackV = () => custToken ? `<div class="w"><h1 class="ttl">طلباتي</h1><div class="sm"><p>طلبات حسابك تظهر في صفحة «حسابي» مباشرة دون طلب رمز أو آخر أرقام الهاتف.</p><a class="btn" href="#/account">عرض طلباتي</a></div></div>` : `<div class="w">
  <h1 class="ttl">تتبع طلبي واستلام الحساب</h1>
  <div class="sm">
    <label class="lb">رمز الطلب</label>
    <input class="in2" id="tk_code" placeholder="OP-XXXXXXXX" style="text-transform:uppercase" dir="ltr">
    <label class="lb">آخر 4 أرقام من رقم الهاتف</label>
    <input class="in2" id="tk_ph" type="tel" maxlength="4" placeholder="مثال: 5850" dir="ltr">
    <button class="btn" onclick="trackOrder()">بحث وعرض حالة الطلب</button>
  </div>
  <div id="tk_res"></div>
</div>`;

window.trackOrder = async () => {
  if (custToken) { location.hash = '#/account'; return; }
  const c = $('#tk_code').value.trim().toUpperCase();
  const p = $('#tk_ph').value.trim();
  if (!c || p.length !== 4) return toast('أدخل رمز الطلب وآخر 4 أرقام من الهاتف');
  $('#tk_res').innerHTML = '<p class="note">جارٍ البحث...</p>';
  try {
    const r = await fetch(`${ACC_URL}/track?code=${encodeURIComponent(c)}&phone4=${encodeURIComponent(p)}`);
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    const t = d.tracking;
    $('#tk_res').innerHTML = `
      <div class="sm">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <b style="font-size:17px" dir="ltr">${esc(t.orderCode)}</b>
          <span style="background:${COL[t.status] || '#666'};color:#fff;padding:3px 12px;border-radius:14px;font-size:12px;font-weight:800">${esc(t.status)}</span>
        </div>
        <div class="row"><span>طريقة الدفع</span><b>${esc(t.paymentMethod || '')} ${t.isPaidOnline ? '⚡' : ''}</b></div>
        <div class="row"><span>تاريخ الطلب</span><b dir="ltr">${new Date(t.createdAt).toLocaleString('fr-DZ')}</b></div>
        <hr>
        <ul style="padding-inline-start:18px;font-size:14px;color:var(--ink);font-weight:700">${t.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        <hr>
        <div class="tt"><span>الإجمالي</span>${fmt(t.totalPrice)}</div>
        ${renderDeliveredBox(t.deliveredAccount)}
        ${t.deliveryNotice ? `<p class="note">${esc(t.deliveryNotice)}</p>` : ''}
      </div>
      ${renderPaymentReceiptBox(t.paymentDetails, t.totalPrice)}`;
  } catch (e) {
    $('#tk_res').innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
};

const pwField = (id, ac) => `
  <div class="pw">
    <input class="in2" id="${id}" type="password" dir="ltr" placeholder="••••••••" autocomplete="${ac}">
    <button type="button" class="eye" onclick="togglePw('${id}',this)" aria-label="إظهار كلمة السر">👁</button>
  </div>`;

window.requestPasswordOtp = async () => {
  try { const r = await fetch(ACC_URL+'/password/request-code',{method:'POST',headers:{Authorization:'Bearer '+custToken}});
    const d = await r.json(); toast(d.message || 'تم طلب رمز التحقق');
  } catch(e){toast('تعذّر طلب الرمز');}
};
window.changeCustomerPassword = async () => {
  const old = document.getElementById('changeOldPw')?.value || '';
  const code = document.getElementById('changeOtp')?.value || '';
  const newPassword = document.getElementById('changeNewPw')?.value || '';
  try {
    const r = await fetch(ACC_URL+'/password/change',{method:'POST',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},
      body:JSON.stringify({currentPassword:old,code,newPassword})});
    const d = await r.json(); toast(d.message || 'تم التحديث');
    if(d.success)custLogout();
  }catch(e){toast('تعذّر تحديث كلمة المرور');}
};

window.redeemOwnerSupportCode=async()=>{
 const supportCode=document.getElementById('accountSupportCode')?.value.trim()||'';
 if(!/^OVS-[A-Fa-f0-9]{18}$/.test(supportCode))return toast('أدخل رمز دعم صحيحًا من المالك');
 try{const r=await fetch(ACC_URL+'/support/redeem-code',{method:'POST',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},body:JSON.stringify({supportCode})});
 const d=await r.json();toast(d.message||(d.success?'تم التحقق':'الرمز غير صالح أو انتهت صلاحيته'));
 if(d.success){const field=document.getElementById('accountSupportCode');if(field)field.value='';}}
 catch(_){toast('تعذر الاتصال بخادم الدعم');}
};
window.requestProfileCode=async()=>{
 if(!custToken)return toast('سجّل الدخول أولًا');
 try{const r=await fetch(ACC_URL+'/profile/request-change-code',{method:'POST',headers:{Authorization:'Bearer '+custToken}});
 const d=await r.json();toast(d.message||(r.ok?'تحقق من Telegram أو تطبيق TOTP':'تعذر إرسال الرمز'));}
 catch(_){toast('تعذر طلب رمز التحقق');}
};
window.secureProfileUpdate=async()=>{
 const email=document.getElementById('profileNewEmail')?.value.trim()||'';
 const phone=document.getElementById('profileNewPhone')?.value.trim()||'';
 const code=document.getElementById('profileStepOtp')?.value.trim()||'';
 if(!/^[0-9]{6}$/.test(code)||(!email&&!phone))return toast('أدخل البيانات الجديدة ورمز OTP من حسابك');
 try{const r=await fetch(ACC_URL+'/profile/secure-update',{method:'POST',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},body:JSON.stringify({email,phone,code})});
 const d=await r.json();toast(d.message||(r.ok?'تم التحديث':'تعذر تحديث الحساب'));
 if(d.success)custLogout();}
 catch(_){toast('تعذر الاتصال بخادم الحساب');}
};
window.togglePw = (id, btn) => {
  const el = document.getElementById(id);
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
};

window.openTopup = () => { topupOpen = !topupOpen; draw(); };
window.setTopupAmt = (v) => { topupAmt = v; draw(); };
window.sendTopup = () => {
  const inp = document.getElementById('tp_amt');
  const amt = Math.round(Number(inp ? inp.value : topupAmt));
  if (!Number.isFinite(amt) || amt < 200) { toast('أدخل مبلغاً لا يقل عن 200 DA'); return; }
  if (!CFG.wa) { toast('رقم الدعم غير متوفر حالياً'); return; }
  const text = `مرحباً، أريد شحن رصيد محفظتي بمبلغ ${amt} DA.\nالاسم: ${custProfile.name}\nالهاتف: ${custProfile.phone || 'غير مضاف'}`;
  window.open('https://wa.me/' + CFG.wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
};

const topupPanel = () => !topupOpen ? '' : `
  <div class="sm topup">
    <h3>➕ شحن رصيد المحفظة</h3>
    <div class="chips" style="margin-bottom:8px">
      ${[500, 1000, 2000, 5000].map((v) => `<button class="chip ${topupAmt === v ? 'on' : ''}" onclick="setTopupAmt(${v})">${fmt(v)}</button>`).join('')}
    </div>
    <label class="lb">أو أدخل مبلغاً آخر (DA)</label>
    <input class="in2" id="tp_amt" type="number" inputmode="numeric" min="200" dir="ltr" value="${topupAmt}">
    <button class="btn wa" style="margin-top:12px" onclick="sendTopup()">💬 اطلب الشحن عبر واتساب</button>
    <p class="note" style="margin-top:8px">سيصلك الرصيد في حسابك بعد تأكيد الإدارة للدفع.</p>
  </div>`;

const conversationsBlock = () => `
  <div class="sec-head"><h2 class="sh" style="margin:0">💬 محادثات الدعم</h2><a class="chip on" href="#/support">فتح مركز الرسائل</a></div>
  <div class="sm"><p>تواصل مع الإدارة واحصل على ردودك داخل المتجر. يمكنك طلب مراجعة Qwen للأسئلة العامة عند توفر الوكيل.</p></div>`;

// بطاقة الأمان والتحقق بخطوتين (2FA) وربط تيليغرام داخل حساب الزبون
const securityBlock = () => {
  if (!custProfile) return '';
  const is2FA = !!custProfile.twoFactorEnabled;
  const methodLabel = custProfile.twoFactorMethod === 'telegram' ? 'عبر بوت تيليغرام 📲' : 'عبر Google Authenticator 🔑';

  return `
    <h2 class="sh">🔐 الأمان والتحقق بخطوتين (2FA)</h2>
    <div class="sec-card">
      <b>🔑 تعيين أو تغيير كلمة المرور</b>
      <p class="note">يلزم كلمة المرور الحالية أو رمز تحقق Telegram/تطبيق المصادقة. عند النجاح تنتهي الجلسات القديمة.</p>
      <input class="in2" id="changeOldPw" type="password" autocomplete="current-password" placeholder="كلمة المرور الحالية (إن وُجدت)">
      <input class="in2" id="changeOtp" inputmode="numeric" maxlength="6" placeholder="رمز 2FA أو Telegram" dir="ltr">
      <input class="in2" id="changeNewPw" type="password" autocomplete="new-password" placeholder="كلمة مرور جديدة (8 أحرف فأكثر)">
      <button class="btn o" onclick="requestPasswordOtp()">📲 إرسال رمز تأكيد إلى Telegram</button>
      <button class="btn" onclick="changeCustomerPassword()">حفظ كلمة المرور</button>
    </div>
    <div class="sec-card">
      ${!custProfile.phone ? `
        <div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);padding:12px;border-radius:14px;margin-bottom:14px">
          <b style="font-size:13px;color:#B45309">📱 أضف رقم واتساب لحسابك لتسهيل الطلبات:</b>
          <div style="display:flex;gap:8px;margin-top:8px">
            <input class="in2" id="prof_ph" type="tel" dir="ltr" placeholder="05XX XX XX XX" style="padding:9px 12px">
            <button class="chip on" onclick="saveCustPhone()">حفظ الرقم</button>
          </div>
        </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <b style="font-size:15px">ربط الحساب ببوت تيليغرام</b>
          <p style="font-size:12px;color:var(--mut)">لاستلام أكواد التحقق 2FA وإشعارات الطلبات والشاشات فوراً</p>
        </div>
        ${custProfile.telegramLinked
          ? `<span class="badge" style="background:var(--ok)">✅ مربوط ${custProfile.telegramUsername ? '(@' + esc(custProfile.telegramUsername) + ')' : ''}</span>`
          : `<button class="chip on" onclick="linkTelegramAccount()">🔗 ربط تيليغرام الآن</button>`}
      </div>

      <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <b style="font-size:15px">التحقق بخطوتين (2FA) عند الدخول</b>
          <p style="font-size:12px;color:var(--mut)">${is2FA ? `الحماية مفعّلة حالياً (${methodLabel})` : 'حماية اختيارية إضافية لحسابك ومحفظتك'}</p>
        </div>
        <span class="badge" style="background:${is2FA ? 'var(--ok)' : '#64748B'}">${is2FA ? '🟢 مفعّل' : '⚪ غير مفعّل'}</span>
      </div>

      ${is2FA ? `
        <button class="btn o" style="margin-top:12px;color:var(--bad);border-color:rgba(239,68,68,.35)" onclick="disableCustomer2FA()">🔓 إيقاف التحقق بخطوتين</button>
      ` : `
        <div class="sec-grid">
          <button class="btn tg" style="margin:0;font-size:13px" onclick="start2FASetup('telegram')">📲 تفعيل عبر بوت تيليغرام</button>
          <button class="btn" style="margin:0;font-size:13px" onclick="start2FASetup('totp')">🔑 تفعيل عبر Google Authenticator</button>
        </div>
      `}

      ${twoFaSetup ? `
        <div class="ok-box" style="margin-top:14px;border-color:var(--pri2);background:rgba(36,71,201,.06)">
          <h4 style="color:var(--pri2)">${twoFaSetup.method === 'totp' ? '🔑 إعداد تطبيق Google Authenticator' : '📲 تأكيد كود بوت تيليغرام'}</h4>
          ${twoFaSetup.method === 'totp' ? `
            <p style="font-size:13px;color:var(--mut)">1. في تطبيق المصادقة اختر إضافة مفتاح يدوياً، ثم انسخ المفتاح أدناه. حفاظاً على سر التحقق لا نرسله إلى أي خادم لتوليد QR.</p>
            <div class="cred-row">
              <span>المفتاح: <code>${esc(twoFaSetup.secret)}</code></span>
              <button class="cp" onclick="cp(this.dataset.copy)" data-copy="${esc(twoFaSetup.secret)}">${ico(I.copy)} نسخ</button>
            </div>
            <p style="font-size:13px;color:var(--mut);margin-top:8px">2. أدخل الرمز المكون من 6 أرقام الظاهر في التطبيق لتأكيد التفعيل:</p>
          ` : `
            <p style="font-size:13px;color:var(--mut)">${esc(twoFaSetup.message)}</p>
          `}
          <input class="in2 otp-inp" id="setup_2fa_code" type="text" inputmode="numeric" maxlength="6" dir="ltr" placeholder="000000" style="margin-top:8px">
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn" style="margin:0" onclick="confirm2FAEnable('${twoFaSetup.method}')">✅ تأكيد وتفعيل</button>
            <button class="btn o" style="margin:0;flex:0 0 35%" onclick="twoFaSetup=null;draw()">إلغاء</button>
          </div>
        </div>
      ` : ''}
    </div>`;
};


// Account-owned notifications: polling only while account page is open. No marketing without opt-in.
let siteNoteItems=[],siteNoteUnread=0,siteMarketingOptIn=false,siteNoteLoaded=false;
// Header notification badge polls only the authenticated user's own inbox.
async function updateSiteBellCount(){
  if(!custToken||document.hidden)return;
  try{
    const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});
    const data=await r.json();if(!r.ok||!data.success)return;
    const next=Math.max(0,Number(data.unread)||0);
    if(next!==siteNoteUnread){siteNoteUnread=next;chrome();}
  }catch(_){/* keep existing counter if offline */}
}
setInterval(updateSiteBellCount,60000);

function siteNotificationsBlock(){
 if(!custToken)return '';
 return `<section class="sm ov-site-notifications" aria-label="إشعارات حسابي"><h2 class="sh">🔔 إشعارات حسابي ${siteNoteUnread?'('+siteNoteUnread+' جديدة)':''}</h2>
 <button class="btn o" onclick="loadSiteNotifications()">تحديث الإشعارات</button>
 <label class="ov-optin"><input type="checkbox" ${siteMarketingOptIn?'checked':''} onchange="setSiteMarketingOptIn(this.checked)"> أوافق على عروض الاشتراكات الجديدة داخل حسابي (اختياري)</label>
 ${!siteNoteLoaded?'<p>اضغط تحديث الإشعارات لعرضها.</p>':siteNoteItems.length?siteNoteItems.map(n=>`<article class="ov-note ${n.readAt?'':'unread'}"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${esc(new Date(n.createdAt).toLocaleString('ar-DZ'))}</small>${!n.readAt?`<button class="chip" onclick="markSiteNoteRead('${esc(n._id)}')">تمت القراءة</button>`:''}</article>`).join(''):'<p>لا توجد إشعارات لهذا الحساب حاليًا.</p>'}</section>`;
}
async function loadSiteNotifications(){if(!custToken)return;
 try{const r=await fetch(API_BASE+'/api/v2/site-notifications',{headers:{Authorization:'Bearer '+custToken},cache:'no-store'});const d=await r.json();if(!r.ok||!d.success)throw Error('تعذر تحميل إشعارات الحساب');siteNoteItems=d.notifications||[];siteNoteUnread=d.unread||0;siteMarketingOptIn=!!d.marketingOptIn;siteNoteLoaded=true;draw();}catch(e){toast(e.message);}}
async function setSiteMarketingOptIn(value){try{const r=await fetch(API_BASE+'/api/v2/site-notifications/preferences',{method:'PATCH',headers:{Authorization:'Bearer '+custToken,'Content-Type':'application/json'},body:JSON.stringify({marketingOptIn:value})});if(!r.ok)throw Error('لم تُحفظ تفضيلات العروض');siteMarketingOptIn=value;toast('تم حفظ اختيارك');}catch(e){toast(e.message);draw();}}
async function markSiteNoteRead(id){try{const r=await fetch(API_BASE+'/api/v2/site-notifications/'+encodeURIComponent(id)+'/read',{method:'POST',headers:{Authorization:'Bearer '+custToken}});if(!r.ok)throw Error('تعذر تحديث الإشعار');await loadSiteNotifications();}catch(e){toast(e.message)}}

const accountV = () => {
  // إذا كان الزبون في مرحلة إدخال كود التحقق بخطوتين (2FA) لإتمام الدخول
  if (twoFaPending) {
    return `<div class="w">
      <h1 class="ttl">🔐 التحقق بخطوتين (2FA)</h1>
      <div class="sm" style="text-align:center">
        <div style="font-size:40px;margin-bottom:8px">${twoFaPending.method === 'telegram' ? '📲' : '🔑'}</div>
        <h3>تأكيد هويتك للدخول</h3>
        <p style="font-size:13px;color:var(--mut);margin-bottom:14px">${esc(twoFaPending.message)}</p>
        <input class="in2 otp-inp" id="login_2fa_code" type="text" inputmode="numeric" maxlength="6" dir="ltr" placeholder="000000">
        <button class="btn" onclick="verifyCustomer2FALogin()">تأكيد الكود والدخول</button>
        <button class="btn o" onclick="twoFaPending=null;draw()">العودة لتسجيل الدخول</button>
      </div>
      ${brandFoot()}
    </div>`;
  }

  if (!custProfile) {
    return `<div class="w">
      <h1 class="ttl">حسابي ومحفظتي</h1>
      <div class="sm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <button class="chip ${authTab === 'login' ? 'on' : ''}" onclick="authTab='login';draw()">تسجيل الدخول</button>
          <button class="chip ${authTab === 'register' ? 'on' : ''}" onclick="authTab='register';draw()">إنشاء حساب جديد</button>
        </div>
        ${authTab === 'register' ? `
          <label class="lb">الاسم الكامل *</label>
          <input class="in2" id="au_name" placeholder="اسمك الكامل" autocomplete="name">
          <label class="lb">رقم واتساب *</label>
          <input class="in2" id="au_phone" type="tel" dir="ltr" placeholder="05XX XX XX XX" autocomplete="tel">
          <label class="lb">البريد الإلكتروني الشخصي *</label>
          <input class="in2" id="au_email" type="email" dir="ltr" placeholder="example@gmail.com" autocomplete="email">
          <label class="lb">كلمة السر (8 أحرف فأكثر) *</label>
          ${pwField('au_pass', 'new-password')}
          <button class="btn" onclick="doCustRegister()">إنشاء الحساب الآن</button>
        ` : `
          <label class="lb">رقم الهاتف أو البريد الإلكتروني</label>
          <input class="in2" id="au_id" dir="ltr" placeholder="05XX XX XX XX أو الإيميل" autocomplete="username">
          <label class="lb">كلمة السر</label>
          ${pwField('au_pass', 'current-password')}
          <button class="btn" onclick="doCustLogin()">دخول إلى حسابي</button>
        `}

        <div class="social-divider">أو الدخول السريع بضغطة زر عبر</div>
        <div class="social-box">
          <div id="g_id_btn" class="social-slot"></div>
          <button class="btn tg" style="margin:12px 0 0" onclick="startBotLogin()">📲 الدخول عبر بوت تيليغرام (الأسهل)</button>
          <div id="tg_bot_status"></div>
          <div class="note tg-hint">أو عبر نافذة تيليغرام: اكتب رقمك <b>بدون الصفر</b> بعد +213 (مثال: <span dir="ltr">+213 77 64 14 485</span>)</div>
          <div id="tg_login_btn" class="social-slot"></div>
        </div>
      </div>
      ${brandFoot()}
    </div>`;
  }

  return `<div class="w">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;gap:10px">
      <h1 class="ttl" style="margin:0">مرحباً، ${esc(custProfile.name)}</h1>
      <button class="chip" onclick="custLogout()">تسجيل الخروج</button>
    </div>

    <div class="sm wallet-card">
      <div style="font-size:13px;opacity:.9">💰 رصيد محفظتك المتاح للشراء الفوري</div>
      <div style="font-size:28px;font-weight:900;margin:4px 0">${fmt(custProfile.balance || 0)}</div>
      <div style="font-size:12px;opacity:.85">📱 ${esc(custProfile.phone || 'لم يُضف رقم بعد')} ${custProfile.email ? '· 📧 ' + esc(custProfile.email) : ''}</div>
      <button class="topup-btn" onclick="openTopup()">➕ شحن الرصيد</button>
    </div>
    ${topupPanel()}

    ${securityBlock()}
    <details class="sm ov-account-verify"><summary>🪪 التحقق برمز دعم المالك</summary>
      <p class="note">إذا أعطاك المالك رمز دعم، أدخله هنا فقط بعد تسجيل الدخول. لا يُستخدم لتغيير كلمة السر ولا يغني عن OTP.</p>
      <input class="in2" id="accountSupportCode" maxlength="22" placeholder="OVS-..." dir="ltr" autocomplete="off">
      <button class="btn" onclick="redeemOwnerSupportCode()">تأكيد رمز الدعم</button>
    </details>
    <details class="sm ov-account-verify"><summary>🔐 تغيير البريد أو الهاتف بعد التحقق</summary>
      <p class="note">اطلب رمز OTP من هنا، ثم أدخله في هذه الصفحة، وليس في محادثة الدعم. يجب ربط Telegram أو تفعيل TOTP أولًا.</p>
      <button class="chip" onclick="requestProfileCode()">إرسال رمز تحقق إلى Telegram / استعمال TOTP</button>
      <label class="lb" for="profileNewEmail">بريد إلكتروني جديد (اختياري)</label>
      <input class="in2" id="profileNewEmail" type="email" autocomplete="email" placeholder="name@example.com" dir="ltr">
      <label class="lb" for="profileNewPhone">رقم هاتف جديد (اختياري)</label>
      <input class="in2" id="profileNewPhone" type="tel" autocomplete="tel" placeholder="05XXXXXXXX" dir="ltr">
      <label class="lb" for="profileStepOtp">رمز التحقق</label>
      <input class="in2" id="profileStepOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" dir="ltr">
      <button class="btn" onclick="secureProfileUpdate()">تأكيد التغيير</button>
    </details>

    <h2 class="sh">📦 طلباتي وحساباتي المسلمة (${custOrders.length})</h2>
    ${custOrders.length ? custOrders.map((o) => `
      <div class="sm">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b dir="ltr">${esc(o.orderCode)}</b>
          <span class="badge" style="background:${COL[o.status] || '#666'}">${esc(o.status)}</span>
        </div>
        <div style="font-size:12px;color:var(--mut);margin:4px 0">${new Date(o.createdAt).toLocaleString('fr-DZ')} · ${esc(o.paymentMethod)}</div>
        <div style="font-size:14px;font-weight:700;margin:6px 0">${o.items.map((i) => esc(i)).join(' | ')}</div>
        <div class="tt" style="font-size:15px"><span>الإجمالي</span>${fmt(o.totalPrice)}</div>
        ${renderDeliveredBox(o.deliveredAccount)}
      </div>
    `).join('') : '<div class="sm"><p class="note">لا توجد طلبات سابقة بعد.</p></div>'}

    ${siteNotificationsBlock()}
    ${conversationsBlock()}
    ${brandFoot()}
  </div>`;
};

// تهيئة أزرار Google وTelegram بعد رسم صفحة الدخول
function mountSocialButtons() {
  renderTgBotStatus();
  resumeBotLogin();
  const gBox = document.getElementById('g_id_btn');
  if (gBox && CFG.googleClientId) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: CFG.googleClientId,
          callback: window.handleGoogleCredential
        });
        window.google.accounts.id.renderButton(gBox, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'ar',
          width: 280
        });
      } catch (e) {}
    } else {
      setTimeout(mountSocialButtons, 500);
    }
  }

  const tgBox = document.getElementById('tg_login_btn');
  if (tgBox && CFG.tg && !tgBox.hasChildNodes()) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', CFG.tg);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '20');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-request-access', 'write');
    tgBox.appendChild(s);
  }
}

// ===== الدخول عبر بوت تيليغرام (رابط عميق + استطلاع) =====
// لا يحتاج رقم الهاتف ولا نافذة منبثقة، ويعمل في Brave وفي متصفح فيسبوك.
function renderTgBotStatus() {
  const box = document.getElementById('tg_bot_status');
  if (!box) return;
  if (!tgBot) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="tgbot-status">
    <div>${esc(tgBot.msg || '')}</div>
    ${tgBot.url ? `<a class="chip on" target="_blank" rel="noopener" href="${esc(tgBot.url)}">فتح تيليغرام ←</a>` : ''}
  </div>`;
}

function stopBotLogin(clear) {
  if (tgBotTimer) { clearTimeout(tgBotTimer); tgBotTimer = null; }
  if (clear) { try { sessionStorage.removeItem('ov_tgl'); } catch (e) {} }
}

async function pollBotLogin() {
  tgBotTimer = null;
  if (!document.getElementById('tg_bot_status')) return; // خرج المستخدم من صفحة الدخول؛ يُستأنف عند عودته
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('ov_tgl') || 'null'); } catch (e) {}
  if (!saved || Date.now() - saved.t > 290000) {
    stopBotLogin(true);
    tgBot = { msg: 'انتهت صلاحية المحاولة، اضغط الزر من جديد.' };
    return renderTgBotStatus();
  }
  try {
    const r = await fetch(ACC_URL + '/oauth/telegram/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: saved.k })
    });
    const d = await r.json();
    if (d.success && d.pending) {
      tgBot = {
        url: saved.u,
        msg: d.state === 'awaiting'
          ? '✅ وصلك الطلب في تيليغرام: اضغط «نعم، أنا من طلب الدخول» ثم ارجع هنا.'
          : '⏳ اضغط Start في بوت تيليغرام ثم أكّد الدخول…'
      };
      renderTgBotStatus();
    } else if (d.success) {
      stopBotLogin(true);
      tgBot = null;
      return processAuthResult(d, 'تم تسجيل الدخول عبر تيليغرام بنجاح ✓');
    } else {
      stopBotLogin(true);
      tgBot = { msg: d.message || 'تعذّر الدخول عبر تيليغرام.' };
      return renderTgBotStatus();
    }
  } catch (e) { /* انقطاع شبكة أو الخادم يستيقظ: نكمل المحاولة */ }
  tgBotTimer = setTimeout(pollBotLogin, 2500);
}

function resumeBotLogin() {
  if (tgBotTimer || custToken) return;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('ov_tgl') || 'null'); } catch (e) {}
  if (!saved || Date.now() - saved.t > 290000) return;
  if (!tgBot) tgBot = { url: saved.u, msg: '⏳ بانتظار تأكيدك داخل تيليغرام…' };
  renderTgBotStatus();
  tgBotTimer = setTimeout(pollBotLogin, 1500);
}

window.startBotLogin = async () => {
  stopBotLogin(true);
  tgBot = { msg: 'جارٍ تجهيز رابط الدخول…' };
  renderTgBotStatus();
  try {
    const r = await fetch(ACC_URL + '/oauth/telegram/start', { method: 'POST' });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    try { sessionStorage.setItem('ov_tgl', JSON.stringify({ k: d.token, u: d.botUrl, t: Date.now() })); } catch (e) {}
    tgBot = { url: d.botUrl, msg: 'افتح تيليغرام واضغط Start، ثم ارجع إلى هنا.' };
    renderTgBotStatus();
    window.open(d.botUrl, '_blank', 'noopener'); // إن حُجبت النافذة يبقى زر «فتح تيليغرام» ظاهرًا
    tgBotTimer = setTimeout(pollBotLogin, 2500);
  } catch (e) {
    tgBot = { msg: e.message || 'تعذّر بدء الدخول عبر تيليغرام، حاول مجددًا.' };
    renderTgBotStatus();
  }
};

async function processAuthResult(d, welcomeMsg = 'مرحباً بك ✓') {
  if (d.requires2FA) {
    twoFaPending = {
      tempToken: d.tempToken,
      method: d.method,
      message: d.message
    };
    toast(d.message);
    draw();
    return;
  }
  twoFaPending = null;
  custToken = d.token;
  localStorage.setItem('ov_ctk', custToken);
  await fetchCustomerProfile();
  toast(welcomeMsg);
  draw();
}

window.handleGoogleCredential = async (response) => {
  try {
    const r = await fetch(ACC_URL + '/oauth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'تم تسجيل الدخول عبر Google بنجاح ✓');
  } catch (e) {
    toast(e.message || 'تعذّر الدخول عبر قوقل');
  }
};

window.onTelegramAuth = async (user) => {
  try {
    const r = await fetch(ACC_URL + '/oauth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'تم تسجيل الدخول عبر تيليغرام بنجاح ✓');
  } catch (e) {
    toast(e.message || 'تعذّر الدخول عبر تيليغرام');
  }
};

window.verifyCustomer2FALogin = async () => {
  const codeEl = document.getElementById('login_2fa_code');
  const code = (codeEl ? codeEl.value : '').trim();
  if (code.length !== 6) return toast('أدخل الكود المكون من 6 أرقام');
  try {
    const r = await fetch(ACC_URL + '/2fa/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: twoFaPending.tempToken, code })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await processAuthResult(d, 'تم التحقق وتسجيل الدخول بنجاح 🎉');
  } catch (e) {
    toast(e.message);
  }
};

window.linkTelegramAccount = async () => {
  try {
    const r = await fetch(ACC_URL + '/telegram-link-code', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + custToken }
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    window.open(d.botUrl, '_blank', 'noopener');
    toast('اضغط Start في بوت تيليغرام ثم حدّث الصفحة ✓');
  } catch (e) {
    toast(e.message);
  }
};

window.start2FASetup = async (method) => {
  try {
    const r = await fetch(ACC_URL + '/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + custToken },
      body: JSON.stringify({ method })
    });
    const d = await r.json();
    if (!d.success) {
      if (d.needsTelegramLink && d.linkCode) {
        window.open(`https://t.me/${CFG.tg}?start=${d.linkCode}`, '_blank', 'noopener');
      }
      throw new Error(d.message);
    }
    twoFaSetup = d;
    draw();
  } catch (e) {
    toast(e.message);
  }
};

window.confirm2FAEnable = async (method) => {
  const codeEl = document.getElementById('setup_2fa_code');
  const code = (codeEl ? codeEl.value : '').trim();
  if (code.length !== 6) return toast('أدخل الرمز المكون من 6 أرقام');
  try {
    const r = await fetch(ACC_URL + '/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + custToken },
      body: JSON.stringify({ method, code })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    twoFaSetup = null;
    await fetchCustomerProfile();
    toast(d.message);
    draw();
  } catch (e) {
    toast(e.message);
  }
};

window.disableCustomer2FA = async () => {
  if (!confirm('هل تريد إيقاف التحقق بخطوتين (2FA) لحسابك؟')) return;
  try {
    const r = await fetch(ACC_URL + '/2fa/disable', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + custToken }
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await fetchCustomerProfile();
    toast(d.message);
    draw();
  } catch (e) {
    toast(e.message);
  }
};

window.saveCustPhone = async () => {
  const phEl = document.getElementById('prof_ph');
  const phone = phEl ? phEl.value.trim() : '';
  if (!phone) return toast('أدخل رقم الواتساب');
  try {
    const r = await fetch(ACC_URL + '/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + custToken },
      body: JSON.stringify({ phone })
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    await fetchCustomerProfile();
    toast(d.message);
    draw();
  } catch (e) {
    toast(e.message);
  }
};



window.trackV = trackV;
window.pwField = pwField;
window.topupPanel = topupPanel;
window.conversationsBlock = conversationsBlock;
window.securityBlock = securityBlock;
window.accountV = accountV;
window.mountSocialButtons = mountSocialButtons;
window.renderTgBotStatus = renderTgBotStatus;
window.stopBotLogin = stopBotLogin;
window.pollBotLogin = pollBotLogin;
window.resumeBotLogin = resumeBotLogin;
window.processAuthResult = processAuthResult;
