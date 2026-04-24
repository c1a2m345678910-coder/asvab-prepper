import type { Question, SRSCard } from '@/types/asvab';
import { getDueCards } from './srs';
import { getQuestionsForSection, shuffle } from './questions';
import { SECTIONS } from './sections';

// ── Lesson selection ───────────────────────────────────────────────────────

/**
 * Select a mixed queue of questions for a practice session.
 *
 * The queue blends two pools:
 *   - "due"   — questions whose SRS card has nextReviewDate ≤ now
 *   - "fresh" — everything else (no card yet, or card not due)
 *
 * @param sectionId  Section to pull questions from (e.g. 'AR')
 * @param srsCards   Current SRS deck; used to classify questions
 * @param count      Target session length — default 10
 * @param newRatio   Fraction of slots to fill from the "fresh" pool — default 0.7
 *                   So with count=10 and newRatio=0.7: 7 fresh + 3 due (ideal)
 *
 * When either pool is smaller than its target, the remaining slots are
 * backfilled from the other pool so the session always reaches `count`
 * questions (or fewer if the section has fewer questions in total).
 *
 * Returns a shuffled array — pure, no side effects.
 *
 * @example
 * // 70 / 30 split, 10 questions
 * const q = selectQuestions('AR', store.srsCards, 10, 0.7);
 *
 * // Review-only: 0 fresh (all due)
 * const r = selectQuestions('AR', store.srsCards, 10, 0);
 */
export function selectQuestions(
  sectionId: string,
  srsCards: Record<string, SRSCard>,
  count = 10,
  newRatio = 0.7,
): Question[] {
  const all = getQuestionsForSection(sectionId);
  if (all.length === 0) return [];

  const actual = Math.min(count, all.length);
  const nowMs = Date.now();

  const isDue = (q: Question): boolean => {
    const card = srsCards[q.id];
    return card !== undefined && new Date(card.nextReviewDate).getTime() <= nowMs;
  };

  const due = shuffle(all.filter(isDue));
  const fresh = shuffle(all.filter((q) => !isDue(q)));

  // Ideal split
  const idealDue = Math.round(actual * (1 - newRatio));
  const dueCount = Math.min(idealDue, due.length);
  const freshCount = Math.min(actual - dueCount, fresh.length);

  // Backfill any remaining slots from whichever pool has extras
  const needed = actual - dueCount - freshCount;
  const backfill =
    needed > 0
      ? shuffle([
          ...due.slice(dueCount),
          ...fresh.slice(freshCount),
        ]).slice(0, needed)
      : [];

  return shuffle([
    ...due.slice(0, dueCount),
    ...fresh.slice(0, freshCount),
    ...backfill,
  ]);
}

// ── Review selection ───────────────────────────────────────────────────────

/**
 * Select all due review questions for a given section (or every section).
 *
 * @param srsCards   Current SRS deck
 * @param sectionId  If provided, restrict to this section; otherwise all sections
 *
 * Returns a shuffled array of questions that have SRS cards due today.
 */
export function selectReviewQuestions(
  srsCards: Record<string, SRSCard>,
  sectionId?: string,
  limit = Infinity,
): Question[] {
  const dueCards = getDueCards(srsCards, new Date());
  if (dueCards.length === 0) return [];

  const dueIds = new Set(dueCards.map((c) => c.questionId));
  const sectionIds = sectionId ? [sectionId] : SECTIONS.map((s) => s.id);

  const questions: Question[] = [];
  for (const sid of sectionIds) {
    questions.push(...getQuestionsForSection(sid).filter((q) => dueIds.has(q.id)));
  }

  return shuffle(questions).slice(0, limit);
}

// ── Review queue stats ─────────────────────────────────────────────────────

/**
 * Count due SRS cards per section.
 * Only sections with at least one due card appear in the result.
 *
 * @example
 * const counts = getDueBySectionCount(store.srsCards);
 * // → { AR: 3, WK: 1 }
 */
export function getDueBySectionCount(
  srsCards: Record<string, SRSCard>,
): Record<string, number> {
  const dueCards = getDueCards(srsCards, new Date());
  const counts: Record<string, number> = {};
  for (const card of dueCards) {
    counts[card.sectionId] = (counts[card.sectionId] ?? 0) + 1;
  }
  return counts;
}
