'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@ovira/ui';
import { Download, X, RefreshCw } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallToast() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    // 2. Check 30-day dismissal policy
    const lastDismissed = localStorage.getItem('ovira_pwa_dismissed');
    if (lastDismissed) {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - parseInt(lastDismissed, 10) < thirtyDays) {
        return;
      }
    }

    // 3. Register Service Worker and watch for updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      }).catch((err) => {
        console.debug('Service Worker registration skipped:', err);
      });
    }

    // 4. Capture beforeinstallprompt event
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Delay prompt until after engagement (4 seconds)
      setTimeout(() => {
        setShowToast(true);
      }, 4000);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);

    window.addEventListener('appinstalled', () => {
      setShowToast(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setShowToast(false);
    }
  };

  const handleDismiss = () => {
    setShowToast(false);
    localStorage.setItem('ovira_pwa_dismissed', Date.now().toString());
  };

  const handleUpdateRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Update Available Notification */}
      {updateAvailable && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 max-w-sm bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 text-right">
          <div className="flex items-center gap-2 text-xs">
            <RefreshCw className="w-4 h-4 text-[#1684F8] shrink-0 animate-spin" />
            <span>تحديث جديد متوفر للمتجر!</span>
          </div>
          <Button variant="primary" size="sm" onClick={handleUpdateRefresh} className="text-xs font-bold py-1 px-3">
            تحديث الآن
          </Button>
        </div>
      )}

      {/* Contextual PWA Install Toast */}
      {showToast && deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-40 max-w-sm bg-white border border-slate-200 p-4 rounded-2xl shadow-xl text-right animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1684F8] flex items-center justify-center font-bold text-sm">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">تثبيت تطبيق OVIRA PLAY</h4>
                <p className="text-[11px] text-slate-500">وصول سريع لاشتراكاتك وتتبع طلباتك بدون متصفح</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Button variant="primary" size="sm" onClick={handleInstall} className="flex-1 text-xs font-bold">
              تثبيت التطبيق الآن
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs">
              لاحقاً
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
