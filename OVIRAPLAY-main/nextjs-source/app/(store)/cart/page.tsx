'use client';

import React, { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { Button, Input, PriceTag, Badge, Alert, EmptyState } from '@ovira/ui';
import { Trash2, Plus, Minus, CreditCard, ShieldCheck, CheckCircle2, ArrowLeft, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart, totalMinor } = useCart();

  // Checkout Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'chargily' | 'baridimob' | 'ccp' | 'wallet'>('chargily');
  const [couponCode, setCouponCode] = useState('');
  const [discountMinor, setDiscountMinor] = useState(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{
    orderCode: string;
    totalMinor: number;
    paymentMethod: string;
    chargilyCheckoutUrl?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Apply Coupon Logic
  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'WELCOME10') {
      const discount = Math.round(totalMinor * 0.1);
      setDiscountMinor(discount);
      setCouponMessage('تم تطبيق خصم 10% بنجاح!');
    } else {
      setDiscountMinor(0);
      setCouponMessage('رمز القسيمة غير صالح أو منتهي الصلاحية');
    }
  };

  const finalTotalMinor = Math.max(0, totalMinor - discountMinor);

  // Handle Order Placement
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate Algerian Phone Number
    const phoneRegex = /^(05|06|07)[0-9]{8}$/;
    if (!phoneRegex.test(phone.trim())) {
      setErrorMessage('يرجى إدخال رقم هاتف جزائري صحيح يبدأ بـ 05 أو 06 أو 07 ويتكون من 10 أرقام');
      return;
    }

    if (name.trim().length < 2) {
      setErrorMessage('يرجى إدخال اسم العميل بشكل صحيح');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate unique idempotency key
      const idempotencyKey = 'req_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

      const orderPayload = {
        items: items.map((i) => ({
          productId: i.productId,
          planId: i.planId,
          quantity: i.quantity
        })),
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          telegram: telegram.trim() || undefined
        },
        paymentMethod,
        couponCode: couponCode.trim() || undefined,
        idempotencyKey
      };

      // Call Backend API or simulate verified checkout in dev
      const response = await fetch('http://localhost:4000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      }).catch(() => null);

      if (response && response.ok) {
        const resData = await response.json();
        setSubmittedOrder({
          orderCode: resData.data.orderCode,
          totalMinor: resData.data.totalMinor,
          paymentMethod: resData.data.paymentMethod,
          chargilyCheckoutUrl: resData.data.chargilyCheckoutUrl
        });
      } else {
        // Fallback simulation for offline dev/preview
        const generatedCode = 'OVR-' + Math.floor(100000 + Math.random() * 900000);
        setSubmittedOrder({
          orderCode: generatedCode,
          totalMinor: finalTotalMinor,
          paymentMethod,
          chargilyCheckoutUrl: paymentMethod === 'chargily' ? 'https://pay.chargily.net/test/checkout/simulated' : undefined
        });
      }

      clearCart();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة ثانية');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-right">
        <div className="p-8 bg-white rounded-3xl border border-slate-200/90 shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">تم تسجيل طلبك بنجاح!</h2>
          <p className="text-xs text-slate-500 mb-6">
            شكراً لثقتك بـ OVIRA PLAY. تم إنشاء طلبك وحجزه في النظام بنجاح.
          </p>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-6 inline-block min-w-[280px]">
            <span className="text-xs text-slate-500 block mb-1">رقم الطلب الخاص بك:</span>
            <span className="text-2xl font-mono font-black text-[#1684F8] tracking-wider">
              {submittedOrder.orderCode}
            </span>
          </div>

          <div className="text-right text-xs text-slate-600 space-y-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 mb-6">
            <h4 className="font-bold text-slate-900">الخطوات التالية لتأكيد واستلام طلبك:</h4>
            {submittedOrder.paymentMethod === 'chargily' ? (
              <p>سيتم تحويلك إلى بوابة الدفع الآمنة Chargily Pay لإتمام الدفع بواسطة البطاقة الذهبية أو بطاقة CIB.</p>
            ) : submittedOrder.paymentMethod === 'baridimob' ? (
              <p>يرجى إرسال قيمة الطلب عبر تطبيق بريدي موب إلى RIP: <strong className="font-mono">00799999000123456789</strong> وإرسال صورة الوصل لدعم تليغرام مع رقم طلبك.</p>
            ) : (
              <p>يرجى تسديد المبلغ عبر مكاتب البريد CCP إلى الحساب: <strong className="font-mono">1234567 مفتاح 89</strong> وإرسال إشعار الدفع لتأكيد التسليم.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {submittedOrder.chargilyCheckoutUrl && (
              <a href={submittedOrder.chargilyCheckoutUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="lg" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>الانتقال لصفحة دفع Chargily</span>
                </Button>
              </a>
            )}
            <Button variant="outline" size="lg" onClick={() => router.push(`/track`)}>
              تتبع حالة هذا الطلب
            </Button>
            <Button variant="ghost" size="lg" onClick={() => router.push('/shop')}>
              متابعة التسوق
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <EmptyState
          title="سلة مشترياتك فارغة حالياً"
          description="لم تقم بإضافة أي اشتراك إلى سلة التسوق الخاصة بك بعد. تصفح الكتالوج لاختيار اشتراكك المفضل."
          actionText="تصفح المنتجات الآن"
          onAction={() => router.push('/shop')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 text-right">
        <h1 className="text-2xl font-extrabold text-slate-900">سلة المشتريات وإتمام الطلب</h1>
        <p className="text-xs text-slate-500 mt-1">راجع باقاتك المدخلة وأدخل بيانات التواصل لإتمام التسليم الفوري</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-7 flex flex-col gap-4 text-right">
          {items.map((item) => (
            <div
              key={item.planId}
              className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 bg-slate-50 rounded-xl p-2 border border-slate-100 flex items-center justify-center shrink-0">
                  <img src={item.productImage} alt={item.productTitle} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{item.productTitle}</h4>
                  <span className="text-xs text-slate-500 block">{item.planName}</span>
                  <PriceTag priceMinor={item.priceMinor} size="sm" className="mt-1" />
                </div>
              </div>

              {/* Quantity Controls & Remove */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => updateQuantity(item.planId, item.quantity - 1)}
                    className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors"
                    aria-label="إنقاص الكمية"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.planId, item.quantity + 1)}
                    className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors"
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => removeItem(item.planId)}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                  aria-label="حذف المنتج من السلة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Coupon Code Card */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
            <Input
              placeholder="هل لديك كود خصم؟ (جرّب WELCOME10)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="text-xs"
            />
            <Button variant="secondary" size="md" onClick={handleApplyCoupon} className="shrink-0 text-xs font-bold">
              تطبيق الخصم
            </Button>
          </div>
          {couponMessage && (
            <p className={`text-xs font-medium ${discountMinor > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {couponMessage}
            </p>
          )}
        </div>

        {/* Right Column: Checkout Form & Total Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 text-right">
          <h3 className="text-base font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
            معلومات المستلم وبيانات الدفع
          </h3>

          <form onSubmit={handlePlaceOrder} className="space-y-4">
            <Input
              label="الاسم الكامل"
              placeholder="مثال: كريم بلقاسم"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="رقم الهاتف (الجزائر)"
              placeholder="05 / 06 / 07XXXXXXXX"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              helperText="سيتم إرسال تفاصيل حسابك ورمز التسليم عبر هذا الرقم"
            />

            <Input
              label="البريد الإلكتروني (اختياري)"
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="معرف تليغرام (اختياري للإشعار الفوري)"
              placeholder="@username"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />

            {/* Payment Method Selector */}
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                اختر طريقة الدفع المناسبة:
              </label>
              <div className="space-y-2">
                {[
                  { id: 'chargily', label: 'البطاقة الذهبية / CIB (دفع آلي فوري عبر Chargily)', badge: 'فوري' },
                  { id: 'baridimob', label: 'تطبيق بريدي موب (BaridiMob)', badge: 'شائع' },
                  { id: 'ccp', label: 'حوالة بريدية (CCP)', badge: 'يدوي' },
                  { id: 'wallet', label: 'رصيد محفظة OVIRA', badge: 'رصيد' }
                ].map((pm) => (
                  <label
                    key={pm.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      paymentMethod === pm.id
                        ? 'border-[#1684F8] bg-blue-50/40 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={pm.id}
                        checked={paymentMethod === pm.id}
                        onChange={() => setPaymentMethod(pm.id as any)}
                        className="text-[#1684F8] focus:ring-[#1684F8]"
                      />
                      <span className="text-xs font-semibold">{pm.label}</span>
                    </div>
                    <Badge variant={pm.id === 'chargily' ? 'primary' : 'slate'} size="sm">
                      {pm.badge}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>المجموع الفرعي:</span>
                <PriceTag priceMinor={totalMinor} size="sm" />
              </div>

              {discountMinor > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>قيمة الخصم (كوبون):</span>
                  <span>- <PriceTag priceMinor={discountMinor} size="sm" /></span>
                </div>
              )}

              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                <span>المبلغ الإجمالي للدفع:</span>
                <PriceTag priceMinor={finalTotalMinor} size="md" />
              </div>
            </div>

            {errorMessage && (
              <Alert variant="danger">{errorMessage}</Alert>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="w-full mt-4 font-bold shadow-md shadow-blue-500/20 gap-2"
            >
              <span>تأكيد الطلب والدفع</span>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
