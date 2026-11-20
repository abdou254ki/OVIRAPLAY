'use client';

import React, { useState } from 'react';
import { Button, PriceTag, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dialog, Input, Select, Alert } from '@ovira/ui';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  Eye,
  Layers,
  ShoppingBag
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const router = useRouter();

  // Metrics State
  const stats = {
    revenueTodayMinor: 2550000,     // 25,500 DZD
    revenueMonthMinor: 78500000,    // 785,000 DZD
    pendingOrdersCount: 4,
    activeSubscriptionsCount: 342,
    lowStockAlertsCount: 1,
    pendingManualPaymentsCount: 2
  };

  // Recent Orders State
  const [orders, setOrders] = useState([
    {
      id: 'ord_1',
      code: 'OVR-981241',
      customerName: 'أحمد مسعودي',
      customerPhone: '0551234567',
      productTitle: 'Netflix Premium 4K UHD',
      planName: 'شهر واحد (شاشة خاصة)',
      totalMinor: 85000,
      paymentMethod: 'بريدي موب',
      status: 'pending_payment',
      date: 'منذ 15 دقيقة'
    },
    {
      id: 'ord_2',
      code: 'OVR-981240',
      customerName: 'ياسين بلخير',
      customerPhone: '0662345678',
      productTitle: 'ChatGPT Plus (GPT-4o)',
      planName: 'شهر واحد (حساب خاص)',
      totalMinor: 380000,
      paymentMethod: 'Chargily Pay',
      status: 'confirmed',
      date: 'منذ 45 دقيقة'
    },
    {
      id: 'ord_3',
      code: 'OVR-981239',
      customerName: 'سامي لعور',
      customerPhone: '0773456789',
      productTitle: 'Shahid VIP باقة الرياضة',
      planName: 'شهر واحد (حساب كامل)',
      totalMinor: 120000,
      paymentMethod: 'Chargily Pay',
      status: 'delivered',
      date: 'منذ ساعتين'
    }
  ]);

  // Manual Order Dialog State
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualProduct, setManualProduct] = useState('netflix-premium');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Delivery action simulation
  const handleDeliverOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'delivered' } : o))
    );
    setActionSuccess('تم تسليم الحساب والشاشة للعميل بنجاح!');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleCreateManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const newOrder = {
        id: 'ord_' + Date.now(),
        code: 'OVR-' + Math.floor(100000 + Math.random() * 900000),
        customerName: manualCustomerName,
        customerPhone: manualPhone,
        productTitle: manualProduct === 'netflix-premium' ? 'Netflix Premium 4K UHD' : 'Spotify Premium فردي',
        planName: 'طلب يدوي معتمد',
        totalMinor: 85000,
        paymentMethod: manualPaymentMethod === 'cash' ? 'نقداً (مكتب)' : 'بريدي موب',
        status: 'confirmed',
        date: 'الآن'
      };

      setOrders([newOrder, ...orders]);
      setIsSubmitting(false);
      setManualOrderOpen(false);
      setManualCustomerName('');
      setManualPhone('');
      setActionSuccess('تم إنشاء الطلب اليدوي وتأكيده بنجاح!');
      setTimeout(() => setActionSuccess(null), 3000);
    }, 600);
  };

  const statusBadges: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' }> = {
    pending_payment: { label: 'بانتظار الدفع', variant: 'warning' },
    confirmed: { label: 'مؤكد • جاهز للتسليم', variant: 'primary' },
    delivered: { label: 'تم التسليم', variant: 'success' },
    cancelled: { label: 'ملغي', variant: 'danger' }
  };

  return (
    <div className="space-y-8">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">مؤشرات الأداء والعمليات اليومية</h1>
          <p className="text-xs text-slate-500 mt-0.5">ملخص النشاط، المبيعات اللحظية، وتوزيع الطلبات</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="primary" size="sm" onClick={() => setManualOrderOpen(true)} className="gap-2 font-bold">
            <Plus className="w-4 h-4" />
            <span>إنشاء طلب يدوي</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => router.push('/admin/stock')} className="gap-2 font-bold">
            <Layers className="w-4 h-4" />
            <span>إدارة المخزون</span>
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <Alert variant="success" title="عملية ناجحة">
          {actionSuccess}
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إيرادات اليوم:</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <PriceTag priceMinor={stats.revenueTodayMinor} size="lg" />
          <span className="text-[11px] text-emerald-600 font-bold block mt-2">+14% عن يوم أمس</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">إيرادات هذا الشهر:</span>
            <div className="p-2 bg-blue-50 text-[#1684F8] rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <PriceTag priceMinor={stats.revenueMonthMinor} size="lg" />
          <span className="text-[11px] text-slate-400 block mt-2">إجمالي الشهر الحالي</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">طلبات بحاجة لمعالجة:</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.pendingOrdersCount} طلبات</div>
          <span className="text-[11px] text-amber-600 font-bold block mt-2">تشمل تحويلات بريدي موب المعلقة</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">الاشتراكات النشطة:</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.activeSubscriptionsCount} شاشة</div>
          <span className="text-[11px] text-slate-400 block mt-2">شاشات وحسابات قيد التشغيل</span>
        </div>
      </div>

      {/* Recent Orders Management Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">أحدث طلبات الزبائن</h3>
            <p className="text-xs text-slate-400 mt-0.5">معاينة الطلبات وإجراء التسليم الفوري وتأكيد التحويلات</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/orders')}>
            عرض جميع الطلبات
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الطلب</TableHead>
              <TableHead>العميل والهاتف</TableHead>
              <TableHead>المنتج والباقة</TableHead>
              <TableHead>المبلغ الإجمالي</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراء سريع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const currentBadge = statusBadges[order.status] || { label: order.status, variant: 'primary' };
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-bold text-[#1684F8]">
                    {order.code}
                    <span className="block text-[10px] text-slate-400 font-normal">{order.date}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold block">{order.customerName}</span>
                    <span className="text-[11px] font-mono text-slate-500">{order.customerPhone}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold block">{order.productTitle}</span>
                    <span className="text-[11px] text-slate-500">{order.planName}</span>
                  </TableCell>
                  <TableCell>
                    <PriceTag priceMinor={order.totalMinor} size="sm" />
                  </TableCell>
                  <TableCell>
                    <Badge variant="slate" size="sm">{order.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={currentBadge.variant} size="sm">{currentBadge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {order.status === 'confirmed' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleDeliverOrder(order.id)}
                        className="text-xs font-bold"
                      >
                        تسليم آلي الآن
                      </Button>
                    ) : order.status === 'pending_payment' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeliverOrder(order.id)}
                        className="text-xs font-bold"
                      >
                        تأكيد التحويل والتسليم
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تم التسليم</span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Manual Order Creation Modal Dialog */}
      <Dialog
        isOpen={manualOrderOpen}
        onClose={() => setManualOrderOpen(false)}
        title="إنشاء طلب يدوي جديد (Manual Order)"
        description="تسجيل طلب وارد عبر مكالمة هاتفية أو محادثة تليغرام مع منع التكرار"
      >
        <form onSubmit={handleCreateManualOrder} className="space-y-4">
          <Input
            label="اسم العميل"
            placeholder="مثال: يوسف العربي"
            required
            value={manualCustomerName}
            onChange={(e) => setManualCustomerName(e.target.value)}
          />

          <Input
            label="رقم الهاتف الجزائري"
            placeholder="05 / 06 / 07XXXXXXXX"
            required
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
          />

          <Select
            label="المنتج المطلوب"
            value={manualProduct}
            onChange={(e) => setManualProduct(e.target.value)}
            options={[
              { value: 'netflix-premium', label: 'Netflix Premium 4K UHD (850 د.ج)' },
              { value: 'shahid-vip-sports', label: 'Shahid VIP باقة الرياضة (1,200 د.ج)' },
              { value: 'chatgpt-plus', label: 'ChatGPT Plus (GPT-4o) (3,800 د.ج)' },
              { value: 'spotify-premium', label: 'Spotify Premium فردي (1,100 د.ج)' }
            ]}
          />

          <Select
            label="طريقة الاستلام والدفع"
            value={manualPaymentMethod}
            onChange={(e) => setManualPaymentMethod(e.target.value)}
            options={[
              { value: 'cash', label: 'دفع نقدي (تسليم فوري)' },
              { value: 'baridimob', label: 'تحويل بريدي موب تم التحقق منه' },
              { value: 'ccp', label: 'وصل حوالة CCP معتمد' }
            ]}
          />

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" type="button" onClick={() => setManualOrderOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              تأكيد وحجز الطلب
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
