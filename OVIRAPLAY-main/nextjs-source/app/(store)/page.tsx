'use client';

import React, { useState } from 'react';
import { Button, ProductCard } from '@ovira/ui';
import { Zap, ShieldCheck, Headphones, Tv, BrainCircuit, Music, Palette, Sparkles, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'الكل', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'entertainment', label: 'ترفيه وبث', icon: <Tv className="w-3.5 h-3.5" /> },
    { id: 'ai_tools', label: 'ذكاء اصطناعي', icon: <BrainCircuit className="w-3.5 h-3.5" /> },
    { id: 'productivity', label: 'إنتاجية وتصميم', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'music', label: 'موسيقى وصوتيات', icon: <Music className="w-3.5 h-3.5" /> },
  ];

  // Verified catalog fixtures for instant zero-latency loading
  const products = [
    {
      id: 'prod_netflix',
      slug: 'netflix-premium',
      title: 'Netflix Premium 4K UHD',
      tagline: 'شاشة خاصة برمز PIN بجودة 4K فائقة الوضوح',
      category: 'entertainment',
      image: 'https://assets.nflxext.com/ffe/siteui/common/icons/monogram/netflix_icon.png',
      badge: 'الأكثر طلباً',
      startingPriceMinor: 85000,
      originalPriceMinor: 100000,
      features: ['شاشة خاصة برمز PIN', 'جودة 4K Ultra HD', 'ضمان كامل المدة', 'لغة عربية كاملة'],
      ratingAverage: 4.9
    },
    {
      slug: 'shahid-vip-sports',
      id: 'prod_shahid',
      title: 'Shahid VIP باقة الرياضة',
      tagline: 'متابعة دوري روشن وقنوات SSC ودوري أبطال آسيا',
      category: 'entertainment',
      image: 'https://shahid.mbc.net/static/images/brand/shahid-logo-color.svg',
      badge: 'رياضة وتسلية',
      startingPriceMinor: 120000,
      originalPriceMinor: 140000,
      features: ['قنوات SSC الرياضية Full HD', 'محتوى أصلي بدون إعلانات', 'ضمان رسمي 30 يوماً'],
      ratingAverage: 4.8
    },
    {
      id: 'prod_chatgpt',
      slug: 'chatgpt-plus',
      title: 'ChatGPT Plus (GPT-4o)',
      tagline: 'وصول كامل لـ GPT-4o وتوليد الصور بـ DALL-E 3',
      category: 'ai_tools',
      image: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
      badge: 'ذكاء اصطناعي',
      startingPriceMinor: 380000,
      originalPriceMinor: 420000,
      features: ['أحدث نموذج GPT-4o', 'تحليل ملفات وبيانات', 'توليد صور فوري', 'حساب خاص بالكامل'],
      ratingAverage: 5.0
    },
    {
      id: 'prod_spotify',
      slug: 'spotify-premium',
      title: 'Spotify Premium فردي',
      tagline: 'استماع بلا حدود بدون إعلانات مع ميزة التحميل',
      category: 'music',
      image: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
      badge: 'موسيقى',
      startingPriceMinor: 110000,
      originalPriceMinor: 150000,
      features: ['صوت عالي الدقة 320kbps', 'بدون إعلانات إطلاقاً', 'تفعيل على حسابك الشخصي'],
      ratingAverage: 4.9
    }
  ];

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Banner */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-blue-50/70 via-blue-50/20 to-transparent border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/70 border border-blue-200 text-[#1684F8] text-xs font-bold mb-6">
            <Zap className="w-3.5 h-3.5" />
            <span>تسليم آلي فوري وضمان رسمي بالدينار الجزائري</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            اشتراكاتك الرقمية المفضلة
            <br />
            <span className="text-[#1684F8]">بأفضل الأسعار وبطرق دفع محلية</span>
          </h1>

          <p className="text-sm md:text-base text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
            منصة جزائرية موثوقة لشراء وتجديد اشتراكات Netflix, Shahid, ChatGPT Plus, Spotify مع ضمان ذهبي طوال مدة اشتراكك.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/shop')}
              className="shadow-lg shadow-blue-500/20 gap-2"
            >
              <span>تصفح الكتالوج الكامل</span>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/track')}
            >
              تتبع حالة طلبي
            </Button>
          </div>
        </div>
      </section>

      {/* Category Pills Bar */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
        <div className="flex items-center justify-start md:justify-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-x-auto select-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#1684F8] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Products Grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">أبرز الاشتراكات المتاحة</h2>
            <p className="text-xs text-slate-500 mt-1">حسابات رسمية ومضمونة مع تسليم فوري</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/shop')} className="gap-1.5">
            <span>عرض الكل</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              onSelect={() => router.push(`/products/${product.slug}`)}
            />
          ))}
        </div>
      </section>

      {/* Highlights / Guarantees Section */}
      <section className="bg-slate-50 border-y border-slate-200/80 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
            <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1684F8] flex items-center justify-center mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">تسليم آلي وفوري</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                فور إتمام الدفع بالبطاقة الذهبية أو تأكيد الحوالة، تظهر بيانات حسابك وشاشتك مباشرة على الشاشة وترسل لرسائل تليغرام الخاصة بك.
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">ضمان رسمي 100%</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                جميع الاشتراكات مدفوعة رسمياً مع ضمان شامل طوال فترة الاشتراك، وفي حال حدوث أي توقف يتم التعويض فوراً بدون أي تأخير.
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Headphones className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">طرق دفع محلية مرنة</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                ادفع بالدينار الجزائري عبر تطبيق بريدي موب (BaridiMob) أو مراكز البريد CCP أو البطاقة الذهبية / CIB عبر بوابة Chargily Pay المعتمدة.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
