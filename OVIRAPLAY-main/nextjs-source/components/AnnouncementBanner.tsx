'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // In dev / production, fetch active announcement
    const dismissed = sessionStorage.getItem('ovira_announcement_dismissed');
    if (!dismissed) {
      setAnnouncement('مرحباً بكم في المتجر الجديد! تسليم آلي فوري لجميع الاشتراكات وضمان رسمي كامل بالدينار الجزائري 🇩🇿');
    }
  }, []);

  if (!announcement || isDismissed) return null;

  return (
    <div className="bg-[#1684F8] text-white text-xs font-semibold py-2 px-4 text-center relative z-50 flex items-center justify-center gap-2 select-none shadow-sm">
      <Megaphone className="w-3.5 h-3.5 shrink-0" />
      <span>{announcement}</span>
      <button
        onClick={() => {
          setIsDismissed(true);
          sessionStorage.setItem('ovira_announcement_dismissed', 'true');
        }}
        className="absolute left-3 p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
        aria-label="إغلاق الإعلان"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
