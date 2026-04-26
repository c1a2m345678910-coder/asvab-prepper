'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProgressStore } from '@/store/progressStore';
import { useAuthStore } from '@/store/authStore';
import { getDueBySectionCount } from '@/lib/questionSelector';
import { getLevel, getLevelTitle } from '@/lib/mastery';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/review', label: 'Review', icon: '📚' },
  { href: '/diagnostic', label: 'Diagnostic', icon: '🎯' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AppShell() {
  const pathname = usePathname();
  const { streakDays, totalXP, srsCards } = useProgressStore();
  const { user } = useAuthStore();
  const dueCounts = getDueBySectionCount(srsCards);
  const totalDue = Object.values(dueCounts).reduce((a, b) => a + b, 0);
  const level = getLevel(totalXP);
  const levelTitle = getLevelTitle(level);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
      {/* Logo */}
      <div className="px-5 pt-7 pb-4 border-b border-slate-100 dark:border-slate-800">
        <p className="font-bold text-lg text-slate-900 dark:text-white">ASVAB Prep</p>
        <p className="text-xs text-slate-400 mt-0.5">Practice. Learn. Enlist.</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const isReview = item.href === '/review';
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              ].join(' ')}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {isReview && totalDue > 0 && (
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded-full">
                  {totalDue}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Stats */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span>🔥</span>
          <span className="text-orange-600 font-semibold tabular-nums">{streakDays}</span>
          <span className="text-slate-400 text-xs">day streak</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>🏅</span>
          <span className="text-indigo-600 font-semibold">Lv.{level}</span>
          <span className="text-slate-400 text-xs">{levelTitle}</span>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        {user ? (
          <div className="flex items-center gap-2 min-w-0">
            {user.user_metadata?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.user_metadata.avatar_url as string}
                alt=""
                className="w-7 h-7 rounded-full shrink-0"
              />
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {(user.user_metadata?.full_name as string) ?? user.email}
            </p>
          </div>
        ) : (
          <Link
            href="/settings"
            className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
          >
            Sign in to sync →
          </Link>
        )}
      </div>
    </aside>
  );
}
