/**
 * Pure interaction helpers for Human Check release eligibility and pointer lifecycle.
 * Success depends only on an intentional pointerup (or keyboard confirm) —
 * never on UI animation, pointercancel, or lostpointercapture.
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

/**
 * Resolve what a pointer-end event must do.
 * Only intentional pointerup may become a valid release / classification path.
 *
 * @param {'pointerup'|'pointercancel'|'lostpointercapture'|string} eventType
 * @param {boolean} hasActiveDrag
 * @returns {'valid_release'|'cancel'|'noop'}
 */
export function resolvePointerEndAction(eventType, hasActiveDrag) {
  if (eventType === 'pointerup') {
    return hasActiveDrag ? 'valid_release' : 'noop';
  }
  if (eventType === 'pointercancel') {
    return hasActiveDrag ? 'cancel' : 'noop';
  }
  if (eventType === 'lostpointercapture') {
    // After a normal pointerup, drag is already cleared → no-op (idempotent).
    // Unexpected capture loss while drag is active → cancel.
    return hasActiveDrag ? 'cancel' : 'noop';
  }
  return 'noop';
}

/**
 * Whether this lifecycle action may classify / complete / research-record.
 * Cancelled attempts never classify — even if geometry is inside the target.
 *
 * @param {'valid_release'|'cancel'|'noop'} action
 * @param {boolean} releaseInsideTarget only meaningful for valid_release
 */
export function mayCompleteObservation(action, releaseInsideTarget) {
  return action === 'valid_release' && releaseInsideTarget === true;
}

/**
 * Discarded attempt state after pointercancel / unexpected lostpointercapture.
 * Pure helper for tests and documentation of cleared fields.
 */
export function cancelledAttemptState() {
  return {
    drag: null,
    observationOpen: false,
    samples: [],
    userTrajectory: [],
    shouldClassify: false,
    shouldComplete: false,
    shouldRecordResearch: false,
    shouldSnapToTarget: false
  };
}
