import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProgress, SRSCard, QuestionAttempt } from '@/types/asvab';

// ── State shape ────────────────────────────────────────────────────────────

interface ProgressState {
  /**
   * Per-section aggregate progress.
   * Key is sectionId (e.g. 'GS', 'AR').
   */
  progressBySectionId: Record<string, UserProgress>;

  /**
   * SRS review queue.
   * Key is questionId. Cards with nextReviewAt <= now are due.
   */
  srsCards: Record<string, SRSCard>;

  /**
   * History of question attempts in the current session.
   * Ephemeral — not persisted to localStorage, cleared on session reset.
   */
  sessionAttempts: QuestionAttempt[];
}

// ── Actions shape ──────────────────────────────────────────────────────────

interface ProgressActions {
  /**
   * Record a completed attempt.
   * Updates section progress totals and, if incorrect, creates/updates
   * the SRS card for the question (mistake-positive: wrong answers go to
   * the review queue, no punitive mechanics).
   */
  recordAttempt: (attempt: QuestionAttempt) => void;

  /** Reset the current session's attempt history */
  clearSession: () => void;

  /**
   * Persist an updated SRS card after a scheduled review.
   * Full SM-2 computation lives in a pure helper (src/lib/srs.ts).
   */
  updateSRSCard: (card: SRSCard) => void;

  /** Remove an SRS card once the question has been fully graduated */
  removeSRSCard: (questionId: string) => void;

  /** Wipe all persisted progress — used for "start over" feature */
  resetAllProgress: () => void;
}

type ProgressStore = ProgressState & ProgressActions;

// ── Initial state ──────────────────────────────────────────────────────────

const initialState: ProgressState = {
  progressBySectionId: {},
  srsCards: {},
  sessionAttempts: [],
};

// ── Store ──────────────────────────────────────────────────────────────────

/**
 * useProgressStore — Zustand v5 store with localStorage persistence.
 *
 * The curried `create<T>()( ... )` form is required in Zustand v5 TypeScript
 * to get proper generic inference for the `set`/`get` callback parameters.
 *
 * `partialize` excludes `sessionAttempts` from persistence — it is ephemeral
 * and only meaningful during an active study session.
 *
 * NOTE: This store must only be imported in Client Components. The
 * `createJSONStorage(() => localStorage)` call is lazy and safe from SSR
 * errors, but Next.js will error if a Server Component imports this module.
 */
export const useProgressStore = create<ProgressStore>()(
  persist(
    (set) => ({
      ...initialState,

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      recordAttempt: (_attempt: QuestionAttempt) => {
        // TODO: implement when src/lib/srs.ts is ready.
        // Steps:
        //   1. Append attempt to sessionAttempts.
        //   2. Upsert progressBySectionId[sectionId] totals.
        //   3. If !isCorrect, create or update srsCards[questionId].
        throw new Error('recordAttempt: not yet implemented');
      },

      clearSession: () => set({ sessionAttempts: [] }),

      updateSRSCard: (card: SRSCard) =>
        set((state) => ({
          srsCards: { ...state.srsCards, [card.questionId]: card },
        })),

      removeSRSCard: (questionId: string) =>
        set((state) => {
          const next = { ...state.srsCards };
          delete next[questionId];
          return { srsCards: next };
        }),

      resetAllProgress: () => set({ ...initialState }),
    }),
    {
      name: 'asvab-progress',
      storage: createJSONStorage(() => localStorage),
      // Only persist durable state — sessionAttempts are in-memory only.
      partialize: (state) => ({
        progressBySectionId: state.progressBySectionId,
        srsCards: state.srsCards,
      }),
    }
  )
);
