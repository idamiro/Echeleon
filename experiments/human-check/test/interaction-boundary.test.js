/**
 * Release eligibility + attempt-boundary regression tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isSuccessfulRelease,
  appendReleaseEndpoint,
  TARGET_ACCEPTANCE_RATIO,
  resolvePointerEndAction,
  mayCompleteObservation,
  cancelledAttemptState
} from '../js/interaction.js';
import { extractFeatures } from '../js/features.js';

const targetSize = 136;
const threshold = targetSize * TARGET_ACCEPTANCE_RATIO;
const targetCenter = { x: 400, y: 200 };

describe('release eligibility (no inertia success)', () => {
  it('release outside target is not successful — hypothetical inertia cannot flip it', () => {
    // User releases just outside the threshold; a former inertia path would
    // have carried the disc into the ring. Eligibility must stay false.
    const releaseCenter = {
      x: targetCenter.x + threshold + 8,
      y: targetCenter.y
    };
    assert.equal(
      isSuccessfulRelease(releaseCenter, targetCenter, targetSize),
      false
    );

    // Even if UI later moved the circle onto the target, that visual position
    // must not be used for eligibility of the already-decided release.
    const afterHypotheticalInertia = { ...targetCenter };
    const releaseDecision = isSuccessfulRelease(releaseCenter, targetCenter, targetSize);
    const visualWouldSucceed = isSuccessfulRelease(
      afterHypotheticalInertia,
      targetCenter,
      targetSize
    );
    assert.equal(releaseDecision, false);
    assert.equal(visualWouldSucceed, true);
    // Contract: completion uses releaseDecision only, never post-release visual.
  });

  it('release inside threshold is successful', () => {
    const releaseCenter = {
      x: targetCenter.x + threshold * 0.5,
      y: targetCenter.y
    };
    assert.equal(
      isSuccessfulRelease(releaseCenter, targetCenter, targetSize),
      true
    );
  });

  it('exactly on threshold boundary is not inside (< not <=)', () => {
    const onBoundary = {
      x: targetCenter.x + threshold,
      y: targetCenter.y
    };
    assert.equal(isSuccessfulRelease(onBoundary, targetCenter, targetSize), false);
  });
});

describe('pointerup release endpoint sample', () => {
  it('final sample matches release circle center', () => {
    const samples = [
      { x: 100, y: 100, t: 1000 },
      { x: 150, y: 120, t: 1016 }
    ];
    const releaseCenter = { x: 210.5, y: 140.25 };
    const t = 1033.2;
    appendReleaseEndpoint(samples, releaseCenter, t);
    const last = samples[samples.length - 1];
    assert.ok(Math.abs(last.x - releaseCenter.x) < 1e-9);
    assert.ok(Math.abs(last.y - releaseCenter.y) < 1e-9);
    assert.ok(Math.abs(last.t - t) < 1e-9);
  });

  it('near-duplicate release refreshes timestamp instead of doubling', () => {
    const samples = [{ x: 200, y: 100, t: 1000 }];
    appendReleaseEndpoint(samples, { x: 200.05, y: 100.02 }, 1000.4);
    assert.equal(samples.length, 1);
    assert.ok(samples[0].t >= 1000.4 - 1e-9);
  });
});

describe('multi-drag attempt reset (one drag = one attempt)', () => {
  it('second attempt starts from current circle center with a cleared buffer', () => {
    // Simulate first failed attempt trajectory ending outside target.
    let samples = [
      { x: 80, y: 280, t: 1000 },
      { x: 200, y: 220, t: 1100 },
      { x: 300, y: 180, t: 1200 }
    ];
    const releaseOutside = { x: 300, y: 180 };
    assert.equal(
      isSuccessfulRelease(releaseOutside, targetCenter, targetSize),
      false
    );

    // Failed attempt discarded; circle stays at releaseOutside.
    samples = [];
    let userTrajectory = [];

    // Second drag begins: fresh buffer, first sample = current disc center.
    const currentCenter = { ...releaseOutside };
    samples.push({ x: currentCenter.x, y: currentCenter.y, t: 2000 });
    userTrajectory = [];

    assert.equal(samples.length, 1);
    assert.equal(samples[0].x, currentCenter.x);
    assert.equal(samples[0].y, currentCenter.y);
    assert.equal(userTrajectory.length, 0);

    // No synthetic jump: next points continue from the same center.
    samples.push({ x: currentCenter.x + 20, y: currentCenter.y - 10, t: 2012 });
    const jump = Math.hypot(
      samples[1].x - samples[0].x,
      samples[1].y - samples[0].y
    );
    assert.ok(jump < 40);
  });
});

describe('snap exclusion from features', () => {
  it('features use release endpoint, not visual target-center snap', () => {
    const container = { width: 640, height: 400 };
    const start = { x: 100, y: 280 };
    const release = {
      x: targetCenter.x + 10,
      y: targetCenter.y + 8
    };
    assert.equal(isSuccessfulRelease(release, targetCenter, targetSize), true);

    const userTrajectory = [
      { x: start.x, y: start.y, t: 1000 },
      { x: 200, y: 240, t: 1080 },
      { x: 320, y: 210, t: 1160 },
      { x: release.x, y: release.y, t: 1240 }
    ];

    // Contaminated series wrongly includes snap to exact target center.
    const withSnap = [
      ...userTrajectory,
      { x: targetCenter.x, y: targetCenter.y, t: 1400 }
    ];

    const clean = extractFeatures({
      samples: userTrajectory,
      container,
      targetCenter,
      targetRadius: targetSize / 2,
      pointerType: 'mouse',
      reactionMs: 200,
      challengeDurationMs: 500
    });
    const dirty = extractFeatures({
      samples: withSnap,
      container,
      targetCenter,
      targetRadius: targetSize / 2,
      pointerType: 'mouse',
      reactionMs: 200,
      challengeDurationMs: 500
    });

    const cleanEnd = clean.analysisTrajectory[clean.analysisTrajectory.length - 1];
    assert.ok(Math.abs(cleanEnd.x - release.x) < 1);
    assert.ok(Math.abs(cleanEnd.y - release.y) < 1);
    assert.notEqual(clean.features.movementTime, dirty.features.movementTime);
    assert.ok(clean.features.sampleCount < dirty.features.sampleCount);
  });
});

describe('pointer lifecycle: cancel ≠ release', () => {
  it('A: pointercancel cannot succeed even when circle is inside target', () => {
    const inside = { x: targetCenter.x + 5, y: targetCenter.y };
    assert.equal(isSuccessfulRelease(inside, targetCenter, targetSize), true);

    const action = resolvePointerEndAction('pointercancel', true);
    assert.equal(action, 'cancel');
    assert.equal(mayCompleteObservation(action, true), false);

    const cleared = cancelledAttemptState();
    assert.equal(cleared.shouldClassify, false);
    assert.equal(cleared.shouldComplete, false);
    assert.equal(cleared.shouldRecordResearch, false);
    assert.equal(cleared.shouldSnapToTarget, false);
    assert.deepEqual(cleared.samples, []);
    assert.deepEqual(cleared.userTrajectory, []);
  });

  it('B: lostpointercapture during active drag cancels — no classification', () => {
    const action = resolvePointerEndAction('lostpointercapture', true);
    assert.equal(action, 'cancel');
    assert.equal(mayCompleteObservation(action, true), false);
    assert.equal(mayCompleteObservation(action, false), false);
  });

  it('C: lostpointercapture after normal pointerup is a no-op (no duplicate completion)', () => {
    // Valid release already cleared drag
    const releaseAction = resolvePointerEndAction('pointerup', true);
    assert.equal(releaseAction, 'valid_release');
    assert.equal(mayCompleteObservation(releaseAction, true), true);

    // Subsequent lostpointercapture with drag already null
    const after = resolvePointerEndAction('lostpointercapture', false);
    assert.equal(after, 'noop');
    assert.equal(mayCompleteObservation(after, true), false);
  });

  it('D: cancel then new drag starts fresh buffer from current center', () => {
    let samples = [
      { x: 80, y: 280, t: 1000 },
      { x: targetCenter.x, y: targetCenter.y, t: 1100 }
    ];
    // Cancel discards attempt (even though last point was inside target)
    const action = resolvePointerEndAction('pointercancel', true);
    assert.equal(mayCompleteObservation(action, true), false);
    const cancelled = cancelledAttemptState();
    samples = cancelled.samples;
    let userTrajectory = cancelled.userTrajectory;
    assert.equal(samples.length, 0);

    const currentCenter = { x: targetCenter.x, y: targetCenter.y };
    samples = [{ x: currentCenter.x, y: currentCenter.y, t: 2000 }];
    userTrajectory = [];
    assert.equal(samples[0].x, currentCenter.x);
    assert.equal(samples[0].y, currentCenter.y);
    assert.equal(userTrajectory.length, 0);
  });

  it('E: cancelled attempt cannot enter research capture', () => {
    const cancel = resolvePointerEndAction('pointercancel', true);
    const lost = resolvePointerEndAction('lostpointercapture', true);
    const noop = resolvePointerEndAction('lostpointercapture', false);

    for (const action of [cancel, lost, noop]) {
      assert.equal(mayCompleteObservation(action, true), false);
      assert.equal(cancelledAttemptState().shouldRecordResearch, false);
    }

    // Only intentional successful pointerup may complete (research is gated behind completion)
    assert.equal(mayCompleteObservation('valid_release', true), true);
    assert.equal(mayCompleteObservation('valid_release', false), false);
  });

  it('pointerup outside target is valid_release but does not complete', () => {
    const action = resolvePointerEndAction('pointerup', true);
    assert.equal(action, 'valid_release');
    assert.equal(mayCompleteObservation(action, false), false);
  });
});
