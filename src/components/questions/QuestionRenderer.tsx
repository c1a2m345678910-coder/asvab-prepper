'use client';

import type { Question } from '@/types/asvab';
import { MCQChoice } from './MCQChoice';
import { VocabMatch } from './VocabMatch';
import { PassageQuestion } from './PassageQuestion';
import { DiagramQuestion } from './DiagramQuestion';

interface Props {
  question: Question;
  onAnswer: (correct: boolean) => void;
}

/**
 * Routes a Question to its type-specific rendering component.
 *
 * `key={question.id}` is set on each branch so React unmounts and
 * remounts the component when the question changes. This resets the
 * selected-answer state inside AnswerOptions without the parent needing
 * to manage that lifecycle explicitly.
 */
export function QuestionRenderer({ question, onAnswer }: Props) {
  switch (question.type) {
    case 'mcq':
      return (
        <MCQChoice key={question.id} question={question} onAnswer={onAnswer} />
      );

    case 'vocab':
      return (
        <VocabMatch key={question.id} question={question} onAnswer={onAnswer} />
      );

    case 'passage':
      return (
        <PassageQuestion
          key={question.id}
          question={question}
          onAnswer={onAnswer}
        />
      );

    case 'diagram':
      return (
        <DiagramQuestion
          key={question.id}
          question={question}
          onAnswer={onAnswer}
        />
      );

    default: {
      // TypeScript exhaustiveness guard — will error at compile time if a
      // new Question type is added without a corresponding case above.
      const _exhaustive: never = question;
      void _exhaustive;
      return null;
    }
  }
}
