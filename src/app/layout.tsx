import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import PwaSetup from '@/components/PwaSetup';
import SyncManager from '@/components/SyncManager';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ASVAB Prep',
  description: 'Practice all 9 ASVAB sections with spaced repetition. Master the AFQT.',
  applicationName: 'ASVAB Prep',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ASVAB Prep',
  },
};

export const viewport: Viewport = {
  themeColor: '#1e3a5f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Inline script — runs synchronously before any paint to prevent FOWT.
// Reads localStorage and applies .dark class to <html> before React hydrates.
const themeScript = `
(function() {
  try {
    var prefs = JSON.parse(localStorage.getItem('asvab-prefs') || '{}');
    var state = prefs.state || {};
    var theme = state.theme || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (theme === 'dark' || (theme === 'system' && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaSetup />
        <SyncManager />
        {children}
      </body>
    </html>
  );
}
