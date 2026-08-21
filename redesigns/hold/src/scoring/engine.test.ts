import { describe, expect, it } from 'vitest';
import { scoreAssessment } from './engine';
import type { AssessmentInput } from './types';

const base: AssessmentInput = {
  category: 'tech',
  price: 220,
  currency: 'EUR',
  frequency: 'few_times_week',
  overlap: 'no',
  reason: 'improve_regular',
  considered: 'few_weeks',
  affordability: 'barely',
  ownershipYears: 2,
  importance: 4,
};

describe('HOLD scoring v1', () => {
  it('scores a strong, considered tech purchase without collapsing to one metric', () => {
    const r = scoreAssessment(base);
    expect(r.utility).toBeGreaterThan(60);
    expect(r.need).toBeGreaterThan(50);
    expect(r.value).toBeGreaterThan(40);
    expect(r.impulseRisk).toBe('LOW');
    expect(r.confidence).toBe('HIGH');
    expect(r.whyItMakesSense.length).toBeGreaterThanOrEqual(1);
    expect(r.whatGivesPause.length).toBeGreaterThanOrEqual(1);
    expect(r.costPerUse).not.toBeNull();
    expect(r.recommendation).not.toBe('CONSIDER_LETTING_IT_GO');
  });

  it('flags contradiction: high importance + rare use + working equivalent → low confidence', () => {
    const r = scoreAssessment({
      ...base,
      importance: 5,
      frequency: 'rarely',
      overlap: 'works_fine',
      reason: 'just_like',
      considered: 'today',
    });
    expect(r.confidence).toBe('LOW');
    expect(r.contradictions.length).toBeGreaterThanOrEqual(2);
    expect(r.impulseRisk).toBe('HIGH');
    expect(['HOLD_7_DAYS', 'HOLD_30_DAYS', 'CONSIDER_LETTING_IT_GO']).toContain(
      r.recommendation
    );
  });

  it('keeps Need less dominated by stated reason alone', () => {
    const needyWords = scoreAssessment({
      ...base,
      reason: 'genuine_need',
      frequency: 'rarely',
      overlap: 'works_fine',
      importance: 2,
      considered: 'today',
    });
    const quietNeed = scoreAssessment({
      ...base,
      reason: 'just_like',
      frequency: 'daily',
      overlap: 'no',
      importance: 5,
      considered: 'more_month',
    });
    expect(quietNeed.need).toBeGreaterThan(needyWords.need);
  });

  it('sale + today discovery elevates impulse and cooling-off', () => {
    const r = scoreAssessment({
      ...base,
      reason: 'on_sale',
      considered: 'today',
      frequency: 'few_times_month',
      importance: 3,
    });
    expect(r.impulseRisk).not.toBe('LOW');
    expect(r.holdDays === null || r.holdDays >= 3).toBe(true);
  });

  it('never returns a single overall purchase score field', () => {
    const r = scoreAssessment(base);
    expect(r).not.toHaveProperty('overall');
    expect(r).not.toHaveProperty('purchaseScore');
    expect(typeof r.utility).toBe('number');
    expect(typeof r.need).toBe('number');
    expect(typeof r.value).toBe('number');
  });

  it('uses category only as a soft CPU interpretation nudge', () => {
    const clothing = scoreAssessment({ ...base, category: 'clothing', price: 220 });
    const home = scoreAssessment({ ...base, category: 'home', price: 220 });
    // Same inputs otherwise — values may differ slightly via CPU factor, not recommendation spam
    expect(Math.abs(clothing.value - home.value)).toBeLessThanOrEqual(15);
  });
});
