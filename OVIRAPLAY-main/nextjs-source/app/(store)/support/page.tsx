'use client';

import React, { useState } from 'react';
import { Button, Input, Select, Alert } from '@ovira/ui';
import { Headphones, Send, MessageSquare, CheckCircle2 } from 'lucide-react';

export default function SupportPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [issueType, setIssueType] = useState('account_issue');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setName('');
      setPhone('');
      setOrderCode('');
      setMessage('');
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-right">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">مركز الدعم والمساعدة الفنية</h1>
        <p className="text-xs text-slate-500 mt-1">فريقنا متواجد على مدار الساعة لمساعدتك في أي استفسار أو مشكلة تواجهك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Support Channels Card */}
        <div className="md:col-span-5 space-y-4">
          <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-[#1684F8] rounded-2xl flex items-center justify-center mb-4">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">تواصل مباشر وسريع</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              للحصول على استجابة فورية، يمكنك مراسلة فريق خدمة العملاء مباشرة عبر قنواتنا المعتمدة:
            </p>

            <div className="space-y-3">
              <a
                href="https://t.me/oviraplay_support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-blue-50 text-[#1684F8] font-bold text-xs hover:bg-blue-100 transition-colors"
              >
                <span>محادثة تليغرام المباشرة</span>
                <Send className="w-4 h-4 rotate-180" />
              </a>

              <a
                href="https://wa.me/213550000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-colors"
              >
                <span>دعم واتساب (WhatsApp Support)</span>
                <MessageSquare className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Complaint / Ticket Form */}
        <div className="md:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 mb-4 pb-3 border-b border-slate-100">
            إرسال استفسار أو شكوى بخصوص طلب
          </h3>

          {isSuccess && (
            <div className="mb-4">
              <Alert variant="success" title="تم استلام طلبك بنجاح!">
                شكراً لتواصلك معنا. سيقوم أحد مسؤولي الدعم بمراجعة طلبك والتواصل معك عبر هاتفك خلال مدة وجيزة.
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="الاسم الكامل"
              placeholder="اسمك الكريم"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="رقم الهاتف للتواصل"
              placeholder="05 / 06 / 07XXXXXXXX"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="رقم الطلب (إن وجد)"
              placeholder="مثال: OVR-123456"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
            />

            <Select
              label="نوع المشكلة أو الاستفسار"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              options={[
                { value: 'account_issue', label: 'مشكلة في تسجيل الدخول إلى الحساب أو الشاشة' },
                { value: 'renewal_help', label: 'استفسار حول تجديد الاشتراك' },
                { value: 'payment_check', label: 'التحقق من حالة تحويل بريدي موب أو CCP' },
                { value: 'other', label: 'استفسار عام آخر' }
              ]}
            />

            <div className="text-right">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">تفاصيل المشكلة أو الرسالة</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اشرح المشكلة بالتفصيل لنتمكن من مساعدتك بأسرع شكل..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#1684F8] focus:ring-2 focus:ring-[#1684F8]/20 text-sm placeholder:text-slate-400 outline-none transition-colors"
              />
            </div>

            <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full font-bold">
              إرسال تذكرة الدعم
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
