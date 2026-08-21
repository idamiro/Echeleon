import type {
  Affordability,
  AssessmentInput,
  Category,
  Considered,
  Frequency,
  Overlap,
  Reason,
} from './types';

export const FREQUENCY_USES_PER_WEEK: Record<Frequency, number> = {
  daily: 7,
  few_times_week: 3,
  weekly: 1,
  few_times_month: 0.5,
  rarely: 0.15,
};

export const FREQUENCY_SCORE: Record<Frequency, number> = {
  daily: 1,
  few_times_week: 0.8,
  weekly: 0.55,
  few_times_month: 0.3,
  rarely: 0.15,
};

export const OVERLAP_SCORE: Record<Overlap, number> = {
  no: 1,
  needs_replacing: 0.7,
  works_fine: 0.15,
};

/** Soft contribution only — Need must not lean heavily on this */
export const REASON_NEEDISH: Record<Reason, number> = {
  genuine_need: 1,
  improve_regular: 0.7,
  wanted_awhile: 0.45,
  just_like: 0.3,
  on_sale: 0.2,
  just_discovered: 0.15,
};

export const CONSIDERED_SCORE: Record<Considered, number> = {
  more_month: 1,
  few_weeks: 0.75,
  few_days: 0.4,
  today: 0.15,
};

export const AFFORDABILITY_SCORE: Record<Affordability, number> = {
  barely: 1,
  noticeably: 0.5,
  significantly: 0.15,
};

/** Category only nudges cost-per-use interpretation bands */
export function categoryCpuFactor(category: Category): number {
  switch (category) {
    case 'clothing':
    case 'footwear':
    case 'beauty':
      return 1.15;
    case 'tech':
    case 'audio':
      return 0.95;
    case 'home':
    case 'kitchen':
      return 0.9;
    case 'hobby':
    case 'sports':
      return 1.05;
    case 'travel':
      return 1.08;
    case 'digital':
      return 1.2; // subscriptions / low physical reuse
    default:
      return 1;
  }
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function clampImportance(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function ownershipDurationScore(years: number): number {
  const y = Math.max(0.25, Math.min(10, years));
  return clamp01(y / 5);
}

export function importanceScore(importance: number): number {
  return clampImportance(importance) / 5;
}

export function estimatedUses(input: AssessmentInput): number {
  const upw = FREQUENCY_USES_PER_WEEK[input.frequency];
  const years = Math.max(0.25, input.ownershipYears);
  return upw * 52 * years;
}

export function scoreTo100(n: number): number {
  return Math.round(clamp01(n) * 100);
}
