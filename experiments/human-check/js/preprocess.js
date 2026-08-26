/**
 * Trajectory preprocessing.
 * Keeps rawTrajectory intact; returns analysisTrajectory.
 * PROVISIONAL cleaning constants — tune with empirical data.
 */

import { isFiniteNumber, hypot } from './math.js';

const MIN_DT_MS = 0.05;
const MIN_SEGMENT_PX = 0.15;

/**
 * @param {Array<{x:number,y:number,t:number,xn?:number,yn?:number}>} samples
 */
export function preprocessTrajectory(samples) {
  const raw = samples.map((s) => ({ ...s }));
  if (raw.length < 2) {
    return {
      rawTrajectory: raw,
      analysisTrajectory: raw.slice(),
      droppedDuplicates: 0,
      droppedInvalid: raw.length ? 0 : 0
    };
  }

  const cleaned = [];
  let droppedDuplicates = 0;
  let droppedInvalid = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const s = raw[i];
    if (!isFiniteNumber(s.x) || !isFiniteNumber(s.y) || !isFiniteNumber(s.t)) {
      droppedInvalid += 1;
      continue;
    }
    if (!cleaned.length) {
      cleaned.push({ ...s });
      continue;
    }
    const prev = cleaned[cleaned.length - 1];
    const dt = s.t - prev.t;
    const dist = hypot(s.x - prev.x, s.y - prev.y);
    if (dt < MIN_DT_MS && dist < MIN_SEGMENT_PX) {
      droppedDuplicates += 1;
      // Keep later timestamp if identical position — update t only when time advanced tiny amount
      if (dt > 0) prev.t = s.t;
      continue;
    }
    if (dt <= 0) {
      // Non-monotonic time — nudge
      cleaned.push({ ...s, t: prev.t + MIN_DT_MS });
      continue;
    }
    cleaned.push({ ...s });
  }

  return {
    rawTrajectory: raw,
    analysisTrajectory: cleaned,
    droppedDuplicates,
    droppedInvalid
  };
}

/**
 * Attach normalized coords relative to container size.
 * @param {Array<{x:number,y:number,t:number}>} samples board-local px
 * @param {{width:number,height:number}} container
 */
export function withNormalizedCoords(samples, container) {
  const w = Math.max(1, container.width || 1);
  const h = Math.max(1, container.height || 1);
  return samples.map((s) => ({
    ...s,
    xn: s.x / w,
    yn: s.y / h
  }));
}
