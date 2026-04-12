/**
 * afqtProjection.ts
 *
 * Maps a completed AFQT diagnostic response set to a projected AFQT percentile
 * using a simplified Item Response Theory (IRT) approach.
 *
 * ─── Model ───────────────────────────────────────────────────────────────────
 * We use the 1-parameter logistic model (Rasch model):
 *
 *   P(correct | θ, b) = 1 / (1 + exp(−(θ − b)))
 *
 *   θ  = latent ability estimate (the unknown we're solving for)
 *   b  = item difficulty parameter, derived from the question's 1–5 difficulty
 *
 * Difficulty → b-parameter mapping:
 *   1 (very easy) → −2.0
 *   2 (easy)      → −1.0
 *   3 (medium)    →  0.0
 *   4 (hard)      →  1.0
 *   5 (very hard) →  2.0
 *
 * θ is estimated via Maximum Likelihood Estimation using Newton-Raphson
 * iteration (converges in < 10 steps for this scale).
 *
 * ─── Percentile mapping ──────────────────────────────────────────────────────
 * θ is mapped to an AFQT percentile via a lookup table that approximates the
 * norming distribution from the 1997 Profile of American Youth, the reference
 * population used for official AFQT scoring. The mapping is directionally
 * correct but not statistically calibrated — it should be treated as a rough
 * educational estimate.
 *
 * θ ≈ 0   → ~40th percentile  (reflects that today's average test-taker scores
 *                               slightly above the historical reference mean)
 * θ ≈ 1   → ~67th percentile
 * θ ≈ −1  → ~16th percentile
 *
 * ─── Assumptions & limitations ───────────────────────────────────────────────
 * 1. All items are treated as equally discriminating (Rasch assumption).
 * 2. Difficulty b-values are assigned by content level, not statistically
 *    calibrated from real test data.
 * 3. The theta → percentile mapping is an approximation; actual AFQT
 *    percentiles depend on scale scores derived from the full ASVAB battery.
 * 4. Official AFQT scores also include a Verbal Expression (VE) composite
 *    derived from WK + PC; this model treats WK and PC as independent sections.
 * 5. This projection is for study purposes only. MEPS determines eligibility
 *    using official AFQT scores. This app's estimate should NOT be used for
 *    enlistment or MOS qualification decisions.
 */

import type { DiagnosticResult, DiagnosticSectionScore } from '@/types/asvab';
import type { DiagnosticResponse } from './diagnostic';
import { DIAGNOSTIC_SECTION_IDS } from './diagnostic';

// ── IRT parameters ─────────────────────────────────────────────────────────

/** Map question difficulty (1–5) to Rasch b-parameter on the logit scale. */
const DIFFICULTY_TO_B: Readonly<Record<number, number>> = {
  1: -2, 2: -1, 3: 0, 4: 1, 5: 2,
};

