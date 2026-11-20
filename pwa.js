/* OVIRA PLAY PWA bootstrap — native install prompt, iOS guidance, no dependencies. */
(() => {
  'use strict';
  let installPrompt = null;
  const root = document.documentElement;
  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function syncInstallState() {
    const installed = standalone();
    root.classList.toggle('ovx-install-ready', !!installPrompt && !installed);
    root.classList.toggle('ovx-ios-install-ready', !installPrompt && isIOS() && !installed);
  }

  function closeInstallDialog() {
    document.querySelector('.ovx-install-dialog')?.remove();
  }

  function showInstallDialog(title, message, steps) {
    closeInstallDialog();
    const overlay = document.createElement('div');
    overlay.className = 'ovx-install-dialog';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
      <section class="ovx-install-card" role="dialog" aria-modal="true" aria-labelledby="ovxInstallTitle">
        <div class="ovx-install-icon" aria-hidden="true">▶</div>
        <h2 id="ovxInstallTitle">${title}</h2>
        <p>${message}</p>
        <div class="ovx-install-steps">${steps}</div>
        <button class="ovx-install-close" type="button">إغلاق</button>
      </section>`;
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('.ovx-install-close')) closeInstallDialog();
    });
    document.addEventListener('keydown', function onKey(event) {
      if (event.key === 'Escape') {
        closeInstallDialog();
        document.removeEventListener('keydown', onKey);
      }
    }, { once: true });
    document.body.appendChild(overlay);
    overlay.querySelector('.ovx-install-close')?.focus();
  }

  window.oviraInstallApp = async () => {
    if (standalone()) {
      showInstallDialog('التطبيق مثبت بالفعل', 'يمكنك فتح OVIRA PLAY من شاشة التطبيقات أو سطح المكتب.', '');
      return;
    }
    if (installPrompt) {
      const promptEvent = installPrompt;
      installPrompt = null;
      syncInstallState();
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === 'dismissed') {
          showInstallDialog('لم يكتمل التثبيت', 'يمكنك المحاولة لاحقاً من قائمة المتصفح واختيار تثبيت OVIRA PLAY كتطبيق.', '');
        }
      } catch (_) {
        showInstallDialog('تعذّر فتح التثبيت', 'افتح قائمة المتصفح وابحث عن «تثبيت OVIRA PLAY» أو «Install app».', '');
      }
      return;
    }
    if (isIOS()) {
      showInstallDialog(
        'أضف OVIRA PLAY إلى هاتفك',
        'ثبّت المتجر على الشاشة الرئيسية لفتحه كتطبيق مستقل.',
        '<ol><li>افتح الصفحة في Safari.</li><li>اضغط زر المشاركة.</li><li>اختر «إضافة إلى الشاشة الرئيسية» ثم اضغط «إضافة».</li></ol>'
      );
    }
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    syncInstallState();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    syncInstallState();
  });

  if (window.matchMedia) {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    displayMode.addEventListener?.('change', syncInstallState);
  }
  syncInstallState();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
        .then((registration) => registration.update().catch(() => {}))
        .catch(() => {
          // Install prompt does not depend on offline caching being available.
        });
    }, { once: true });
  }
})();
