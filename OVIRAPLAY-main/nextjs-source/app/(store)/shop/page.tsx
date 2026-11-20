'use client';

import React, { useState } from 'react';
import { ProductCard, Input, Select, Pagination, EmptyState } from '@ovira/ui';
import { Search, Sparkles, Tv, BrainCircuit, Palette, Music } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ShopPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('popular');
  const [currentPage, setCurrentPage] = useState(1);

  const categories = [
    { id: 'all', label: 'الكل', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'entertainment', label: 'ترفيه وبث', icon: <Tv className="w-3.5 h-3.5" /> },
    { id: 'ai_tools', label: 'ذكاء اصطناعي', icon: <BrainCircuit className="w-3.5 h-3.5" /> },
    { id: 'productivity', label: 'إنتاجية وتصميم', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'music', label: 'موسيقى وصوتيات', icon: <Music className="w-3.5 h-3.5" /> },
  ];

  const allProducts = [
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
      id: 'prod_shahid',
      slug: 'shahid-vip-sports',
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
    },
    {
      id: 'prod_canva',
      slug: 'canva-pro',
      title: 'Canva Pro اشتراك رسمي',
      tagline: 'وصول لجميع القوالب والصور الاحترافية والذكاء الاصطناعي',
      category: 'productivity',
      image: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Canva_icon_2021.svg',
      badge: 'تصميم',
      startingPriceMinor: 150000,
      originalPriceMinor: 200000,
      features: ['إزالة الخلفيات بنقرة واحدة', 'وصول غير محدود لـ 100+ مليون صورة', 'مساحة تخزين سحابية 1TB'],
      ratingAverage: 4.9
    }
  ];

  // Filtering
  const filtered = allProducts.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch =
      searchTerm.trim() === '' ||
      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.tagline?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'price_asc') return a.startingPriceMinor - b.startingPriceMinor;
    if (sortOrder === 'price_desc') return b.startingPriceMinor - a.startingPriceMinor;
    return 0; // Default popularity
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Title & Description */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">كتالوج الاشتراكات الرقمية</h1>
        <p className="text-xs text-slate-500 mt-1">تصفح جميع الاشتراكات والخدمات المتاحة مع تفعيل فوري بالدينار الجزائري</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="w-full md:w-72 relative">
          <Input
            placeholder="ابحث عن منتج أو اشتراك..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors ${
                selectedCategory === c.id
                  ? 'bg-[#1684F8] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.icon}
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="w-full md:w-44">
          <Select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            options={[
              { value: 'popular', label: 'الترتيب: الأكثر طلباً' },
              { value: 'price_asc', label: 'السعر: من الأقل للأعلى' },
              { value: 'price_desc', label: 'السعر: من الأعلى للأقل' }
            ]}
          />
        </div>
      </div>

      {/* Products Grid */}
      {sorted.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sorted.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                onSelect={() => router.push(`/products/${product.slug}`)}
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={1}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </>
      ) : (
        <EmptyState
          title="لم يتم العثور على أي نتائج"
          description="جرّب تعديل كلمات البحث أو اختيار تصنيف آخر لعرض المنتجات المتاحة."
          actionText="عرض كل المنتجات"
          onAction={() => {
            setSelectedCategory('all');
            setSearchTerm('');
          }}
        />
      )}
    </div>
  );
}
