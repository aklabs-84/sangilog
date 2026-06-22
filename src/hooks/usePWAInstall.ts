import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState = 'idle' | 'available' | 'ios' | 'installed' | 'dismissed';

const DISMISS_KEY = 'pwa-install-hide-until';

function isBannerHidden() {
  const until = localStorage.getItem(DISMISS_KEY);
  return until !== null && Date.now() < parseInt(until, 10);
}

export function usePWAInstall() {
  const [installState, setInstallState] = useState<InstallState>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isBannerHidden()) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((navigator as any).standalone === true) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      setInstallState('ios');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState('available');
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstallState('installed');
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallState('installed');
    }
    setDeferredPrompt(null);
  };

  const dismiss = (forDay = true) => {
    if (forDay) {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    }
    setInstallState('dismissed');
  };

  return { installState, triggerInstall, dismiss };
}
