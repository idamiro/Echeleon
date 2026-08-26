/**
 * Pure interaction helpers for Human Check release eligibility.
 * Success depends only on the user-controlled release position — never on UI animation.
 */

import { hypot } from './math.js';

/** Distance threshold as a fraction of target diameter (matches prior UI). */
export const TARGET_ACCEPTANCE_RATIO = 0.34;

/**
 * Whether the disc center is inside the valid target acceptance region.
 * @param {{x:number,y:number}} circleCenter board-local
 * @param {{x:number,y:number}} targetCenter board-local
 * @param {number} targetSize target diameter in px
 * @param {number} [ratio=TARGET_ACCEPTANCE_RATIO]
 */
export function isSuccessfulRelease(circleCenter, targetCenter, targetSize, ratio = TARGET_ACCEPTANCE_RATIO) {
  if (!circleCenter || !targetCenter || !(targetSize > 0)) return false;
  const threshold = targetSize * ratio;
  return hypot(circleCenter.x - targetCenter.x, circleCenter.y - targetCenter.y) < threshold;
}

/**
 * Append or refresh the final release sample so pointerup position is represented.
 * Skips an exact near-duplicate of the latest sample (preprocessing also dedupes).
 *
 * @param {Array<{x:number,y:number,t:number}>} samples mutable buffer
 * @param {{x:number,y:number}} center
 * @param {number} t
 * @param {object} [extra]
 */
export function appendReleaseEndpoint(samples, center, t, extra = {}) {
  if (!samples || !center || !Number.isFinite(t)) return samples;
  const last = samples[samples.length - 1];
  if (
    last &&
    Math.abs(last.x - center.x) < 0.15 &&
    Math.abs(last.y - center.y) < 0.15 &&
    Math.abs(last.t - t) < 0.75
  ) {
    last.t = t;
    Object.assign(last, extra);
    return samples;
  }
  samples.push({ x: center.x, y: center.y, t, ...extra });
  return samples;
}
