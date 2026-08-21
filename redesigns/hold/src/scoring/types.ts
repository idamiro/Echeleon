/** HOLD scoring types — ruleset v1 */

export type Category =
  | 'clothing'
  | 'footwear'
  | 'tech'
  | 'audio'
  | 'home'
  | 'kitchen'
  | 'beauty'
  | 'hobby'
  | 'sports'
  | 'travel'
  | 'digital'
  | 'other';

export type Frequency =
  | 'daily'
  | 'few_times_week'
  | 'weekly'
  | 'few_times_month'
  | 'rarely';

export type Overlap = 'no' | 'needs_replacing' | 'works_fine';

export type Reason =
  | 'genuine_need'
  | 'improve_regular'
  | 'wanted_awhile'
  | 'on_sale'
  | 'just_discovered'
  | 'just_like';

export type Considered = 'today' | 'few_days' | 'few_weeks' | 'more_month';

export type Affordability = 'barely' | 'noticeably' | 'significantly';

export type ImpulseRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type Recommendation =
  | 'BUYING_NOW_SEEMS_REASONABLE'
  | 'HOLD_24_HOURS'
  | 'HOLD_3_DAYS'
  | 'HOLD_7_DAYS'
  | 'HOLD_30_DAYS'
  | 'CONSIDER_LETTING_IT_GO';

export interface AssessmentInput {
  category: Category;
  price: number;
  currency: string;
  frequency: Frequency;
  overlap: Overlap;
  reason: Reason;
  considered: Considered;
  affordability: Affordability;
  /** Expected ownership / use duration in years */
  ownershipYears: number;
  /** 1–5 */
  importance: number;
}

export interface ScoreBreakdown {
  utility: number;
  need: number;
  value: number;
  impulseRisk: ImpulseRisk;
  impulsePoints: number;
  confidence: Confidence;
  contradictions: string[];
  estimatedUses: number | null;
  costPerUse: number | null;
  usesPerWeek: number;
}

export interface SignalItem {
  id: string;
  text: string;
  /** Higher = stronger signal */
  weight: number;
}

export interface ScoringResult extends ScoreBreakdown {
  rulesetId: 'v1';
  recommendation: Recommendation;
  holdDays: number | null;
  recommendationLabel: string;
  recommendationBlurb: string;
  whyItMakesSense: SignalItem[];
  whatGivesPause: SignalItem[];
  observations: string[];
}
