import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-right">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">شروط الاستخدام والخدمة</h1>
      
      <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-slate-900 mb-2">1. طبيعة الخدمات المقدمة</h2>
          <p>
            يقدم متجر OVIRA PLAY خدمات توزيع وتفعيل الاشتراكات الرقمية وخدمات البث والبرمجيات السحابية بالدينار الجزائري، مع الالتزام التام بتقديم حسابات رسمية وضمان كامل مدة الاشتراك المتفق عليها.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900 mb-2">2. شروط استخدام الحسابات المشتركة</h2>
          <p>
            في حال شراء باقة شاشة خاصة (Shared Screen):
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-slate-600">
            <li>يلتزم العميل بالدخول إلى شاشته المحددة فقط وعدم الدخول لشاشات المشتركين الآخرين.</li>
            <li>يمنع منعاً باتاً محاولة تغيير كلمة المرور الرئيسية للحساب أو تعديل إعدادات الدفع.</li>
            <li>أي محاولة لتغيير بيانات الحساب تؤدي إلى إلغاء الضمان وإيقاف الخدمة تلقائياً دون تعويض.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900 mb-2">3. سياسة الضمان والاستبدال</h2>
          <p>
            نضمن عمل الاشتراك طوال المدة المحددة في الفاتورة (30 يوماً، 90 يوماً، 365 يوماً). في حال حدوث أي توقف ناجم عن عطل في الحساب، يلتزم فريق الدعم الفني بإصلاح الخلل أو تزويد العميل بحساب بديل فوري خلال مدة لا تتجاوز 24 ساعة عمل.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900 mb-2">4. الدفع واسترداد الأموال</h2>
          <p>
            يتم قبول المدفوعات عبر تطبيق بريدي موب (BaridiMob) والحوالات البريدية CCP والبطاقة الذهبية عبر بوابة Chargily Pay. المبالغ المدفوعة غير قابلة للاسترجاع النقدي إلا في حال تعذر تقديم الخدمة أو تعويض العميل بحساب صالح.
          </p>
        </section>
      </div>
    </div>
  );
}
