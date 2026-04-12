import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SRSCard } from '@/types/asvab';
import { createCard, gradeCard } from '@/lib/srs';

// XP awards per answer — mistake-positive: attempting always earns something
const XP_CORRECT = 10;
const XP_INCORRECT = 2;

// ── State ──────────────────────────────────────────────────────────────────

interface SectionAttempts {
  total: number;
  correct: number;
}

interface ProgressState {
  /** Raw attempt counts per section. Key = sectionId (e.g. 'GS'). */
  attemptsBySection: Record<string, SectionAttempts>;
  /**
   * Mastery score per section, 0–1 float.
   * Computed as correct / total; updated on every recordAttempt call.
   */
  masteryBySection: Record<string, number>;
  /** Active SRS review cards. Key = questionId. */
  srsCards: Record<string, SRSCard>;
  /** Current study streak in calendar days. */
  streakDays: number;
  /** YYYY-MM-DD (local time) of the last day the user answered a question. */
  lastActiveDate: string | null;
  /** Total XP earned across all sessions. */
  totalXP: number;
}

// ── Actions ────────────────────────────────────────────────────────────────

interface ProgressActions {
  /**
   * Record one question attempt.
   *
   * - Updates attempt counts and mastery for the section.
   * - Wrong answers create/update an SRS card (quality 1 = incorrect).
   * - Correct answers on an existing SRS card advance its schedule (quality 4).
   * - Awards XP: 10 for correct, 2 for incorrect (mistake-positive).
   * - Calls updateStreak() automatically.
   */
  recordAttempt: (sectionId: string, questionId: string, correct: boolean) => void;

  /**
   * Maintain the day streak. Safe to call multiple times per day —
   * only updates once per calendar day. Called internally by recordAttempt,
   * but can also be called on app open to capture passive streaks.
   */
  updateStreak: () => void;

  /** Wipe all persisted progress and reset to initial state. */
  resetProgress: () => void;
}

type ProgressStore = ProgressState & ProgressActions;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD in the user's local time. */
function todayStr(): string {
  // 'en-CA' locale formats dates as YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA');
}

/** Yesterday's date as YYYY-MM-DD in the user's local time. */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

/**
 * Compute the new streak values given the current state.
 * Pure function — used by both recordAttempt and updateStreak.
 */
function computeStreak(
  currentStreak: number,
  lastActiveDate: string | null,
): { streakDays: number; lastActiveDate: string } {
  const today = todayStr();
  if (lastActiveDate === today) {
    // Already counted today — no change needed
    return { streakDays: currentStreak, lastActiveDate: today };
  }
  const newStreak =
    lastActiveDate === yesterdayStr()
      ? currentStreak + 1  // consecutive day: extend streak
      : 1;                 // gap in days: restart streak
  return { streakDays: newStreak, lastActiveDate: today };
}

// ── Initial state ──────────────────────────────────────────────────────────

const initialState: ProgressState = {
  attemptsBySection: {},
  masteryBySection: {},
  srsCards: {},
  streakDays: 0,
  lastActiveDate: null,
  totalXP: 0,
};

// ── Store ──────────────────────────────────────────────────────────────────

/**
 * useProgressStore — persisted Zustand v5 store.
 *
 * All state is written to localStorage under the key 'asvab-v1'.
 *
 * Client Components only: do NOT import this in Server Components.
 * The localStorage access is lazy (Zustand's persist middleware), so
 * there are no SSR errors, but the module itself should only be bundled
 * for the client.
 */
export const useProgressStore = create<ProgressStore>()(
  persist(
    (set) => ({
      ...initialState,

      recordAttempt: (sectionId, questionId, correct) =>
        set((state) => {
          // ── Attempt counts ───────────────────────────────────────────────
          const prev = state.attemptsBySection[sectionId] ?? {
            total: 0,
            correct: 0,
          };
          const updated: SectionAttempts = {
            total: prev.total + 1,
            correct: prev.correct + (correct ? 1 : 0),
          };

          // ── Mastery (correct / total, clamped to [0, 1]) ────────────────
          const mastery = Math.min(1, updated.correct / updated.total);

          // ── SRS ──────────────────────────────────────────────────────────
          const existing = state.srsCards[questionId];
          let srsCards = state.srsCards;

          if (!correct) {
            // Wrong answer → create or degrade the card (quality 1 = incorrect)
            const card = existing ?? createCard(questionId, sectionId);
            srsCards = { ...state.srsCards, [questionId]: gradeCard(card, 1) };
          } else if (existing) {
            // Correct on an active review card → advance its schedule (quality 4)
            srsCards = {
              ...state.srsCards,
              [questionId]: gradeCard(existing, 4),
            };
          }

          // ── Streak ───────────────────────────────────────────────────────
          const streak = computeStreak(state.streakDays, state.lastActiveDate);

          return {
            attemptsBySection: {
              ...state.attemptsBySection,
              [sectionId]: updated,
            },
            masteryBySection: {
              ...state.masteryBySection,
              [sectionId]: mastery,
            },
            srsCards,
            totalXP: state.totalXP + (correct ? XP_CORRECT : XP_INCORRECT),
            ...streak,
          };
        }),

      updateStreak: () =>
        set((state) => computeStreak(state.streakDays, state.lastActiveDate)),

      resetProgress: () => set({ ...initialState }),
    }),
    {
      name: 'asvab-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
