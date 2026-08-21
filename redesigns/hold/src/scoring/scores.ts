import type { AssessmentInput } from './types';
import {
  AFFORDABILITY_SCORE,
  CONSIDERED_SCORE,
  FREQUENCY_SCORE,
  OVERLAP_SCORE,
  REASON_NEEDISH,
  categoryCpuFactor,
  estimatedUses,
  importanceScore,
  ownershipDurationScore,
  scoreTo100,
} from './normalize';

/**
 * Utility — how useful for this user.
 * Frequency, importance, ownership duration, overlap, light reason.
 */
export function computeUtility(input: AssessmentInput): number {
  const raw =
    0.35 * FREQUENCY_SCORE[input.frequency] +
    0.25 * importanceScore(input.importance) +
    0.2 * ownershipDurationScore(input.ownershipYears) +
    0.15 * OVERLAP_SCORE[input.overlap] +
    0.05 * REASON_NEEDISH[input.reason];
  return scoreTo100(raw);
}

/**
 * Need — solves an actual need vs optional.
 * Behavioral signals dominate; stated reason is a small tilt only.
 */
export function computeNeed(input: AssessmentInput): number {
  const raw =
    0.28 * OVERLAP_SCORE[input.overlap] +
    0.26 * FREQUENCY_SCORE[input.frequency] +
    0.24 * importanceScore(input.importance) +
    0.14 * CONSIDERED_SCORE[input.considered] +
    0.08 * REASON_NEEDISH[input.reason];
  return scoreTo100(raw);
}

/**
 * Value — estimated value relative to price + use, gated by utility/need/affordability.
 * Category only adjusts cost-per-use interpretation.
 */
export function computeValue(input: AssessmentInput): {
  value: number;
  estimatedUses: number;
  costPerUse: number | null;
} {
  const uses = estimatedUses(input);
  const price = Math.max(0, input.price);
  const costPerUse = uses > 0 && price > 0 ? price / uses : null;

  let cpuScore = 0.45;
  if (costPerUse != null) {
    const adjusted = costPerUse * categoryCpuFactor(input.category);
    // Soft bands — not "cheap = buy"
    if (adjusted <= 0.5) cpuScore = 0.95;
    else if (adjusted <= 1.5) cpuScore = 0.8;
    else if (adjusted <= 4) cpuScore = 0.6;
    else if (adjusted <= 10) cpuScore = 0.4;
    else if (adjusted <= 25) cpuScore = 0.25;
    else cpuScore = 0.12;
  } else if (price === 0) {
    cpuScore = 0.7;
  }

  const utility01 = computeUtility(input) / 100;
  const need01 = computeNeed(input) / 100;
  const afford = AFFORDABILITY_SCORE[input.affordability];

  // Value cannot outrun usefulness or need much; affordability caps upside
  const raw =
    0.4 * cpuScore +
    0.3 * utility01 +
    0.15 * need01 +
    0.15 * afford;

  const capped = Math.min(raw, afford + 0.35);
  return {
    value: scoreTo100(capped),
    estimatedUses: Math.round(uses),
    costPerUse,
  };
}
