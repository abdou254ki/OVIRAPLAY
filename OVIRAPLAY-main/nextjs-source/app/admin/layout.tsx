'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Users,
  Headphones,
  DollarSign,
  Cpu,
  LogOut,
  Menu,
  Shield,
  ChevronLeft
} from 'lucide-react';
import { Badge } from '@ovira/ui';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { label: 'نظرة عامة', href: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'إدارة الطلبات', href: '/admin/orders', icon: <ShoppingCart className="w-4 h-4" />, badge: 3 },
    { label: 'الكتالوج والباقات', href: '/admin/products', icon: <Package className="w-4 h-4" /> },
    { label: 'المخزون والشاشات', href: '/admin/stock', icon: <Layers className="w-4 h-4" /> },
    { label: 'سجل العملاء', href: '/admin/customers', icon: <Users className="w-4 h-4" /> },
    { label: 'صندوق الدعم', href: '/admin/support', icon: <Headphones className="w-4 h-4" /> },
    { label: 'التقارير والمالية', href: '/admin/finance', icon: <DollarSign className="w-4 h-4" /> },
    { label: 'الذكاء الاصطناعي', href: '/admin/ai-control', icon: <Cpu className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-right font-sans">
      {/* Sidebar for Desktop */}
      <aside className="w-64 bg-white border-l border-slate-200 hidden lg:flex flex-col justify-between shrink-0 h-screen sticky top-0">
        <div>
          {/* Admin Header */}
          <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1684F8] flex items-center justify-center text-white font-black text-base shadow-sm">
                O
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 block leading-tight">لوحة تحكم OVIRA</span>
                <span className="text-[10px] text-slate-400 font-medium block">الإدارة والعمليات</span>
              </div>
            </div>
            <Badge variant="primary" size="sm">V5</Badge>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#1684F8] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white text-[#1684F8]' : 'bg-blue-100 text-[#1684F8]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 text-[#1684F8] rounded-xl flex items-center justify-center font-bold text-xs">
                م
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block leading-none">المدير العام</span>
                <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">مالك (Owner)</span>
              </div>
            </div>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>العودة للمتجر</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            aria-label="القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <Badge variant="success" size="sm">النظام متصل • Atlas DEV</Badge>
          </div>
        </header>

        <main className="p-6 md:p-8 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
