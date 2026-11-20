const Product = require('../models/Product');
const crypto = require('crypto');
const planKey = (p) => crypto.createHash('sha256').update([p.months, p.price, p.label || ''].join('|')).digest('hex').slice(0, 16);

const DEFAULT_STEPS = [
  { title: 'اختر باقتك وأكمل الطلب', desc: 'حدد المدة التي تناسبك ثم أكمل الطلب باسمك ورقم واتساب وبريدك الإلكتروني.' },
  { title: 'ادفع بالطريقة المتاحة', desc: 'تظهر لك طرق الدفع المفعّلة حاليًا عند إتمام الطلب، وبعد تأكيد الدفع نبدأ تجهيز طلبك.' },
  { title: 'استلم بيانات اشتراكك', desc: 'تظهر بيانات اشتراكك في صفحة طلبك، وتصلك على تيليغرام إن ربطت حسابك به.' }
];

// قوالب تصميم جاهزة بنفس ألوان وأيقونات البطاقات لإنشائها بضغطة زر في تيليغرام
const PRESET_TEMPLATES = {
  crunchyroll: {
    brandName: 'Crunchyroll',
    category: 'أنمي',
    primaryColor: '#F47521',
    secondaryColor: '#8A3A0A',
    iconText: 'C',
    badgeText: ''
  },
  netflix: {
    brandName: 'Netflix',
    category: 'أفلام ومسلسلات',
    primaryColor: '#E50914',
    secondaryColor: '#5C060C',
    iconText: 'N',
    badgeText: ''
  },
  shahid: {
    brandName: 'Shahid VIP',
    category: 'أفلام ومسلسلات',
    primaryColor: '#005FF9',
    secondaryColor: '#002E8A',
    iconText: 'S',
    badgeText: ''
  },
  prime: {
    brandName: 'Prime Video',
    category: 'أفلام ومسلسلات',
    primaryColor: '#00A8E1',
    secondaryColor: '#005B7F',
    iconText: 'P',
    badgeText: ''
  },
  youtube: {
    brandName: 'YouTube',
    category: 'ترفيه وموسيقى',
    primaryColor: '#FF0000',
    secondaryColor: '#7A0000',
    iconText: '▶',
    badgeText: ''
  },
  spotify: {
    brandName: 'Spotify',
    category: 'ترفيه وموسيقى',
    primaryColor: '#1DB954',
    secondaryColor: '#0B5E28',
    iconText: 'S',
    badgeText: ''
  },
  chatgpt: {
    brandName: 'ChatGPT Plus',
    category: 'ذكاء اصطناعي وبرامج',
    primaryColor: '#10A37F',
    secondaryColor: '#074F3D',
    iconText: 'AI',
    badgeText: ''
  },
  canva: {
    brandName: 'Canva Pro',
    category: 'ذكاء اصطناعي وبرامج',
    primaryColor: '#7D2AE8',
    secondaryColor: '#3B1078',
    iconText: 'C',
    badgeText: ''
  },
  iptv: {
    brandName: 'IPTV Pro',
    category: 'قنوات ورياضة',
    primaryColor: '#2563EB',
    secondaryColor: '#1E3A8A',
    iconText: 'TV',
    badgeText: '⚽ باقة شاملة'
  }
};

