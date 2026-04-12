// ── Shared primitives ──────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';

// ── Section ────────────────────────────────────────────────────────────────

export interface Section {
  /** Short uppercase identifier matching sectionId in questions (e.g. "GS") */
  id: string;
  /** Full display name (e.g. "General Science") */
  name: string;
  /** Two-letter abbreviation (e.g. "GS") */
  abbrev: string;
  /** True only for AR, WK, PC, MK — the four AFQT-contributing sections */
  isAFQT: boolean;
  /** One-sentence description of what the section tests */
  description: string;
  /** Emoji used as icon in the UI (e.g. "🔬") */
  iconEmoji: string;
}

// ── Question discriminated union ───────────────────────────────────────────

interface QuestionBase {
  id: string;
  sectionId: string;
  difficulty: Difficulty;
  /** Zero-based index into options[] pointing to the correct answer */
  correctIndex: number;
  options: string[];
  /** Shown after an attempt; explains why the answer is correct */
  explanation: string;
}

/** Standard multiple-choice question used by most sections */
export interface MCQQuestion extends QuestionBase {
  type: 'mcq';
  question: string;
}

/** Word Knowledge section: match a word to its definition */
export interface VocabMatchQuestion extends QuestionBase {
  type: 'vocab';
  word: string;
  /** The correct definition — semantically separate from the distractor options */
  definition: string;
}

/** Paragraph Comprehension section: passage followed by a question */
export interface PassageQuestion extends QuestionBase {
  type: 'passage';
  passage: string;
  question: string;
}

/**
 * Assembling Objects (AO) and Mechanical Comprehension (MC):
 * questions that reference a diagram image.
 */
export interface DiagramQuestion extends QuestionBase {
  type: 'diagram';
  /** Relative path or absolute URL to the diagram image (stored under /public) */
  diagramUrl: string;
  /** Accessible alt text for the diagram */
  altText: string;
  question: string;
}

export type Question =
  | MCQQuestion
  | VocabMatchQuestion
  | PassageQuestion
  | DiagramQuestion;

// ── Study / progress tracking ──────────────────────────────────────────────

/** A single attempt at one question during a practice session */
export interface QuestionAttempt {
  questionId: string;
  sectionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  /** Unix epoch milliseconds */
  timestamp: number;
  /** How long the user spent before answering, in milliseconds */
  timeSpentMs: number;
}

/** Aggregate progress for a single section, persisted across sessions */
export interface UserProgress {
  sectionId: string;
  totalAttempted: number;
  totalCorrect: number;
  /** Current consecutive-correct streak for this section */
  streak: number;
  /** ISO-8601 datetime string of the most recent study session */
  lastStudiedAt: string;
}

// ── Spaced-Repetition System (SM-2-like) ──────────────────────────────────

/**
 * One SRS card per question. A card is created or updated whenever the user
 * answers incorrectly — wrong answers are added to the review queue
 * automatically. No punitive hearts/lives system.
 *
 * Algorithm fields mirror SM-2:
 *   interval       — days until next review (starts at 1)
 *   easiness       — multiplier applied to interval on correct recall (default 2.5, min 1.3)
 *   repetitions    — count of consecutive correct recalls at current interval
 *   lapses         — total times this card was answered incorrectly after graduation
 *   nextReviewDate — ISO-8601 datetime when card is due for review
 */
export interface SRSCard {
  questionId: string;
  sectionId: string;
  /** Days until the next review */
  interval: number;
  /** SM-2 ease factor; minimum 1.3, default 2.5 */
  easiness: number;
  /** ISO-8601 datetime string */
  nextReviewDate: string;
  /** Number of consecutive successful reviews at current interval */
  repetitions: number;
  /** Number of times this card has lapsed (answered incorrectly after graduation) */
  lapses: number;
}
