/**
 * Touch modality / pointer-profile regression tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractFeatures } from '../js/features.js';
import { defaultClassifier } from '../js/classifier.js';
import { profileForPointer, classificationProfiles } from '../js/calibration.js';
import {
  generateTouchNatural,
  generateTouchStraightBallistic,
  generateTouchConstantSpeedScript,
  generateTouchPerfectEaseScript,
  generateTouchRandomJitter,
  generatePerfectLinear,
  generateHumanLikeSample,
  runSyntheticBattery,
  runTouchSyntheticBattery
} from '../js/synthetic.js';

const desktop = { width: 640, height: 400 };
const phone = { width: 360, height: 640 };
const largePhone = { width: 430, height: 780 };
const start = { x: 48, y: 420 };
const end = { x: 280, y: 160 };
const desktopStart = { x: 80, y: 280 };
const desktopEnd = { x: 480, y: 120 };

function classifyTouch(samples, container = phone, s = start, e = end) {
  const extracted = extractFeatures({
    samples,
    container,
    targetCenter: e,
    targetRadius: 58,
    pointerType: 'touch',
    reactionMs: 180,
    challengeDurationMs: (samples[samples.length - 1].t - samples[0].t) + 200
  });
  const result = defaultClassifier.predict(extracted.features);
  return { extracted, result };
}

function classifyMouse(samples, container = desktop) {
  const extracted = extractFeatures({
    samples,
    container,
    targetCenter: desktopEnd,
    targetRadius: 68,
    pointerType: 'mouse',
    reactionMs: 250,
    challengeDurationMs: 800
  });
  return defaultClassifier.predict(extracted.features);
}

describe('pointer-specific profiles', () => {
  it('uses distinct mouse / touch / pen profiles', () => {
    assert.equal(profileForPointer('mouse').id, 'mouse');
    assert.equal(profileForPointer('touch').id, 'touch');
    assert.equal(profileForPointer('pen').id, 'pen');
    assert.notDeepEqual(
      classificationProfiles.mouse.featureWeights,
      classificationProfiles.touch.featureWeights
    );
    assert.notEqual(
      classificationProfiles.mouse.interactionRiskWeights.overRegularTiming,
      classificationProfiles.touch.interactionRiskWeights.overRegularTiming
    );
  });

  it('touch sample reports classifierProfile touch', () => {
    const traj = generateTouchNatural(start, end, { variant: 'medium' });
    const { result } = classifyTouch(traj.samples);
    assert.equal(result.classifierProfile, 'touch');
    assert.ok(result.diagnostics);
    assert.equal(result.diagnostics.classifierProfile, 'touch');
  });
});

describe('reported touch uncertainty bug', () => {
  it('natural touch variants are not systematically uncertain/synthetic', () => {
    const variants = ['fast', 'medium', 'smooth'].map((variant) => {
      const traj = generateTouchNatural(start, end, { variant });
      const { result } = classifyTouch(traj.samples);
      return { variant, state: result.state, score: result.humanLikeScore, risk: result.syntheticRisk };
    });

    const humanLike = variants.filter((v) => v.state === 'human_like').length;
    const synthetic = variants.filter((v) => v.state === 'synthetic_like').length;
    assert.ok(
      humanLike >= 2,
      `expected ≥2/3 human_like, got ${JSON.stringify(variants)}`
    );
    assert.equal(synthetic, 0, `natural touch must not be synthetic_like: ${JSON.stringify(variants)}`);
  });

  it('straight ballistic touch is not automatically synthetic', () => {
    const traj = generateTouchStraightBallistic(start, end);
    const { result } = classifyTouch(traj.samples);
    assert.notEqual(result.state, 'synthetic_like');
    assert.ok(result.state === 'human_like' || result.state === 'uncertain');
  });
});

describe('touch synthetic protection', () => {
  it('constant-speed deterministic touch remains suspicious', () => {
    const traj = generateTouchConstantSpeedScript(start, end);
    const { result } = classifyTouch(traj.samples);
    assert.ok(
      result.state === 'synthetic_like' || result.syntheticRisk >= 0.45,
      `expected synthetic lean, got ${result.state} risk=${result.syntheticRisk}`
    );
  });

  it('touch random jitter is not trusted as human_like', () => {
    const traj = generateTouchRandomJitter(start, end);
    const { result } = classifyTouch(traj.samples);
    assert.notEqual(result.state, 'human_like');
  });
});

describe('touch sampling-rate stability', () => {
  it('same physical swipe at ~60/90/120 Hz stays in same coarse class', () => {
    const base = generateTouchNatural(start, end, { variant: 'medium', durationMs: 420, dt: 11 });
    const rates = [
      resampleDt(base.samples, 1000 / 60),
      resampleDt(base.samples, 1000 / 90),
      resampleDt(base.samples, 1000 / 120)
    ];
    const states = rates.map((samples) => classifyTouch(samples).result.state);
    const unique = new Set(states);
    // Allow at most human_like↔uncertain ambiguity; never introduce synthetic_like
    assert.ok(!states.includes('synthetic_like'), `states=${states}`);
    assert.ok(unique.size <= 2, `too unstable across rates: ${states}`);
  });
});

describe('mobile geometry normalization', () => {
  it('scaled natural touch stays reasonably stable across board sizes', () => {
    const boards = [
      { container: phone, s: start, e: end },
      { container: largePhone, s: { x: 56, y: 500 }, e: { x: 340, y: 180 } },
      {
        container: desktop,
        s: desktopStart,
        e: desktopEnd
      }
    ];
    const states = boards.map(({ container, s, e }) => {
      const traj = generateTouchNatural(s, e, { variant: 'medium' });
      return classifyTouch(traj.samples, container, s, e).result.state;
    });
    assert.ok(!states.includes('synthetic_like'), `states=${states}`);
    const ok = states.every((st) => st === 'human_like' || st === 'uncertain');
    assert.ok(ok, `unexpected states ${states}`);
  });
});

describe('mouse regression protection', () => {
  it('perfect linear mouse remains synthetic_like', () => {
    const traj = generatePerfectLinear(desktopStart, desktopEnd);
    const result = classifyMouse(traj.samples);
    assert.equal(result.state, 'synthetic_like');
    assert.equal(result.classifierProfile, 'mouse');
  });

  it('mouse human-like sample is not synthetic_like', () => {
    const traj = generateHumanLikeSample(desktopStart, desktopEnd);
    const result = classifyMouse(traj.samples);
    assert.notEqual(result.state, 'synthetic_like');
  });

  it('mouse battery smoke still runs', () => {
    const rows = runSyntheticBattery({
      start: desktopStart,
      end: desktopEnd,
      container: desktop,
      targetCenter: desktopEnd,
      targetRadius: 68,
      extract: extractFeatures,
      classify: (f) => defaultClassifier.predict(f)
    });
    const linear = rows.find((r) => r.id === 'perfect_linear');
    assert.equal(linear.state, 'synthetic_like');
  });
});

describe('touch battery smoke', () => {
  it('runs touch families and prints class matrix contract', () => {
    const rows = runTouchSyntheticBattery({
      start,
      end,
      container: phone,
      targetCenter: end,
      targetRadius: 58,
      extract: extractFeatures,
      classify: (f) => defaultClassifier.predict(f)
    });
    assert.ok(rows.length >= 7);
    rows.forEach((r) => assert.equal(r.classifierProfile, 'touch'));
    const naturals = rows.filter((r) => r.id.startsWith('touch_natural'));
    const humanLike = naturals.filter((r) => r.state === 'human_like').length;
    assert.ok(humanLike >= 2, JSON.stringify(naturals.map((r) => ({ id: r.id, state: r.state }))));
  });
});

function resampleDt(samples, dt) {
  if (samples.length < 2) return samples.slice();
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const out = [];
  let i = 0;
  for (let t = t0; t <= t1; t += dt) {
    while (i < samples.length - 2 && samples[i + 1].t < t) i += 1;
    const a = samples[i];
    const b = samples[Math.min(i + 1, samples.length - 1)];
    const span = Math.max(b.t - a.t, 1e-6);
    const u = Math.min(1, Math.max(0, (t - a.t) / span));
    out.push({
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
      t
    });
  }
  return out;
}
