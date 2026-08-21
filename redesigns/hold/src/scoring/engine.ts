import { computeConfidence } from './confidence';
import { computeImpulse } from './impulse';
import { FREQUENCY_USES_PER_WEEK } from './normalize';
import { recommend } from './recommendation';
import { computeNeed, computeUtility, computeValue } from './scores';
import { buildObservations, buildSignals } from './signals';
import type { AssessmentInput, ScoringResult } from './types';

export const RULESET_ID = 'v1' as const;

export function scoreAssessment(input: AssessmentInput): ScoringResult {
  const utility = computeUtility(input);
  const need = computeNeed(input);
  const { value, estimatedUses, costPerUse } = computeValue(input);
  const impulse = computeImpulse(input);
  const conf = computeConfidence(input);

  const signals = buildSignals(input, {
    utility,
    need,
    value,
    impulseRisk: impulse.risk,
    costPerUse,
    estimatedUses,
  });

  const rec = recommend({
    utility,
    need,
    value,
    impulseRisk: impulse.risk,
    confidence: conf.confidence,
    input,
  });

  const observations = buildObservations(
    input,
    {
      costPerUse,
      estimatedUses,
      contradictions: conf.contradictions,
    },
    impulse.flags
  );

  return {
    rulesetId: RULESET_ID,
    utility,
    need,
    value,
    impulseRisk: impulse.risk,
    impulsePoints: impulse.points,
    confidence: conf.confidence,
    contradictions: conf.contradictions,
    estimatedUses,
    costPerUse,
    usesPerWeek: FREQUENCY_USES_PER_WEEK[input.frequency],
    recommendation: rec.recommendation,
    holdDays: rec.holdDays,
    recommendationLabel: rec.label,
    recommendationBlurb: rec.blurb,
    whyItMakesSense: signals.whyItMakesSense,
    whatGivesPause: signals.whatGivesPause,
    observations,
  };
}

export * from './types';
