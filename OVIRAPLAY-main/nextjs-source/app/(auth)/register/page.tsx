'use client';

import React, { useState } from 'react';
import { Button, Input, Alert } from '@ovira/ui';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phoneRegex = /^(05|06|07)[0-9]{8}$/;
    if (!phoneRegex.test(phone.trim())) {
      setError('يرجى إدخال رقم هاتف جزائري صحيح يبدأ بـ 05 أو 06 أو 07 ويتكون من 10 أرقام');
      return;
    }

    if (password.length < 8) {
      setError('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل');
      return;
    }

    setIsLoading(true);

    try {
      // In dev or connected backend, register customer
      router.push('/account');
    } catch {
      setError('حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة ثانية');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-right">
      <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#1684F8] text-white rounded-2xl flex items-center justify-center mx-auto mb-3 font-black text-xl shadow-sm">
            O
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">إنشاء حساب جديد</h1>
          <p className="text-xs text-slate-500 mt-1">انضم لمتجر OVIRA PLAY واستمتع بإدارة اشتراكاتك بسهولة</p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            label="الاسم الكامل"
            placeholder="مثال: كريم الجزائري"
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
            helperText="مطلوب لتأكيد الدخول وتسليم الاشتراكات"
          />

          <Input
            label="البريد الإلكتروني"
            type="email"
            placeholder="example@mail.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="كلمة المرور"
            type="password"
            placeholder="8 أحرف على الأقل"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full font-bold mt-2">
            إنشاء الحساب
          </Button>
        </form>

        <p className="text-xs text-slate-600 text-center mt-6 pt-6 border-t border-slate-100">
          لديك حساب بالفعل؟{' '}
          <a href="/login" className="text-[#1684F8] font-bold hover:underline">
            تسجيل الدخول
          </a>
        </p>
      </div>
    </div>
  );
}
