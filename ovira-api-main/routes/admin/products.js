'use strict';

const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Product = require('../../models/Product');
const ProductRevision = require('../../models/ProductRevision');
const {
  DEFAULT_STEPS,
  ensureSeedProducts,
  parsePlansInput,
  readLandingInput,
  landingToText
} = require('../../services/productService');
const {
  recordAdminAudit,
  requireAdmin,
  requireRole
} = require('./middlewares');

const router = express.Router();

const LANDING_FIELDS = ['audience','limits','faqs','guaranteeText','deliveryText','seoTitle','seoDescription'];
const PRODUCT_SNAPSHOT_FIELDS = ['brandName','title','subtitle','category','primaryColor',
  'secondaryColor','iconText','imageUrl','badgeText','features','steps','plans','active', ...LANDING_FIELDS];

function productSnapshot(p) {
  const snap = {};
  for (const k of PRODUCT_SNAPSHOT_FIELDS) snap[k] = JSON.parse(JSON.stringify(p[k] ?? null));
  return snap;
}

router.get('/products/:id/revisions', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'معرّف غير صالح' });
    const revisions = await ProductRevision.find({ productId: req.params.id }).sort({ createdAt: -1 })
      .limit(15).select('createdAt adminId label').lean();
    res.json({ success: true, revisions });
  } catch (err) { next(err); }
});
router.post('/products/:id/restore/:revId', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (![req.params.id, req.params.revId].every(mongoose.isValidObjectId))
      return res.status(400).json({ success: false, message: 'معرّف غير صالح' });
    const [product, rev] = await Promise.all([
      Product.findById(req.params.id),
      ProductRevision.findOne({ _id: req.params.revId, productId: req.params.id })
    ]);
    if (!product || !rev) return res.status(404).json({ success: false, message: 'لم يتم العثور على النسخة' });
    // احفظ الحالة الحالية أولاً بحيث يمكن التراجع عن الاستعادة نفسها.
    await ProductRevision.create({ productId: product._id, adminId: req.admin.telegramId,
      label: 'قبل استعادة نسخة سابقة', snapshot: productSnapshot(product) });
    for (const key of PRODUCT_SNAPSHOT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(rev.snapshot, key)) continue; // نسخ قديمة لا تحوي حقول الهبوط: لا نمسّها
      const v = rev.snapshot[key];
      product[key] = LANDING_FIELDS.includes(key) && v == null ? undefined : v;
    }
    await product.save();
    await recordAdminAudit({ adminId: req.admin.telegramId, action: 'RESTORE_PRODUCT',
      entity: 'Product', entityId: product.productId, summary: `استعادة تعديل سابق للمنتج (${product.title})` });
    res.json({ success: true, message: 'تم استرجاع النسخة بنجاح', product });
  } catch (err) { next(err); }
});

