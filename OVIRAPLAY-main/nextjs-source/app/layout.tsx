import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { InstallToast } from '@/components/pwa/InstallToast';

export const metadata: Metadata = {
  title: 'OVIRA PLAY — متجر الاشتراكات الرقمية الذكي',
  description: 'المتجر الجزائري الأول للاشتراكات الرقمية: Netflix، Shahid VIP، Spotify، ChatGPT Plus بأفضل الأسعار وبالدينار الجزائري.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  }
};

export const viewport: Viewport = {
  themeColor: '#1684F8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased flex flex-col justify-between">
        <CartProvider>
          <AnnouncementBanner />
          <Navbar />
          <div className="flex-1">
            {children}
          </div>
          <Footer />
          <InstallToast />
        </CartProvider>
      </body>
    </html>
  );
}
