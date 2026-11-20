const crypto = require('crypto');
const Stock = require('../models/Stock');
const CATALOG = require('../config/catalog');

const genStockCode = (productId) => {
  const prefix = String(productId || 'ST').slice(0, 2).toUpperCase();
  return `${prefix}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
};

const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));

async function createStockAccount({ productId, email, password, slotsCount, costPrice = 0, masterDays = 30, notes = '' }) {
  const product = CATALOG[productId];
  if (!product) throw new Error('المنتج غير موجود في الكتالوج');

  const count = Math.max(1, Number(slotsCount) || product.defaultSlots || 5);
  const slots = [];
  for (let i = 1; i <= count; i++) {
    slots.push({
      slotNumber: i,
      profileName: `الشاشة ${i}`,
      pin: `${i}${i}${i}${i}`,
      status: 'available',
    });
  }

  const masterExpiresAt = new Date(Date.now() + (Number(masterDays) || 30) * 86400000);
  const code = genStockCode(productId);

  return Stock.create({
    code,
    productId,
    productName: product.name,
    email: String(email).trim(),
    password: String(password).trim(),
    costPrice: Number(costPrice) || 0,
    masterExpiresAt,
    notes: String(notes || '').trim(),
    active: true,
    slots,
  });
}

async function getAvailabilityMap() {
  const stocks = await Stock.find({ active: { $ne: false } }).lean();
  const map = {};
  for (const id of Object.keys(CATALOG)) {
    map[id] = { availableSlots: 0, totalSlots: 0, accountsCount: 0 };
  }
  for (const st of stocks) {
    if (!map[st.productId]) map[st.productId] = { availableSlots: 0, totalSlots: 0, accountsCount: 0 };
    map[st.productId].accountsCount += 1;
    for (const sl of st.slots || []) {
      map[st.productId].totalSlots += 1;
      if (sl.status === 'available') map[st.productId].availableSlots += 1;
    }
  }
  return map;
}

async function assignSlotsForOrder(order) {
  if (!order || !Array.isArray(order.cartItems) || !order.cartItems.length) {
    throw new Error('بيانات الطلب غير صالحة');
  }

  const assignedSlots = [];
  const textBlocks = [];
  let maxExpiry = new Date(0);

  for (const item of order.cartItems) {
    const needed = Number(item.quantity) || 1;
    const months = Number(item.months) || 1;
    const itemExpiresAt = new Date(Date.now() + months * 30 * 86400000);
    if (itemExpiresAt > maxExpiry) maxExpiry = itemExpiresAt;

    let allocated = 0;
    const candidates = await Stock.find({
      productId: item.productId,
      active: { $ne: false },
      'slots.status': 'available',
    }).sort({ masterExpiresAt: 1 });

    for (const stock of candidates) {
      for (const slot of stock.slots) {
        if (slot.status === 'available' && allocated < needed) {
          slot.status = 'occupied';
          slot.orderId = order._id;
          slot.orderCode = order.orderCode;
          slot.customerName = order.customerName;
          slot.customerPhone = order.whatsappNumber;
          slot.assignedAt = new Date();
          slot.expiresAt = itemExpiresAt;

          assignedSlots.push({
            stockId: stock._id,
            stockCode: stock.code,
            slotNumber: slot.slotNumber,
            productName: item.productName,
            email: stock.email,
            password: stock.password,
            profileName: slot.profileName || `الشاشة ${slot.slotNumber}`,
            pin: slot.pin || '',
            expiresAt: itemExpiresAt,
          });

          const lines = [
            `🎬 ${item.productName} (${months} شهر)`,
            `📧 الإيميل: ${stock.email}`,
            `🔑 كلمة السر: ${stock.password}`,
            `🖥️ الشاشة: ${slot.profileName || 'الشاشة ' + slot.slotNumber}`,
          ];
          if (slot.pin) lines.push(`🔒 رمز PIN: ${slot.pin}`);
          lines.push(`📅 صالح حتى: ${itemExpiresAt.toLocaleDateString('fr-DZ')}`);
          textBlocks.push(lines.join('\n'));

          allocated++;
        }
      }
      await stock.save();
      if (allocated >= needed) break;
    }

    if (allocated < needed) {
      throw new Error(`لا توجد شاشات متاحة كافية في المخزون للمنتج: ${item.productName}`);
    }
  }

  return {
    credentials: textBlocks.join('\n\n──────────────\n\n'),
    assignedSlots,
    expiresAt: maxExpiry,
  };
}

async function releaseSlot(stockId, slotNumber, rotatePin = true) {
  const stock = await Stock.findById(stockId);
  if (!stock) throw new Error('الحساب غير موجود في المخزون');
  const slot = (stock.slots || []).find((s) => s.slotNumber === Number(slotNumber));
  if (!slot) throw new Error('الشاشة غير موجودة');

  slot.status = 'available';
  slot.orderId = null;
  slot.orderCode = '';
  slot.customerName = '';
  slot.customerPhone = '';
  slot.assignedAt = null;
  slot.expiresAt = null;
  if (rotatePin) slot.pin = randomPin();

  await stock.save();
  return { stock, slot };
}

module.exports = {
  createStockAccount,
  getAvailabilityMap,
  assignSlotsForOrder,
  releaseSlot,
};
