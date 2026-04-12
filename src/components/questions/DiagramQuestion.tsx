'use client';

import { useState } from 'react';
import type { DiagramQuestion as DiagramQuestionType } from '@/types/asvab';
import { AnswerOptions } from './AnswerOptions';

interface Props {
  question: DiagramQuestionType;
  onAnswer: (correct: boolean) => void;
}

/**
 * Mechanical Comprehension, Assembling Objects, Electronics Information,
 * Auto & Shop — any question that ships with a diagram image.
 *
 * Uses a plain <img> (not next/image) so we can attach onError for the
 * fallback placeholder without requiring known dimensions.
 *
 * Images are expected at public paths like /diagrams/mc/MC-001.png.
 * Falling back gracefully when images aren't available yet lets the
 * component render during development before assets exist.
 */
export function DiagramQuestion({ question, onAnswer }: Props) {
  const [imgError, setImgError] = useState(false);

  const hasImage = Boolean(question.diagramUrl) && !imgError;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Diagram ─────────────────────────────────────────────────────── */}
      {hasImage ? (
        <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.diagramUrl}
            alt={question.altText}
            onError={() => setImgError(true)}
            className="w-full max-h-64 object-contain p-4"
          />
        </div>
      ) : (
        <div
          className="w-full h-44 rounded-xl border-2 border-dashed border-slate-200
            bg-slate-50 flex flex-col items-center justify-center gap-2"
          role="img"
          aria-label={question.altText || 'Diagram unavailable'}
        >
          <span className="text-3xl opacity-20">🖼️</span>
          <p className="text-xs text-slate-400 font-medium">Diagram not available</p>
        </div>
      )}

      {/* ── Question text ────────────────────────────────────────────────── */}
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
