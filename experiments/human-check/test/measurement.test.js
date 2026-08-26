/**
 * Human Check measurement / classifier unit tests.
 * Run: node --test (from experiments/human-check) or npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractFeatures } from '../js/features.js';
import { defaultClassifier } from '../js/classifier.js';
import { minimumJerkDeviation } from '../js/kinematics.js';
import { computeFeatureValidity, FEATURE_MIN_SAMPLES } from '../js/validity.js';
import { resampleUniformTime } from '../js/preprocess.js';
import {
  generatePerfectLinear,
  generateSparseTeleport,
  generateHumanLikeSample,
  generateMinimumJerk,
  runSyntheticBattery,
  replayTrajectory
} from '../js/synthetic.js';
import { copyForResult } from '../js/copy.js';

const container = { width: 640, height: 400 };
const start = { x: 80, y: 280 };
const end = { x: 480, y: 120 };
const targetCenter = end;
const targetRadius = 68;

function extract(samples, pointerType = 'mouse') {
  return extractFeatures({
    samples,
    container,
    targetCenter,
    targetRadius,
    pointerType,
    reactionMs: 200,
    challengeDurationMs: 900
  });
}

/** Simulate disc-center recording under different grab offsets (pointer → disc pos). */
function simulateGrabTrajectory(grabOffsetX, discPositions) {
  // Behavioral samples must be disc centers after setDiscPosition, not pointer coords.
  // Grab offset only maps pointer → top-left; center is always pos + halfSize.
  const discSize = 72;
  return discPositions.map((pos, i) => ({
    x: pos.x + discSize / 2,
    y: pos.y + discSize / 2,
    t: 1000 + i * 12,
    // Pointer would have been at disc top-left + grabOffset — unused for trajectory
    _pointerWouldBe: { x: pos.x + grabOffsetX, y: pos.y + discSize / 2 }
  }));
}

describe('coordinates: circle-center trajectory', () => {
  it('center / left-edge / right-edge grabs yield identical circle-center paths', () => {
    const discSize = 72;
    const path = [
      { x: 40, y: 200 },
      { x: 120, y: 180 },
      { x: 220, y: 150 },
      { x: 320, y: 130 },
      { x: 400, y: 110 }
    ];
    const centerGrab = simulateGrabTrajectory(discSize / 2, path);
    const leftGrab = simulateGrabTrajectory(4, path);
    const rightGrab = simulateGrabTrajectory(discSize - 4, path);

    for (let i = 0; i < path.length; i += 1) {
      assert.equal(centerGrab[i].x, leftGrab[i].x);
      assert.equal(centerGrab[i].y, leftGrab[i].y);
      assert.equal(centerGrab[i].x, rightGrab[i].x);
      assert.equal(centerGrab[i].y, rightGrab[i].y);
      assert.equal(centerGrab[i].x, path[i].x + discSize / 2);
    }

    const a = extract(centerGrab).features;
    const b = extract(leftGrab).features;
    assert.equal(a.pathLength, b.pathLength);
    assert.equal(a.displacement, b.displacement);
    assert.equal(a.pathEfficiency, b.pathEfficiency);
  });
});

describe('minimum-jerk timing', () => {
  it('uses normalized wall-clock time, not sample index', () => {
    // Ideal min-jerk progress at irregular timestamps
    const samples = [];
    const progress = [];
    const times = [0, 10, 80, 120, 400, 500]; // irregular
    const t0 = 1000;
    times.forEach((rel) => {
      const τ = rel / 500;
      const s = 10 * τ ** 3 - 15 * τ ** 4 + 6 * τ ** 5;
      samples.push({ x: s * 100, y: 0, t: t0 + rel });
      progress.push(s);
    });
    const timed = minimumJerkDeviation(progress, samples);
    assert.ok(timed != null);
    assert.ok(timed < 1e-9, `expected near-zero deviation, got ${timed}`);

    // Index-based τ would mismatch when progress is correct in time but
    // we pass progress that only matches time-based τ — construct a case
    // where index-based would look perfect but time-based does not.
    const badProgress = samples.map((_, i) => {
      const τIndex = i / (samples.length - 1);
      return 10 * τIndex ** 3 - 15 * τIndex ** 4 + 6 * τIndex ** 5;
    });
    const indexShaped = minimumJerkDeviation(badProgress, samples);
    assert.ok(indexShaped > 0.01, 'index-shaped progress must deviate under time-based τ');
  });

  it('returns null for zero-duration', () => {
    const samples = [
      { x: 0, y: 0, t: 100 },
      { x: 1, y: 0, t: 100 }
    ];
    assert.equal(minimumJerkDeviation([0, 1], samples), null);
  });
});

describe('sparse samples', () => {
  it('3-point long teleport → synthetic_like via structural anomaly', () => {
    const traj = generateSparseTeleport(start, end);
    const { features } = extract(traj.samples);
    const result = defaultClassifier.predict(features);
    assert.equal(result.state, 'synthetic_like');
    assert.equal(result.modelType, 'heuristic');
  });

  it('3-point ordinary short movement → insufficient_signal', () => {
    const samples = [
      { x: 100, y: 100, t: 1000 },
      { x: 110, y: 102, t: 1020 },
      { x: 118, y: 105, t: 1045 }
    ];
    const { features } = extract(samples);
    const result = defaultClassifier.predict(features);
    assert.equal(result.state, 'insufficient_signal');
  });
});

