/**
 * Progress, overshoot, micro-corrections, phase analysis.
 */

import { clamp, hypot, mean } from './math.js';
import { progressAlongAxis, startTargetAxis, perpendicularDeviation } from './geometry.js';

/**
 * @param {Array} samples
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} targetCenter
 * @param {number} targetRadius px
 * @param {object} kinematics from computeKinematics
 */
export function computeCorrections(samples, start, targetCenter, targetRadius, kinematics) {
  const axis = startTargetAxis(start, targetCenter);
  const progress = samples.map((s) => progressAlongAxis(s, start, axis));

  let backwardProgressCount = 0;
  let backwardProgressDistance = 0;
  let largestBackwardCorrection = 0;
  for (let i = 1; i < progress.length; i += 1) {
    const dp = progress[i] - progress[i - 1];
    if (dp < -0.008) {
      backwardProgressCount += 1;
      const mag = Math.abs(dp) * Math.max(axis.len, 1);
      backwardProgressDistance += mag;
      largestBackwardCorrection = Math.max(largestBackwardCorrection, mag);
    }
  }

  // Overshoot: progress > 1 then comes back, or distance past target then closer
  let overshootCount = 0;
  let overshootDistance = 0;
  let overshootDuration = 0;
  let wasPast = false;
  let pastStartT = 0;
  let maxPast = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const p = progress[i];
    const distToTarget = hypot(samples[i].x - targetCenter.x, samples[i].y - targetCenter.y);
    const past = p > 1.02 || (distToTarget < targetRadius * 0.35 && p > 0.92 && i > 0 && progress[i] < progress[i - 1] && progress[i - 1] > 1);
    if (p > 1.02) {
      if (!wasPast) {
        wasPast = true;
        pastStartT = samples[i].t;
        overshootCount += 1;
      }
      maxPast = Math.max(maxPast, (p - 1) * axis.len);
    } else if (wasPast && p <= 1.0) {
      overshootDuration += samples[i].t - pastStartT;
      wasPast = false;
    }
  }
  overshootDistance = maxPast;
  if (wasPast && samples.length) {
    overshootDuration += samples[samples.length - 1].t - pastStartT;
  }

  // Micro-corrections: combine progress reversal + direction change + velocity dip
  const angleDeltas = kinematics.angleDeltas || [];
  const velocities = kinematics.velocities || [];
  let microCorrectionCount = 0;
  let microCorrectionMagnitude = 0;
  let lateMicroCorrectionCount = 0;

  for (let i = 1; i < samples.length - 1; i += 1) {
    const progFrac = clamp(i / (samples.length - 1), 0, 1);
    const dp = progress[i] - progress[i - 1];
    const ang = angleDeltas[i - 1] || 0;
    const vPrev = velocities[i - 1] || 0;
    const vCur = velocities[i] || 0;
    const vNext = velocities[Math.min(i + 1, velocities.length - 1)] || 0;
    const velocityDip = vPrev > 40 && vCur < vPrev * 0.72 && vNext > vCur * 1.05;
    const dirKick = ang > 0.18 && (kinematics.segments?.[i]?.dist || 0) > 1.5;
    const reverse = dp < -0.01;

    if ((reverse && dirKick) || (velocityDip && dirKick) || (reverse && velocityDip)) {
      microCorrectionCount += 1;
      microCorrectionMagnitude += Math.abs(dp) * axis.len + ang * 10;
      if (progFrac >= 0.7) lateMicroCorrectionCount += 1;
    }
  }

  // Phase splits by geometric progress
  const earlyIdx = [];
  const midIdx = [];
  const lateIdx = [];
  for (let i = 0; i < progress.length; i += 1) {
    const p = clamp(progress[i], 0, 1);
    if (p < 0.2) earlyIdx.push(i);
    else if (p < 0.8) midIdx.push(i);
    else lateIdx.push(i);
  }

  const phaseVelocity = (idxs) => {
    if (!idxs.length || !velocities.length) return 0;
    let s = 0;
    let n = 0;
    for (const i of idxs) {
      if (i > 0 && velocities[i - 1] != null) {
        s += velocities[i - 1];
        n += 1;
      }
    }
    return n ? s / n : 0;
  };

  const lateVelocityDrop = Math.max(0, phaseVelocity(midIdx) - phaseVelocity(lateIdx));

  return {
    progress,
    backwardProgressCount,
    backwardProgressDistance,
    largestBackwardCorrection,
    overshootCount,
    overshootDistance,
    overshootDuration,
    microCorrectionCount,
    microCorrectionMagnitude,
    lateMicroCorrectionCount,
    lateVelocityDrop,
    earlySampleCount: earlyIdx.length,
    midSampleCount: midIdx.length,
    lateSampleCount: lateIdx.length,
    meanLateDeviation: lateIdx.length
      ? mean(lateIdx.map((i) => perpendicularDeviation(samples[i], start, axis)))
      : 0
  };
}
