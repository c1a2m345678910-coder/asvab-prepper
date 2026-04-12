import { create } from 'zustand';
import type { Question } from '@/types/asvab';
import { getQuestionsForSection, shuffle } from '@/lib/questions';

// ── State ──────────────────────────────────────────────────────────────────

interface SessionState {
  /** Whether a session is currently in progress. */
  isActive: boolean;
  /** The sectionId being studied (e.g. 'AR'). Null when no session is active. */
  currentSection: string | null;
  /** The ordered list of questions for this session. */
  questionQueue: Question[];
  /** Zero-based index into questionQueue pointing at the current question. */
  currentIndex: number;
  /** Number of questions answered correctly this session. */
  sessionCorrect: number;
  /** Number of questions answered incorrectly this session. */
  sessionWrong: number;
}

// ── Actions ────────────────────────────────────────────────────────────────

interface SessionActions {
  /**
   * Start a new session for the given section.
   * Questions are shuffled; if fewer than `count` exist, all are used.
   * Any in-progress session is discarded.
   */
  startSession: (sectionId: string, count: number) => void;

  /**
   * Record whether the current question was answered correctly or not.
   * Call this before nextQuestion() so counts stay in sync.
   * Does not advance the index — pair with nextQuestion().
   */
  answer: (correct: boolean) => void;

  /**
   * Advance to the next question.
   * Automatically sets isActive = false when the queue is exhausted.
   */
  nextQuestion: () => void;

  /** End the session early and reset all session state. */
  endSession: () => void;
}

type SessionStore = SessionState & SessionActions;

// ── Initial state ──────────────────────────────────────────────────────────

const initialState: SessionState = {
  isActive: false,
  currentSection: null,
  questionQueue: [],
  currentIndex: 0,
  sessionCorrect: 0,
  sessionWrong: 0,
};

// ── Store (no persistence — session is ephemeral) ──────────────────────────

/**
 * useSessionStore — in-memory only, no localStorage.
 *
 * The session is intentionally transient: navigating away or refreshing
 * the page ends the session. Durable progress is written to useProgressStore
 * via recordAttempt(), which the component/hook calling answer() is
 * responsible for coordinating.
 *
 * Client Components only.
 */
export const useSessionStore = create<SessionStore>()((set) => ({
  ...initialState,

  startSession: (sectionId, count) => {
    const all = getQuestionsForSection(sectionId);
    const queue = shuffle(all).slice(0, count);
    set({
      ...initialState,
      isActive: queue.length > 0,
      currentSection: sectionId,
      questionQueue: queue,
    });
  },

  answer: (correct) =>
    set((state) => ({
      sessionCorrect: state.sessionCorrect + (correct ? 1 : 0),
      sessionWrong: state.sessionWrong + (correct ? 0 : 1),
    })),

  nextQuestion: () =>
    set((state) => {
      const nextIndex = state.currentIndex + 1;
      const exhausted = nextIndex >= state.questionQueue.length;
      return {
        currentIndex: nextIndex,
        isActive: !exhausted,
      };
    }),

  endSession: () => set({ ...initialState }),
}));

// ── Derived selectors (use outside the store to avoid re-renders) ──────────

/**
 * Get the current question from a session snapshot.
 * Returns null when the session is inactive or the queue is exhausted.
 *
 * @example
 * const { questionQueue, currentIndex } = useSessionStore();
 * const q = currentQuestion({ questionQueue, currentIndex });
 */
export function currentQuestion(state: Pick<SessionState, 'questionQueue' | 'currentIndex'>): Question | null {
  return state.questionQueue[state.currentIndex] ?? null;
}

/**
 * Compute session score as a percentage (0–100), rounded to the nearest integer.
 * Returns 0 if no questions have been answered yet.
 *
 * @example
 * const score = sessionScore({ sessionCorrect: 7, sessionWrong: 3 }); // → 70
 */
export function sessionScore(state: Pick<SessionState, 'sessionCorrect' | 'sessionWrong'>): number {
  const total = state.sessionCorrect + state.sessionWrong;
  if (total === 0) return 0;
  return Math.round((state.sessionCorrect / total) * 100);
}
