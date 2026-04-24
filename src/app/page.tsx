'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useProgressStore } from '@/store/progressStore';
import { usePrefsStore, MOS_LIST } from '@/store/prefsStore';
import { SECTIONS, AFQT_SECTIONS, SECTION_MAP } from '@/lib/sections';
import { getDueBySectionCount } from '@/lib/questionSelector';
import { getMasteryTier, getLevel, getLevelTitle, getXPForLevel } from '@/lib/mastery';
import OnboardingModal from '@/components/OnboardingModal';
import type { Section } from '@/types/asvab';

// ── Helpers ────────────────────────────────────────────────────────────────

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

// ── Section card ───────────────────────────────────────────────────────────

function SectionCard({
  section,
  mastery,
  dueCount,
  highlighted = false,
}: {
  section: Section;
  mastery: number;
  dueCount: number;
  highlighted?: boolean;
}) {
  const pct = Math.round(mastery * 100);
  const tier = getMasteryTier(mastery);

  return (
    <Link
      href={`/lesson/${section.id}`}
      className={[
        'group flex flex-col gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border active:scale-[0.97] transition-transform',
        highlighted
          ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-300/60 dark:ring-indigo-700/60'
          : 'border-slate-100 dark:border-slate-800',
      ].join(' ')}
    >
      {/* Top row: emoji + AFQT badge */}
      <div className="flex items-start justify-between">
        <span className="text-2xl leading-none">{section.iconEmoji}</span>
        {section.isAFQT && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 px-2 py-0.5 rounded-full">
            AFQT
          </span>
        )}
      </div>

      {/* Name + abbreviation */}
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{section.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{section.abbrev}</p>
      </div>

      {/* Mastery bar */}
      <div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${tier.barColor} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-slate-400">{pct}%</p>
          <p className={`text-xs font-semibold ${tier.textColor}`}>{tier.label}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-2 mt-auto">
        <span className="flex-1 block text-center text-sm font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl py-2.5 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950/60 transition-colors">
          Practice →
        </span>
        {dueCount > 0 && (
          <Link
            href={`/lesson/${section.id}?mode=review`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-xl px-2.5 py-2.5 leading-none"
            aria-label={`Review ${dueCount} due card${dueCount !== 1 ? 's' : ''} for ${section.name}`}
          >
            {dueCount}↩
          </Link>
        )}
      </div>
    </Link>
  );
}

// ── Quick-start helper ─────────────────────────────────────────────────────

/**
 * Pick the single best next session for the user.
 * Priority: section with most due SRS cards → lowest-mastery AFQT section.
 */
function getQuickStartTarget(
  dueCounts: Record<string, number>,
  masteryBySection: Record<string, number>,
): { sectionId: string; reviewMode: boolean } {
  const totalDue = Object.values(dueCounts).reduce((a, b) => a + b, 0);
  if (totalDue > 0) {
    const [sectionId] = Object.entries(dueCounts).sort(([, a], [, b]) => b - a)[0];
    return { sectionId, reviewMode: true };
  }
  const { id: sectionId } = [...AFQT_SECTIONS].sort(
    (a, b) => (masteryBySection[a.id] ?? 0) - (masteryBySection[b.id] ?? 0),
  )[0];
  return { sectionId, reviewMode: false };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const {
    masteryBySection,
    streakDays,
    lastActiveDate,
    totalXP,
    srsCards,
    dailyQuestions,
    pendingSession,
    resetDailyIfNeeded,
  } = useProgressStore();
  const { studyGoal, sessionLength, setSessionLength, selectedMos } = usePrefsStore();
  const dueCounts = getDueBySectionCount(srsCards);

  // Reset daily counter at midnight without requiring a question to be answered first.
  useEffect(() => { resetDailyIfNeeded(); }, [resetDailyIfNeeded]);

  // Level derived values
  const level = getLevel(totalXP);
  const levelTitle = getLevelTitle(level);
  const xpThis = getXPForLevel(level);
  const xpNext = getXPForLevel(level + 1);
  const levelPct = Math.round(((totalXP - xpThis) / (xpNext - xpThis)) * 100);
  const totalDue = Object.values(dueCounts).reduce((a, b) => a + b, 0);
  const technicalSections = SECTIONS.filter((s) => !s.isAFQT && s.id !== 'MED');
  const mosSections = SECTIONS.filter((s) => s.id === 'MED');
  const afqtOnly = studyGoal === 'afqt';

  // MOS highlighting
  const mosOption = studyGoal === 'mos' && selectedMos
    ? (MOS_LIST.find((m) => m.id === selectedMos) ?? null)
    : null;
  const mosFocusedSections = mosOption ? new Set(mosOption.sections) : null;

  // Streak at-risk (studied yesterday but not yet today)
  const streakAtRisk = streakDays > 0 && lastActiveDate === yesterdayStr();

  const { sectionId: qsSectionId, reviewMode: qsReview } = getQuickStartTarget(dueCounts, masteryBySection);
  const quickHref = qsReview ? `/lesson/${qsSectionId}?mode=review` : `/lesson/${qsSectionId}`;

  return (
    <>
      <OnboardingModal />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-lg mx-auto px-4 pb-16">

          {/* ── App header ────────────────────────────────────────────── */}
          <div className="pt-12 pb-6 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                ASVAB Prep
              </h1>
              <p className="text-sm text-slate-400 mt-1">Practice. Learn. Enlist.</p>
            </div>
            <Link
              href="/settings"
              className="mt-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
              aria-label="Settings"
            >
              ⚙️
            </Link>
          </div>

          {/* ── Stats row ─────────────────────────────────────────────── */}
          <div className="flex gap-3 mb-4">
            {/* Streak — amber when at risk */}
            <div className={[
              'flex-1 flex items-center gap-2 border rounded-2xl px-3 py-3.5',
              streakAtRisk
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40'
                : 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/40',
            ].join(' ')}>
              <span className="text-lg leading-none">🔥</span>
              <div>
                <p className={`text-lg font-bold leading-none tabular-nums ${streakAtRisk ? 'text-amber-600' : 'text-orange-600'}`}>
                  {streakDays}
                </p>
                <p className={`text-xs mt-0.5 ${streakAtRisk ? 'text-amber-500 font-semibold' : 'text-orange-400'}`}>
                  {streakAtRisk ? 'at risk!' : 'streak'}
                </p>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl px-3 py-3.5">
              <span className="text-lg leading-none">🏅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-indigo-600 leading-none">
                  Lv.{level} <span className="text-xs font-normal text-indigo-400">{levelTitle}</span>
                </p>
                <div className="mt-1.5 h-1 bg-indigo-100 dark:bg-indigo-900/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${levelPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl px-3 py-3.5">
              <span className="text-lg leading-none">📝</span>
              <div>
                <p className="text-lg font-bold text-emerald-600 leading-none tabular-nums">
                  {dailyQuestions}
                </p>
                <p className="text-xs text-emerald-400 mt-0.5">today</p>
              </div>
            </div>
          </div>

          {/* ── Resume banner ─────────────────────────────────────────── */}
          {pendingSession && SECTION_MAP[pendingSession.sectionId] && (() => {
            const remaining = pendingSession.questionIds.length - pendingSession.currentIndex;
            const resumeHref = pendingSession.reviewMode
              ? `/lesson/${pendingSession.sectionId}?mode=review`
              : `/lesson/${pendingSession.sectionId}`;
            return (
              <Link
                href={resumeHref}
                className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-4 py-3.5 mb-2 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">⏸️</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Resume {SECTION_MAP[pendingSession.sectionId].abbrev}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {remaining} question{remaining !== 1 ? 's' : ''} remaining
                    </p>
                  </div>
                </div>
                <span className="text-emerald-500 font-bold text-lg">→</span>
              </Link>
            );
          })()}

          {/* ── Quick Start ───────────────────────────────────────────── */}
          <Link
            href={quickHref}
            className="flex items-center justify-between bg-indigo-600 rounded-2xl px-4 py-4 mb-2 active:scale-[0.98] transition-transform"
          >
            <div>
              <p className="text-base font-bold text-white leading-tight">Study Now →</p>
              <p className="text-xs text-indigo-200 mt-0.5">
                {SECTION_MAP[qsSectionId]?.abbrev} · {sessionLength} questions
                {qsReview ? ' · review' : ''}
              </p>
            </div>
            {dailyQuestions > 0 && (
              <span className="text-xs font-bold text-indigo-200 bg-indigo-700/60 rounded-full px-2.5 py-1 shrink-0">
                {dailyQuestions} today
              </span>
            )}
          </Link>

          {/* ── Session length chips ───────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-slate-400 shrink-0">Session:</span>
            {([5, 10, 20] as const).map((n) => (
              <button
                key={n}
                onClick={() => setSessionLength(n)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  sessionLength === n
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {n}Q
              </button>
            ))}
          </div>

          {/* ── Diagnostic banner ─────────────────────────────────────── */}
          <Link
            href="/diagnostic"
            className="flex items-center justify-between bg-indigo-600 rounded-2xl px-4 py-3.5 mb-4 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🎯</span>
              <div>
                <p className="text-sm font-semibold text-white">AFQT Diagnostic</p>
                <p className="text-xs text-indigo-200 mt-0.5">
                  30-question adaptive test · get your projected score
                </p>
              </div>
            </div>
            <span className="text-indigo-300 font-bold text-lg">→</span>
          </Link>

          {/* ── Review banner ─────────────────────────────────────────── */}
          {totalDue > 0 && (
            <Link
              href="/review"
              className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3.5 mb-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📚</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Review Due</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    {totalDue} card{totalDue !== 1 ? 's' : ''} waiting for you
                  </p>
                </div>
              </div>
              <span className="text-amber-500 font-bold text-lg">→</span>
            </Link>
          )}

          {/* ── MOS focus banner ──────────────────────────────────────── */}
          {mosOption && (
            <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-3.5 py-2.5 mb-4 text-xs text-emerald-800 dark:text-emerald-300">
              <span className="shrink-0">🎖️</span>
              <span>
                Highlighted for <strong>{mosOption.id} · {mosOption.name}</strong>
              </span>
              <Link href="/settings" className="ml-auto text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                Change →
              </Link>
            </div>
          )}

          {/* ── AFQT Core ─────────────────────────────────────────────── */}
          <section className="mb-8" aria-labelledby="afqt-heading">
            <div className="flex items-center gap-2 mb-4">
              <h2
                id="afqt-heading"
                className="text-xs font-bold uppercase tracking-widest text-indigo-500"
              >
                AFQT Core
              </h2>
              <span className="flex-1 h-px bg-indigo-100 dark:bg-indigo-900/50" />
              <span className="text-xs text-slate-400">Counts toward score</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {AFQT_SECTIONS.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  mastery={masteryBySection[section.id] ?? 0}
                  dueCount={dueCounts[section.id] ?? 0}
                  highlighted={mosFocusedSections?.has(section.id) ?? false}
                />
              ))}
            </div>
          </section>

          {/* ── Technical Sections ────────────────────────────────────── */}
          <section
            aria-labelledby="technical-heading"
            className={`mb-8 ${afqtOnly ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-2 mb-4">
              <h2
                id="technical-heading"
                className="text-xs font-bold uppercase tracking-widest text-slate-400"
              >
                Technical Sections
              </h2>
              <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              {afqtOnly && (
                <span className="text-xs text-slate-400">Not in AFQT</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {technicalSections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  mastery={masteryBySection[section.id] ?? 0}
                  dueCount={dueCounts[section.id] ?? 0}
                  highlighted={mosFocusedSections?.has(section.id) ?? false}
                />
              ))}
            </div>
          </section>

          {/* ── MOS Track ─────────────────────────────────────────────── */}
          <section aria-labelledby="mos-heading">
            <div className="flex items-center gap-2 mb-4">
              <h2
                id="mos-heading"
                className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400"
              >
                MOS Track
              </h2>
              <span className="flex-1 h-px bg-emerald-100 dark:bg-emerald-900/50" />
              <span className="text-xs text-slate-400">68W · ST score</span>
            </div>

            {/* Context callout */}
            <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-3.5 py-3 mb-4 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              <span className="shrink-0 mt-px">⚕️</span>
              <span>
                Combat Medic (68W) requires a <strong>Skilled Technical (ST) score ≥ 107</strong>,
                calculated as GS + WK + PC + MK. This section drills the
                medical biology and anatomy questions that dominate GS and directly build your ST score.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {mosSections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  mastery={masteryBySection[section.id] ?? 0}
                  dueCount={dueCounts[section.id] ?? 0}
                  highlighted={mosFocusedSections?.has(section.id) ?? false}
                />
              ))}
            </div>
          </section>

          {/* ── Mastery hint ──────────────────────────────────────────── */}
          <p className="text-[11px] text-slate-400 dark:text-slate-600 text-center px-4 pt-6 pb-2 leading-relaxed">
            Mastery grows with repeated reviews over days. First clean pass ≈ 50%.
          </p>

        </div>
      </main>
    </>
  );
}
