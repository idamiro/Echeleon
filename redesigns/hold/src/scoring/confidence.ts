import type { AssessmentInput, Confidence } from './types';
import { FREQUENCY_SCORE, OVERLAP_SCORE } from './normalize';

/**
 * Confidence = consistency of the user's signals, not predictive certainty.
 */
export function computeConfidence(input: AssessmentInput): {
  confidence: Confidence;
  contradictions: string[];
} {
  const contradictions: string[] = [];

  // High importance + rare use
  if (input.importance >= 4 && (input.frequency === 'rarely' || input.frequency === 'few_times_month')) {
    contradictions.push(
      'You marked this as highly important, but you expect to use it rarely.'
    );
  }

  // High importance + working equivalent
  if (input.importance >= 4 && input.overlap === 'works_fine') {
    contradictions.push(
      'Importance is high even though you already own something that works fine.'
    );
  }

  // Genuine need + only started today
  if (input.reason === 'genuine_need' && input.considered === 'today') {
    contradictions.push(
      'You framed this as a genuine need, but you only started considering it today.'
    );
  }

  // Daily use + barely important
  if (input.frequency === 'daily' && input.importance <= 2) {
    contradictions.push(
      'You expect daily use, but rated importance quite low.'
    );
  }

  // Sale-driven + significant affordability hit
  if (input.reason === 'on_sale' && input.affordability === 'significantly') {
    contradictions.push(
      'A sale is part of the pull, while the spend would hit your budget hard.'
    );
  }

  // High frequency claimed + owns working equivalent with low replace need
  if (
    FREQUENCY_SCORE[input.frequency] >= 0.8 &&
    input.overlap === 'works_fine' &&
    OVERLAP_SCORE[input.overlap] < 0.3
  ) {
    contradictions.push(
      'Expected use is high, yet a working equivalent already covers the job.'
    );
  }

  // Wanted awhile vs just discovered contradiction if somehow both — N/A single select

  // Long consideration + low importance
  if (input.considered === 'more_month' && input.importance <= 2) {
    contradictions.push(
      "You've thought about this for over a month, but importance remains low."
    );
  }

  let confidence: Confidence = 'HIGH';
  if (contradictions.length >= 2) confidence = 'LOW';
  else if (contradictions.length === 1) confidence = 'MEDIUM';

  return { confidence, contradictions };
}
