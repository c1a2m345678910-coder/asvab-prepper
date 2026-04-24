import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Service worker must never be cached by the browser HTTP cache.
        // Without this, iOS can serve a stale sw.js for up to 24 hours,
        // delaying PWA updates even when skipWaiting() is set.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
