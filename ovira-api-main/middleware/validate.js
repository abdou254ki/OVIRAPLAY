const { z } = require('zod');

/**
 * Middleware factory for validating request bodies, queries, or params using Zod
 * Returns human-friendly Arabic error messages.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = schema.parse(dataToValidate);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const firstError = err.errors[0];
        const fieldName = firstError.path.join('.');
        return res.status(400).json({
          success: false,
          message: firstError.message || `قيمة غير صالحة في الحقل: ${fieldName}`,
          field: fieldName,
          errors: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const orderSchema = z.object({
  customerName: z.string({ required_error: 'اسم العميل مطلوب' })
    .min(2, 'الاسم يجب ألا يقل عن حرفين')
    .max(80, 'الاسم طويل جداً'),
  whatsappNumber: z.string({ required_error: 'رقم الواتساب مطلوب' })
    .min(9, 'رقم الهاتف قصير جداً')
    .max(20, 'رقم الهاتف طويل جداً'),
  customerEmail: z.string().email('صيغة البريد الإلكتروني غير صحيحة').optional().or(z.literal('')),
  paymentMethod: z.string({ required_error: 'طريقة الدفع مطلوبة' }),
  cartItems: z.array(z.object({
    productId: z.string().min(1, 'معرف المنتج مطلوب'),
    productName: z.string().min(1, 'اسم المنتج مطلوب'),
    months: z.number().int().min(1).max(36),
    quantity: z.number().int().min(1).max(9),
    unitPrice: z.number().min(0),
    planKey: z.string().optional(),
    planLabel: z.string().optional()
  })).min(1, 'السلة يجب أن تحتوي على منتج واحد على الأقل').max(20, 'السلة ممتلئة جداً'),
  couponCode: z.string().optional(),
  adminNote: z.string().max(300).optional(),
  requestedAt: z.string().datetime().optional().or(z.date()).optional(),
  scheduledFor: z.string().datetime().optional().or(z.date()).optional(),
  scheduleNote: z.string().max(300).optional()
});

const manualOrderSchema = z.object({
  productId: z.string({ required_error: 'معرف المنتج مطلوب' }),
  productName: z.string().optional(),
  months: z.number().int().min(1).max(36).default(1),
  quantity: z.number().int().min(1).max(9).default(1),
  unitPrice: z.number().min(0).optional(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(2, 'اسم العميل مطلوب'),
  customerPhone: z.string().min(9, 'رقم الهاتف غير صالح'),
  customerEmail: z.string().email('البريد غير صالح').optional().or(z.literal('')),
  paymentMethod: z.string().default('بريدي موب'),
  status: z.enum(['قيد المراجعة', 'مؤكد', 'تم التسليم']).default('مؤكد'),
  requestedAt: z.string().optional(),
  scheduledFor: z.string().optional(),
  scheduleNote: z.string().max(300).optional(),
  adminNote: z.string().max(300).optional(),
  idempotencyKey: z.string().optional()
});

const productSchema = z.object({
  id: z.string().min(2, 'معرف المنتج مطلوب').max(40),
  name: z.string().min(2, 'اسم المنتج مطلوب').max(80),
  title: z.string().min(2, 'عنوان العرض مطلوب').max(100),
  category: z.string().min(2, 'التصنيف مطلوب').max(50),
  sub: z.string().max(200).optional(),
  color: z.string().optional(),
  color2: z.string().optional(),
  letter: z.string().max(5).optional(),
  image: z.string().optional(),
  plans: z.array(z.any()).min(1, 'يجب تحديد باقة واحدة على الأقل')
});

module.exports = {
  validate,
  orderSchema,
  manualOrderSchema,
  productSchema
};
