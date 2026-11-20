'use client';

import React, { useState } from 'react';
import { Button, Badge, PriceTag, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Tabs, Dialog, Input, Alert } from '@ovira/ui';
import { Wallet, Tv, Clock, ShieldCheck, KeyRound, LogOut, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('subscriptions');

  // Customer Data State
  const customer = {
    name: 'كريم الجزائري',
    phone: '0555123456',
    email: 'karim@example.com',
    walletBalanceMinor: 250000, // 2,500 DZD
    isTwoFactorEnabled: true,
    createdAt: '2026-10-15'
  };

  const subscriptions = [
    {
      id: 'sub_1',
      title: 'Netflix Premium 4K UHD',
      planName: 'شهر واحد (شاشة خاصة)',
      accountEmail: 'netflix.user14@ovira-dz.com',
      screenNumber: 3,
      pin: '1003',
      expiresAt: '2026-12-20',
      daysRemaining: 30,
      status: 'active'
    },
    {
      id: 'sub_2',
      title: 'Spotify Premium فردي',
      planName: '3 أشهر (تفعيل رسمي)',
      accountEmail: 'karim@example.com',
      expiresAt: '2027-01-15',
      daysRemaining: 56,
      status: 'active'
    }
  ];

  const orders = [
    {
      code: 'OVR-782914',
      date: '2026-11-20',
      totalMinor: 85000,
      status: 'delivered',
      itemsCount: 1,
      paymentMethod: 'بريدي موب'
    },
    {
      code: 'OVR-654120',
      date: '2026-10-15',
      totalMinor: 110000,
      status: 'delivered',
      itemsCount: 1,
      paymentMethod: 'Chargily Pay'
    }
  ];

  const walletLedger = [
    {
      id: 'led_1',
      date: '2026-11-19',
      type: 'credit',
      amountMinor: 300000,
      description: 'شحن رصيد المحفظة عبر بريدي موب',
      balanceAfterMinor: 250000
    },
    {
      id: 'led_2',
      date: '2026-11-20',
      type: 'debit',
      amountMinor: 85000,
      description: 'دفع قيمة الطلب OVR-782914',
      balanceAfterMinor: 250000
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-right">
      {/* Top Profile Summary Card */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 text-[#1684F8] rounded-2xl flex items-center justify-center font-black text-2xl border border-blue-100">
            {customer.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">{customer.name}</h1>
              <Badge variant="success" size="sm">عميل موثق</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              هاتف: <span className="font-mono">{customer.phone}</span> • بريد: {customer.email}
            </p>
          </div>
        </div>

        {/* Wallet Balance Widget */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 w-full md:w-auto justify-between">
          <div>
            <span className="text-[11px] text-slate-500 block mb-0.5">رصيد محفظتك:</span>
            <PriceTag priceMinor={customer.walletBalanceMinor} size="lg" />
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/support')} className="gap-1.5 text-xs">
            <Wallet className="w-4 h-4 text-[#1684F8]" />
            <span>شحن الرصيد</span>
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <Tabs
        tabs={[
          { id: 'subscriptions', label: 'اشتراكاتي النشطة', icon: <Tv className="w-4 h-4" />, badge: subscriptions.length },
          { id: 'orders', label: 'سجل الطلبات', icon: <Clock className="w-4 h-4" />, badge: orders.length },
          { id: 'wallet', label: 'سجل المحفظة الدفتري', icon: <Wallet className="w-4 h-4" /> },
          { id: 'security', label: 'أمان الحساب و 2FA', icon: <ShieldCheck className="w-4 h-4" /> }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {/* Tab: Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-slate-900">{sub.title}</h3>
                    <Badge variant="success" size="sm">نشط • متبقي {sub.daysRemaining} يوم</Badge>
                  </div>
                  <span className="text-xs text-slate-500 block mb-4">{sub.planName}</span>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">حساب الدخول:</span>
                      <code className="font-mono font-bold text-slate-800">{sub.accountEmail}</code>
                    </div>
                    {sub.screenNumber && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">الشاشة الخاصة بك:</span>
                        <span className="font-bold text-slate-800">شاشة {sub.screenNumber}</span>
                      </div>
                    )}
                    {sub.pin && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">رمز قفل الشاشة (PIN):</span>
                        <code className="font-mono font-bold text-emerald-700">{sub.pin}</code>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500">تاريخ الانتهاء:</span>
                      <span className="font-bold text-slate-700">{sub.expiresAt}</span>
                    </div>
                  </div>
                </div>

                <Button variant="primary" size="sm" onClick={() => router.push('/shop')} className="w-full">
                  طلب تجديد هذا الاشتراك
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Orders */}
      {activeTab === 'orders' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الطلب</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>المبلغ الإجمالي</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.code}>
                <TableCell className="font-mono font-bold text-[#1684F8]">{o.code}</TableCell>
                <TableCell>{o.date}</TableCell>
                <TableCell><PriceTag priceMinor={o.totalMinor} size="sm" /></TableCell>
                <TableCell>{o.paymentMethod}</TableCell>
                <TableCell><Badge variant="success" size="sm">تم التسليم</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => router.push('/track')}>
                    عرض التفاصيل
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Tab: Wallet Ledger */}
      {activeTab === 'wallet' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
            <strong>سجل العمليات الدفتري:</strong> جميع حركات الرصيد (الإيداع، الخصم، التعويض) موثقة في دفتر حسابات غير قابل للتعديل لضمان الشفافية والأمان المالي.
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>نوع الحركة</TableHead>
                <TableHead>البيان والتفاصيل</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الرصيد بعد الحركة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {walletLedger.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.date}</TableCell>
                  <TableCell>
                    <Badge variant={w.type === 'credit' ? 'success' : 'primary'} size="sm">
                      {w.type === 'credit' ? 'إيداع' : 'خصم شراء'}
                    </Badge>
                  </TableCell>
                  <TableCell>{w.description}</TableCell>
                  <TableCell>
                    <span className={`font-bold ${w.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {w.type === 'credit' ? '+' : '-'} <PriceTag priceMinor={w.amountMinor} size="sm" />
                    </span>
                  </TableCell>
                  <TableCell><PriceTag priceMinor={w.balanceAfterMinor} size="sm" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab: Security & 2FA */}
      {activeTab === 'security' && (
        <div className="max-w-xl space-y-6">
          <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">المصادقة الثنائية (2FA TOTP)</h3>
                <p className="text-xs text-slate-500 mt-0.5">حماية إضافية لحسابك عبر Google Authenticator أو تليغرام</p>
              </div>
              <Badge variant="success" size="md">مفعلة وحمية</Badge>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              عند تسجيل الدخول من جهاز جديد، سيطلب منك إدخال رمز التحقق المتغير المكون من 6 أرقام لمنع أي دخول غير مصرح به.
            </p>

            <Button variant="outline" size="sm" className="text-xs font-bold">
              إعادة توليد رموز الاسترداد الاحتياطية
            </Button>
          </div>

          <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900">تغيير كلمة المرور</h3>
            <Input label="كلمة المرور الحالية" type="password" placeholder="••••••••" />
            <Input label="كلمة المرور الجديدة" type="password" placeholder="8 أحرف على الأقل" />
            <Button variant="primary" size="md" className="font-bold">
              تحديث كلمة المرور
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