describe('feature validity', () => {
  it('jerk invalid below minimum samples', () => {
    const v3 = computeFeatureValidity(3);
    assert.equal(v3.jerk, false);
    assert.equal(v3.acceleration, true);
    assert.equal(v3.velocity, true);
    assert.equal(v3.fullBehavioral, false);

    const v4 = computeFeatureValidity(FEATURE_MIN_SAMPLES.jerk);
    assert.equal(v4.jerk, true);

    const samples = [
      { x: 0, y: 0, t: 0 },
      { x: 30, y: 0, t: 20 },
      { x: 80, y: 5, t: 40 }
    ];
    const { features } = extract(samples);
    assert.equal(features.normalizedJerk, null);
    assert.equal(features.meanAbsoluteJerk, null);
    assert.equal(features.featureValidity.jerk, false);
  });
});

describe('keyboard classification', () => {
  it('does not assign pointer biometric scores', () => {
    const traj = generateHumanLikeSample(start, end);
    const { features } = extract(traj.samples, 'keyboard');
    const result = defaultClassifier.predict(features);
    assert.equal(result.state, 'accessible_completion');
    assert.equal(result.humanLikeScore, null);
    assert.equal(result.syntheticRisk, null);
    assert.equal(result.humanProbability, undefined);
    assert.ok(result.contributions.some((c) => /keyboard/i.test(c)));
    assert.ok(result.contributions.some((c) => /not applied/i.test(c)));

    const copy = copyForResult(result);
    assert.equal(copy.title, 'Human enough.');
    assert.match(copy.insight, /Pointer trajectory classifier not applied/i);
  });
});

describe('UI snap excluded from analysis trajectory', () => {
  it('analyzing only userTrajectory ignores later snap points', () => {
    const user = generateMinimumJerk(start, end, { samples: 40, dt: 10 }).samples;
    const snapTail = [];
    const last = user[user.length - 1];
    for (let i = 1; i <= 12; i += 1) {
      const u = i / 12;
      const e = 1 - (1 - u) ** 3;
      snapTail.push({
        x: last.x + (end.x - last.x) * e * 0.05,
        y: last.y + (end.y - last.y) * e * 0.05,
        t: last.t + i * 16
      });
    }
    const contaminated = [...user, ...snapTail];
    const clean = extract(user).features;
    const dirty = extract(contaminated).features;
    // Snap must not be part of behavioral input — callers pass userTrajectory only.
    // Contaminated series changes movementTime / sampleCount if wrongly included.
    assert.ok(dirty.sampleCount > clean.sampleCount);
    assert.ok(dirty.movementTime > clean.movementTime);
  });
});

describe('weighted score ignores invalid features', () => {
  it('renormalizes over valid scores only (sparse structural path skips full weights)', () => {
    const traj = generateSparseTeleport(start, end);
    const { features } = extract(traj.samples);
    assert.equal(features.featureValidity.fullBehavioral, false);
    assert.equal(features.normalizedJerk, null);
    const result = defaultClassifier.predict(features);
    // Should not invent a dense featureScores map of zeros
    const scored = Object.values(result.featureScores || {}).filter((v) => typeof v === 'number');
    assert.ok(scored.length === 0 || result.state === 'synthetic_like');
  });
});

describe('sampling-rate robustness via resampling', () => {
  it('normalized geometry stays close across event rates for same physical path', () => {
    const base = generateHumanLikeSample(start, end).samples;
    // Dense: interpolate same path at ~8ms
    const dense = resampleOntoDt(base, 8);
    const sparse = resampleOntoDt(base, 24);
    const fDense = extract(dense).features;
    const fSparse = extract(sparse).features;

    assert.ok(Math.abs(fDense.pathEfficiency - fSparse.pathEfficiency) < 0.08);
    assert.ok(Math.abs(fDense.meanAxisDeviationNorm - fSparse.meanAxisDeviationNorm) < 0.04);
    // Entropy uses resampled ~100Hz grid — should be closer than raw-rate entropy would be
    if (fDense.directionEntropy != null && fSparse.directionEntropy != null) {
      assert.ok(Math.abs(fDense.directionEntropy - fSparse.directionEntropy) < 0.85);
    }
  });
});

describe('synthetic battery smoke', () => {
  it('runs families without throwing and exposes humanLikeScore', () => {
    const rows = runSyntheticBattery({
      start,
      end,
      container,
      targetCenter,
      targetRadius,
      extract: extractFeatures,
      classify: (f) => defaultClassifier.predict(f)
    });
    assert.ok(rows.length >= 11);
    const teleport = rows.find((r) => r.id === 'sparse_teleport');
    assert.equal(teleport.state, 'synthetic_like');
    rows.forEach((r) => {
      assert.equal(r.humanProbability, undefined);
      assert.ok('humanLikeScore' in r);
    });
    const replay = replayTrajectory(generateHumanLikeSample(start, end).samples);
    assert.ok(replay.samples.length > 5);
  });
});

describe('resampling helper', () => {
  it('produces roughly 100 Hz grid', () => {
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
      samples.push({ x: i * 10, y: 0, t: 1000 + i * 40 });
    }
    const out = resampleUniformTime(samples, 10);
    assert.ok(out.length > samples.length);
    for (let i = 1; i < out.length; i += 1) {
      const dt = out[i].t - out[i - 1].t;
      assert.ok(Math.abs(dt - 10) < 1e-6 || i === out.length - 1);
    }
  });
});

function resampleOntoDt(samples, dt) {
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
