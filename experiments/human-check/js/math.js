/**
 * Human Check — shared math helpers
 * Local-only research prototype. Not production bot detection.
 */

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const hypot = (x, y) => Math.hypot(x, y);

export const safeDiv = (a, b, fallback = 0) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) < 1e-12) return fallback;
  const r = a / b;
  return Number.isFinite(r) ? r : fallback;
};

export const mean = (arr) => {
  if (!arr.length) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i += 1) s += arr[i];
  return s / arr.length;
};

export const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export const variance = (arr, avg = mean(arr)) => {
  if (arr.length < 2) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const d = arr[i] - avg;
    s += d * d;
  }
  return s / arr.length;
};

export const std = (arr, avg = mean(arr)) => Math.sqrt(variance(arr, avg));

export const mad = (arr, med = median(arr)) => {
  if (!arr.length) return 0;
  return median(arr.map((x) => Math.abs(x - med)));
};

/** Robust z-score using median/MAD. */
export const robustZ = (x, med, madVal) => {
  if (madVal < 1e-12) return 0;
  return (0.6745 * (x - med)) / madVal;
};

export const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = clamp(p, 0, 1) * (a.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  const t = idx - lo;
  return a[lo] * (1 - t) + a[hi] * t;
};

export const wrapAngleDelta = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const shannonEntropy = (values, binCount = 12, min = null, max = null) => {
  if (values.length < 2) return 0;
  let lo = min;
  let hi = max;
  if (lo == null || hi == null) {
    lo = Math.min(...values);
    hi = Math.max(...values);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo < 1e-12) return 0;
  const bins = new Array(binCount).fill(0);
  for (let i = 0; i < values.length; i += 1) {
    const t = clamp((values[i] - lo) / (hi - lo), 0, 1 - 1e-9);
    bins[Math.floor(t * binCount)] += 1;
  }
  let h = 0;
  const n = values.length;
  for (let i = 0; i < bins.length; i += 1) {
    if (!bins[i]) continue;
    const p = bins[i] / n;
    h -= p * Math.log2(p);
  }
  return h;
};

export const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
