import type { SRSCard } from '@/types/asvab';

const EASE_DEFAULT = 2.5;
const EASE_MIN = 1.3;

// ── Card factory ───────────────────────────────────────────────────────────

/**
 * Create a brand-new SRS card for a question.
 * Cards are created the first time a question is answered incorrectly.
 * nextReviewDate is set to now so the card appears immediately in the queue.
 */
export function createCard(questionId: string, sectionId: string): SRSCard {
  return {
    questionId,
    sectionId,
    easiness: EASE_DEFAULT,
    interval: 1,
    repetitions: 0,
    lapses: 0,
    nextReviewDate: new Date().toISOString(),
  };
}

// ── SM-2 grading ───────────────────────────────────────────────────────────

/**
 * Grade a card using the SM-2 spaced-repetition algorithm and return an
 * updated copy. The original card is not mutated.
 *
 * quality 0–5:
 *   5 = perfect recall, no hesitation
 *   4 = correct with slight hesitation          ← use for normal correct answers
 *   3 = correct but required significant effort
 *   2 = incorrect; correct answer felt obvious in hindsight
 *   1 = incorrect                               ← use for wrong answers
 *   0 = complete blackout
 *
 * Correct recall (quality >= 3) advances the interval schedule.
 * Incorrect recall (quality < 3) resets repetitions to 0, interval to 1,
 * and increments lapses.
 *
 * Interval progression (quality = 4, easiness stays at 2.5):
 *   rep 0 → 1 : interval =  1 day
 *   rep 1 → 2 : interval =  6 days
 *   rep 2 → 3 : interval = 15 days  (round(6 × 2.5))
 *
 * @example
 * // Three consecutive correct answers (quality=4, "normal correct"):
 * // Start:   { interval: 1,  repetitions: 0, easiness: 2.5 }
 * // Grade 1: { interval: 1,  repetitions: 1, easiness: 2.5 }  → review in 1 day
 * // Grade 2: { interval: 6,  repetitions: 2, easiness: 2.5 }  → review in 6 days
 * // Grade 3: { interval: 15, repetitions: 3, easiness: 2.5 }  → review in 15 days
 *
 * // With quality=5 (perfect recall), easiness grows each rep:
 * // Start:   { interval: 1,  repetitions: 0, easiness: 2.5 }
 * // Grade 1: { interval: 1,  repetitions: 1, easiness: 2.6 }  → review in 1 day
 * // Grade 2: { interval: 6,  repetitions: 2, easiness: 2.7 }  → review in 6 days
 * // Grade 3: { interval: 16, repetitions: 3, easiness: 2.8 }  → review in 16 days
 *
 * // Wrong answer (quality=1) resets the card:
 * // { interval: 6, repetitions: 2 } → { interval: 1, repetitions: 0, lapses: +1 }
 */
export function gradeCard(card: SRSCard, quality: number): SRSCard {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { easiness, interval, repetitions, lapses } = card;

  if (q >= 3) {
    // Correct recall — advance the interval schedule
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions += 1;
  } else {
    // Incorrect recall — restart from day 1
    lapses += 1;
    repetitions = 0;
    interval = 1;
  }

  // SM-2 ease factor update; clamp to minimum 1.3 so cards never stagnate
  easiness = Math.max(
    EASE_MIN,
    easiness + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02),
  );

  const nextReviewDate = new Date(
    Date.now() + interval * 24 * 60 * 60 * 1000,
  ).toISOString();

  return { ...card, easiness, interval, repetitions, lapses, nextReviewDate };
}

// ── Due-card query ─────────────────────────────────────────────────────────

/**
 * Return all cards whose nextReviewDate is on or before `now`.
 * Pass `new Date()` for the current due list.
 *
 * @example
 * const due = getDueCards(store.srsCards, new Date());
 * // → SRSCard[] ready for review right now
 */
export function getDueCards(
  cards: Record<string, SRSCard>,
  now: Date,
): SRSCard[] {
  const nowMs = now.getTime();
  return Object.values(cards).filter(
    (card) => new Date(card.nextReviewDate).getTime() <= nowMs,
  );
}