router.get('/products', requireAdmin, requireRole(['owner', 'staff', 'viewer']), async (req, res, next) => {
  try {
    await ensureSeedProducts();
    const products = await Product.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
    // landing: نفس القيم بصيغة نصية جاهزة للتعديل (سطر لكل عنصر، "سؤال | جواب")
    res.json({ success: true, products: products.map((p) => ({ ...p, landing: landingToText(p) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/products', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    const {
      brandName,
      title,
      subtitle,
      category,
      primaryColor,
      secondaryColor,
      iconText,
      imageUrl,
      badgeText,
      featuresText,
      stepsText,
      plansText
    } = req.body || {};

    if (!brandName || !title) {
      return res.status(400).json({ success: false, message: 'اسم العلامة وعنوان البطاقة مطلوبان.' });
    }

    const plans = parsePlansInput(plansText);
    if (!plans.length) {
      return res.status(400).json({ success: false, message: 'أدخل الباقات بصيغة صحيحة (مثال: 1:600, 3:1650, 12:5500*).' });
    }

    const features = String(featuresText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const steps = String(stepsText || '')
      .split('\n')
      .map((line) => {
        const [t, d] = line.split('|').map((s) => s.trim());
        return t && d ? { title: t, desc: d } : null;
      })
      .filter(Boolean);

    const slugBase = String(brandName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 10) || 'prod';
    const productId = `${slugBase}-${crypto.randomBytes(2).toString('hex')}`;

    const product = await Product.create({
      productId,
      brandName: String(brandName).trim(),
      title: String(title).trim(),
      subtitle: String(subtitle || '').trim(),
      category: String(category || 'أفلام ومسلسلات').trim(),
      primaryColor: String(primaryColor || '#F47521').trim(),
      secondaryColor: String(secondaryColor || '#8A3A0A').trim(),
      iconText: String(iconText || String(brandName).slice(0, 1).toUpperCase()).trim(),
      imageUrl: String(imageUrl || '').trim(),
      badgeText: String(badgeText || '').trim(), // الشارة اختيارية؛ لا نفترض "فوري" لأن التسليم يدوي
      features, // لا نخترع مميزات؛ القسم يختفي من الصفحة إذا كان فارغًا
      steps: steps.length ? steps : DEFAULT_STEPS,
      plans,
      ...readLandingInput(req.body),
      active: true
    });

    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'CREATE_PRODUCT',
      entity: 'Product',
      entityId: product.productId,
      summary: `إنشاء بطاقة منتج جديدة (${product.title})`
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء بطاقة العرض وصفحة الهبوط بنجاح!',
      product
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/products/:id', requireAdmin, requireRole(['owner', 'staff']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف غير صالح.' });
    }
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'البطاقة غير موجودة.' });
    const beforeUpdate = productSnapshot(p);

    const {
      brandName,
      title,
      subtitle,
      category,
      primaryColor,
      secondaryColor,
      iconText,
      imageUrl,
      badgeText,
      featuresText,
      stepsText,
      plansText,
      active
    } = req.body || {};

    if (typeof brandName === 'string' && brandName.trim()) p.brandName = brandName.trim();
    if (typeof title === 'string' && title.trim()) p.title = title.trim();
    if (typeof subtitle === 'string') p.subtitle = subtitle.trim();
    if (typeof category === 'string' && category.trim()) p.category = category.trim();
    if (typeof primaryColor === 'string' && primaryColor.trim()) p.primaryColor = primaryColor.trim();
    if (typeof secondaryColor === 'string' && secondaryColor.trim()) p.secondaryColor = secondaryColor.trim();
    if (typeof iconText === 'string' && iconText.trim()) p.iconText = iconText.trim();
    if (typeof imageUrl === 'string') p.imageUrl = imageUrl.trim();
    if (typeof badgeText === 'string') p.badgeText = badgeText.trim(); // نص فارغ = إزالة الشارة
    if (typeof active === 'boolean') p.active = active;

    if (typeof featuresText === 'string') {
      const feats = featuresText.split('\n').map((s) => s.trim()).filter(Boolean);
      p.features = feats; // النص الفارغ يمسح المميزات؛ لا يظهر قسم بلا محتوى
    }

    if (typeof stepsText === 'string' && stepsText.trim()) {
      const parsedSteps = stepsText
        .split('\n')
        .map((line) => {
          const [t, d] = line.split('|').map((s) => s.trim());
          return t && d ? { title: t, desc: d } : null;
        })
        .filter(Boolean);
      if (parsedSteps.length) p.steps = parsedSteps;
    }

    if (typeof plansText === 'string' && plansText.trim()) {
      const plans = parsePlansInput(plansText);
      if (!plans.length) {
        return res.status(400).json({ success: false, message: 'صيغة الباقات غير صالحة.' });
      }
      p.plans = plans;
    }

    p.set(readLandingInput(req.body)); // حقول الهبوط: غير المُرسل لا يُمس، والنص الفارغ يحذف الحقل

    await p.save();
    if (JSON.stringify(beforeUpdate) !== JSON.stringify(productSnapshot(p))) {
      try {
        await ProductRevision.create({ productId: p._id, adminId: req.admin.telegramId,
          label: 'تعديل المنتج', snapshot: beforeUpdate });
      } catch (historyErr) {
        console.error('Failed to persist product revision:', historyErr.message);
      }
    }
    await recordAdminAudit({
      adminId: req.admin.telegramId,
      action: 'UPDATE_PRODUCT',
      entity: 'Product',
      entityId: p.productId,
      summary: `تعديل بطاقة المنتج (${p.title})`
    });

    res.json({ success: true, message: 'تم حفظ تعديلات البطاقة وصفحة الهبوط بنجاح!', product: p });
  } catch (err) {
    next(err);
  }
});

router.delete('/products/:id', requireAdmin, requireRole(['owner']), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'معرّف غير صالح.' });
    }
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (deleted) {
      await recordAdminAudit({
        adminId: req.admin.telegramId,
        action: 'DELETE_PRODUCT',
        entity: 'Product',
        entityId: deleted.productId,
        summary: `حذف بطاقة المنتج (${deleted.title})`
      });
    }
    res.json({ success: true, message: 'تم حذف البطاقة نهائياً.' });
  } catch (err) {
    next(err);
  }
});

// أداء مصادر الزيارة (utm) خلال آخر 7/30/90 يومًا: عدد الطلبات والمؤكَّد منها والإيراد المؤكَّد.
// قراءة فقط ومجمّعة؛ لا تُرجع أي اسم أو هاتف أو بريد.
module.exports = router;