/** Rasch model probability of a correct response given ability θ and difficulty b. */
function pCorrect(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

// ── MLE theta estimation ───────────────────────────────────────────────────

/**
 * Estimate latent ability (θ) from a set of responses using MLE.
 *
 * Newton-Raphson iteration on the log-likelihood:
 *   L(θ) = Σ [ correct_i · ln P_i  +  (1 − correct_i) · ln (1 − P_i) ]
 *   L′(θ) = Σ [ correct_i − P_i ]
 *   L″(θ) = −Σ [ P_i · (1 − P_i) ]
 *   θ_{n+1} = θ_n − L′(θ_n) / L″(θ_n)
 *
 * θ is bounded to [−3.5, 3.5] to prevent divergence on perfect/zero scores.
 *
 * @example
 * // All 10 medium questions correct → θ ≈ 3.5 (ceiling hit, perfect score)
 * // All 10 medium questions wrong   → θ ≈ −3.5 (floor hit, zero score)
 * // 5/10 medium correct             → θ ≈ 0.0 (matching item difficulty)
 */
function estimateTheta(responses: DiagnosticResponse[]): number {
  if (responses.length === 0) return 0;

  const correctCount = responses.filter((r) => r.correct).length;

  // Edge cases: perfect or zero raw score — MLE diverges, so bound directly.
  if (correctCount === responses.length) return 3.5;
  if (correctCount === 0) return -3.5;

  let theta = 0; // start at prior mean

  for (let iter = 0; iter < 20; iter++) {
    let d1 = 0; // L′(θ)
    let d2 = 0; // L″(θ)

    for (const r of responses) {
      const b = DIFFICULTY_TO_B[r.question.difficulty] ?? 0;
      const p = pCorrect(theta, b);
      d1 += (r.correct ? 1 : 0) - p;
      d2 -= p * (1 - p);
    }

    // Guard against division by near-zero (flat likelihood)
    if (Math.abs(d2) < 1e-9) break;

    const step = d1 / d2;
    theta -= step;
    theta = Math.max(-3.5, Math.min(3.5, theta));

    // Converged
    if (Math.abs(step) < 1e-6) break;
  }

  return theta;
}

// ── θ → AFQT percentile lookup ─────────────────────────────────────────────

/**
 * Piecewise-linear lookup table mapping θ to projected AFQT percentile (1–99).
 *
 * Derived from an approximation of the standard-normal CDF adjusted to fit
 * observed AFQT score distributions in the 1997 Profile of American Youth.
 * θ = 0 maps to ~40th percentile (not 50th) because average contemporary
 * test-takers score above the historical norming population.
 *
 * Adjacent entries are linearly interpolated for smooth output.
 */
const THETA_PERCENTILE_TABLE: ReadonlyArray<[theta: number, percentile: number]> = [
  [-3.5,  1], [-3.0,  1], [-2.75, 2], [-2.5,  2],
  [-2.25, 3], [-2.0,  4], [-1.75, 6], [-1.5,  9],
  [-1.25, 12], [-1.0, 16], [-0.75, 21], [-0.5, 27],
  [-0.25, 33], [0.0,  40], [0.25, 47],  [0.5,  53],
  [0.75,  60], [1.0,  67], [1.25, 74],  [1.5,  79],
  [1.75,  84], [2.0,  88], [2.25, 92],  [2.5,  94],
  [2.75,  97], [3.0,  98], [3.5,  99],
];

function thetaToPercentile(theta: number): number {
  const table = THETA_PERCENTILE_TABLE;

  if (theta <= table[0][0]) return table[0][1];
  if (theta >= table[table.length - 1][0]) return table[table.length - 1][1];

  for (let i = 0; i < table.length - 1; i++) {
    const [t0, p0] = table[i];
    const [t1, p1] = table[i + 1];
    if (theta >= t0 && theta <= t1) {
      const frac = (theta - t0) / (t1 - t0);
      return Math.round(p0 + frac * (p1 - p0));
    }
  }

  return 40; // unreachable, satisfies TypeScript
}

// ── Section strength ───────────────────────────────────────────────────────

function sectionStrength(
  correct: number,
  total: number,
): DiagnosticSectionScore['strength'] {
  if (total === 0) return 'weak';
  const ratio = correct / total;
  if (ratio >= 0.7) return 'strong';
  if (ratio >= 0.4) return 'medium';
  return 'weak';
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute a projected AFQT result from the diagnostic response history.
 *
 * Steps:
 * 1. Estimate θ via MLE over the full response set.
 * 2. Map θ → projected AFQT percentile (1–99) via the lookup table.
 * 3. Compute per-section correct/total counts and classify strength.
 *
 * See module-level JSDoc for model assumptions and limitations.
 */
export function computeAfqtProjection(
  responses: DiagnosticResponse[],
): DiagnosticResult {
  const theta = estimateTheta(responses);
  const projectedAfqt = Math.max(1, Math.min(99, thetaToPercentile(theta)));

  const sectionScores: Record<string, DiagnosticSectionScore> = {};
  for (const sId of DIAGNOSTIC_SECTION_IDS) {
    const sectionResponses = responses.filter(
      (r) => r.question.sectionId === sId,
    );
    const correct = sectionResponses.filter((r) => r.correct).length;
    sectionScores[sId] = {
      correct,
      total: sectionResponses.length,
      strength: sectionStrength(correct, sectionResponses.length),
    };
  }

  return {
    completedAt: new Date().toISOString(),
    projectedAfqt,
    sectionScores,
    totalCorrect: responses.filter((r) => r.correct).length,
    totalQuestions: responses.length,
    estimatedTheta: Math.round(theta * 100) / 100,
  };
}
