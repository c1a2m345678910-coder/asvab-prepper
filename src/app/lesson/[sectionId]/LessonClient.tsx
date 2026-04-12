'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QuestionRenderer } from '@/components/questions/QuestionRenderer';
import { useProgressStore } from '@/store/progressStore';
import { useSessionStore, currentQuestion, sessionScore } from '@/store/sessionStore';
import { SECTION_MAP } from '@/lib/sections';
import { selectQuestions, selectReviewQuestions } from '@/lib/questionSelector';

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  sectionId: string;
  reviewMode?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function LessonClient({ sectionId, reviewMode = false }: Props) {
  const router = useRouter();
  const section = SECTION_MAP[sectionId];

  // Zustand actions (stable references — don't need to be in deps)
  const { recordAttempt } = useProgressStore();
  const { answer, nextQuestion, endSession } = useSessionStore();

  // Reactive session state
  const { isActive, currentSection, questionQueue, currentIndex, sessionCorrect, sessionWrong } =
    useSessionStore();

  // Local state
  const [answered, setAnswered] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);

  // ── Session initialisation ───────────────────────────────────────────────
  // Reads store snapshots directly so question selection happens once at
  // session start and is not re-triggered by mid-session SRS card updates.
  // Uses Zustand's set (not React setState) to signal readiness, which
  // satisfies the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    const { srsCards } = useProgressStore.getState();
    const { startSession } = useSessionStore.getState();

    const questions = reviewMode
      ? selectReviewQuestions(srsCards, sectionId)
      : selectQuestions(sectionId, srsCards);

    startSession(sectionId, questions);

    return () => {
      useSessionStore.getState().endSession();
    };
  }, [sectionId, reviewMode]);

  // `currentSection` is set by startSession — use it as the initialization
  // signal instead of a separate local flag. Zustand's cleanup (endSession)
  // resets it to null before each new effect, so stale matches are impossible.
  const initialized = currentSection === sectionId;

  // ── Derived values ───────────────────────────────────────────────────────
  const q = currentQuestion({ questionQueue, currentIndex });
  const totalQuestions = questionQueue.length;
  const answeredCount = sessionCorrect + sessionWrong;
  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAnswer = (correct: boolean) => {
    if (!q) return;
    recordAttempt(q.sectionId, q.id, correct);
    answer(correct);
    setSessionXP((prev) => prev + (correct ? 10 : 2));
    setAnswered(true);
  };

  const handleNext = () => {
    setAnswered(false);
    nextQuestion();
  };

  // ── Render: loading ──────────────────────────────────────────────────────
  if (!initialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  // ── Render: unknown section ──────────────────────────────────────────────
  if (!section) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-slate-500">Section &ldquo;{sectionId}&rdquo; not found.</p>
        <Link href="/" className="text-indigo-600 font-semibold">← Back to Home</Link>
      </div>
    );
  }

  // ── Render: no questions available ──────────────────────────────────────
  if (initialized && totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center gap-4">
        <span className="text-6xl">{section.iconEmoji}</span>
        <h2 className="text-xl font-semibold text-slate-800">No questions yet</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          {reviewMode
            ? `No review cards are due for ${section.name} right now.`
            : `Questions for ${section.name} are coming soon.`}
        </p>
        <Link
          href={reviewMode ? '/review' : '/'}
          className="mt-2 bg-indigo-600 text-white rounded-xl px-5 py-3 font-semibold text-sm"
        >
          ← Go back
        </Link>
      </div>
    );
  }

  // ── Render: session complete ─────────────────────────────────────────────
  if (!isActive && totalQuestions > 0) {
    const score = sessionScore({ sessionCorrect, sessionWrong });
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center">
          {/* Result icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl mx-auto mb-5">
            {score >= 70 ? '🎉' : '📚'}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {reviewMode ? 'Review Complete!' : 'Session Complete!'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            {section.iconEmoji} {section.name}
          </p>

          {/* Score */}
          <div className="bg-slate-50 rounded-2xl px-4 py-4 mb-4">
            <p className="text-4xl font-bold text-slate-900 leading-none">
              {sessionCorrect}
              <span className="text-2xl text-slate-400 font-normal">/{totalQuestions}</span>
            </p>
            <p className="text-sm text-slate-500 mt-1">questions correct</p>
          </div>

          {/* XP */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-4 mb-8">
            <p className="text-3xl font-bold text-indigo-600 leading-none">+{sessionXP}</p>
            <p className="text-sm text-indigo-400 mt-1">XP earned</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="block w-full bg-indigo-600 text-white rounded-xl py-4
                font-semibold text-base text-center active:scale-[0.98] transition-transform"
              onClick={() => endSession()}
            >
              Continue →
            </Link>
            <button
              onClick={() => {
                const { srsCards } = useProgressStore.getState();
                const { startSession } = useSessionStore.getState();
                const questions = reviewMode
                  ? selectReviewQuestions(srsCards, sectionId)
                  : selectQuestions(sectionId, srsCards);
                startSession(sectionId, questions);
                setAnswered(false);
                setSessionXP(0);
              }}
              className="w-full bg-slate-100 text-slate-700 rounded-xl py-3.5
                font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              Practice Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: active lesson ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 pb-10">

        {/* ── Sticky header + progress bar ─────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-slate-50 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-slate-600 transition-colors leading-none
                text-lg p-1 -ml-1 active:scale-95"
              aria-label="Back to home"
            >
              ←
            </button>
            <p className="flex-1 text-sm font-semibold text-slate-700 truncate">
              {section.iconEmoji} {section.name}
              {reviewMode && (
                <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  Review
                </span>
              )}
            </p>
            <span className="text-xs tabular-nums text-slate-400 font-medium">
              {answeredCount}/{totalQuestions}
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

        {/* ── Question ─────────────────────────────────────────────────── */}
        {q && (
          <div className="pt-5">
            <QuestionRenderer question={q} onAnswer={handleAnswer} />
          </div>
        )}

        {/* ── Next / Finish button ──────────────────────────────────────── */}
        {answered && (
          <div className="mt-6 animate-slide-up">
            <button
              onClick={handleNext}
              className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold
                text-base active:scale-[0.98] transition-transform"
            >
              {currentIndex + 1 < totalQuestions ? 'Next Question →' : 'Finish Session →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
