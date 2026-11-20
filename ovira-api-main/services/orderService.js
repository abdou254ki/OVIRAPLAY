const Order = require('../models/Order');
const Audit = require('../models/Audit');
const { STATUSES } = require('../models/Order');

let notifier = null;
const setNotifier = (n) => {
  notifier = n;
};

async function setStatus(id, status, by, adminId = 0) {
  if (!STATUSES.includes(status)) throw new Error('INVALID_STATUS');
  const order = await Order.findById(id);
  if (!order) return null;
  if (order.status === status) return order;

  order.status = status;
  order.history.push({ status, by });
  await order.save();

  if (adminId) {
    await Audit.create({
      adminId: adminId,
      action: 'UPDATE_STATUS',
      entity: 'Order',
      entityId: String(id),
      summary: `تغيير الحالة إلى: ${status}`
    });
  }

  if (notifier && notifier.customerStatus) {
    notifier.customerStatus(order).catch((e) => console.error('customer notify failed:', e.message));
  }
  return order;
}

// تسليم الحساب المخصّص (الإيميل/الباسورد + اسم الشاشة + رمز PIN)
async function deliverOrderAccount(id, { type = 'screen', credentials, profileName, pinCode, invitationUrl, extraNote, by = 'admin', adminId = 0 }) {
  if (!['account', 'screen', 'invite'].includes(type)) throw Object.assign(new Error('نوع التسليم غير صالح'), { status: 400 });
  if (type === 'invite' && !/^https:\/\/[^\s]+$/i.test(String(invitationUrl || '')) ) throw Object.assign(new Error('رابط التفعيل يجب أن يبدأ بـ https://'), { status: 400 });
  if (type !== 'invite' && String(credentials || '').trim().length < 3) throw Object.assign(new Error('بيانات الحساب مطلوبة'), { status: 400 });
  const order = await Order.findById(id);
  if (!order) return null;

  order.deliveredAccount = {
    type,
    invitationUrl: type === 'invite' ? String(invitationUrl).trim().slice(0, 1500) : '',
    credentials: type === 'invite' ? '' : String(credentials || '').trim(),
    profileName: type === 'screen' ? String(profileName || '').trim() : '',
    pinCode: type === 'screen' ? String(pinCode || '').trim() : '',
    extraNote: String(extraNote || '').trim(),
    deliveredAt: new Date(),
    deliveredBy: by
  };
  order.status = 'تم التسليم';
  order.history.push({ status: 'تم التسليم', by });
  await order.save();

  if (adminId) {
    await Audit.create({
      adminId,
      action: 'DELIVER_ACCOUNT',
      entity: 'Order',
      entityId: String(id),
      summary: `تسليم حساب للطلب ${order.orderCode} (الشاشة: ${profileName || 'بدون'})`
    });
  }

  if (notifier && notifier.accountDelivered) {
    notifier.accountDelivered(order).catch((e) => console.error('account delivery notify failed:', e.message));
  }
  return order;
}

// إشعار الدفع التلقائي عبر شارجيلي للمدير والعميل
async function notifyChargilyPaymentSuccess(order) {
  if (notifier && notifier.chargilyPaid) {
    await notifier.chargilyPaid(order).catch((e) => console.error('chargily notify failed:', e.message));
  }
}

module.exports = {
  setStatus,
  setNotifier,
  deliverOrderAccount,
  notifyChargilyPaymentSuccess
};
