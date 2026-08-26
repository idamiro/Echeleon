/**
 * Deterministic synthetic trajectory generators for local debug/testing.
 * Do NOT overfit the classifier to these exact patterns.
 */

import { clamp } from './math.js';

function pack(points, pointerType = 'mouse') {
  return {
    samples: points,
    pointerType,
    meta: { synthetic: true }
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} end
 * @param {object} opts
 */
export function generatePerfectLinear(start, end, opts = {}) {
  const n = opts.samples || 40;
  const dt = opts.dt || 8;
  const t0 = opts.t0 || 1000;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    pts.push({
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
      t: t0 + i * dt
    });
  }
  return pack(pts);
}

export function generateConstantVelocity(start, end, opts = {}) {
  // Same as linear with fixed spacing — explicit alias for test harness
  return generatePerfectLinear(start, end, { ...opts, samples: opts.samples || 48, dt: opts.dt || 10 });
}

export function generateLinearEaseInOut(start, end, opts = {}) {
  const n = opts.samples || 48;
  const dt = opts.dt || 10;
  const t0 = opts.t0 || 1000;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    const t = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    pts.push({
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
      t: t0 + i * dt
    });
  }
  return pack(pts);
}

export function generateCubicBezier(start, end, opts = {}) {
  const n = opts.samples || 56;
  const dt = opts.dt || 9;
  const t0 = opts.t0 || 1000;
  const c1 = opts.c1 || { x: start.x + (end.x - start.x) * 0.25, y: start.y - 80 };
  const c2 = opts.c2 || { x: start.x + (end.x - start.x) * 0.75, y: end.y + 60 };
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const u = 1 - t;
    const x = u ** 3 * start.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * end.x;
    const y = u ** 3 * start.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * end.y;
    pts.push({ x, y, t: t0 + i * dt });
  }
  return pack(pts);
}

export function generateMinimumJerk(start, end, opts = {}) {
  const n = opts.samples || 60;
  const dt = opts.dt || 10;
  const t0 = opts.t0 || 1000;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const τ = i / (n - 1);
    const s = 10 * τ ** 3 - 15 * τ ** 4 + 6 * τ ** 5;
    pts.push({
      x: lerp(start.x, end.x, s),
      y: lerp(start.y, end.y, s),
      t: t0 + i * dt
    });
  }
  return pack(pts);
}

export function generateRandomJitter(start, end, opts = {}) {
  const n = opts.samples || 55;
  const dt = opts.dt || 9;
  const t0 = opts.t0 || 1000;
  const amp = opts.amp || 6;
  // Deterministic PRNG
  let seed = opts.seed || 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const jx = (rand() - 0.5) * 2 * amp;
    const jy = (rand() - 0.5) * 2 * amp;
    pts.push({
      x: lerp(start.x, end.x, t) + (i === 0 || i === n - 1 ? 0 : jx),
      y: lerp(start.y, end.y, t) + (i === 0 || i === n - 1 ? 0 : jy),
      t: t0 + i * dt
    });
  }
  return pack(pts);
}

export function generateSinusoidal(start, end, opts = {}) {
  const n = opts.samples || 60;
  const dt = opts.dt || 9;
  const t0 = opts.t0 || 1000;
  const amp = opts.amp || 28;
  const cycles = opts.cycles || 2.2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const lat = Math.sin(t * Math.PI * 2 * cycles) * amp * (i === 0 || i === n - 1 ? 0 : 1);
    pts.push({
      x: lerp(start.x, end.x, t) + px * lat,
      y: lerp(start.y, end.y, t) + py * lat,
      t: t0 + i * dt
    });
  }
  return pack(pts);
}

export function generateOvershootScript(start, end, opts = {}) {
  const n = opts.samples || 64;
  const dt = opts.dt || 9;
  const t0 = opts.t0 || 1000;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    // Go to 1.12 then ease back to 1.0
    let s;
    if (u < 0.78) {
      const τ = u / 0.78;
      s = (10 * τ ** 3 - 15 * τ ** 4 + 6 * τ ** 5) * 1.12;
    } else {
      const τ = (u - 0.78) / 0.22;
      s = lerp(1.12, 1, τ * τ * (3 - 2 * τ));
    }
    pts.push({
      x: lerp(start.x, end.x, s),
      y: lerp(start.y, end.y, s),
      t: t0 + i * dt
    });
  }
  return pack(pts);
}

export function generatePiecewiseRobotic(start, end, opts = {}) {
  const dt = opts.dt || 8;
  const t0 = opts.t0 || 1000;
  const mid1 = {
    x: start.x + (end.x - start.x) * 0.4,
    y: start.y
  };
  const mid2 = {
    x: mid1.x,
    y: end.y
  };
  const segs = [
    [start, mid1, 18],
    [mid1, mid2, 16],
    [mid2, end, 18]
  ];
  const pts = [];
  let t = t0;
  segs.forEach(([a, b, n], si) => {
    for (let i = 0; i < n; i += 1) {
      if (si > 0 && i === 0) continue;
      const u = i / (n - 1);
      pts.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), t });
      t += dt;
    }
  });
  return pack(pts);
}

export function replayTrajectory(samples, opts = {}) {
  const scaleDt = opts.scaleDt || 1;
  if (!samples?.length) return pack([]);
  const t0 = samples[0].t;
  return pack(samples.map((s) => ({
    x: s.x,
    y: s.y,
    t: t0 + (s.t - t0) * scaleDt
  })), opts.pointerType || 'mouse');
}

export const SYNTHETIC_FAMILIES = [
  { id: 'perfect_linear', label: 'Perfect linear', fn: generatePerfectLinear, expect: 'synthetic_like' },
  { id: 'constant_velocity', label: 'Constant velocity', fn: generateConstantVelocity, expect: 'synthetic_like' },
  { id: 'linear_ease', label: 'Linear ease-in-out', fn: generateLinearEaseInOut, expect: 'synthetic_like' },
  { id: 'cubic_bezier', label: 'Cubic bezier', fn: generateCubicBezier, expect: 'uncertain|synthetic_like' },
  { id: 'minimum_jerk', label: 'Minimum jerk', fn: generateMinimumJerk, expect: 'uncertain|synthetic_like' },
  { id: 'random_jitter', label: 'Random jitter', fn: generateRandomJitter, expect: 'uncertain|synthetic_like' },
  { id: 'sinusoidal', label: 'Sinusoidal', fn: generateSinusoidal, expect: 'uncertain|synthetic_like' },
  { id: 'overshoot_script', label: 'Overshoot script', fn: generateOvershootScript, expect: 'uncertain|synthetic_like|human_like' },
  { id: 'piecewise_robotic', label: 'Piecewise robotic', fn: generatePiecewiseRobotic, expect: 'synthetic_like' }
];

/**
 * Run all synthetic families through extract+classify.
 */
export function runSyntheticBattery({ start, end, extract, classify, container, targetCenter, targetRadius }) {
  return SYNTHETIC_FAMILIES.map((fam) => {
    const traj = fam.fn(start, end);
    const extracted = extract({
      samples: traj.samples,
      container,
      targetCenter: targetCenter || end,
      targetRadius,
      pointerType: 'mouse',
      reactionMs: 300,
      challengeDurationMs: traj.samples[traj.samples.length - 1].t - traj.samples[0].t + 300
    });
    const result = classify(extracted.features);
    return {
      id: fam.id,
      label: fam.label,
      expect: fam.expect,
      state: result.state,
      humanProbability: result.humanProbability,
      syntheticRisk: result.syntheticRisk,
      confidence: result.confidence,
      contributions: result.contributions,
      features: extracted.features
    };
  });
}
