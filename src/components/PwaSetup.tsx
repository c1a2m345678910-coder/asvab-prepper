'use client';

import { useEffect } from 'react';
import { usePrefsStore } from '@/store/prefsStore';

/**
 * Mounts once in the root layout.
 * - Registers the service worker
 * - Keeps document.documentElement.classList in sync with the user's theme pref
 */
export default function PwaSetup() {
  const theme = usePrefsStore((s) => s.theme);

  // Sync .dark class to <html> whenever theme pref changes
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

    root.classList.toggle('dark', isDark);
  }, [theme]);

  // Also react to OS-level changes when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('SW registration failed:', err));
    }
  }, []);

  return null;
}
