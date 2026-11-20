'use client';

import React, { useState } from 'react';
import { Button, Input, Alert } from '@ovira/ui';
import { useRouter } from 'next/navigation';
import { ShieldCheck, KeyRound, Send } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA step
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (requires2FA) {
        if (!/^[0-9]{6}$/.test(twoFactorCode.trim())) {
          setError('رمز التحقق يجب أن يتكون من 6 أرقام');
          setIsLoading(false);
          return;
        }
        // Simulated successful 2FA
        router.push('/account');
        return;
      }

      // Check credentials
      if (identifier.trim().length < 3 || password.length < 6) {
        setError('يرجى التأكد من كتابة البريد/الهاتف وكلمة المرور بشكل صحيح');
        setIsLoading(false);
        return;
      }

      // Call API or simulate login
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password })
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        if (json.data?.requires2FA) {
          setRequires2FA(true);
        } else {
          router.push('/account');
        }
      } else {
        // Fallback simulation for local dev
        if (password === 'password123' || password.length >= 6) {
          router.push('/account');
        } else {
          setError('بيانات الدخول غير صحيحة، يرجى التحقق من كلمة المرور');
        }
      }
    } catch {
      setError('حدث خطأ أثناء محاولة تسجيل الدخول، يرجى المحاولة لاحقاً');
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
          <h1 className="text-xl font-extrabold text-slate-900">
            {requires2FA ? 'المصادقة الثنائية (2FA)' : 'تسجيل الدخول إلى حسابك'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {requires2FA ? 'أدخل رمز التحقق المكون من 6 أرقام لتأكيد هويتك' : 'تابع اشتراكاتك وطلباتك المسلمة بكل سهولة وأمان'}
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {!requires2FA ? (
            <>
              <Input
                label="البريد الإلكتروني أو رقم الهاتف"
                placeholder="05XXXXXXXX أو mail@example.com"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />

              <Input
                label="كلمة المرور"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <a href="/forgot-password" className="text-[#1684F8] font-bold hover:underline">
                  نسيت كلمة المرور؟
                </a>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Input
                label="رمز التحقق (Authenticator Code)"
                placeholder="000000"
                maxLength={6}
                required
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="text-center font-mono text-lg tracking-widest"
              />
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full font-bold">
            {requires2FA ? 'تأكيد ودخول' : 'تسجيل الدخول'}
          </Button>
        </form>

        {!requires2FA && (
          <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-3">
            <span className="text-xs text-slate-400 block">أو تسجيل الدخول السريع عبر:</span>
            
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => router.push('/account')}
                className="flex items-center justify-center gap-2 p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/account')}
                className="flex items-center justify-center gap-2 p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-[#1684F8] rotate-180" />
                <span>Telegram</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-4">
              ليس لديك حساب بعد؟{' '}
              <a href="/register" className="text-[#1684F8] font-bold hover:underline">
                إنشاء حساب جديد
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
