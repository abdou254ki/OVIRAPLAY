'use client';

import React, { useState } from 'react';
import { Breadcrumb, PlanSelect, Button, Badge, PriceTag, Alert } from '@ovira/ui';
import { useCart } from '@/components/CartProvider';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Check, Star, ShoppingBag } from 'lucide-react';

export interface ProductData {
  id: string;
  slug: string;
  title: string;
  category: string;
  tagline: string;
  description: string;
  image: string;
  badge?: string;
  plans: Array<{
    id: string;
    name: string;
    durationDays: number;
    priceMinor: number;
    originalPriceMinor?: number;
    isPopular?: boolean;
    features?: string[];
  }>;
  features: string[];
  faqs: Array<{ question: string; answer: string }>;
  guaranteeText: string;
  ratingAverage: number;
  ratingCount: number;
}

export const productsDatabase: Record<string, ProductData> = {
  'netflix-premium': {
    id: 'prod_netflix',
    slug: 'netflix-premium',
    title: 'Netflix Premium 4K UHD (شاشة خاصة)',
    category: 'ترفيه وبث',
    tagline: 'شاشة خاصة برمز PIN بجودة 4K فائقة الوضوح وضمان ذهبي',
    description: 'اشتراك نتفلكس بريميوم رسمي بجودة 4K UHD فائقة الوضوح. نوفر لك شاشة خاصة ومستقلة تماماً برمز PIN خاص بك، لضمان استمرارية المشاهدة بدون أي مقاطعة وعلى جميع أجهزتك الذكية.',
    image: 'https://assets.nflxext.com/ffe/siteui/common/icons/monogram/netflix_icon.png',
    badge: 'الأكثر طلباً',
    plans: [
      {
        id: 'plan_netflix_1m',
        name: 'اشتراك شهر واحد (30 يوماً)',
        durationDays: 30,
        priceMinor: 85000,
        originalPriceMinor: 100000,
        isPopular: true,
        features: ['شاشة خاصة ومستقلة 100%', 'رمز PIN سري على الشاشة', 'جودة 4K Ultra HD فائقة الدقة', 'ضمان رسمي كامل 30 يوماً']
      },
      {
        id: 'plan_netflix_3m',
        name: 'اشتراك 3 أشهر (90 يوماً)',
        durationDays: 90,
        priceMinor: 240000,
        originalPriceMinor: 285000,
        isPopular: false,
        features: ['نفس الحساب طوال 3 أشهر', 'تجديد تلقائي بدون تغيير الشاشة', 'جودة 4K Ultra HD', 'ضمان ذهبي ممتد طوال المدة']
      }
    ],
    features: [
      'شاشة مستقلة خاصة بك تماماً مع قفل برمز PIN سري',
      'دقة بث فائقة 4K Ultra HD مع دعم تقنية الصوت المحيطي Spatial Audio',
      'إمكانية التحميل والمشاهدة بدون إنترنت على الهاتف أو التابلت',
      'تعمل على جميع الأجهزة: التلفزيون الذكي، الكمبيوتر، الهواتف الذكية وApple TV',
      'ضمان ذهبي رسمي طوال فترة الاشتراك مع دعم فني فوري'
    ],
    faqs: [
      {
        question: 'كيف أستلم معلومات الحساب بعد الدفع؟',
        answer: 'يتم تسليم البريد الإلكتروني وكلمة المرور ورقم الشاشة الخاصة بك مع رمز PIN تلقائياً وفورياً على صفحة تتبع الطلب ورسالة تأكيد.'
      },
      {
        question: 'هل يمكنني تغيير كلمة المرور الرئيسية للحساب؟',
        answer: 'للحفاظ على الضمان واستقرار الاشتراك، يمنع تغيير كلمة المرور الرئيسية. يمكنك قفل شاشتك برمز PIN خاص بك بكل حرية.'
      }
    ],
    guaranteeText: 'ضمان كامل المدة مع تعويض أو استبدال فوري عند أي خلل',
    ratingAverage: 4.9,
    ratingCount: 342
  },
  'shahid-vip': {
    id: 'prod_shahid',
    slug: 'shahid-vip',
    title: 'Shahid VIP (شاهد VIP شامل المسلسلات والرياضة)',
    category: 'ترفيه وبث',
    tagline: 'مكتبة شاهد الحصرية وعروض قبل التلفزيون بدقة Full HD',
    description: 'استمتع بأضخم مكتبة للمسلسلات والأفلام العربية الحصرية وعروض شاهد الأصلية بدون فواصل إعلانية وبجودة فائقة الوضوح Full HD.',
    image: 'https://shahid.mbc.net/static/images/shahid-logo.svg',
    badge: 'عرض خاص',
    plans: [
      {
        id: 'plan_shahid_1m',
        name: 'اشتراك شهر واحد (VIP)',
        durationDays: 30,
        priceMinor: 65000,
        originalPriceMinor: 80000,
        isPopular: true,
        features: ['شاشة خاصة برمز PIN', 'بدون أي إعلانات', 'أعمال شاهد الأصلية الحصرية', 'دقة Full HD فائقة']
      }
    ],
    features: [
      'عروض حصرية أولاً بأول قبل شاشة التلفزيون',
      'بث قنوات MBC بجودة فائقة الدقة',
      'تنزيل المحتوى للمشاهدة أوفلاين بدون إنترنت',
      'ضمان شامل طوال مدة الاشتراك'
    ],
    faqs: [
      {
        question: 'هل يشمل الاشتراك المباريات الرياضية؟',
        answer: 'هذه الباقة مخصصة للمسلسلات والأفلام وبرامج VIP. لباقات الرياضة يرجى التواصل مع الدعم الفني.'
      }
    ],
    guaranteeText: 'ضمان كامل المدة مع تعويض فوري',
    ratingAverage: 4.8,
    ratingCount: 198
  },
  'chatgpt-plus': {
    id: 'prod_chatgpt',
    slug: 'chatgpt-plus',
    title: 'ChatGPT Plus (GPT-4o)',
    category: 'ذكاء اصطناعي',
    tagline: 'وصول لـ GPT-4o وتوليد الصور بـ DALL-E 3 وتحليل البيانات',
    description: 'اشتراك شات جي بي تي بلس الرسمي. أسرع وأقوى نماذج الذكاء الاصطناعي مع إمكانية إنشاء الروبوتات المخصصة GPTs وتوليد الصور عالية الدقة وتحليل الأكواد والملفات المعقدة.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
    badge: 'ذكاء اصطناعي',
    plans: [
      {
        id: 'plan_chatgpt_1m',
        name: 'شهر واحد (حساب خاص)',
        durationDays: 30,
        priceMinor: 380000,
        originalPriceMinor: 420000,
        isPopular: true,
        features: ['وصول فوري لنموذج GPT-4o', 'توليد صور احترافية بـ DALL-E 3', 'ميزات البحث المباشر في الويب', 'حساب خاص بالكامل']
      }
    ],
    features: [
      'وصول كامل وحصري لأحدث قدرات الذكاء الاصطناعي من OpenAI',
      'استخدام غير محدود لأدوات تحليل البيانات والبرمجة',
      'حساب خاص بالكامل ببريد إلكتروني وكلمة مرور مستقلة'
    ],
    faqs: [
      {
        question: 'هل يمكنني استخدام الحساب على أكثر من جهاز؟',
        answer: 'نعم، يمكنك تسجيل الدخول إلى حسابك على الهاتف، الحاسوب، والمتصفح دون قيود.'
      }
    ],
    guaranteeText: 'حساب خاص ومضمون 100% طوال الشهر',
    ratingAverage: 5.0,
    ratingCount: 87
  },
  'spotify-premium': {
    id: 'prod_spotify',
    slug: 'spotify-premium',
    title: 'Spotify Premium Individual',
    category: 'موسيقى وصوتيات',
    tagline: 'موسيقى بدون إعلانات وتحميل أوفلاين بجودة صوت فائقة',
    description: 'استمع إلى ملايين الأغاني والبودكاست بدون انقطاع وبدون فواصل إعلانية، مع إمكانية التحميل والاستماع أوفلاين على هاتفك أو حاسوبك بجودة صوت استثنائية.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
    badge: 'صوت نقي',
    plans: [
      {
        id: 'plan_spotify_3m',
        name: 'اشتراك 3 أشهر فردي',
        durationDays: 90,
        priceMinor: 150000,
        originalPriceMinor: 180000,
        isPopular: true,
        features: ['تفعيل رسمي على حسابك الشخصي', 'بدون أي إعلانات نهائياً', 'تحميل الأغاني بدون إنترنت', 'جودة صوت عالية جداً 320kbps']
      }
    ],
    features: [
      'تخطي غير محدود للأغاني في أي وقت',
      'جودة صوت نقية وفائقة الوضوح (Very High Quality)',
      'تفعيل رسمي وقانوني على بريدك الإلكتروني الخاص',
      'يعمل في الجزائر وجميع دول العالم بدون VPN'
    ],
    faqs: [
      {
        question: 'هل يتم التفعيل على حسابي الحالي؟',
        answer: 'نعم، نوفر خيار التفعيل على حسابك الشخصي الحالي أو تزويدك بحساب جديد مفعّل جاهز.'
      }
    ],
    guaranteeText: 'ضمان كامل المدة 90 يوماً متواصلة',
    ratingAverage: 4.9,
    ratingCount: 145
  }
};

