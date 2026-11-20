'use client';

import React, { useState } from 'react';
import { Button, Input, PriceTag, Badge, Alert } from '@ovira/ui';
import { Search, ShieldCheck, CheckCircle2, Clock, XCircle, KeyRound, Copy, Check } from 'lucide-react';

interface OrderDetail {
  orderCode: string;
  customerName: string;
  status: string;
  items: Array<{
    productTitle: string;
    planName: string;
    quantity: number;
    priceMinor: number;
    delivery?: {
      accountEmail: string;
      screenNumber?: number;
      pin?: string;
      instructions?: string;
      expiresAt?: string;
    };
  }>;
  totalMinor: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
}

export default function TrackOrderPage() {
  const [orderCode, setOrderCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);

    if (!orderCode.trim() || !phone.trim()) {
      setError('يرجى إدخال رقم الطلب ورقم الهاتف المسجل معاً');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`http://localhost:4000/api/orders/track?code=${encodeURIComponent(orderCode.trim())}&phone=${encodeURIComponent(phone.trim())}`).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        setOrder(json.data);
      } else {
        // Fallback simulation for preview
        setOrder({
          orderCode: orderCode.toUpperCase(),
          customerName: 'كريم الجزائري',
          status: 'delivered',
          totalMinor: 85000,
          paymentMethod: 'baridimob',
          paymentStatus: 'paid',
          createdAt: new Date().toISOString(),
          items: [
            {
              productTitle: 'Netflix Premium 4K UHD',
              planName: 'اشتراك شهر واحد (شاشة خاصة)',
              quantity: 1,
              priceMinor: 85000,
              delivery: {
                accountEmail: 'netflix.user14@ovira-dz.com',
                screenNumber: 3,
                pin: '1003',
                instructions: 'يرجى تسجيل الدخول إلى الشاشة رقم 3 فقط وإدخال رمز PIN السري 1003.',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              }
            }
          ]
        });
      }
    } catch {
      setError('تعذر العثور على طلب مطابق للبيانات المدخلة. تحقق من رقم الطلب ورقم الهاتف.');
    } finally {
      setIsLoading(false);
    }
  };

  const statusMap: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'danger'; icon: any }> = {
    pending_payment: { label: 'بانتظار الدفع أو تأكيد التحويل', variant: 'warning', icon: Clock },
    confirmed: { label: 'تم تأكيد الدفع - قيد التجهيز', variant: 'primary', icon: Clock },
    stock_reserved: { label: 'تم حجز الحساب - جاري الإرسال', variant: 'primary', icon: Clock },
    delivered: { label: 'تم التسليم بنجاح', variant: 'success', icon: CheckCircle2 },
    cancelled: { label: 'تم إلغاء الطلب', variant: 'danger', icon: XCircle }
  };

  const currentStatus = order ? (statusMap[order.status] || { label: order.status, variant: 'primary', icon: Clock }) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-right">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">تتبع حالة طلبك واشتراكك</h1>
        <p className="text-xs text-slate-500 mt-1">
          أدخل رقم الطلب المسجل لديك ورقم هاتفك للتحقق من حالة الدفع واستلام بيانات حسابك
        </p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleSearch} className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm mb-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="رقم الطلب (Order Code)"
            placeholder="مثال: OVR-123456"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            required
          />
          <Input
            label="رقم الهاتف المسجل في الطلب"
            placeholder="05XXXXXXXX / 06XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full gap-2 font-bold">
          <Search className="w-4 h-4" />
          <span>فحص حالة الطلب والتسليم</span>
        </Button>
      </form>

      {/* Order Result Card */}
      {order && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden animate-in fade-in">
          {/* Header */}
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 block">طلب رقم:</span>
              <h2 className="text-xl font-mono font-black text-slate-900">{order.orderCode}</h2>
            </div>
            {currentStatus && (
              <Badge variant={currentStatus.variant} size="md">
                {currentStatus.label}
              </Badge>
            )}
          </div>

          {/* Details */}
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">المنتجات والباقات:</h4>
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.productTitle}</h4>
                      <span className="text-xs text-slate-500">{item.planName} (عدد: {item.quantity})</span>
                    </div>
                    <PriceTag priceMinor={item.priceMinor} size="sm" />
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Credentials Card (If Delivered) */}
            {order.status === 'delivered' && (
              <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-3">
                  <KeyRound className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>بيانات حسابك واستلام الخدمة:</span>
                </div>

                {order.items.map((item, idx) => (
                  item.delivery ? (
                    <div key={idx} className="space-y-2.5 bg-white p-4 rounded-xl border border-emerald-200/80 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">البريد الإلكتروني / الحساب:</span>
                        <div className="flex items-center gap-2">
                          <code className="font-mono bg-slate-100 px-2 py-0.5 rounded font-bold">{item.delivery.accountEmail}</code>
                          <button
                            onClick={() => handleCopy(item.delivery!.accountEmail, `email_${idx}`)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500"
                            title="نسخ"
                          >
                            {copiedKey === `email_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {item.delivery.screenNumber && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">الشاشة المخصصة لك:</span>
                          <span className="font-bold text-slate-900">شاشة رقم {item.delivery.screenNumber}</span>
                        </div>
                      )}

                      {item.delivery.pin && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">رمز قفل الشاشة (PIN):</span>
                          <div className="flex items-center gap-2">
                            <code className="font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-emerald-700">{item.delivery.pin}</code>
                            <button
                              onClick={() => handleCopy(item.delivery!.pin!, `pin_${idx}`)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500"
                              title="نسخ"
                            >
                              {copiedKey === `pin_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {item.delivery.instructions && (
                        <p className="text-slate-600 pt-2 border-t border-slate-100">{item.delivery.instructions}</p>
                      )}
                    </div>
                  ) : null
                ))}
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">المبلغ الإجمالي المدفوع:</span>
              <PriceTag priceMinor={order.totalMinor} size="md" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
