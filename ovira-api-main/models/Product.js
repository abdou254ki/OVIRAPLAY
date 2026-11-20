const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    months: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    best: { type: Boolean, default: false },
    label: { type: String, trim: true, maxlength: 80, default: '' }
  },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    desc: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const faqSchema = new mongoose.Schema(
  {
    q: { type: String, required: true, trim: true, maxlength: 200 },
    a: { type: String, required: true, trim: true, maxlength: 800 }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
  brandName: { type: String, required: true, trim: true }, // مثل: Crunchyroll أو Netflix
  title: { type: String, required: true, trim: true },     // مثل: كرانشي رول Mega Fan
  subtitle: { type: String, trim: true, default: '' },     // وصف مخصص تحت العنوان في صفحة الهبوط
  category: { type: String, required: true, trim: true, default: 'أفلام ومسلسلات' },
  primaryColor: { type: String, trim: true, default: '#F47521' },
  secondaryColor: { type: String, trim: true, default: '#8A3A0A' },
  iconText: { type: String, trim: true, default: 'C' },    // الحرف أو الإيموجي داخل البطاقة
  imageUrl: { type: String, trim: true, default: '' },     // رابط صورة مخصصة للبطاقة (اختياري)
  badgeText: { type: String, trim: true, default: '' },    // شارة اختيارية (فارغة = لا تظهر). لا تكتب "فوري" ما دام التسليم يدويًا.
  features: { type: [String], default: [] },               // قائمة "ما ستحصل عليه" في صفحة الهبوط
  steps: { type: [stepSchema], default: [] },              // خطوات "كيف يتم طلبك؟" المخصصة
  plans: {
    type: [planSchema],
    validate: {
      validator: function(v) { return Array.isArray(v) && v.length > 0; },
      message: 'يجب إضافة باقة واحدة على الأقل'
    }
  },
  // ===== حقول صفحة الهبوط (كلها اختيارية؛ القسم الفارغ يختفي من الصفحة) =====
  // default: undefined => لا تُكتب مصفوفة فارغة في المنتجات القديمة عند حفظها.
  audience: { type: [String], default: undefined },        // "يناسبك إذا"
  limits: { type: [String], default: undefined },          // "قبل الشراء اعلم" (حدود الخدمة الحقيقية)
  faqs: { type: [faqSchema], default: undefined },         // أسئلة خاصة بالمنتج
  guaranteeText: { type: String, trim: true, maxlength: 600 },   // سياسة الاستبدال/الدعم الحقيقية
  deliveryText: { type: String, trim: true, maxlength: 400 },    // كيف/متى يتم التسليم فعليًا
  seoTitle: { type: String, trim: true, maxlength: 70 },         // عنوان المعاينة عند المشاركة
  seoDescription: { type: String, trim: true, maxlength: 200 },  // وصف المعاينة عند المشاركة
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
