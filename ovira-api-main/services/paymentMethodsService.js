const Setting = require('../models/Setting');
const { getChargilyConfig } = require('./chargilyService');

const SETTING_KEY = 'payment_methods';

// تعريف الطرق الست المعتمدة في المتجر
const BASE_METHODS = [
  {
    id: 'chargily',
    name: 'Chargily Pay (الذهبية / CIB)',
    type: 'auto',
    defaultEnabled: true,
    defaultLabel: '',
    defaultValue: '',
    defaultNote: 'دفع إلكتروني فوري ومؤمّن 100% عبر البطاقة الذهبية أو CIB (يتم تأكيد طلبك تلقائياً)'
  },
  {
    id: 'wallet',
    name: 'رصيد المحفظة',
    type: 'wallet',
    defaultEnabled: true,
    defaultLabel: '',
    defaultValue: '',
    defaultNote: 'ادفع فوراً من رصيد حسابك في المتجر دون انتظار'
  },
  {
    id: 'baridimob',
    name: 'بريدي موب',
    type: 'manual',
    defaultEnabled: true,
    defaultLabel: 'RIP',
    defaultValue: '00799999004244734853',
    defaultNote: ''
  },
  {
    id: 'binance',
    name: 'Binance',
    type: 'manual',
    defaultEnabled: true,
    defaultLabel: 'Binance ID',
    defaultValue: '732478828',
    defaultNote: ''
  },
  {
    id: 'redotpay',
    name: 'Redotpay',
    type: 'manual',
    defaultEnabled: true,
    defaultLabel: 'Redotpay ID',
    defaultValue: '1090594184',
    defaultNote: ''
  },
  {
    id: 'bybit',
    name: 'Bybit',
    type: 'manual',
    defaultEnabled: true,
    defaultLabel: 'Bybit ID',
    defaultValue: '67421194',
    defaultNote: ''
  }
];

function cleanText(val, maxLen = 200) {
  return String(val ?? '')
    .replace(/[<>[\]\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

async function computeMethodsState(storedMap = {}) {
  const chargilyCfg = await getChargilyConfig();
  const hasChargilySecret = !!(chargilyCfg && chargilyCfg.enabled && chargilyCfg.secretKey);

  return BASE_METHODS.map((base) => {
    const saved = storedMap[base.id] || {};
    const enabled = typeof saved.enabled === 'boolean' ? saved.enabled : base.defaultEnabled;
    const label = saved.label !== undefined ? cleanText(saved.label, 60) : base.defaultLabel;
    const value = saved.value !== undefined ? cleanText(saved.value, 120) : base.defaultValue;
    const note = saved.note !== undefined ? cleanText(saved.note, 250) : base.defaultNote;

    let visible = enabled;
    let hiddenReason = '';

    if (!enabled) {
      visible = false;
      hiddenReason = 'معطّلة من الإدارة';
    } else if (base.type === 'auto' && !hasChargilySecret) {
      visible = false;
      hiddenReason = 'مفتاح شارجيلي السري غير مضبوط للوضع الحالي';
    } else if (base.type === 'manual' && !value) {
      visible = false;
      hiddenReason = 'رقم الحساب / المعرّف فارغ';
    }

    return {
      id: base.id,
      name: base.name,
      type: base.type,
      enabled,
      visible,
      hiddenReason,
      label,
      value,
      note
    };
  });
}

async function loadStoredMap() {
  const doc = await Setting.findOne({ key: SETTING_KEY }).lean();
  if (!doc || !doc.value || typeof doc.value !== 'object') return {};
  return doc.value;
}

// جلب جميع الطرق مع حالتها للوحة الإدارة
async function getAdminPaymentMethods() {
  const storedMap = await loadStoredMap();
  const methods = await computeMethodsState(storedMap);
  return { methods };
}

// جلب الطرق الظاهرة فقط للزبائن في المتجر
async function getPublicPaymentMethods() {
  const { methods } = await getAdminPaymentMethods();
  return methods
    .filter((m) => m.visible)
    .map(({ id, name, type, label, value, note }) => ({
      id,
      name,
      type,
      label,
      value,
      note
    }));
}

// التحقق مما إذا كانت طريقة الدفع مسموحة عند إنشاء طلب جديد
async function isPaymentMethodAllowed(paymentMethodName) {
  const { methods } = await getAdminPaymentMethods();
  const found = methods.find((m) => m.name === paymentMethodName || m.id === paymentMethodName);
  return !!(found && found.visible);
}

// حفظ التعديلات القادمة من لوحة الإدارة
async function savePaymentMethods(inputList) {
  if (!Array.isArray(inputList)) {
    const err = new Error('بيانات طرق الدفع غير صالحة.');
    err.code = 'INVALID_INPUT';
    throw err;
  }

  const currentMap = await loadStoredMap();
  const nextMap = { ...currentMap };

  for (const item of inputList) {
    if (!item || typeof item.id !== 'string') continue;
    const base = BASE_METHODS.find((b) => b.id === item.id);
    if (!base) continue;

    nextMap[base.id] = {
      enabled: typeof item.enabled === 'boolean' ? item.enabled : base.defaultEnabled,
      label: base.type === 'manual' ? cleanText(item.label ?? base.defaultLabel, 60) : '',
      value: base.type === 'manual' ? cleanText(item.value ?? base.defaultValue, 120) : '',
      note: cleanText(item.note ?? base.defaultNote, 250)
    };
  }

  const preview = await computeMethodsState(nextMap);
  if (!preview.some((m) => m.visible)) {
    const err = new Error('لا يمكن الحفظ: يجب إبقاء طريقة دفع واحدة على الأقل مفعّلة وظاهرة للزبائن.');
    err.code = 'NO_VISIBLE_METHOD';
    throw err;
  }

  await Setting.findOneAndUpdate(
    { key: SETTING_KEY },
    { value: nextMap },
    { upsert: true, new: true }
  );

  return { methods: preview };
}

module.exports = {
  BASE_METHODS,
  getAdminPaymentMethods,
  getAllPaymentMethodsForAdmin: getAdminPaymentMethods,
  getPublicPaymentMethods,
  getPublicMethods: getPublicPaymentMethods,
  isPaymentMethodAllowed,
  savePaymentMethods
};
