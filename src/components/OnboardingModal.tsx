'use client';

import { useState, useEffect } from 'react';
import { usePrefsStore, type StudyGoal, MOS_LIST } from '@/store/prefsStore';

const GOALS: { id: StudyGoal; emoji: string; title: string; description: string }[] = [
  {
    id: 'afqt',
    emoji: '🎯',
    title: 'AFQT Focus',
    description: 'Arithmetic, Word Knowledge, Paragraph Comprehension, Math — the four sections that determine enlistment eligibility.',
  },
  {
    id: 'full',
    emoji: '📋',
    title: 'Full ASVAB',
    description: 'All nine sections. Maximises your line scores and opens up more MOS / rating options.',
  },
  {
    id: 'mos',
    emoji: '🎖️',
    title: 'Specific MOS',
    description: 'Targeting a particular job or rating? Focus on the sections that matter most for your path.',
  },
];

export default function OnboardingModal() {
  const { hasSeenOnboarding, completeOnboarding } = usePrefsStore();
  const [selected, setSelected] = useState<StudyGoal | null>(null);
  const [selectedMosId, setSelectedMosId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [visible, setVisible] = useState(true);
  // Delay rendering until after first client-side paint so the persisted
  // `hasSeenOnboarding` value is available. Without this, the modal briefly
  // appears on every cold start even for returning users.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || hasSeenOnboarding || !visible) return null;

  function handleContinue() {
    if (!selected) return;
    if (selected === 'mos' && step === 1) {
      // Advance to MOS picker step
      setStep(2);
      return;
    }
    completeOnboarding(selected, selectedMosId ?? undefined);
    setVisible(false);
  }

  // ── Step 1: Goal picker ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
        <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 px-6 pt-8 pb-6">
            <div className="text-3xl mb-3">🪖</div>
            <h2 className="text-xl font-bold text-white">What&apos;s your goal?</h2>
            <p className="text-indigo-200 text-sm mt-1">
              We&apos;ll emphasise the right sections on your home screen.
            </p>
          </div>

          {/* Options */}
          <div className="px-4 py-4 space-y-3">
            {GOALS.map((goal) => {
              const isSelected = selected === goal.id;
              return (
                <button
                  key={goal.id}
                  onClick={() => setSelected(goal.id)}
                  className={[
                    'w-full flex items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-all',
                    isSelected
                      ? 'bg-indigo-600 ring-2 ring-indigo-400'
                      : 'bg-slate-800 active:bg-slate-700',
                  ].join(' ')}
                >
                  <span className="text-2xl mt-0.5 shrink-0">{goal.emoji}</span>
                  <div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {goal.title}
                    </p>
                    <p className={`text-xs mt-0.5 leading-relaxed ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {goal.description}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="ml-auto text-white shrink-0 mt-0.5">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* CTA */}
          <div className="px-4 pb-6">
            <button
              onClick={handleContinue}
              disabled={!selected}
              className={[
                'w-full py-3.5 rounded-xl font-semibold text-sm transition-all',
                selected
                  ? 'bg-indigo-600 text-white active:scale-[0.98]'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              {selected === 'mos' ? 'Next →' : 'Let\'s go →'}
            </button>
            <p className="text-center text-xs text-slate-500 mt-3">
              You can change this any time in Settings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: MOS picker ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-6 pt-8 pb-6">
          <button
            onClick={() => setStep(1)}
            className="text-emerald-300 text-sm mb-4 flex items-center gap-1.5"
          >
            ← Back
          </button>
          <div className="text-3xl mb-3">🎖️</div>
          <h2 className="text-xl font-bold text-white">Which MOS?</h2>
          <p className="text-emerald-200 text-sm mt-1">
            We&apos;ll highlight the sections that matter most for your job.
          </p>
        </div>

        {/* MOS list */}
        <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-2">
          {MOS_LIST.map((mos) => {
            const isSelected = selectedMosId === mos.id;
            return (
              <button
                key={mos.id}
                onClick={() => setSelectedMosId(mos.id)}
                className={[
                  'w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
                  isSelected
                    ? 'bg-emerald-700 ring-2 ring-emerald-400'
                    : 'bg-slate-800 active:bg-slate-700',
                ].join(' ')}
              >
                <span className={`text-xs font-bold w-8 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`}>
                  {mos.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {mos.name}
                  </p>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {mos.sections.join(' · ')}
                  </p>
                </div>
                {isSelected && (
                  <span className="text-white shrink-0">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="px-4 pb-6 pt-3 space-y-2">
          <button
            onClick={() => {
              completeOnboarding('mos', selectedMosId ?? undefined);
              setVisible(false);
            }}
            disabled={!selectedMosId}
            className={[
              'w-full py-3.5 rounded-xl font-semibold text-sm transition-all',
              selectedMosId
                ? 'bg-emerald-600 text-white active:scale-[0.98]'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            Let&apos;s go →
          </button>
          <button
            onClick={() => {
              completeOnboarding('mos', undefined);
              setVisible(false);
            }}
            className="w-full text-xs text-slate-500 py-1.5"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
