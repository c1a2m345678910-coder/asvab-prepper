'use client';

import { useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type AnswerState = 'idle' | 'correct' | 'wrong';

export interface AnswerOptionsProps {
  options: string[];
  correctIndex: number;
  explanation: string;
  onAnswer: (correct: boolean) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function badgeLabel(
  index: number,
  answered: boolean,
  correctIndex: number,
  selectedIndex: number | null,
): string {
  if (!answered) return LETTERS[index] ?? String(index + 1);
  if (index === correctIndex) return '✓';
  if (index === selectedIndex) return '✗';
  return LETTERS[index] ?? String(index + 1);
}

function buttonClasses(
  index: number,
  answered: boolean,
  correctIndex: number,
  selectedIndex: number | null,
): string {
  const base =
    'w-full flex items-center gap-3 px-4 py-4 min-h-[3.5rem] rounded-xl border-2 ' +
    'text-left font-medium text-base transition-colors duration-100 select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2';

  if (!answered) {
    return (
      base +
      ' border-slate-200 bg-white text-slate-800 cursor-pointer ' +
      'hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.98]'
    );
  }

  if (index === correctIndex) {
    return base + ' border-emerald-500 bg-emerald-50 text-emerald-900 animate-correct-pulse cursor-default';
  }

  if (index === selectedIndex) {
    return base + ' border-rose-400 bg-rose-50 text-rose-800 animate-shake cursor-default';
  }

  // Unanswered option that wasn't selected
  return base + ' border-slate-100 bg-white text-slate-400 opacity-50 cursor-default';
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Shared answer-option grid used by all question types.
 *
 * Manages its own "which option was selected" state so each question
 * component stays simple. The parent is notified once via onAnswer().
 *
 * Pedagogy: explanation always shown after answering, regardless of
 * correctness. Wrong answers get "Correct answer: …" header + amber panel.
 * No punitive language.
 */
export function AnswerOptions({
  options,
  correctIndex,
  explanation,
  onAnswer,
}: AnswerOptionsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const answered = selectedIndex !== null;
  const answerState: AnswerState = !answered
    ? 'idle'
    : selectedIndex === correctIndex
      ? 'correct'
      : 'wrong';

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelectedIndex(index);
    onAnswer(index === correctIndex);
  };

  return (
    <div className="flex flex-col gap-3">
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => handleSelect(index)}
          className={buttonClasses(index, answered, correctIndex, selectedIndex)}
          aria-pressed={selectedIndex === index}
        >
          {/* Letter / icon badge */}
          <span
            className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-current
              flex items-center justify-center text-xs font-bold leading-none"
          >
            {badgeLabel(index, answered, correctIndex, selectedIndex)}
          </span>

          <span className="flex-1">{option}</span>
        </button>
      ))}

      {/* Explanation panel — slides up after any answer */}
      {answered && (
        <div
          className={`mt-1 rounded-xl border-2 p-4 animate-slide-up ${
            answerState === 'correct'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <p
            className={`text-sm font-bold mb-1.5 ${
              answerState === 'correct' ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {answerState === 'correct'
              ? '✓ Correct!'
              : `Correct answer: "${options[correctIndex]}"`}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  );
}