const INITIAL_PRODUCTS = [
  {
    productId: 'netflix',
    brandName: 'Netflix',
    title: 'نتفلكس بروفايل خاص',
    subtitle: 'مشاهدة بجودة 4K Ultra HD مع شاشة خاصة مقفلة برمز PIN سري',
    category: 'أفلام ومسلسلات',
    primaryColor: '#E50914',
    secondaryColor: '#5C060C',
    iconText: 'N',
    badgeText: '',
    features: ['شاشة خاصة باسمك', 'رمز PIN سري خاص بك', 'جودة 4K Ultra HD', 'تسليم البيانات بعد تأكيد الدفع'],
    steps: DEFAULT_STEPS,
    plans: [
      { months: 1, price: 900, best: false },
      { months: 3, price: 2700, best: false },
      { months: 6, price: 4900, best: false },
      { months: 12, price: 9500, best: true }
    ],
    sortOrder: 1
  },
  {
    productId: 'cr-mega',
    brandName: 'Crunchyroll',
    title: 'كرانشي رول Mega Fan',
    subtitle: 'أكبر مكتبة أنمي في العالم بدون إعلانات مع ميزة التحميل للمشاهدة بدون إنترنت',
    category: 'أنمي',
    primaryColor: '#F47521',
    secondaryColor: '#8A3A0A',
    iconText: 'C',
    badgeText: '',
    features: ['بدون إعلانات نهائياً', 'حلقات جديدة بعد عرضها في اليابان', 'تحميل للمشاهدة بدون إنترنت', 'تسليم الحساب والشاشة بعد تأكيد الدفع'],
    steps: DEFAULT_STEPS,
    plans: [
      { months: 1, price: 600, best: false },
      { months: 3, price: 1650, best: false },
      { months: 6, price: 3000, best: false },
      { months: 12, price: 5500, best: true }
    ],
    sortOrder: 2
  },
  {
    productId: 'cr-fan',
    brandName: 'Crunchyroll',
    title: 'كرانشي رول Fan',
    subtitle: 'مشاهدة كافة حلقات الأنمي بجودة عالية 1080p وبدون إعلانات',
    category: 'أنمي',
    primaryColor: '#F47521',
    secondaryColor: '#8A3A0A',
    iconText: 'C',
    badgeText: '',
    features: ['مشاهدة بدون إعلانات', 'مكتبة الأنمي كاملة', 'جودة 1080p Full HD', 'تسليم البيانات بعد تأكيد الدفع'],
    steps: DEFAULT_STEPS,
    plans: [
      { months: 1, price: 500, best: false },
      { months: 3, price: 1350, best: false },
      { months: 6, price: 2500, best: false },
      { months: 12, price: 4500, best: true }
    ],
    sortOrder: 3
  },
  {
    productId: 'shahid',
    brandName: 'Shahid VIP',
    title: 'شاهد VIP (باقة شاملة)',
    subtitle: 'أحدث الأعمال العربية الحصرية والباقة الرياضية الشاملة بشاشة خاصة',
    category: 'أفلام ومسلسلات',
    primaryColor: '#005FF9',
    secondaryColor: '#002E8A',
    iconText: 'S',
    badgeText: '',
    features: ['الباقة الرياضية الشاملة', 'شاشة خاصة برقم سري', 'بدون إعلانات', 'تسليم بعد تأكيد الدفع'],
    steps: DEFAULT_STEPS,
    plans: [
      { months: 1, price: 800, best: false },
      { months: 12, price: 7500, best: true }
    ],
    sortOrder: 4
  },
  {
    productId: 'prime',
    brandName: 'Prime Video',
    title: 'أمازون برايم فيديو',
    subtitle: 'أفلام ومسلسلات أمازون الحصرية بجودة 4K HDR وشاشة مخصصة لك',
    category: 'أفلام ومسلسلات',
    primaryColor: '#00A8E1',
    secondaryColor: '#005B7F',
    iconText: 'P',
    badgeText: '',
    features: ['شاشة خاصة بك', 'مكتبة أفلام أمازون الحصرية', 'جودة 4K HDR', 'تسليم بعد تأكيد الدفع'],
    steps: DEFAULT_STEPS,
    plans: [
      { months: 1, price: 600, best: false },
      { months: 6, price: 3200, best: false },
      { months: 12, price: 6000, best: true }
    ],
    sortOrder: 5
  }
];

// لا يكتب شيئًا في قاعدة البيانات إلا إذا فعّلت SEED_DEFAULT_PRODUCTS=true صراحةً (لقاعدة جديدة فقط).
// سابقًا كان يعيد زرع 5 منتجات تلقائيًا كلما أصبحت القائمة فارغة.
async function ensureSeedProducts() {
  if (process.env.SEED_DEFAULT_PRODUCTS !== 'true') return;
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      await Product.insertMany(INITIAL_PRODUCTS);
      console.log('Seeded initial 5 products into MongoDB');
    }
  } catch (err) {
    console.error('Product seed error:', err.message);
  }
}

