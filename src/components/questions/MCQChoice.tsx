'use client';

import type { MCQQuestion } from '@/types/asvab';
import { AnswerOptions } from './AnswerOptions';

interface Props {
  question: MCQQuestion;
  onAnswer: (correct: boolean) => void;
}

/**
 * Standard 4-option multiple choice question.
 * Used by GS, AR, MK, EI, AS — any section without a special display format.
 */
export function MCQChoice({ question, onAnswer }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-snug">
        {question.question}
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
