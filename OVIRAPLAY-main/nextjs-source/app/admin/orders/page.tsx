'use client';

import React, { useState } from 'react';
import { Button, PriceTag, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select, Dialog } from '@ovira/ui';
import { Search, CheckCircle2, Clock, KeyRound, Copy, Check } from 'lucide-react';

export default function AdminOrdersPage() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderForCode, setSelectedOrderForCode] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const [orders, setOrders] = useState([
    {
      code: 'OVR-981241',
      customerName: 'أحمد مسعودي',
      customerPhone: '0551234567',
      productTitle: 'Netflix Premium 4K UHD',
      planName: 'شهر واحد',
      totalMinor: 85000,
      paymentMethod: 'بريدي موب',
      status: 'pending_payment',
      date: '2026-11-20 19:45'
    },
    {
      code: 'OVR-981240',
      customerName: 'ياسين بلخير',
      customerPhone: '0662345678',
      productTitle: 'ChatGPT Plus (GPT-4o)',
      planName: 'شهر واحد',
      totalMinor: 380000,
      paymentMethod: 'Chargily Pay',
      status: 'confirmed',
      date: '2026-11-20 19:15'
    },
    {
      code: 'OVR-981239',
      customerName: 'سامي لعور',
      customerPhone: '0773456789',
      productTitle: 'Shahid VIP باقة الرياضة',
      planName: 'شهر واحد',
      totalMinor: 120000,
      paymentMethod: 'Chargily Pay',
      status: 'delivered',
      date: '2026-11-20 17:30'
    }
  ]);

  const handleDeliver = (orderCode: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.code === orderCode ? { ...o, status: 'delivered' } : o))
    );
  };

  const handleGenerateTempCode = (orderCode: string) => {
    setSelectedOrderForCode(orderCode);
    setGeneratedCode('TMP-' + Math.floor(1000 + Math.random() * 9000));
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchesSearch =
      searchTerm.trim() === '' ||
      o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerPhone.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">إدارة ومتابعة طلبات المتجر</h1>
        <p className="text-xs text-slate-500 mt-0.5">معالجة وتأكيد الطلبات، التسليم الآلي، وإصدار أكواد الدخول المؤقتة</p>
      </div>

      {/* Filters and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-72 relative">
          <Input
            placeholder="بحث برقم الطلب، اسم العميل، الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'all', label: 'كل الحالات' },
              { value: 'pending_payment', label: 'بانتظار الدفع' },
              { value: 'confirmed', label: 'مؤكد • جاهز للتسليم' },
              { value: 'delivered', label: 'تم التسليم' }
            ]}
          />
        </div>
      </div>

      {/* Orders Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>كود الطلب</TableHead>
            <TableHead>العميل</TableHead>
            <TableHead>المنتج والباقة</TableHead>
            <TableHead>المبلغ</TableHead>
            <TableHead>طريقة الدفع</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>الإجراءات المتاحة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order) => (
            <TableRow key={order.code}>
              <TableCell className="font-mono font-bold text-[#1684F8]">{order.code}</TableCell>
              <TableCell>
                <span className="font-bold block">{order.customerName}</span>
                <span className="text-[11px] font-mono text-slate-500">{order.customerPhone}</span>
              </TableCell>
              <TableCell>
                <span className="font-bold block">{order.productTitle}</span>
                <span className="text-[11px] text-slate-500">{order.planName}</span>
              </TableCell>
              <TableCell><PriceTag priceMinor={order.totalMinor} size="sm" /></TableCell>
              <TableCell><Badge variant="slate" size="sm">{order.paymentMethod}</Badge></TableCell>
              <TableCell>
                <Badge
                  variant={order.status === 'delivered' ? 'success' : order.status === 'confirmed' ? 'primary' : 'warning'}
                  size="sm"
                >
                  {order.status === 'delivered' ? 'تم التسليم' : order.status === 'confirmed' ? 'مؤكد للتسليم' : 'بانتظار الدفع'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {order.status !== 'delivered' && (
                    <Button variant="primary" size="sm" onClick={() => handleDeliver(order.code)}>
                      تسليم الحساب
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleGenerateTempCode(order.code)}>
                    كود مؤقت
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Temporary Code Modal */}
      <Dialog
        isOpen={!!selectedOrderForCode}
        onClose={() => setSelectedOrderForCode(null)}
        title="كود التسليم المؤقت للاشتراك"
        description={`تم توليد رمز تسليم مؤقت صالح لمرة واحدة للطلب ${selectedOrderForCode}`}
      >
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
          <span className="text-xs text-slate-500 block">رمز الدخول المؤقت:</span>
          <div className="text-3xl font-mono font-black text-[#1684F8] tracking-widest bg-white p-3 rounded-xl border border-slate-200 inline-block">
            {generatedCode}
          </div>
          <p className="text-[11px] text-slate-500">
            يمكنك إرسال هذا الكود للعميل عبر تليغرام لتمكينه من استلام شاشته دون انتظار.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setSelectedOrderForCode(null)}>
            إغلاق
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
