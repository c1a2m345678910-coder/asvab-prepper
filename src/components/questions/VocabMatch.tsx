'use client';

import type { VocabMatchQuestion } from '@/types/asvab';
import { AnswerOptions } from './AnswerOptions';

interface Props {
  question: VocabMatchQuestion;
  onAnswer: (correct: boolean) => void;
}

/**
 * Word Knowledge section.
 * The target word is displayed large and centered; the user picks the
 * best definition from 4 options.
 */
export function VocabMatch({ question, onAnswer }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Word display */}
      <div className="py-6 flex flex-col items-center gap-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
          Word Knowledge
        </p>
        <p className="text-5xl font-bold text-slate-900 tracking-tight">
          {question.word}
        </p>
        {/* Decorative rule */}
        <span className="block h-1 w-10 rounded-full bg-indigo-300" />
      </div>

      <p className="text-sm font-medium text-slate-500 text-center -mt-2">
        Choose the best definition:
      </p>

      <AnswerOptions
        options={question.options}
        correctIndex={question.correctIndex}
        explanation={question.explanation}
        onAnswer={onAnswer}
      />
    </div>
  );
}
