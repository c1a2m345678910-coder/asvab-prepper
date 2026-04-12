'use client';

import Link from 'next/link';
import { useProgressStore } from '@/store/progressStore';
import { SECTIONS, AFQT_SECTIONS } from '@/lib/sections';
import { getDueBySectionCount } from '@/lib/questionSelector';
import type { Section } from '@/types/asvab';

// ── Section card ───────────────────────────────────────────────────────────

function SectionCard({
  section,
  mastery,
  dueCount,
}: {
  section: Section;
  mastery: number;
  dueCount: number;
}) {
  const pct = Math.round(mastery * 100);

  return (
    <Link
      href={`/lesson/${section.id}`}
      className="group flex flex-col gap-3 bg-white rounded-2xl p-4
        shadow-sm border border-slate-100 active:scale-[0.97] transition-transform"
    >
      {/* Top row: emoji + AFQT badge */}
      <div className="flex items-start justify-between">
        <span className="text-2xl leading-none">{section.iconEmoji}</span>
        {section.isAFQT && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider
              text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full"
          >
            AFQT
          </span>
        )}
      </div>

      {/* Name + abbreviation */}
      <div>
        <p className="text-sm font-semibold text-slate-900 leading-tight">{section.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{section.abbrev}</p>
      </div>

      {/* Mastery bar */}
      <div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">{pct}% mastery</p>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-2 mt-auto">
        <span
          className="flex-1 block text-center text-sm font-semibold
            text-indigo-700 bg-indigo-50 rounded-xl py-2.5
            group-hover:bg-indigo-100 transition-colors"
        >
          Practice →
        </span>
        {dueCount > 0 && (
          <Link
            href={`/lesson/${section.id}?mode=review`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-50
              border border-amber-200 rounded-xl px-2.5 py-2.5 leading-none"
            aria-label={`Review ${dueCount} due card${dueCount !== 1 ? 's' : ''} for ${section.name}`}
          >
            {dueCount}↩
          </Link>
        )}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { masteryBySection, streakDays, totalXP, srsCards } = useProgressStore();
  const dueCounts = getDueBySectionCount(srsCards);
  const totalDue = Object.values(dueCounts).reduce((a, b) => a + b, 0);

  const technicalSections = SECTIONS.filter((s) => !s.isAFQT);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* ── App header ──────────────────────────────────────────────── */}
        <div className="pt-12 pb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ASVAB Prep</h1>
          <p className="text-sm text-slate-400 mt-1">Practice. Learn. Enlist.</p>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <div className="flex gap-3 mb-8">
          <div
            className="flex-1 flex items-center gap-3 bg-orange-50 border border-orange-100
              rounded-2xl px-4 py-3.5"
          >
            <span className="text-xl leading-none">🔥</span>
            <div>
              <p className="text-xl font-bold text-orange-600 leading-none tabular-nums">
                {streakDays}
              </p>
              <p className="text-xs text-orange-400 mt-0.5">day streak</p>
            </div>
          </div>

          <div
            className="flex-1 flex items-center gap-3 bg-indigo-50 border border-indigo-100
              rounded-2xl px-4 py-3.5"
          >
            <span className="text-xl leading-none">⭐</span>
            <div>
              <p className="text-xl font-bold text-indigo-600 leading-none tabular-nums">
                {totalXP.toLocaleString()}
              </p>
              <p className="text-xs text-indigo-400 mt-0.5">total XP</p>
            </div>
          </div>
        </div>

        {/* ── Review banner ───────────────────────────────────────────── */}
        {totalDue > 0 && (
          <Link
            href="/review"
            className="flex items-center justify-between bg-amber-50 border border-amber-200
              rounded-2xl px-4 py-3.5 mb-8 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📚</span>
              <div>
                <p className="text-sm font-semibold text-amber-900">Review Due</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {totalDue} card{totalDue !== 1 ? 's' : ''} waiting for you
                </p>
              </div>
            </div>
            <span className="text-amber-500 font-bold text-lg">→</span>
          </Link>
        )}

        {/* ── AFQT Core ───────────────────────────────────────────────── */}
        <section className="mb-8" aria-labelledby="afqt-heading">
          <div className="flex items-center gap-2 mb-4">
            <h2
              id="afqt-heading"
              className="text-xs font-bold uppercase tracking-widest text-indigo-500"
            >
              AFQT Core
            </h2>
            <span className="flex-1 h-px bg-indigo-100" />
            <span className="text-xs text-slate-400">Counts toward score</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {AFQT_SECTIONS.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                mastery={masteryBySection[section.id] ?? 0}
                dueCount={dueCounts[section.id] ?? 0}
              />
            ))}
          </div>
        </section>

        {/* ── Technical Sections ──────────────────────────────────────── */}
        <section aria-labelledby="technical-heading">
          <div className="flex items-center gap-2 mb-4">
            <h2
              id="technical-heading"
              className="text-xs font-bold uppercase tracking-widest text-slate-400"
            >
              Technical Sections
            </h2>
            <span className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {technicalSections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                mastery={masteryBySection[section.id] ?? 0}
                dueCount={dueCounts[section.id] ?? 0}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
