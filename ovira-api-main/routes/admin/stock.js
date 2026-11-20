'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Stock = require('../../models/Stock');
const stockService = require('../../services/stockService');
const {
  recordAdminAudit,
  requireAdmin,
  requireRole
} = require('./middlewares');

const router = express.Router();

// 1. جرد المخزون وخريطة التوفر
router.get('/stock/availability', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const map = await stockService.getAvailabilityMap();
    res.json({ success: true, availability: map });
  } catch (err) {
    next(err);
  }
});

// 2. قائمة حسابات المخزون والشاشات
router.get('/stock', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    const { productId, active } = req.query;
    const filter = {};
    if (productId) filter.productId = productId;
    if (active !== undefined) filter.active = active === 'true';

    const stocks = await Stock.find(filter).sort({ createdAt: -1 }).lean();
    
    // إحصائيات سريعة
    let totalSlots = 0;
    let availableSlots = 0;
    let occupiedSlots = 0;

    const list = stocks.map((st) => {
      let stAvail = 0;
      let stOcc = 0;
      (st.slots || []).forEach((sl) => {
        totalSlots++;
        if (sl.status === 'available') {
          stAvail++;
          availableSlots++;
        } else {
          stOcc++;
          occupiedSlots++;
        }
      });

      return {
        _id: st._id,
        code: st.code,
        productId: st.productId,
        productName: st.productName,
        email: req.admin.role === 'viewer' ? '***@***.***' : st.email,
        password: req.admin.role === 'viewer' ? '********' : st.password,
        costPrice: req.admin.role === 'viewer' ? 0 : st.costPrice,
        masterExpiresAt: st.masterExpiresAt,
        active: st.active,
        notes: st.notes,
        createdAt: st.createdAt,
        totalSlots: (st.slots || []).length,
        availableSlots: stAvail,
        occupiedSlots: stOcc,
        slots: (st.slots || []).map((s) => ({
          slotNumber: s.slotNumber,
          profileName: s.profileName,
          status: s.status,
          orderCode: s.orderCode,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          assignedAt: s.assignedAt,
          expiresAt: s.expiresAt,
          pin: req.admin.role === 'viewer' ? '****' : s.pin
        }))
      };
    });

    res.json({
      success: true,
      stocks: list,
      summary: {
        accountsCount: stocks.length,
        totalSlots,
        availableSlots,
        occupiedSlots
      }
    });
  } catch (err) {
    next(err);
  }
});

// 3. إضافة حساب جديد للمخزون
router.post('/stock', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const { productId, email, password, slotsCount, costPrice, masterDays, notes } = req.body || {};
    if (!productId || !email || !password) {
      return res.status(400).json({ success: false, message: 'معرف المنتج والبريد وكلمة المرور مطلوبة.' });
    }

    const stock = await stockService.createStockAccount({
      productId,
      email,
      password,
      slotsCount: Number(slotsCount) || 5,
      costPrice: Number(costPrice) || 0,
      masterDays: Number(masterDays) || 30,
      notes: String(notes || '')
    });

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'CREATE_STOCK_ACCOUNT',
      entity: 'Stock',
      entityId: stock.code,
      summary: `إضافة حساب مخزون جديد (${stock.code}) للمنتج ${stock.productName}`
    });

    res.status(201).json({ success: true, message: 'تمت إضافة حساب المخزون بنجاح!', stock });
  } catch (err) {
    next(err);
  }
});

// 4. تحرير شاشة (إعادة الشاشة لحالة المتاح)
router.post('/stock/:id/release-slot', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const { slotNumber, rotatePin = true } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id) || !slotNumber) {
      return res.status(400).json({ success: false, message: 'معرف الحساب ورقم الشاشة مطلوبان.' });
    }

    const result = await stockService.releaseSlot(req.params.id, slotNumber, rotatePin);

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'RELEASE_STOCK_SLOT',
      entity: 'Stock',
      entityId: result.stock.code,
      summary: `تحرير الشاشة ${slotNumber} في الحساب ${result.stock.code}`
    });

    res.json({ success: true, message: `تم تحرير الشاشة ${slotNumber} وإعادتها للمخزون!`, slot: result.slot });
  } catch (err) {
    next(err);
  }
});

// 5. تعديل بيانات حساب المخزون
router.patch('/stock/:id', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرف الحساب غير صالح.' });
    }
    const { email, password, notes, active, costPrice } = req.body || {};
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).json({ success: false, message: 'الحساب غير موجود.' });

    if (email) stock.email = String(email).trim();
    if (password) stock.password = String(password).trim();
    if (notes !== undefined) stock.notes = String(notes).trim();
    if (active !== undefined) stock.active = !!active;
    if (costPrice !== undefined) stock.costPrice = Number(costPrice) || 0;

    await stock.save();

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_STOCK',
      entity: 'Stock',
      entityId: stock.code,
      summary: `تحديث بيانات حساب المخزون ${stock.code}`
    });

    res.json({ success: true, message: 'تم تحديث حساب المخزون.', stock });
  } catch (err) {
    next(err);
  }
});

// 6. حذف حساب المخزون
router.delete('/stock/:id', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرف الحساب غير صالح.' });
    }
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).json({ success: false, message: 'الحساب غير موجود.' });

    const hasOccupied = (stock.slots || []).some(s => s.status === 'occupied');
    if (hasOccupied && req.query.force !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'الحساب يحتوي على شاشات نشطة ومسلمة لعملاء. حرر الشاشات أولاً أو أرسل force=true.'
      });
    }

    await Stock.findByIdAndDelete(req.params.id);

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'DELETE_STOCK',
      entity: 'Stock',
      entityId: stock.code,
      summary: `حذف حساب المخزون ${stock.code}`
    });

    res.json({ success: true, message: 'تم حذف حساب المخزون بنجاح.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
