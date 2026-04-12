import type { Question } from '@/types/asvab';
import { getQuestionsForSection } from './questions';

// ── Constants ──────────────────────────────────────────────────────────────

/** The four AFQT-contributing sections tested in the diagnostic. */
export const DIAGNOSTIC_SECTION_IDS = ['AR', 'WK', 'PC', 'MK'] as const;
export type DiagnosticSectionId = (typeof DIAGNOSTIC_SECTION_IDS)[number];

/** Target session length for the adaptive diagnostic. */
export const DIAGNOSTIC_TOTAL = 30;

const DIFFICULTY_START = 3 as const;

// ── Types ──────────────────────────────────────────────────────────────────

/** One answered question during the diagnostic. */
export interface DiagnosticResponse {
  question: Question;
  correct: boolean;
}

// ── Adaptive logic ─────────────────────────────────────────────────────────

/**
 * Compute the next target difficulty given prior responses.
 *
 * Algorithm: classic 1-up-1-down staircase.
 *   - Start at difficulty 3 (medium).
 *   - Correct answer → increase by 1 (up to 5).
 *   - Wrong answer   → decrease by 1 (down to 1).
 *
 * The staircase is intentionally simple. Because the IRT ability estimate
 * (see afqtProjection.ts) uses the full response history, the difficulty
 * trajectory only needs to keep questions in a reasonable information range —
 * it doesn't need to be an optimal adaptive algorithm itself.
 */
export function nextTargetDifficulty(
  responses: DiagnosticResponse[],
): 1 | 2 | 3 | 4 | 5 {
  if (responses.length === 0) return DIFFICULTY_START;
  const last = responses[responses.length - 1];
  const current = last.question.difficulty;
  const next = last.correct
    ? Math.min(5, current + 1)
    : Math.max(1, current - 1);
  return next as 1 | 2 | 3 | 4 | 5;
}

/**
 * Select the next adaptive diagnostic question.
 *
 * Selection strategy (in priority order):
 * 1. Prefer the AFQT section with the fewest questions answered so far
 *    (keeps coverage balanced across AR / WK / PC / MK).
 * 2. Within that section, pick a random unseen question at the target difficulty.
 * 3. If no question exists at the exact target difficulty, widen the search
 *    outward (|delta|=1, 2, …) across all four sections until one is found.
 *
 * Returns null when all eligible questions have been used or no AFQT questions
 * exist in the data at all (e.g., question banks are still empty).
 *
 * @param responses  All responses given so far this session.
 * @param usedIds    Set of question IDs already shown (pre-built from responses
 *                   for O(1) lookup; must stay in sync with responses).
 */
export function selectDiagnosticQuestion(
  responses: DiagnosticResponse[],
  usedIds: Set<string>,
): Question | null {
  const targetDiff = nextTargetDifficulty(responses);

  // Tally how many questions each AFQT section has contributed.
  const sectionCounts: Record<DiagnosticSectionId, number> = {
    AR: 0, WK: 0, PC: 0, MK: 0,
  };
  for (const r of responses) {
    const sid = r.question.sectionId as DiagnosticSectionId;
    if (sid in sectionCounts) sectionCounts[sid]++;
  }

  // Sort sections so the least-represented comes first.
  const sectionOrder = ([...DIAGNOSTIC_SECTION_IDS] as DiagnosticSectionId[]).sort(
    (a, b) => sectionCounts[a] - sectionCounts[b],
  );

  // Pass 1: exact difficulty match.
  for (const sectionId of sectionOrder) {
    const q = pickOne(getQuestionsForSection(sectionId), usedIds, targetDiff);
    if (q) return q;
  }

  // Pass 2: widen outward from target difficulty until a candidate is found.
  for (let delta = 1; delta <= 4; delta++) {
    const adjacentDiffs = [targetDiff - delta, targetDiff + delta].filter(
      (d): d is 1 | 2 | 3 | 4 | 5 => d >= 1 && d <= 5,
    );
    for (const sectionId of sectionOrder) {
      for (const d of adjacentDiffs) {
        const q = pickOne(getQuestionsForSection(sectionId), usedIds, d);
        if (q) return q;
      }
    }
  }

  return null; // question bank exhausted or still empty
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Pick a random unseen question at an exact difficulty from the given pool. */
function pickOne(
  questions: Question[],
  usedIds: Set<string>,
  difficulty: number,
): Question | null {
  const pool = questions.filter(
    (q) => !usedIds.has(q.id) && q.difficulty === difficulty,
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
