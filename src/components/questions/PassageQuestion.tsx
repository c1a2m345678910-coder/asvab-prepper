'use client';

import type { PassageQuestion as PassageQuestionType } from '@/types/asvab';
import { AnswerOptions } from './AnswerOptions';

interface Props {
  question: PassageQuestionType;
  onAnswer: (correct: boolean) => void;
}

/**
 * Paragraph Comprehension section.
 *
 * The passage sticks to the top of the viewport so it remains readable
 * as the user scrolls down to the answer choices. The parent page/container
 * must be the scroll root (standard body scroll) for sticky to work.
 *
 * Max-height + overflow-y-auto lets very long passages scroll within the
 * sticky band without consuming the whole screen.
 */
export function PassageQuestion({ question, onAnswer }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Sticky passage band ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 rounded-xl border border-indigo-100 bg-indigo-50 shadow-sm">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
            Passage
          </span>
        </div>
        {/* Inner scroll so the band never exceeds ~40 % of the viewport */}
        <div className="max-h-[40vh] overflow-y-auto px-4 pb-4">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {question.passage}
          </p>
        </div>
      </div>

      {/* ── Question ────────────────────────────────────────────────────── */}
      <p className="text-base font-semibold text-slate-900 leading-snug">
        {question.question}
      </p>

      {/* ── Choices ─────────────────────────────────────────────────────── */}
      <AnswerOptions
        options={question.options}
        correctIndex={question.correctIndex}
        explanation={question.explanation}
        onAnswer={onAnswer}
      />
    </div>
  );
}
