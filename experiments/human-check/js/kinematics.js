/**
 * Kinematic series: velocity, acceleration, jerk, curvature, angles.
 * All derivatives use actual dt — never frame-count assumptions.
 */

import {
  clamp, hypot, mean, median, std, variance, wrapAngleDelta, shannonEntropy, safeDiv
} from './math.js';

const MIN_DT_S = 0.0004; // 0.4ms floor against spike artifacts

/**
 * Build segment kinematics from analysis samples (px, ms timestamps).
 */
export function computeKinematics(samples) {
  const empty = {
    segments: [],
    velocities: [],
    accelerations: [],
    jerks: [],
    angles: [],
    angleDeltas: [],
    curvatures: [],
    dts: [],
    meanVelocity: 0,
    medianVelocity: 0,
    maxVelocity: 0,
    minMovingVelocity: 0,
    velocityStd: 0,
    velocityVariance: 0,
    velocityCV: 0,
    timeToPeakVelocity: 0,
    normalizedPeakTime: 0.5,
    velocityPeakCount: 0,
    velocityValleyCount: 0,
    proportionBeforePeak: 0.5,
    proportionAfterPeak: 0.5,
    meanAcceleration: 0,
    accelerationStd: 0,
    maxPositiveAcceleration: 0,
    maxNegativeAcceleration: 0,
    accelerationVariance: 0,
    accelerationSignChanges: 0,
    meanAbsoluteJerk: 0,
    jerkStd: 0,
    jerkVariance: 0,
    maxAbsoluteJerk: 0,
    integratedSquaredJerk: 0,
    normalizedJerk: 0,
    meanAbsDirectionChange: 0,
    directionChangeStd: 0,
    maxDirectionChange: 0,
    directionChangeCount: 0,
    meanCurvature: 0,
    medianCurvature: 0,
    curvatureStd: 0,
    maxCurvature: 0,
    integratedCurvature: 0,
    directionEntropy: 0,
    curvatureEntropy: 0,
    timingEntropy: 0,
    dtMean: 0,
    dtStd: 0,
    dtCV: 0,
    sampleIntervalCV: 0,
    earlyAccelerationRatio: 0,
    lateDecelerationRatio: 0,
    movementTimeMs: 0
  };

  if (!samples || samples.length < 2) return empty;

  const segments = [];
  const velocities = [];
  const angles = [];
  const dts = [];

  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dtMs = Math.max(b.t - a.t, MIN_DT_S * 1000);
    const dt = dtMs / 1000;
    const dist = hypot(dx, dy);
    const v = dist / dt;
    const theta = Math.atan2(dy, dx);
    segments.push({ dx, dy, dt, dtMs, dist, v, theta, t: b.t, i });
    velocities.push(v);
    angles.push(theta);
    dts.push(dtMs);
  }

  const accelerations = [];
  for (let i = 1; i < velocities.length; i += 1) {
    const dt = Math.max(segments[i].dt, MIN_DT_S);
    accelerations.push((velocities[i] - velocities[i - 1]) / dt);
  }

  const jerks = [];
  for (let i = 1; i < accelerations.length; i += 1) {
    const dt = Math.max(segments[i + 1].dt, MIN_DT_S);
    jerks.push((accelerations[i] - accelerations[i - 1]) / dt);
  }

  const angleDeltas = [];
  for (let i = 1; i < angles.length; i += 1) {
    angleDeltas.push(Math.abs(wrapAngleDelta(angles[i], angles[i - 1])));
  }

  // Discrete curvature via consecutive direction change / distance
  const curvatures = [];
  for (let i = 0; i < angleDeltas.length; i += 1) {
    const dist = Math.max(segments[i + 1].dist, 0.25);
    curvatures.push(angleDeltas[i] / dist);
  }

  const meanVelocity = mean(velocities);
  const velocityStd = std(velocities, meanVelocity);
  const velocityVariance = variance(velocities, meanVelocity);
  const maxVelocity = velocities.length ? Math.max(...velocities) : 0;
  const moving = velocities.filter((v) => v > 5);
  const minMovingVelocity = moving.length ? Math.min(...moving) : 0;

  let peakIdx = 0;
  for (let i = 1; i < velocities.length; i += 1) {
    if (velocities[i] > velocities[peakIdx]) peakIdx = i;
  }
  const movementTimeMs = samples[samples.length - 1].t - samples[0].t;
  const timeToPeakVelocity = segments[peakIdx] ? segments[peakIdx].t - samples[0].t : 0;
  const normalizedPeakTime = movementTimeMs > 0 ? clamp(timeToPeakVelocity / movementTimeMs, 0, 1) : 0.5;

  // Peaks / valleys on velocity (noise-resistant)
  const peakThresh = Math.max(maxVelocity * 0.12, meanVelocity * 0.2, 20);
  let velocityPeakCount = 0;
  let velocityValleyCount = 0;
  for (let i = 1; i < velocities.length - 1; i += 1) {
    const prev = velocities[i - 1];
    const cur = velocities[i];
    const next = velocities[i + 1];
    if (cur > prev && cur >= next && cur >= peakThresh) velocityPeakCount += 1;
    if (cur < prev && cur <= next && prev - cur > peakThresh * 0.25) velocityValleyCount += 1;
  }
  if (velocityPeakCount === 0 && maxVelocity > 0) velocityPeakCount = 1;

  const meanAcceleration = mean(accelerations);
  const accelerationStd = std(accelerations, meanAcceleration);
  let maxPosA = 0;
  let maxNegA = 0;
  let accelSignChanges = 0;
  for (let i = 0; i < accelerations.length; i += 1) {
    maxPosA = Math.max(maxPosA, accelerations[i]);
    maxNegA = Math.min(maxNegA, accelerations[i]);
    if (i > 0 && accelerations[i - 1] * accelerations[i] < 0) accelSignChanges += 1;
  }

  const absJerks = jerks.map((j) => Math.abs(j));
  const meanAbsoluteJerk = mean(absJerks);
  const jerkStd = std(jerks);
  let integratedSquaredJerk = 0;
  for (let i = 0; i < jerks.length; i += 1) {
    const dt = Math.max(segments[i + 2]?.dt || MIN_DT_S, MIN_DT_S);
    integratedSquaredJerk += jerks[i] * jerks[i] * dt;
  }
  // Normalize loosely by duration^5 / distance^2 style scale (provisional)
  const T = Math.max(movementTimeMs / 1000, 0.05);
  const D = Math.max(hypot(samples[samples.length - 1].x - samples[0].x, samples[samples.length - 1].y - samples[0].y), 1);
  const normalizedJerk = integratedSquaredJerk * (T ** 5) / (D ** 2);

  const meanAbsDirectionChange = mean(angleDeltas);
  const directionChangeStd = std(angleDeltas, meanAbsDirectionChange);
  const maxDirectionChange = angleDeltas.length ? Math.max(...angleDeltas) : 0;
  // Meaningful direction changes (noise-resistant ~8°)
  const directionChangeCount = angleDeltas.filter((d, i) => d > 0.14 && segments[i + 1].dist > 1.2).length;

  const meanCurvature = mean(curvatures);
  const medianCurvature = median(curvatures);
  const curvatureStd = std(curvatures, meanCurvature);
  const maxCurvature = curvatures.length ? Math.max(...curvatures) : 0;
  let integratedCurvature = 0;
  for (let i = 0; i < curvatures.length; i += 1) {
    integratedCurvature += curvatures[i] * Math.max(segments[i + 1].dist, 0);
  }

  const dtMean = mean(dts);
  const dtStd = std(dts, dtMean);

  // Early accel / late decel ratios from velocity halves
  const n = velocities.length;
  const earlySlice = velocities.slice(0, Math.max(1, Math.floor(n * 0.35)));
  const lateSlice = velocities.slice(Math.floor(n * 0.65));
  const earlyAccelerationRatio = safeDiv(mean(earlySlice), maxVelocity || 1);
  const lateDecelerationRatio = 1 - safeDiv(mean(lateSlice), maxVelocity || 1);

  return {
    segments,
    velocities,
    accelerations,
    jerks,
    angles,
    angleDeltas,
    curvatures,
    dts,
    meanVelocity,
    medianVelocity: median(velocities),
    maxVelocity,
    minMovingVelocity,
    velocityStd,
    velocityVariance,
    velocityCV: safeDiv(velocityStd, meanVelocity),
    timeToPeakVelocity,
    normalizedPeakTime,
    velocityPeakCount,
    velocityValleyCount,
    proportionBeforePeak: normalizedPeakTime,
    proportionAfterPeak: 1 - normalizedPeakTime,
    meanAcceleration,
    accelerationStd,
    maxPositiveAcceleration: maxPosA,
    maxNegativeAcceleration: maxNegA,
    accelerationVariance: variance(accelerations, meanAcceleration),
    accelerationSignChanges: accelSignChanges,
    meanAbsoluteJerk,
    jerkStd,
    jerkVariance: variance(jerks),
    maxAbsoluteJerk: absJerks.length ? Math.max(...absJerks) : 0,
    integratedSquaredJerk,
    normalizedJerk,
    meanAbsDirectionChange,
    directionChangeStd,
    maxDirectionChange,
    directionChangeCount,
    meanCurvature,
    medianCurvature,
    curvatureStd,
    maxCurvature,
    integratedCurvature,
    directionEntropy: shannonEntropy(angleDeltas.length ? angleDeltas : [0], 10, 0, Math.PI),
    curvatureEntropy: shannonEntropy(curvatures.length ? curvatures : [0], 10),
    timingEntropy: shannonEntropy(dts, 10),
    dtMean,
    dtStd,
    dtCV: safeDiv(dtStd, dtMean),
    sampleIntervalCV: safeDiv(dtStd, dtMean),
    earlyAccelerationRatio,
    lateDecelerationRatio,
    movementTimeMs
  };
}

/**
 * Minimum-jerk reference deviation on normalized progress.
 * s(τ) = 10τ³ − 15τ⁴ + 6τ⁵
 */
export function minimumJerkDeviation(progressSamples) {
  if (!progressSamples.length) return 1;
  let err = 0;
  for (let i = 0; i < progressSamples.length; i += 1) {
    const τ = clamp(i / Math.max(progressSamples.length - 1, 1), 0, 1);
    const ideal = 10 * τ ** 3 - 15 * τ ** 4 + 6 * τ ** 5;
    const actual = clamp(progressSamples[i], -0.2, 1.4);
    err += (actual - ideal) ** 2;
  }
  return Math.sqrt(err / progressSamples.length);
}
