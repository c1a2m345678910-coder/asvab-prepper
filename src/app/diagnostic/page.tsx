'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import type { Question, DiagnosticResult } from '@/types/asvab';
import { QuestionRenderer } from '@/components/questions/QuestionRenderer';
import { useProgressStore } from '@/store/progressStore';
import { SECTION_MAP } from '@/lib/sections';
import {
  selectDiagnosticQuestion,
  DIAGNOSTIC_TOTAL,
  DIAGNOSTIC_SECTION_IDS,
  type DiagnosticResponse,
} from '@/lib/diagnostic';
import { computeAfqtProjection } from '@/lib/afqtProjection';
import { getQuestionsForSection } from '@/lib/questions';
import ErrorBoundary from '@/components/ErrorBoundary';

// ── Types ──────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'running' | 'complete';

// ── Helpers ────────────────────────────────────────────────────────────────

/** True if at least one AFQT section has questions loaded. */
function hasAfqtQuestions(): boolean {
  return DIAGNOSTIC_SECTION_IDS.some(
    (id) => getQuestionsForSection(id).length > 0,
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Difficulty ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((d) => (
        <span
          key={d}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            d <= level ? 'bg-indigo-500' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

function StrengthBadge({ strength }: { strength: 'strong' | 'medium' | 'weak' }) {
  const styles = {
    strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    weak:   'bg-red-50 text-red-600 border-red-200',
  };
  const labels = { strong: 'Strong', medium: 'Developing', weak: 'Needs Work' };
  return (
    <span
      className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${styles[strength]}`}
    >
      {labels[strength]}
    </span>
  );
}

// ── Intro screen ───────────────────────────────────────────────────────────

function IntroScreen({
  onStart,
  hasQuestions,
  previousResult,
}: {
  onStart: () => void;
  hasQuestions: boolean;
  previousResult: DiagnosticResult | null;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-10">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mb-8"
        >
          ← Home
        </Link>

        {/* Hero */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center
            justify-center text-3xl mb-5">
            🎯
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            AFQT Diagnostic
          </h1>
          <p className="text-slate-500 text-base leading-relaxed">
            A 30-question adaptive test across Arithmetic Reasoning, Math
            Knowledge, Word Knowledge, and Paragraph Comprehension — the four
            sections that determine your AFQT score.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 mb-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
            How it works
          </h2>
          <div className="flex flex-col gap-4">
            {[
              {
                icon: '⚡',
                title: 'Adapts to your level',
                body: 'Questions get harder after correct answers and easier after wrong ones, so the test homes in on your true ability quickly.',
              },
              {
                icon: '⚖️',
                title: 'Balanced coverage',
                body: 'Roughly 7–8 questions per section keep the projection accurate across all four AFQT areas.',
              },
              {
                icon: '📊',
                title: 'IRT-based score',
                body: 'We use a simplified Rasch model to estimate your ability and project a percentile — the same family of math used in real adaptive tests.',
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <span className="text-xl leading-none mt-0.5">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Previous result teaser */}
        {previousResult && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3.5 mb-5">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">
              Last result
            </p>
            <p className="text-2xl font-bold text-indigo-700 leading-none">
              {previousResult.projectedAfqt}
              <span className="text-sm font-normal text-indigo-400 ml-1.5">
                projected AFQT percentile
              </span>
            </p>
            <p className="text-xs text-indigo-400 mt-1">
              {previousResult.totalCorrect}/{previousResult.totalQuestions} correct ·{' '}
              {new Date(previousResult.completedAt).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* CTA */}
        {hasQuestions ? (
          <button
            onClick={onStart}
            className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold
              text-base active:scale-[0.98] transition-transform"
          >
            Start Diagnostic →
          </button>
        ) : (
          <div className="bg-slate-100 rounded-xl px-5 py-4 text-center">
            <p className="text-sm font-semibold text-slate-600 mb-1">
              Questions coming soon
            </p>
            <p className="text-xs text-slate-400">
              AFQT question banks are still being built. Check back later.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 text-center mt-6 leading-relaxed px-2">
          ⚠️ This is a rough estimate for study purposes only. Official AFQT
          scores are determined at MEPS and are not guaranteed by this app.
        </p>
      </div>
    </div>
  );
}

// ── Running screen ─────────────────────────────────────────────────────────

function RunningScreen({
  question,
  responses,
  answered,
  onAnswer,
  onNext,
  onAbort,
}: {
  question: Question;
  responses: DiagnosticResponse[];
  answered: boolean;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
  onAbort: () => void;
}) {
  const questionNumber = responses.length + (answered ? 0 : 1);
  const answeredCount = responses.length;
  const progressPct = (answeredCount / DIAGNOSTIC_TOTAL) * 100;
  const currentDiff = question.difficulty;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 pb-10">

        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 safe-pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onAbort}
              className="text-slate-400 hover:text-slate-600 transition-colors
                text-lg p-1 -ml-1 active:scale-95 leading-none"
              aria-label="Exit diagnostic"
            >
              ←
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 leading-tight truncate">
                🎯 AFQT Diagnostic
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-medium tabular-nums">
                  {SECTION_MAP[question.sectionId]?.abbrev ?? question.sectionId}
                </span>
                <span className="text-slate-200">·</span>
                <DifficultyDots level={currentDiff} />
              </div>
            </div>

            <span className="text-xs tabular-nums text-slate-400 font-medium flex-shrink-0">
              {questionNumber}/{DIAGNOSTIC_TOTAL}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="pt-5">
          <QuestionRenderer question={question} onAnswer={onAnswer} />
        </div>

        {/* Next button */}
        {answered && (
          <div className="mt-6 animate-slide-up">
            <button
              onClick={onNext}
              className="w-full bg-indigo-600 text-white rounded-xl py-4
                font-semibold text-base active:scale-[0.98] transition-transform"
            >
              {answeredCount >= DIAGNOSTIC_TOTAL - 1
                ? 'See Results →'
                : 'Next Question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Results screen ─────────────────────────────────────────────────────────

function ResultsScreen({
  result,
  onRetake,
}: {
  result: DiagnosticResult;
  onRetake: () => void;
}) {
  // Study priority: sort AFQT sections weakest-first, then medium, then strong.
  const priorityOrder = { weak: 0, medium: 1, strong: 2 } as const;
  const studyPriority = [...DIAGNOSTIC_SECTION_IDS]
    .filter((id) => result.sectionScores[id]?.total > 0)
    .sort((a, b) => {
      const sa = result.sectionScores[a];
      const sb = result.sectionScores[b];
      const orderDiff =
        priorityOrder[sa.strength] - priorityOrder[sb.strength];
      if (orderDiff !== 0) return orderDiff;
      // Tiebreak: lower accuracy first
      const accA = sa.total > 0 ? sa.correct / sa.total : 0;
      const accB = sb.total > 0 ? sb.correct / sb.total : 0;
      return accA - accB;
    });

  const scoreColor =
    result.projectedAfqt >= 65
      ? 'text-emerald-600'
      : result.projectedAfqt >= 50
      ? 'text-indigo-600'
      : result.projectedAfqt >= 31
      ? 'text-amber-600'
      : 'text-red-500';

  const scoreMessage =
    result.projectedAfqt >= 65
      ? 'Excellent — you qualify for virtually all branches and MOSs.'
      : result.projectedAfqt >= 50
      ? 'Good score — you meet the threshold for most branches.'
      : result.projectedAfqt >= 31
      ? 'Passing — keep studying to open up more options.'
      : 'Below passing for most branches — focused study will help.';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-10">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mb-8"
        >
          ← Home
        </Link>

        {/* Early-end notice */}
        {result.totalQuestions < DIAGNOSTIC_TOTAL && (
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 mb-5">
            <span className="shrink-0 mt-px">⚠️</span>
            <span>
              Test ended after <strong>{result.totalQuestions}</strong> questions — the
              question bank ran out before reaching {DIAGNOSTIC_TOTAL}. Add more questions
              in Settings for a complete diagnostic.
            </span>
          </div>
        )}

        {/* Score hero */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-7 mb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Projected AFQT Percentile
          </p>
          <p className={`text-7xl font-extrabold leading-none mb-2 ${scoreColor}`}>
            {result.projectedAfqt}
          </p>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed max-w-xs mx-auto">
            {scoreMessage}
          </p>
          <div className="flex items-center justify-center gap-4 mt-5 text-sm text-slate-400">
            <span>
              <span className="font-semibold text-slate-700">{result.totalCorrect}</span>
              /{result.totalQuestions} correct
            </span>
            <span className="text-slate-200">|</span>
            <span>
              θ&nbsp;=&nbsp;
              <span className="font-semibold text-slate-700">{result.estimatedTheta}</span>
            </span>
          </div>
        </div>

        {/* Per-section breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Section Breakdown
          </h2>
          <div className="flex flex-col gap-3">
            {DIAGNOSTIC_SECTION_IDS.map((id) => {
              const score = result.sectionScores[id];
              const section = SECTION_MAP[id];
              if (!score || score.total === 0) return null;
              const pct = Math.round((score.correct / score.total) * 100);
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="text-lg leading-none w-7 text-center">
                    {section?.iconEmoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {section?.name ?? id}
                      </p>
                      <span className="text-xs text-slate-400 tabular-nums ml-2 flex-shrink-0">
                        {score.correct}/{score.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          score.strength === 'strong'
                            ? 'bg-emerald-400'
                            : score.strength === 'medium'
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <StrengthBadge strength={score.strength} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Study priority */}
        {studyPriority.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              Recommended Study Priority
            </h2>
            <div className="flex flex-col gap-2">
              {studyPriority.map((id, idx) => {
                const score = result.sectionScores[id];
                const section = SECTION_MAP[id];
                const pct = score.total > 0
                  ? Math.round((score.correct / score.total) * 100)
                  : 0;
                const rankColors = ['text-red-500', 'text-amber-500', 'text-slate-400', 'text-slate-300'];
                return (
                  <Link
                    key={id}
                    href={`/lesson/${id}`}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl
                      bg-slate-50 hover:bg-slate-100 active:scale-[0.98] transition-all"
                  >
                    <span
                      className={`w-5 text-center text-sm font-bold tabular-nums ${
                        rankColors[idx] ?? 'text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-base leading-none">
                      {section?.iconEmoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {section?.name ?? id}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{pct}% accuracy</p>
                    </div>
                    <span className="text-slate-300 text-sm flex-shrink-0">→</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="block w-full text-center bg-indigo-600 text-white rounded-xl
              py-4 font-semibold text-base active:scale-[0.98] transition-transform"
          >
            Study Now →
          </Link>
          <button
            onClick={onRetake}
            className="w-full bg-slate-100 text-slate-700 rounded-xl py-3.5
              font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            Retake Diagnostic
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 text-center mt-6 leading-relaxed px-2">
          ⚠️ Rough estimate only. Not an official AFQT score. Determined at MEPS.
          θ = {result.estimatedTheta} (IRT ability estimate, Rasch model).
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DiagnosticPage() {
  const { latestDiagnostic, saveDiagnostic } = useProgressStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [responses, setResponses] = useState<DiagnosticResponse[]>([]);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    const firstQ = selectDiagnosticQuestion([], new Set());
    if (!firstQ) return; // guard: no questions yet (handled by hasQuestions check in intro)
    setResponses([]);
    setCurrentQ(firstQ);
    setAnswered(false);
    setResult(null);
    setPhase('running');
  }, []);

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (!currentQ || answered) return;
      setResponses((prev) => [...prev, { question: currentQ, correct }]);
      setAnswered(true);
    },
    [currentQ, answered],
  );

  const handleNext = useCallback(() => {
    // `responses` already contains the just-answered question (set in handleAnswer).
    const newResponses = responses;
    const doneCount = newResponses.length;

    const finish = (finalResponses: DiagnosticResponse[]) => {
      const res = computeAfqtProjection(finalResponses);
      saveDiagnostic(res);
      setResult(res);
      setPhase('complete');
    };

    if (doneCount >= DIAGNOSTIC_TOTAL) {
      finish(newResponses);
      return;
    }

    const usedIds = new Set(newResponses.map((r) => r.question.id));
    const nextQ = selectDiagnosticQuestion(newResponses, usedIds);
    if (!nextQ) {
      // Question bank exhausted before 30 — complete early
      finish(newResponses);
      return;
    }

    setCurrentQ(nextQ);
    setAnswered(false);
  }, [responses, saveDiagnostic]);

  const handleAbort = useCallback(() => {
    setPhase('intro');
    setResponses([]);
    setCurrentQ(null);
    setAnswered(false);
  }, []);

  const handleRetake = useCallback(() => {
    handleAbort();
  }, [handleAbort]);

  // ── Render ─────────────────────────────────────────────────────────────

  let content: React.ReactNode;

  if (phase === 'intro') {
    content = (
      <IntroScreen
        onStart={handleStart}
        hasQuestions={hasAfqtQuestions()}
        previousResult={latestDiagnostic}
      />
    );
  } else if (phase === 'running' && currentQ) {
    content = (
      <RunningScreen
        question={currentQ}
        responses={responses}
        answered={answered}
        onAnswer={handleAnswer}
        onNext={handleNext}
        onAbort={handleAbort}
      />
    );
  } else if (phase === 'complete' && result) {
    content = <ResultsScreen result={result} onRetake={handleRetake} />;
  } else {
    // Transitional / fallback — should never be visible
    content = (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackHref="/" fallbackLabel="← Back to Home">
      {content}
    </ErrorBoundary>
  );
}
