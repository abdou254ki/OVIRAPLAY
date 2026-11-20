import React from 'react';
import { ShieldCheck, Zap, Headphones } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16 text-right">
      {/* Guarantees Bar */}
      <div className="border-b border-slate-100 py-6 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-[#1684F8] rounded-xl shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-slate-900">تسليم آلي سريع</h5>
              <p className="text-[11px] text-slate-500">استلام فوري لمعلومات الحساب بعد الدفع مباشرة.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-slate-900">ضمان ذهبي كامل المدة</h5>
              <p className="text-[11px] text-slate-500">تعويض فوري أو استبدال في حال حدوث أي خلل.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-slate-900">دعم فني متواصل</h5>
              <p className="text-[11px] text-slate-500">فريق جزائري مخصص لمساعدتك عبر الواتساب وتليغرام.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#1684F8] flex items-center justify-center text-white font-black text-base">
              O
            </div>
            <span className="font-extrabold text-base text-slate-900">OVIRA PLAY</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-4">
            المنصة الجزائرية الموثوقة للاشتراكات الرقمية وخدمات البث والذكاء الاصطناعي، نوفر حلول دفع محلية سهلة ومريحة مع تفعيل فوري.
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>طرق الدفع المعتمدة:</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">بريدي موب</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">CCP</span>
            <span className="px-2 py-0.5 bg-blue-50 text-[#1684F8] rounded">Chargily Pay</span>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-xs text-slate-900 mb-3">روابط سريعة</h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li><a href="/shop" className="hover:text-[#1684F8]">كتالوج المنتجات</a></li>
            <li><a href="/track" className="hover:text-[#1684F8]">تتبع حالة طلبي</a></li>
            <li><a href="/account" className="hover:text-[#1684F8]">حسابي واشتراكاتي</a></li>
            <li><a href="/support" className="hover:text-[#1684F8]">مركز الدعم والشكاوى</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-xs text-slate-900 mb-3">معلومات قانونية</h4>
          <ul className="space-y-2 text-xs text-slate-600">
            <li><a href="/terms" className="hover:text-[#1684F8]">شروط الاستخدام والخدمة</a></li>
            <li><a href="/privacy" className="hover:text-[#1684F8]">سياسة الخصوصية وحماية البيانات</a></li>
            <li><a href="/guarantee" className="hover:text-[#1684F8]">سياسة الضمان والاسترجاع</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100 py-4 text-center text-[11px] text-slate-400">
        <p>© {new Date().getFullYear()} OVIRA PLAY V5. جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  );
}
