import type { SRSCard } from '@/types/asvab';
import { getQuestionsForSection } from './questions';

// ── SRS-weighted mastery ───────────────────────────────────────────────────

/**
 * Compute mastery for a section based on spaced-repetition evidence.
 *
 * Each question contributes a score based on how well it is retained:
 *
 *   Never seen                          → 0.00
 *   Answered correctly once (no card)   → 0.50  (unverified; one attempt)
 *   SRS card, rep=0 (just got wrong)    → 0.10
 *   SRS card, rep=1 (1-day interval)    → 0.40
 *   SRS card, rep=2 (6-day interval)    → 0.65
 *   SRS card, rep=3 (~15-day interval)  → 0.85
 *   SRS card, rep≥4 (~37+ day interval) → 1.00  (proven long-term retention)
 *
 * mastery = sum(question scores) / total questions in section
 *
 * 100% mastery requires every question at SRS rep≥4 (~30+ days of reviews).
 * A single pass through the section with all correct answers yields ~50% max.
 */
export function computeSectionMastery(
  sectionId: string,
  correctIdSet: Record<string, true>,
  srsCards: Record<string, SRSCard>,
): number {
  const questions = getQuestionsForSection(sectionId);
  if (questions.length === 0) return 0;

  let total = 0;
  for (const q of questions) {
    const card = srsCards[q.id];
    if (card) {
      const rep = card.repetitions;
      if (rep === 0)      total += 0.10;
      else if (rep === 1) total += 0.40;
      else if (rep === 2) total += 0.65;
      else if (rep === 3) total += 0.85;
      else                total += 1.00;
    } else if (correctIdSet[q.id]) {
      total += 0.50;
    }
    // else 0 — unseen
  }

  return Math.min(1, total / questions.length);
}

// ── Mastery tiers ──────────────────────────────────────────────────────────

export type MasteryTier =
  | 'Unfamiliar'
  | 'Novice'
  | 'Developing'
  | 'Proficient'
  | 'Expert'
  | 'Mastered';

export interface TierInfo {
  label: MasteryTier;
  /** Tailwind text-color class */
  textColor: string;
  /** Tailwind bg-color class for the mastery progress bar */
  barColor: string;
}

export function getMasteryTier(mastery: number): TierInfo {
  if (mastery === 0)  return { label: 'Unfamiliar', textColor: 'text-slate-400',   barColor: 'bg-slate-300 dark:bg-slate-600' };
  if (mastery < 0.20) return { label: 'Novice',     textColor: 'text-rose-500',    barColor: 'bg-rose-400' };
  if (mastery < 0.45) return { label: 'Developing', textColor: 'text-amber-500',   barColor: 'bg-amber-400' };
  if (mastery < 0.70) return { label: 'Proficient', textColor: 'text-yellow-500',  barColor: 'bg-yellow-400' };
  if (mastery < 0.90) return { label: 'Expert',     textColor: 'text-emerald-500', barColor: 'bg-emerald-500' };
  return                     { label: 'Mastered',   textColor: 'text-indigo-500',  barColor: 'bg-indigo-500' };
}

// ── Level system ───────────────────────────────────────────────────────────

/**
 * Compute level from total XP using a quadratic growth curve.
 * Level 1 = 0 XP, each level requires progressively more XP.
 * Formula: level = floor((1 + sqrt(1 + 4*xp/25)) / 2)
 */
export function getLevel(totalXP: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + 4 * totalXP / 25)) / 2));
}

export function getLevelTitle(level: number): string {
  if (level <= 1)  return 'Recruit';
  if (level <= 3)  return 'Trainee';
  if (level <= 6)  return 'Soldier';
  if (level <= 10) return 'Specialist';
  if (level <= 14) return 'Expert';
  return 'Elite';
}

/**
 * Total XP required to reach `level` (the floor for that level's XP range).
 * Used to compute progress-bar fill within the current level.
 *
 * Inverse of getLevel: xp = 25 * level * (level - 1)
 */
export function getXPForLevel(level: number): number {
  return Math.round(25 * level * (level - 1));
}
