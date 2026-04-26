'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePrefsStore, type Theme, MOS_LIST } from '@/store/prefsStore';
import { useProgressStore } from '@/store/progressStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import QuestionBankManager from '@/components/QuestionBankManager';
import SyncStatusBadge from '@/components/SyncStatusBadge';

const VERSION = '1.0.0';

const THEME_OPTIONS: { value: Theme; label: string; emoji: string }[] = [
  { value: 'system', label: 'System', emoji: '🖥️' },
  { value: 'light', label: 'Light', emoji: '☀️' },
  { value: 'dark', label: 'Dark', emoji: '🌙' },
];

export default function SettingsPage() {
  const { theme, setTheme, resetOnboarding, studyGoal, selectedMos, setSelectedMos } = usePrefsStore();
  const { resetProgress } = useProgressStore();
  const { user } = useAuthStore();

  const [resetInput, setResetInput] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  async function handleSignIn() {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${base}/auth/callback` },
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Local data intentionally preserved after sign-out
  }

  function handleReset() {
    if (resetInput !== 'RESET') return;
    resetProgress();
    resetOnboarding();
    setResetInput('');
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  function handleExport() {
    const progressData = JSON.parse(
      localStorage.getItem('asvab-v1') ?? '{}',
    );
    const prefsData = JSON.parse(
      localStorage.getItem('asvab-prefs') ?? '{}',
    );
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            version: VERSION,
            progress: progressData,
            prefs: prefsData,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asvab-prep-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 3000);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 safe-pt-12 pb-6">
        <Link
          href="/"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors text-lg"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
      </header>

      <div className="px-4 space-y-6 pb-16 max-w-lg">
        {/* Account / Sync */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Account
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800">
            {user ? (
              <>
                <div className="px-4 py-3.5 flex items-center gap-3">
                  {user.user_metadata?.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.user_metadata.avatar_url as string}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {(user.user_metadata?.full_name as string) ?? user.email}
                    </p>
                    <SyncStatusBadge />
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                >
                  <span className="text-sm text-red-500">Sign out</span>
                  <span className="text-slate-400 text-sm">→</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleSignIn}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
              >
                <span className="text-lg">🔑</span>
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  Sign in with Google
                </span>
                <span className="ml-auto text-slate-400 text-sm">→</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2 px-1">
            Sign in to sync your progress across devices. Your data stays local if you sign out.
          </p>
        </section>

        {/* Theme */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Appearance
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm">
                  <span>{opt.emoji}</span>
                  <span className="text-slate-800 dark:text-slate-200">{opt.label}</span>
                </span>
                {theme === opt.value && (
                  <span className="text-indigo-500 dark:text-indigo-400 font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* MOS Target — only when goal is MOS */}
        {studyGoal === 'mos' && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
              MOS Target
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800">
              {MOS_LIST.map((mos) => (
                <button
                  key={mos.id}
                  onClick={() => setSelectedMos(mos.id)}
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-xs font-bold text-emerald-500 w-8 shrink-0">{mos.id}</span>
                    <span className="text-slate-800 dark:text-slate-200">{mos.name}</span>
                  </span>
                  {selectedMos === mos.id && (
                    <span className="text-emerald-500 font-bold">✓</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setSelectedMos(null)}
                className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-xs font-bold text-slate-400 w-8 shrink-0">—</span>
                  <span className="text-slate-500 dark:text-slate-400">None / not sure yet</span>
                </span>
                {selectedMos === null && (
                  <span className="text-slate-400 font-bold">✓</span>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 px-1">
              Sections relevant to your MOS are highlighted on the home screen.
            </p>
          </section>
        )}

        {/* Export */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Data
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800">
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
            >
              <span className="flex items-center gap-3 text-sm">
                <span>📤</span>
                <span className="text-slate-800 dark:text-slate-200">Export progress</span>
              </span>
              {exportDone ? (
                <span className="text-green-500 text-xs font-semibold">Downloaded!</span>
              ) : (
                <span className="text-slate-400 text-sm">→</span>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 px-1">
            Downloads your progress and preferences as a JSON file.
          </p>
        </section>

        {/* Question Bank */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Question Bank
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
            <QuestionBankManager />
          </div>
          <p className="text-xs text-slate-400 mt-2 px-1">
            Analyses current question counts and your mastery scores, then
            generates exactly what&apos;s needed via Gemini.
          </p>
        </section>

        {/* Reset */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Danger zone
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-4 space-y-3 border border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Type <span className="font-mono font-bold text-red-500">RESET</span> to
              wipe all progress, SRS cards, streaks, and onboarding state.
            </p>
            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder="Type RESET to confirm"
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
            <button
              onClick={handleReset}
              disabled={resetInput !== 'RESET'}
              className={[
                'w-full py-3 rounded-xl font-semibold text-sm transition-all',
                resetInput === 'RESET'
                  ? 'bg-red-600 text-white active:scale-[0.98]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed',
              ].join(' ')}
            >
              {resetDone ? 'Reset complete ✓' : 'Reset all progress'}
            </button>
          </div>
        </section>

        {/* Version */}
        <section className="pt-2">
          <p className="text-center text-xs text-slate-400">
            ASVAB Prep v{VERSION}
          </p>
        </section>
      </div>
    </div>
  );
}
