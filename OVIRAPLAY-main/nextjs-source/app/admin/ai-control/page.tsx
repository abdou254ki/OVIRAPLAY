'use client';

import React, { useState } from 'react';
import { Button, Badge, Alert } from '@ovira/ui';
import { Cpu, Power, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminAiControlPage() {
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [autoDrafts, setAutoDrafts] = useState(true);
  const [autoFaq, setAutoFaq] = useState(false);
  const [killSwitchAlert, setKillSwitchAlert] = useState<string | null>(null);

  const toggleKillSwitch = () => {
    if (isAiEnabled) {
      setIsAiEnabled(false);
      setAutoDrafts(false);
      setAutoFaq(false);
      setKillSwitchAlert('تم تفعيل زر الطوارئ (Kill-Switch) بنجاح وإيقاف جميع خدمات ووكلاء الذكاء الاصطناعي فوراً.');
    } else {
      setIsAiEnabled(true);
      setAutoDrafts(true);
      setKillSwitchAlert('تمت استعادة اتصال خدمات الذكاء الاصطناعي بنجاح.');
    }
    setTimeout(() => setKillSwitchAlert(null), 4000);
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">التحكم في خدمات الذكاء الاصطناعي والأتمتة</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          إدارة صلاحيات وكلاء الذكاء الاصطناعي، مسودات الردود التلقائية، وزر الإيقاف الطارئ الفوري
        </p>
      </div>

      {killSwitchAlert && (
        <Alert variant={isAiEnabled ? 'success' : 'danger'} title="تنبيه الأمان">
          {killSwitchAlert}
        </Alert>
      )}

      {/* Emergency Kill Switch Card */}
      <div className={`p-6 rounded-3xl border transition-all ${
        isAiEnabled ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-red-50/60 border-red-200 shadow-md'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isAiEnabled ? 'bg-blue-50 text-[#1684F8]' : 'bg-red-100 text-red-600'
            }`}>
              <Power className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">زر الطوارئ الفوري (Emergency Kill Switch)</h3>
                <Badge variant={isAiEnabled ? 'success' : 'danger'} size="sm">
                  {isAiEnabled ? 'الخدمة نشطة' : 'متوقفة تماماً'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                خاصية حصرية للمالك تتيح قطع الاتصال الفوري بنماذج الذكاء الاصطناعي في حالات الطوارئ.
              </p>
            </div>
          </div>

          <Button
            variant={isAiEnabled ? 'danger' : 'primary'}
            size="md"
            onClick={toggleKillSwitch}
            className="font-bold shrink-0 gap-2"
          >
            <Power className="w-4 h-4" />
            <span>{isAiEnabled ? 'إيقاف طارئ شامل' : 'استعادة التشغيل'}</span>
          </Button>
        </div>

        {/* Feature Switches */}
        <div className="pt-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <h4 className="font-bold text-xs text-slate-900">توليد مسودات الردود للدعم الفني (Draft Auto-Replies)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">اقتراح ردود ذكية لموظفي الدعم الفني دون إرسالها للعميل تلقائياً</p>
            </div>
            <input
              type="checkbox"
              checked={autoDrafts}
              disabled={!isAiEnabled}
              onChange={(e) => setAutoDrafts(e.target.checked)}
              className="w-4 h-4 text-[#1684F8] rounded focus:ring-[#1684F8]"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <h4 className="font-bold text-xs text-slate-900">توليد الأسئلة الشائعة آلياً (Auto-FAQ Generation)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">تحليل استفسارات الزبائن المتكررة واقتراح إضافتها لصفحات المنتجات</p>
            </div>
            <input
              type="checkbox"
              checked={autoFaq}
              disabled={!isAiEnabled}
              onChange={(e) => setAutoFaq(e.target.checked)}
              className="w-4 h-4 text-[#1684F8] rounded focus:ring-[#1684F8]"
            />
          </div>
        </div>
      </div>

      {/* Safety & Cost Quota Widget */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900">محددات الاستهلاك وحدود الأمان</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          تم ضبط سقف الاستهلاك اليومي للذكاء الاصطناعي لمنع الهجمات الموجهة وتفادي استنزاف الرصيد.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">الحد اليومي للطلبات:</span>
            <span className="font-bold text-sm text-slate-800">500 طلب / يوم</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">المستهلك اليوم:</span>
            <span className="font-bold text-sm text-[#1684F8]">14 طلب (2.8%)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">حالة المزود:</span>
            <span className="font-bold text-sm text-emerald-600">طبيعي وآمن</span>
          </div>
        </div>
      </div>
    </div>
  );
}