export function ProductClientView({ slug }: { slug: string }) {
  const router = useRouter();
  const { addItem } = useCart();

  const product = productsDatabase[slug] || productsDatabase['netflix-premium'];
  const [selectedPlanId, setSelectedPlanId] = useState(product.plans[0]?.id || '');
  const [addedSuccess, setAddedSuccess] = useState(false);

  const selectedPlan = product.plans.find((p) => p.id === selectedPlanId) || product.plans[0]!;

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productTitle: product.title,
      productSlug: product.slug,
      productImage: product.image,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      durationDays: selectedPlan.durationDays,
      priceMinor: selectedPlan.priceMinor
    });
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  const handleInstantBuy = () => {
    handleAddToCart();
    router.push('/cart');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: 'الرئيسية', href: '/' },
          { label: 'الكتالوج', href: '/shop' },
          { label: product.title }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        {/* Left Side: Product Image & Overview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-8 flex items-center justify-center relative overflow-hidden">
            {product.badge && (
              <div className="absolute top-4 right-4 z-10">
                <Badge variant="primary" size="md">{product.badge}</Badge>
              </div>
            )}
            <img
              src={product.image}
              alt={product.title}
              className="max-h-48 w-auto object-contain my-6"
            />
          </div>

          {/* Quick Security & Guarantee Highlights */}
          <div className="w-full mt-4 p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 text-right">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{product.guaranteeText}</span>
            </div>
            <p className="text-[11px] text-emerald-700/90">
              دعم فني جزائري متواصل على مدار الساعة عبر الواتساب وتليغرام.
            </p>
          </div>
        </div>

        {/* Right Side: Details & Plan Selection */}
        <div className="lg:col-span-7 flex flex-col text-right">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-500">{product.category}</span>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{product.ratingAverage.toFixed(1)}</span>
                <span className="text-slate-400 font-normal">({product.ratingCount} تقييم)</span>
              </div>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-snug">
              {product.title}
            </h1>
            <p className="text-xs md:text-sm text-slate-600 mt-2 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Interactive Plan Selector */}
          <div className="my-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">اختر الباقة ومدة الاشتراك:</h3>
            <PlanSelect
              plans={product.plans}
              selectedPlanId={selectedPlan.id}
              onSelect={setSelectedPlanId}
            />
          </div>

          {/* Pricing & Add to Cart Action */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs text-slate-500 block">السعر الإجمالي:</span>
              <PriceTag
                priceMinor={selectedPlan.priceMinor}
                originalPriceMinor={selectedPlan.originalPriceMinor}
                size="lg"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                onClick={handleAddToCart}
                className="flex-1 sm:flex-initial gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>أضف للسلة</span>
              </Button>

              <Button
                variant="primary"
                size="lg"
                onClick={handleInstantBuy}
                className="flex-1 sm:flex-initial shadow-md shadow-blue-500/20"
              >
                شراء فوري الآن
              </Button>
            </div>
          </div>

          {addedSuccess && (
            <div className="mb-4">
              <Alert variant="success" title="تمت الإضافة بنجاح!">
                تمت إضافة {product.title} ({selectedPlan.name}) إلى سلة مشترياتك.
              </Alert>
            </div>
          )}

          {/* Features Checklist */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-900 mb-3">مميزات هذا الاشتراك:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {product.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Frequently Asked Questions */}
          {product.faqs.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-3">الأسئلة الشائعة حول هذا المنتج:</h3>
              <div className="space-y-3">
                {product.faqs.map((faq, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 mb-1">{faq.question}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
