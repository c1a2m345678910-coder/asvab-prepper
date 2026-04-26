import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SRSCard, DiagnosticResult } from '@/types/asvab';
import { createCard, gradeCard } from '@/lib/srs';
import { computeSectionMastery } from '@/lib/mastery';

// XP awards per answer — mistake-positive: attempting always earns something
const XP_CORRECT = 10;
const XP_INCORRECT = 2;

// ── State ──────────────────────────────────────────────────────────────────

interface SectionAttempts {
  total: number;
  correct: number;
}

// ── Pending session (for cross-visit resume) ───────────────────────────────

/**
 * A snapshot of an in-progress lesson session, persisted so the user can
 * close the app and continue exactly where they left off.
 *
 * `questionIds` holds the ordered question IDs for the *full* current session
 * queue (starting from index 0 at session start, or from 0 of the restored
 * sub-queue on a resumed session). `currentIndex` is the next unanswered
 * question. Answers already submitted via recordAttempt() are permanently
 * stored in `srsCards` / `correctIdSet` regardless of this snapshot.
 */
export interface PendingSession {
  sectionId: string;
  questionIds: string[];
  /** Index into questionIds of the next question to answer. */
  currentIndex: number;
  reviewMode: boolean;
  /** ISO timestamp — sessions older than 24 h are treated as stale. */
  savedAt: string;
}

interface ProgressState {
  /** Raw attempt counts per section. Key = sectionId (e.g. 'GS'). */
  attemptsBySection: Record<string, SectionAttempts>;
  /**
   * Mastery score per section, 0–1 float.
   * SRS-weighted: 100% requires spaced repetition evidence over ~30 days.
   * Updated on every recordAttempt call via computeSectionMastery().
   */
  masteryBySection: Record<string, number>;
  /** Set of question IDs ever answered correctly. Key = questionId. */
  correctIdSet: Record<string, true>;
  /** Active SRS review cards. Key = questionId. */
  srsCards: Record<string, SRSCard>;
  /** Current study streak in calendar days. */
  streakDays: number;
  /** YYYY-MM-DD (local time) of the last day the user answered a question. */
  lastActiveDate: string | null;
  /** Total XP earned across all sessions. */
  totalXP: number;
  /**
   * Result of the most recently completed AFQT diagnostic.
   * Null until the user completes a diagnostic for the first time.
   */
  latestDiagnostic: DiagnosticResult | null;
  /** Questions answered today (local calendar day). Resets at midnight. */
  dailyQuestions: number;
  /** YYYY-MM-DD (local time) of the current dailyQuestions accumulation. */
  dailyDate: string | null;
  /**
   * In-progress session snapshot. Non-null while a session is active or was
   * interrupted. Cleared when the session completes or user navigates home.
   */
  pendingSession: PendingSession | null;
  /** ISO timestamp of the last successful cloud push or pull. Null if never synced. */
  syncedAt: string | null;
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

  /** Persist the result of the most recently completed AFQT diagnostic. */
  saveDiagnostic: (result: DiagnosticResult) => void;

  /** Add XP directly (used for streak bonuses). */
  addXP: (amount: number) => void;

  /** Persist the current session so the user can resume after closing the app. */
  savePendingSession: (session: PendingSession) => void;

  /** Remove the pending session (call when a session completes or is abandoned). */
  clearPendingSession: () => void;

  /**
   * Reset the daily question counter if the calendar day has changed.
   * Call this on app mount so the counter shows 0 at the start of a new day
   * rather than holding the previous day's count until the first answer.
   */
  resetDailyIfNeeded: () => void;

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
  correctIdSet: {},
  srsCards: {},
  streakDays: 0,
  lastActiveDate: null,
  totalXP: 0,
  latestDiagnostic: null,
  dailyQuestions: 0,
  dailyDate: null,
  pendingSession: null,
  syncedAt: null,
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

          // ── Correct-ID set ───────────────────────────────────────────────
          const correctIdSet: Record<string, true> = correct
            ? { ...state.correctIdSet, [questionId]: true }
            : state.correctIdSet;

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

          // ── Mastery (SRS-weighted, replaces old correct/total formula) ───
          const mastery = computeSectionMastery(sectionId, correctIdSet, srsCards);

          // ── Streak ───────────────────────────────────────────────────────
          const streak = computeStreak(state.streakDays, state.lastActiveDate);

          // ── Daily counter ─────────────────────────────────────────────────
          const today = todayStr();
          const prevDaily = state.dailyDate === today ? state.dailyQuestions : 0;

          return {
            attemptsBySection: {
              ...state.attemptsBySection,
              [sectionId]: updated,
            },
            masteryBySection: {
              ...state.masteryBySection,
              [sectionId]: mastery,
            },
            correctIdSet,
            srsCards,
            totalXP: state.totalXP + (correct ? XP_CORRECT : XP_INCORRECT),
            dailyQuestions: prevDaily + 1,
            dailyDate: today,
            ...streak,
          };
        }),

      updateStreak: () =>
        set((state) => computeStreak(state.streakDays, state.lastActiveDate)),

      addXP: (amount) =>
        set((state) => ({ totalXP: state.totalXP + amount })),

      savePendingSession: (session) =>
        set({ pendingSession: session }),

      clearPendingSession: () =>
        set({ pendingSession: null }),

      resetDailyIfNeeded: () =>
        set((state) => {
          const today = todayStr();
          if (state.dailyDate === today) return {};
          return { dailyQuestions: 0, dailyDate: today };
        }),

      saveDiagnostic: (result) => set({ latestDiagnostic: result }),

      resetProgress: () => set({ ...initialState }),
    }),
    {
      name: 'asvab-v1',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = persistedState as Record<string, unknown>;
        if (fromVersion < 2) {
          // v1 → v2: add correctIdSet, clear stale correct/total mastery
          s.correctIdSet = s.correctIdSet ?? {};
          s.masteryBySection = {};
        }
        if (fromVersion < 3) {
          // v2 → v3: add pendingSession
          s.pendingSession = null;
        }
        if (fromVersion < 4) {
          // v3 → v4: add syncedAt for cloud sync tracking
          s.syncedAt = null;
        }
        return s;
      },
    },
  ),
);
