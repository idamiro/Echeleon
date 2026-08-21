import type {
  AssessmentInput,
  Confidence,
  ImpulseRisk,
  Recommendation,
} from './types';

export interface RecContext {
  utility: number;
  need: number;
  value: number;
  impulseRisk: ImpulseRisk;
  confidence: Confidence;
  input: AssessmentInput;
}

export interface RecResult {
  recommendation: Recommendation;
  holdDays: number | null;
  label: string;
  blurb: string;
}

const LABELS: Record<Recommendation, string> = {
  BUYING_NOW_SEEMS_REASONABLE: 'BUYING NOW SEEMS REASONABLE',
  HOLD_24_HOURS: 'HOLD FOR 24 HOURS',
  HOLD_3_DAYS: 'HOLD FOR 3 DAYS',
  HOLD_7_DAYS: 'HOLD FOR 7 DAYS',
  HOLD_30_DAYS: 'HOLD FOR 30 DAYS',
  CONSIDER_LETTING_IT_GO: 'CONSIDER LETTING IT GO',
};

/**
 * Combinatorial recommendation — never a single overall score.
 * Rules are ordered from strongest “let go / long hold” patterns to lighter holds / buy.
 */
export function recommend(ctx: RecContext): RecResult {
  const { utility, need, value, impulseRisk, confidence, input } = ctx;
  const affordHard = input.affordability === 'significantly';
  const ownsFine = input.overlap === 'works_fine';
  const fresh = input.considered === 'today' || input.reason === 'just_discovered';
  const lowUse = input.frequency === 'rarely' || input.frequency === 'few_times_month';
  const longThink =
    input.considered === 'more_month' || input.considered === 'few_weeks';

  let recommendation: Recommendation;
  let holdDays: number | null;
  let blurb: string;

  // Strong let-go patterns
  if (
    (need < 35 && utility < 45 && (affordHard || impulseRisk === 'HIGH')) ||
    (ownsFine && need < 40 && lowUse) ||
    (need < 30 && utility < 40 && input.importance <= 2 && affordHard)
  ) {
    recommendation = 'CONSIDER_LETTING_IT_GO';
    holdDays = null;
    blurb =
      'The signals lean optional. Letting it go is a valid outcome — useful is not the same as necessary.';
  }
  // Own working equivalent + weak need → long cool-off
  else if (ownsFine && need < 55) {
    recommendation = 'HOLD_30_DAYS';
    holdDays = 30;
    blurb =
      'You already have something that works. Give it a full month before adding another.';
  }
  // Fresh discovery + high impulse
  else if (fresh && impulseRisk === 'HIGH') {
    recommendation = 'HOLD_30_DAYS';
    holdDays = 30;
    blurb =
      'This is new and several impulse signals showed up. A longer pause protects a clear decision.';
  } else if (fresh && impulseRisk === 'MEDIUM') {
    recommendation = 'HOLD_7_DAYS';
    holdDays = 7;
    blurb = "You just started looking. A week is enough to see if the want stays.";
  }
  // High utility, low need
  else if (utility >= 70 && need < 50) {
    recommendation = impulseRisk === 'HIGH' ? 'HOLD_7_DAYS' : 'HOLD_3_DAYS';
    holdDays = impulseRisk === 'HIGH' ? 7 : 3;
    blurb =
      "Useful doesn't always mean necessary. Sit with the gap between use and need.";
  }
  // Affordability stress
  else if (affordHard && (need < 65 || impulseRisk !== 'LOW')) {
    recommendation = need < 45 ? 'HOLD_30_DAYS' : 'HOLD_7_DAYS';
    holdDays = need < 45 ? 30 : 7;
    blurb =
      'The budget impact is real. Extra time helps separate want from timing.';
  }
  // Low confidence contradictions → longer hold even if scores look ok
  else if (confidence === 'LOW' && (utility >= 55 || need >= 55)) {
    recommendation = 'HOLD_7_DAYS';
    holdDays = 7;
    blurb =
      'Your answers pull in different directions. A week helps those signals settle.';
  }
  // Strong buy pattern
  else if (
    utility >= 70 &&
    need >= 65 &&
    value >= 55 &&
    impulseRisk === 'LOW' &&
    !affordHard &&
    !ownsFine &&
    (longThink || input.frequency === 'daily' || input.frequency === 'few_times_week')
  ) {
    recommendation = 'BUYING_NOW_SEEMS_REASONABLE';
    holdDays = 0;
    blurb =
      'Based on what you shared, buying now looks consistent with use, need, and timing — not a guarantee.';
  }
  // Soft buy with tiny pause
  else if (
    utility >= 65 &&
    need >= 55 &&
    impulseRisk === 'LOW' &&
    !affordHard &&
    longThink
  ) {
    recommendation = 'HOLD_24_HOURS';
    holdDays = 1;
    blurb = 'Signals look solid. One quiet day is still a clean checkpoint.';
  }
  // Medium impulse default
  else if (impulseRisk === 'HIGH') {
    recommendation = 'HOLD_7_DAYS';
    holdDays = 7;
    blurb = 'Impulse signals are elevated. Seven days is a fair cooling-off period.';
  } else if (impulseRisk === 'MEDIUM') {
    recommendation = value < 45 || need < 45 ? 'HOLD_7_DAYS' : 'HOLD_3_DAYS';
    holdDays = value < 45 || need < 45 ? 7 : 3;
    blurb = 'A short hold keeps the decision intentional.';
  }
  // Default middle path
  else if (need < 45 || utility < 50) {
    recommendation = 'HOLD_7_DAYS';
    holdDays = 7;
    blurb = 'Need or usefulness is still soft. Give it a week.';
  } else {
    recommendation = 'HOLD_3_DAYS';
    holdDays = 3;
    blurb = 'A short pause keeps this a decision, not a reflex.';
  }

  return {
    recommendation,
    holdDays,
    label: LABELS[recommendation],
    blurb,
  };
}
