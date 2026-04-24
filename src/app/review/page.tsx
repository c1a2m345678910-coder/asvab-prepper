'use client';

import Link from 'next/link';
import { useProgressStore } from '@/store/progressStore';
import { SECTIONS } from '@/lib/sections';
import { getDueBySectionCount } from '@/lib/questionSelector';

export default function ReviewPage() {
  const { srsCards } = useProgressStore();
  const dueCounts = getDueBySectionCount(srsCards);
  const totalDue = Object.values(dueCounts).reduce((a, b) => a + b, 0);
  const sectionsWithDue = SECTIONS.filter((s) => (dueCounts[s.id] ?? 0) > 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 pt-10 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mb-4"
          >
            ← Home
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Review Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalDue > 0
              ? `${totalDue} card${totalDue !== 1 ? 's' : ''} due today`
              : 'No cards due right now'}
          </p>
        </div>

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {totalDue === 0 && (
          <div className="mt-16 flex flex-col items-center text-center gap-3">
            <span className="text-6xl">🎉</span>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">All caught up!</p>
            <p className="text-sm text-slate-400 max-w-xs">
              You&apos;ve reviewed everything that&apos;s due. Come back tomorrow for
              more cards.
            </p>
            <Link
              href="/"
              className="mt-4 bg-indigo-600 text-white rounded-xl px-6 py-3 font-semibold text-sm"
            >
              Practice something new
            </Link>
          </div>
        )}

        {/* ── Due-card list, grouped by section ───────────────────────── */}
        {totalDue > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            {sectionsWithDue.map((section) => {
              const count = dueCounts[section.id] ?? 0;
              return (
                <Link
                  key={section.id}
                  href={`/lesson/${section.id}?mode=review`}
                  className="flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl px-4 py-4 shadow-sm border border-slate-100 dark:border-slate-800 active:scale-[0.98] transition-transform"
                >
                  <span className="text-2xl">{section.iconEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {section.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {count} card{count !== 1 ? 's' : ''} due
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1 rounded-full">
                      {count}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
