'use client';

import React, { useState } from 'react';
import { Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dialog, Input, Select, Alert } from '@ovira/ui';
import { Layers, Plus, ShieldCheck, KeyRound, Eye, EyeOff, Lock } from 'lucide-react';

export default function AdminStockPage() {
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [revealSecretOpen, setRevealSecretOpen] = useState(false);
  const [selectedAccountEmail, setSelectedAccountEmail] = useState('');
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [stepUpPassword, setStepUpPassword] = useState('');
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const [stockAccounts, setStockAccounts] = useState([
    {
      id: 'stk_1',
      productTitle: 'Netflix Premium 4K UHD',
      accountIdentifier: 'netflix.master01@ovira-dz.com',
      encryptionStatus: 'AES-256-GCM (v1)',
      totalScreens: 5,
      occupiedScreens: 4,
      expiresAt: '2026-12-20',
      status: 'active'
    },
    {
      id: 'stk_2',
      productTitle: 'Netflix Premium 4K UHD',
      accountIdentifier: 'netflix.master02@ovira-dz.com',
      encryptionStatus: 'AES-256-GCM (v1)',
      totalScreens: 5,
      occupiedScreens: 1,
      expiresAt: '2027-01-10',
      status: 'active'
    },
    {
      id: 'stk_3',
      productTitle: 'ChatGPT Plus (GPT-4o)',
      accountIdentifier: 'chatgpt.team01@ovira-dz.com',
      encryptionStatus: 'AES-256-GCM (v1)',
      totalScreens: 1,
      occupiedScreens: 0,
      expiresAt: '2026-12-15',
      status: 'active'
    }
  ]);

  const handleRevealClick = (email: string) => {
    setSelectedAccountEmail(email);
    setRevealedPassword(null);
    setStepUpPassword('');
    setStepUpError(null);
    setRevealSecretOpen(true);
  };

  const handleConfirmStepUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (stepUpPassword.length < 6) {
      setStepUpError('كلمة مرور المالك غير صحيحة');
      return;
    }
    // Verified decryption simulation
    setRevealedPassword('MasterPass2026!Secured');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">إدارة المخزون والشاشات المخصصة</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            حسابات المخزون مشفرة بـ AES-256-GCM وتخصيص ذري لكل شاشة لمنع التكرار
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setAddAccountOpen(true)} className="gap-2 font-bold">
          <Plus className="w-4 h-4" />
          <span>إضافة حساب مخزون جديد</span>
        </Button>
      </div>

      {/* Security Invariant Callout */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <strong className="block font-bold">معايير الأمان الإلزامية للمخزون:</strong>
          <span>جميع كلمات المرور مخزنة بتشفير موثق (Authenticated Encryption) ولا تظهر إطلاقاً في السجلات العامة، وكشفها يتطلب مصادقة المالك (Step-Up Auth).</span>
        </div>
      </div>

      {/* Stock Accounts Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المنتج التابع</TableHead>
            <TableHead>معرف الحساب (Email)</TableHead>
            <TableHead>حالة التشفير</TableHead>
            <TableHead>الشاشات الشاغرة</TableHead>
            <TableHead>تاريخ الصلاحية</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجراءات الأمان</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockAccounts.map((account) => {
            const available = account.totalScreens - account.occupiedScreens;
            return (
              <TableRow key={account.id}>
                <TableCell className="font-bold">{account.productTitle}</TableCell>
                <TableCell className="font-mono text-xs">{account.accountIdentifier}</TableCell>
                <TableCell>
                  <Badge variant="success" size="sm">{account.encryptionStatus}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">{account.occupiedScreens} / {account.totalScreens}</span>
                    <Badge variant={available > 0 ? 'primary' : 'danger'} size="sm">
                      {available > 0 ? `${available} متاحة` : 'مكتمل'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{account.expiresAt}</TableCell>
                <TableCell><Badge variant="success" size="sm">نشط</Badge></TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevealClick(account.accountIdentifier)}
                    className="gap-1.5 text-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>كشف السر</span>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Step-Up Secret Reveal Dialog */}
      <Dialog
        isOpen={revealSecretOpen}
        onClose={() => setRevealSecretOpen(false)}
        title="كشف كلمة مرور الحساب (Owner Step-Up)"
        description={`عرض البيانات السرية للحساب: ${selectedAccountEmail}`}
      >
        {!revealedPassword ? (
          <form onSubmit={handleConfirmStepUp} className="space-y-4">
            <div className="p-3.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>هذا الإجراء مسجل في سجل التدقيق الأمني Audit Trail. يتطلب إدخال كلمة مرور المالك.</span>
            </div>

            {stepUpError && <Alert variant="danger">{stepUpError}</Alert>}

            <Input
              label="تأكيد كلمة مرور المشرف (المالك)"
              type="password"
              placeholder="••••••••"
              required
              value={stepUpPassword}
              onChange={(e) => setStepUpPassword(e.target.value)}
            />

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="outline" size="sm" type="button" onClick={() => setRevealSecretOpen(false)}>
                إلغاء
              </Button>
              <Button variant="primary" size="sm" type="submit">
                فك التشفير والمصادقة
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
              <span className="text-xs text-slate-500 block">كلمة المرور المفكوكة:</span>
              <div className="font-mono font-black text-lg bg-white p-3 rounded-xl border border-slate-200 text-slate-900 inline-block">
                {revealedPassword}
              </div>
            </div>

            <Button variant="primary" size="sm" onClick={() => setRevealSecretOpen(false)} className="w-full">
              إغلاق وحماية السر
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