// تحويل المنتج لصيغة الواجهة الأمامية
function formatProductForFrontend(p) {
  return {
    _id: p._id,
    id: p.productId,
    n: p.brandName,
    t: p.title,
    sub: p.subtitle || p.category,
    cat: p.category,
    c: p.primaryColor || '#2447C9',
    c2: p.secondaryColor || '#12286E',
    l: p.iconText || p.brandName.slice(0, 1).toUpperCase(),
    img: p.imageUrl || '',
    badge: p.badgeText || '',
    // لا نخترع مميزات: إن لم تُكتب مميزات يخفي الفرونت القسم.
    f: Array.isArray(p.features) ? p.features : [],
    steps: Array.isArray(p.steps) && p.steps.length ? p.steps : DEFAULT_STEPS,
    // حقول صفحة الهبوط (فارغة = لا يعرضها الفرونت)
    aud: Array.isArray(p.audience) ? p.audience : [],
    lim: Array.isArray(p.limits) ? p.limits : [],
    faq: Array.isArray(p.faqs) ? p.faqs.map((x) => ({ q: x.q, a: x.a })) : [],
    guar: p.guaranteeText || '',
    dlv: p.deliveryText || '',
    seoT: p.seoTitle || '',
    seoD: p.seoDescription || '',
    pl: (p.plans || []).map((pl) => [pl.months, pl.price, pl.best ? 1 : 0, pl.label || '', planKey(pl)]),
    active: p.active,
    sortOrder: p.sortOrder || 10
  };
}

// تحليل نص الباقات مثل: "1:600, 3:1650, 12:5500*"
function parsePlansInput(rawText) {
  const parts = String(rawText || '')
    .replace(/[،؛]/g, ',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const plans = [];
  for (const part of parts) {
    const isBest = part.includes('*');
    const clean = part.replace('*', '').trim();
    const [pricePart, ...labelParts] = clean.split('|');
    const [mStr, pStr] = pricePart.split(/[:=\-]/).map((s) => s.trim());
    const label = labelParts.join('|').trim().slice(0, 80);
    const months = Number(mStr);
    const price = Number(pStr);
    if (Number.isInteger(months) && months >= 1 && !isNaN(price) && price >= 0) {
      plans.push({ months, price: Math.round(price), best: isBest, label });
    }
  }
  if (plans.length > 0 && !plans.some((p) => p.best)) {
    plans[plans.length - 1].best = true;
  }
  return plans;
}

// أسطر نصية => مصفوفة نظيفة (تُستعمل في لوحة التحكم والبوت)
function parseLinesInput(rawText, maxItems = 8, maxLen = 160) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((x) => x.replace(/^\s*[-•*✓✔]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((x) => x.slice(0, maxLen));
}

// "السؤال | الجواب" في كل سطر
function parseFaqInput(rawText, maxItems = 8) {
  const out = [];
  for (const line of String(rawText || '').split(/\r?\n/)) {
    const idx = line.indexOf('|');
    if (idx < 1) continue;
    const q = line.slice(0, idx).trim().slice(0, 200);
    const a = line.slice(idx + 1).trim().slice(0, 800);
    if (q && a) out.push({ q, a });
    if (out.length >= maxItems) break;
  }
  return out;
}

// يقرأ حقول الهبوط من body (كل حقل اختياري). حقل نصي فارغ => undefined => يُحذف من المنتج.
// الاستعمال: doc.set(readLandingInput(body)) أو Product.create({ ...base, ...readLandingInput(body) })
function readLandingInput(body) {
  const b = body || {};
  const has = (k) => typeof b[k] === 'string';
  const str = (k, max) => String(b[k]).trim().slice(0, max) || undefined;
  const list = (v) => (v.length ? v : undefined);
  const out = {};
  if (has('audienceText')) out.audience = list(parseLinesInput(b.audienceText, 6, 140));
  if (has('limitsText')) out.limits = list(parseLinesInput(b.limitsText, 8, 180));
  if (has('faqsText')) out.faqs = list(parseFaqInput(b.faqsText, 8));
  if (has('guaranteeText')) out.guaranteeText = str('guaranteeText', 600);
  if (has('deliveryText')) out.deliveryText = str('deliveryText', 400);
  if (has('seoTitle')) out.seoTitle = str('seoTitle', 70);
  if (has('seoDescription')) out.seoDescription = str('seoDescription', 200);
  return out;
}

// عكس readLandingInput: لعرض القيم الحالية داخل نماذج التعديل
function landingToText(p) {
  const x = p || {};
  return {
    audienceText: (x.audience || []).join('\n'),
    limitsText: (x.limits || []).join('\n'),
    faqsText: (x.faqs || []).map((f) => `${f.q} | ${f.a}`).join('\n'),
    guaranteeText: x.guaranteeText || '',
    deliveryText: x.deliveryText || '',
    seoTitle: x.seoTitle || '',
    seoDescription: x.seoDescription || ''
  };
}

module.exports = {
  parseLinesInput,
  parseFaqInput,
  readLandingInput,
  landingToText,
  DEFAULT_STEPS,
  PRESET_TEMPLATES,
  ensureSeedProducts,
  formatProductForFrontend,
  parsePlansInput,
  planKey
};
