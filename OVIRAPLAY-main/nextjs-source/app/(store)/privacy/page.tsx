import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-right">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">سياسة الخصوصية وحماية البيانات</h1>
      
      <div className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-slate-900 mb-2">1. جمع البيانات واستخدامها</h2>
          <p>
            نحن في OVIRA PLAY نلتزم بالحفاظ على خصوصية زوارنا وعملائنا الكرام. نجمع فقط البيانات الضرورية لتنفيذ وتأكيد طلبات الشراء مثل: الاسم، رقم الهاتف الجزائري لتسليم الخدمة، والبريد الإلكتروني لإرسال الفواتير.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900 mb-2">2. حماية بيانات الدفع</h2>
          <p>
            لا يقوم متجرنا إطلاقاً بتخزين أرقام بطاقاتكم الائتمانية أو بطاقات الشفاء أو البطاقة الذهبية أو رموز CVV. تتم جميع عمليات الدفع الإلكتروني عبر بوابة Chargily Pay الرسمية المشفرة وفق أعلى معايير الأمان المصرفية العالمية PCI-DSS.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900 mb-2">3. عدم مشاركة البيانات مع أطراف ثالثة</h2>
          <p>
            نتعهد بشكل صارم بعدم بيع أو تأجير أو مشاركة بيانات عملائنا مع أي جهة تسويقية خارجية. تستخدم بياناتك حصراً للتواصل معك بشأن طلباتك النشطة وتحديثات الاشتراكات.
          </p>
        </section>
      </div>
    </div>
  );
}
