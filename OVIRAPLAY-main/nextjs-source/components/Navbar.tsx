'use client';

import React, { useState } from 'react';
import { useCart } from './CartProvider';
import { Button, Drawer } from '@ovira/ui';
import { ShoppingBag, Search, Menu, User, ShieldCheck } from 'lucide-react';

export function Navbar() {
  const { totalItemsCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
            aria-label="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <a href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1684F8] flex items-center justify-center text-white font-black text-lg shadow-sm">
              O
            </div>
            <div>
              <span className="font-extrabold text-base text-slate-900 tracking-tight block leading-none">
                OVIRA PLAY
              </span>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                متجر الاشتراكات
              </span>
            </div>
          </a>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-700">
          <a href="/" className="hover:text-[#1684F8] transition-colors">الرئيسية</a>
          <a href="/shop" className="hover:text-[#1684F8] transition-colors">الكتالوج الكامل</a>
          <a href="/track" className="hover:text-[#1684F8] transition-colors">تتبع الطلبات</a>
          <a href="/support" className="hover:text-[#1684F8] transition-colors">الدعم والمساعدة</a>
        </nav>

        {/* Actions: Search, Cart, Account */}
        <div className="flex items-center gap-2.5">
          <a href="/shop" className="p-2 text-slate-600 hover:text-[#1684F8] rounded-xl hover:bg-slate-100 hidden sm:flex">
            <Search className="w-4 h-4" />
          </a>

          <a href="/account" className="p-2 text-slate-600 hover:text-[#1684F8] rounded-xl hover:bg-slate-100">
            <User className="w-4 h-4" />
          </a>

          <a href="/cart" className="relative">
            <Button variant="primary" size="sm" className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">السلة</span>
              {totalItemsCount > 0 && (
                <span className="bg-white text-[#1684F8] text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {totalItemsCount}
                </span>
              )}
            </Button>
          </a>
        </div>
      </div>

      {/* Mobile Drawer */}
      <Drawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="قائمة المتجر"
      >
        <div className="flex flex-col gap-4 text-right">
          <a
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 font-bold text-slate-800 hover:bg-slate-50 rounded-xl"
          >
            الرئيسية
          </a>
          <a
            href="/shop"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 font-bold text-slate-800 hover:bg-slate-50 rounded-xl"
          >
            الكتالوج الكامل
          </a>
          <a
            href="/track"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 font-bold text-slate-800 hover:bg-slate-50 rounded-xl"
          >
            تتبع حالة الطلب
          </a>
          <a
            href="/account"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 font-bold text-slate-800 hover:bg-slate-50 rounded-xl"
          >
            حسابي والاشتراكات
          </a>
          <a
            href="/support"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 font-bold text-slate-800 hover:bg-slate-50 rounded-xl"
          >
            مركز الدعم الفني
          </a>

          <div className="mt-8 p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-[#1684F8] mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>ضمان رسمي 100%</span>
            </div>
            <p>جميع الاشتراكات مفعلة برسمية مع تعويض مباشر ودعم عبر الواتساب وتليغرام.</p>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
