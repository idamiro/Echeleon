/**
 * Trajectory preprocessing.
 * Keeps rawTrajectory intact; returns analysisTrajectory.
 * Optional uniform-time resampling for distribution features only.
 * PROVISIONAL cleaning constants — tune with empirical data.
 */

import { isFiniteNumber, hypot } from './math.js';

const MIN_DT_MS = 0.05;
const MIN_SEGMENT_PX = 0.15;
/** ~100 Hz analysis grid for entropy / shape features */
export const RESAMPLE_DT_MS = 10;

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
      if (dt > 0) prev.t = s.t;
      continue;
    }
    if (dt <= 0) {
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

/**
 * Linearly interpolate onto a uniform time grid (~100 Hz by default).
 * Used for entropy / residual / velocity-shape features — NOT for raw timing stats.
 */
export function resampleUniformTime(samples, dtMs = RESAMPLE_DT_MS) {
  if (!samples || samples.length < 2) return samples ? samples.slice() : [];
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  if (!(t1 > t0) || !(dtMs > 0)) return samples.slice();

  const out = [];
  let i = 0;
  for (let t = t0; t <= t1 + 1e-6; t += dtMs) {
    while (i < samples.length - 2 && samples[i + 1].t < t) i += 1;
    const a = samples[i];
    const b = samples[Math.min(i + 1, samples.length - 1)];
    const span = Math.max(b.t - a.t, 1e-6);
    const u = Math.min(1, Math.max(0, (t - a.t) / span));
    out.push({
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
      t,
      xn: a.xn != null ? a.xn + ((b.xn ?? a.xn) - a.xn) * u : undefined,
      yn: a.yn != null ? a.yn + ((b.yn ?? a.yn) - a.yn) * u : undefined,
      resampled: true
    });
  }
  const last = samples[samples.length - 1];
  if (!out.length || out[out.length - 1].t < last.t - 1e-3) {
    out.push({ ...last, resampled: true });
  }
  return out;
}
