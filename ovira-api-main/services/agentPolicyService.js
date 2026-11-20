const crypto = require('crypto');
const AgentUsage = require('../models/AgentUsage');

const POLICY = Object.freeze({ hourlyLimit: 20, maxDraftChars: 1000, maxInputChars: 900 });
const APPROVED_CONTEXT = [
  'OVIRA PLAY متجر اشتراكات رقمية. الأسعار والباقات الرسمية هي المعروضة الآن في قسم المتجر على الموقع.',
  'لمعرفة حالة طلب مرتبط بحساب، يستعمل الزبون قسم «حسابي» بعد تسجيل الدخول.',
  'للزبون الذي ليس لديه حساب، تتوفر صفحة «تتبع طلبي» باستعمال رمز الطلب وآخر 4 أرقام من الهاتف.',
  'لا تؤكد وقت التسليم ولا تذكر أسعارًا أو توافر منتجات دون بيانات مباشرة من الخادم.',
  'للمشكلات المتعلقة بالدفع أو الحساب أو تسليم البيانات، أَحِلْ الزبون إلى الدعم البشري.'
].join('\n');

// Strict conservative allowlist. Sensitive/uncertain messages stay with a human.
// Public-site questions can be phrased freely. What matters is whether they contain
// a credential or require access to a *particular* account, not a keyword whitelist.
// The owner's isolated test endpoint is deliberately not subject to this classifier.
function personalAccountIntent(s) {
  return /(?:كم\s*بقي.{0,30}(?:حسابي|رصيدي)|رصيد\s*حسابي|حالة\s*حسابي|بيانات\s*حسابي|(?:اعرض|أرسل|ارسل|هات|اكشف).{0,35}(?:بيانات|رقم|تفاصيل|معلومات)\s*(?:حسابي|طلبي|العميل|زبون)|(?:غير|غيّر|تغيير|عدل|عدّل|تعديل|استرجع|استرد|احذف|انقل).{0,30}(?:بريدي|ايميلي|إيميلي|الايميل|كلمة السر|كلمة المرور|حسابي)|استرجاع حسابي|(?:تفاصيل|حالة)\s*(?:طلب|الطلب)\s*(?:رقم|#)|my account details|my balance|my order status|reset my password|change my email|refund|استرداد|استرجاع مالي)/i.test(s);
}
function safeForAI(text) {
  if (typeof text !== 'string') return false;
  const s=text.trim();
  if (!s || s.length > 1100 || /[\u0000-\u0008\u000b\u000e-\u001f]/.test(s)) return false;
  // Never send literal credentials, identifiers or personal cases to Termux.
  if (/(?:\d{4,}|[٠-٩]{4,}|@|https?:\/\/|\+\d{5,}|\b(?:otp|pin|password|secret|token|api.?key)\s*[:=#]|كلمة السر\s*[:=]|رمز التحقق\s*[:=]|رقم الطلب\s*[:#]|رقم البطاقة\s*[:=]|payment id|transaction id)/i.test(s)) return false;
  return !personalAccountIntent(s);
}
// No untrusted model reply may perform actions or invent account/payment state.
function eligibleSiteReply(question, answer) {
  if (!safeForAI(question) || typeof answer !== 'string') return false;
  const a=answer.trim();
  if (!a || a.length>550 || /[\u0000-\u0008\u000b\u000e-\u001f<>]/.test(a)) return false;
  if (/(?:ovira_agent_|Bearer\s+\S+|sk-[A-Za-z0-9_-]{12,}|(?:password|secret|api.?key)\s*[:=]\s*\S+|(?:otp|pin|رمز التحقق)\s*[:=]\s*[0-9٠-٩]{4,})/i.test(a)) return false;
  if (/(?:تم\s*(?:تغيير|إلغاء|إرسال|تأكيد|استرجاع|تسليم)|تم\s*الدفع|غيرت\s*(?:البريد|كلمة)|أرسلت\s*لك\s*رمز|your\s*(?:password|email)\s*(?:has been|was)\s*changed)/i.test(a)) return false;
  // Product prices cannot be generated text: use reviewed catalog/FAQ only.
  if (/(?:[0-9٠-٩]+\s*(?:دج|دينار|da|dzd)|(?:سعر|prix|price).{0,10}[0-9٠-٩])/i.test(a)) return false;
  return true;
}

function pseudonym(sender) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update('wa:' + String(sender)).digest('hex');
}
// Atomic optimistic reservation of a strict rolling 60-minute allowance, across web workers.
async function reserveHourlyMessage(sender) {
  const id = pseudonym(sender);
  for (let retry = 0; retry < 50; retry++) {
    const now = new Date(), cutoff = now.getTime() - 3600000;
    const old = await AgentUsage.findById(id).lean();
    if (!old) {
      try { await AgentUsage.create({ _id: id, timestamps: [now], revision: 1 }); return true; }
      catch (err) { if (err.code === 11000) continue; throw err; }
    }
    const active = (old.timestamps || []).filter(t => new Date(t).getTime() > cutoff);
    if (active.length >= POLICY.hourlyLimit) return false;
    const updated = await AgentUsage.updateOne({ _id: id, revision: old.revision }, {
      $set: { timestamps: [...active, now] }, $inc: { revision: 1 }
    });
    if (updated.modifiedCount === 1) return true;
  }
  // Fail closed on concurrency overload. Never exceed the limit.
  return false;
}
// Approved deterministic answers only; never trust arbitrary model output for auto-send.
// The Qwen job is still useful for a separately reviewed generative draft.
function approvedSiteFaq(question) {
  if (!safeForAI(question)) return null;
  const s = question.trim();
  if (/^(?:مرحبا|سلام|السلام عليكم|أهلا|اهلا|bonjour|salut)[؟?!.,،\s]*$/i.test(s))
    return 'أهلًا بك في OVIRA PLAY! كيف يمكننا مساعدتك؟';
  if (/أسعار|الأسعار|باقات|prix/i.test(s))
    return 'يمكنك الاطلاع على الأسعار والباقات المحدثة في قسم المتجر. إذا لم تجد ما تحتاجه، سيجيبك فريق الدعم هنا.';
  if (/(كيف.*(?:اشتراك|أطلب|اطلب|شراء)|طريقة الاشتراك|comment.*abonn)/i.test(s))
    return 'اختر الاشتراك من قسم المتجر، راجع تفاصيل الباقة والشروط وطريقة الدفع الظاهرة، ثم أكمل الطلب. لأي مشكلة تواصل مع الإدارة هنا.';
  if (/(كيف.*(?:أنشئ|انشئ|أفتح|افتح|أدخل|ادخل).*حساب|إنشاء حساب|فتح حساب|تسجيل حساب|how to.*account)/i.test(s))
    return 'لإنشاء حساب في OVIRA PLAY، افتح «حسابي» واختر إنشاء حساب، وأكمل خطوات التحقق الظاهرة. بعد الدخول ستجد طلباتك ورسائلك وإشعاراتك هناك. لا تشارك كلمة المرور أو رمز التحقق في المحادثة.';
  if (/(كيف.*(?:تتبع|أتابع|اتابع).*طلب|تتبع الطلب|أين.*طلب)/i.test(s))
    return 'بعد تسجيل الدخول افتح «حسابي ← طلباتي» لمتابعة حالة الطلب. إذا اشتريت كزائر، استخدم صفحة تتبع الطلب المخصصة للزوار. لا تضع رمز التحقق أو كلمة المرور في الشات.';
  if (/(كيف|طريقة|كيفية|أين|وين|how).{0,35}(?:غيّر|اغير|أغير|تغيير|change|update).{0,30}(?:بريدي|إيميلي|ايميلي|الايميل|email|كلمة السر|كلمة المرور|password)/i.test(s))
    return 'يمكنك تغيير بيانات حسابك من «حسابي» بعد تسجيل الدخول والتحقق من هويتك بالطريقة المعروضة. لا ترسل كلمة المرور أو رمز OTP في المحادثة؛ إذا تعذّر التحقق سيتولى موظف الدعم مساعدتك.';
  return null;
}
module.exports = { POLICY, APPROVED_CONTEXT, safeForAI, personalAccountIntent, eligibleSiteReply, approvedSiteFaq, reserveHourlyMessage };
