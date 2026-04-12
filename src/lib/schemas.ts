/**
 * Zod validation schemas for all ASVAB question types.
 *
 * This module is intentionally self-contained — it does NOT import from
 * `@/types/asvab` so that it can be consumed by Node scripts in /scripts/
 * as well as by the Next.js app without path-alias complications.
 *
 * The shapes here must stay in sync with the TypeScript interfaces in
 * src/types/asvab.ts. The TypeScript types exported via z.infer<> are the
 * authoritative runtime-checkable form.
 */

import { z } from 'zod';

// ── Shared ─────────────────────────────────────────────────────────────────

/**
 * Numeric difficulty 1–5.
 *   1 = very easy  (e.g., single-step arithmetic, common vocabulary)
 *   3 = medium     (grade-appropriate problem-solving)
 *   5 = very hard  (multi-step reasoning, advanced vocabulary)
 */
export const DifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export type DifficultyLevel = z.infer<typeof DifficultySchema>;

const QuestionBaseSchema = z.object({
  /**
   * Unique question identifier — format "<SECTION>-<000>" e.g. "WK-042".
   * Optional during generation (assigned programmatically); required in the
   * final JSON file.
   */
  id: z.string().min(1).optional(),
  /** Two-letter section code matching the JSON file name. */
  sectionId: z.string().min(1),
  difficulty: DifficultySchema,
  /** Zero-based index into options[] pointing to the correct answer (0–3). */
  correctIndex: z.number().int().min(0).max(3),
  /** Exactly 4 answer choices. */
  options: z.array(z.string().min(1)).length(4),
  /** Educational explanation shown after the user answers. */
  explanation: z.string().min(20),
});

// ── Question type schemas ──────────────────────────────────────────────────

/** GS / AR / MK / EI / AS / MC — standard 4-option multiple choice. */
export const MCQQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal('mcq'),
  /** The question stem (may include a word problem, formula, or scenario). */
  question: z.string().min(10),
});

/**
 * WK (Word Knowledge) — the user sees a word and picks the best definition.
 *
 * `definition` is the authoritative correct meaning (same text as
 * `options[correctIndex]`); it is stored separately so UI components can
 * display it prominently without scanning the options array.
 */
export const VocabMatchSchema = QuestionBaseSchema.extend({
  type: z.literal('vocab'),
  /** Target word in all-caps (e.g. "CIRCUMSPECT"). */
  word: z.string().min(1),
  /**
   * The correct definition — must equal options[correctIndex].
   * The three distractors are semantically distinct wrong definitions.
   */
  definition: z.string().min(10),
});

/** PC (Paragraph Comprehension) — a short passage followed by a question. */
export const PassageQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal('passage'),
  /** The reading passage (80–300 words, informational/neutral topic). */
  passage: z.string().min(50),
  /** The comprehension question about the passage. */
  question: z.string().min(10),
});

/** MC / AO — question references a diagram image (for text-based questions use 'mcq'). */
export const DiagramQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal('diagram'),
  /** Path relative to /public (e.g. "/diagrams/mc/MC-001.png"). */
  diagramUrl: z.string().min(1),
  /** Accessible alt text describing the diagram for screen readers. */
  altText: z.string().min(10),
  question: z.string().min(10),
});

// ── Discriminated union ────────────────────────────────────────────────────

export const AnyQuestionSchema = z.discriminatedUnion('type', [
  MCQQuestionSchema,
  VocabMatchSchema,
  PassageQuestionSchema,
  DiagramQuestionSchema,
]);

export type AnyQuestion = z.infer<typeof AnyQuestionSchema>;

/** The shape of each /src/data/questions/*.json file. */
export const QuestionFileSchema = z.object({
  _comment: z.string().optional(),
  sectionId: z.string().min(1),
  questions: z.array(AnyQuestionSchema),
});

export type QuestionFile = z.infer<typeof QuestionFileSchema>;

// ── Lenient generation schema ──────────────────────────────────────────────
// Used when parsing API output — accepts questions without IDs assigned yet.
// Call `.parse()` on each raw item, then assign IDs before writing to disk.

/** MCQ without the `id` field (used during generation). */
export const MCQQuestionRawSchema = MCQQuestionSchema.omit({ id: true });
export const VocabMatchRawSchema = VocabMatchSchema.omit({ id: true });
export const PassageQuestionRawSchema = PassageQuestionSchema.omit({ id: true });
export const DiagramQuestionRawSchema = DiagramQuestionSchema.omit({ id: true });

export const AnyQuestionRawSchema = z.discriminatedUnion('type', [
  MCQQuestionRawSchema,
  VocabMatchRawSchema,
  PassageQuestionRawSchema,
  DiagramQuestionRawSchema,
]);

export type AnyQuestionRaw = z.infer<typeof AnyQuestionRawSchema>;
