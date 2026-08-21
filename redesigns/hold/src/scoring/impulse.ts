import type { AssessmentInput, ImpulseRisk } from './types';

export function computeImpulse(input: AssessmentInput): {
  risk: ImpulseRisk;
  points: number;
  flags: string[];
} {
  let points = 0;
  const flags: string[] = [];

  if (input.considered === 'today') {
    points += 1;
    flags.push('considered_today');
  }
  if (
    input.reason === 'on_sale' ||
    input.reason === 'just_discovered' ||
    input.reason === 'just_like'
  ) {
    points += 1;
    flags.push(input.reason);
  }
  if (input.overlap === 'works_fine') {
    points += 1;
    flags.push('owns_working_equivalent');
  }
  if (input.frequency === 'rarely' || input.frequency === 'few_times_month') {
    points += 1;
    flags.push('low_expected_usage');
  }
  if (input.affordability === 'significantly') {
    points += 1;
    flags.push('high_financial_impact');
  }
  if (input.importance <= 2) {
    points += 1;
    flags.push('low_importance');
  }

  let risk: ImpulseRisk = 'LOW';
  if (points >= 4) risk = 'HIGH';
  else if (points >= 2) risk = 'MEDIUM';

  return { risk, points, flags };
}
