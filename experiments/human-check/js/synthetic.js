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

/** 3-point near-straight teleport across a long distance */
export function generateSparseTeleport(start, end, opts = {}) {
  const t0 = opts.t0 || 1000;
  const mid = {
    x: lerp(start.x, end.x, 0.5),
    y: lerp(start.y, end.y, 0.5)
  };
  return pack([
    { x: start.x, y: start.y, t: t0 },
    { x: mid.x, y: mid.y, t: t0 + (opts.dt || 40) },
    { x: end.x, y: end.y, t: t0 + 2 * (opts.dt || 40) }
  ]);
}

/**
 * Hand-crafted human-like-ish sample: irregular timing, mild path bow,
 * late slowdown. Not a claim of biometric realism — battery contrast only.
 */
export function generateHumanLikeSample(start, end, opts = {}) {
  const t0 = opts.t0 || 1000;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const knots = [
    { u: 0, lat: 0, dt: 0 },
    { u: 0.08, lat: 2, dt: 28 },
    { u: 0.18, lat: 9, dt: 14 },
    { u: 0.32, lat: 14, dt: 11 },
    { u: 0.45, lat: 11, dt: 9 },
    { u: 0.58, lat: 6, dt: 10 },
    { u: 0.7, lat: 3, dt: 12 },
    { u: 0.82, lat: -2, dt: 16 },
    { u: 0.9, lat: -1, dt: 22 },
    { u: 0.96, lat: 0.5, dt: 28 },
    { u: 1, lat: 0, dt: 34 }
  ];
  let t = t0;
  const pts = knots.map((k, i) => {
    if (i > 0) t += k.dt;
    const s = 10 * k.u ** 3 - 15 * k.u ** 4 + 6 * k.u ** 5;
    return {
      x: lerp(start.x, end.x, s) + px * k.lat,
      y: lerp(start.y, end.y, s) + py * k.lat,
      t
    };
  });
  return pack(pts);
}

/**
 * Touch natural-like finger swipe — PROVISIONAL research generator.
 * Smooth ballistic, small lateral bow, slight dt jitter, few/no corrections.
 */
export function generateTouchNatural(start, end, opts = {}) {
  const variant = opts.variant || 'medium';
  const t0 = opts.t0 || 1000;
  const dtBase = opts.dt || (variant === 'fast' ? 10 : variant === 'smooth' ? 14 : 12);
  const duration =
    opts.durationMs ||
    (variant === 'fast' ? 320 : variant === 'smooth' ? 520 : 420);
  const n = Math.max(12, Math.round(duration / dtBase));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const amp = opts.amp != null ? opts.amp : (variant === 'smooth' ? 4 : 7);
  let seed = opts.seed || (variant === 'fast' ? 11 : variant === 'smooth' ? 29 : 17);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pts = [];
  let t = t0;
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    const s = 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5;
    const lat =
      i === 0 || i === n - 1
        ? 0
        : Math.sin(u * Math.PI) * amp * (0.85 + 0.3 * (rand() - 0.5));
    pts.push({
      x: lerp(start.x, end.x, s) + px * lat,
      y: lerp(start.y, end.y, s) + py * lat,
      t
    });
    if (i < n - 1) {
      // Mild timing jitter around refresh-like cadence
      t += dtBase * (0.88 + rand() * 0.28);
    }
  }
  return pack(pts, 'touch');
}

/** Fairly straight ballistic finger swipe with realistic touch dt jitter */
export function generateTouchStraightBallistic(start, end, opts = {}) {
  return generateTouchNatural(start, end, {
    ...opts,
    variant: 'medium',
    amp: opts.amp != null ? opts.amp : 2.5,
    durationMs: opts.durationMs || 380,
    dt: opts.dt || 11,
    seed: opts.seed || 41
  });
}

/** Deterministic constant-speed scripted touch — should look synthetic */
export function generateTouchConstantSpeedScript(start, end, opts = {}) {
  const n = opts.samples || 36;
  const dt = opts.dt || 8;
  const t0 = opts.t0 || 1000;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    pts.push({
      x: lerp(start.x, end.x, u),
      y: lerp(start.y, end.y, u),
      t: t0 + i * dt
    });
  }
  return pack(pts, 'touch');
}

/** Mechanically regular ease-in-out touch script */
export function generateTouchPerfectEaseScript(start, end, opts = {}) {
  const n = opts.samples || 40;
  const dt = opts.dt || 8;
  const t0 = opts.t0 || 1000;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    const s = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    pts.push({
      x: lerp(start.x, end.x, s),
      y: lerp(start.y, end.y, s),
      t: t0 + i * dt
    });
  }
  return pack(pts, 'touch');
}

/** Synthetic touch line with random coordinate noise */
export function generateTouchRandomJitter(start, end, opts = {}) {
  const traj = generateRandomJitter(start, end, {
    ...opts,
    samples: opts.samples || 48,
    dt: opts.dt || 9,
    amp: opts.amp || 10,
    seed: opts.seed || 77
  });
  return pack(traj.samples, 'touch');
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
  { id: 'piecewise_robotic', label: 'Piecewise robotic', fn: generatePiecewiseRobotic, expect: 'synthetic_like' },
  { id: 'sparse_teleport', label: 'Sparse teleport', fn: generateSparseTeleport, expect: 'synthetic_like' },
  { id: 'human_like_sample', label: 'Human-like sample', fn: generateHumanLikeSample, expect: 'human_like|uncertain' }
];

export const TOUCH_SYNTHETIC_FAMILIES = [
  {
    id: 'touch_natural_fast',
    label: 'Touch natural fast',
    fn: (s, e) => generateTouchNatural(s, e, { variant: 'fast' }),
    expect: 'human_like|uncertain'
  },
  {
    id: 'touch_natural_medium',
    label: 'Touch natural medium',
    fn: (s, e) => generateTouchNatural(s, e, { variant: 'medium' }),
    expect: 'human_like|uncertain'
  },
  {
    id: 'touch_natural_smooth',
    label: 'Touch natural smooth',
    fn: (s, e) => generateTouchNatural(s, e, { variant: 'smooth' }),
    expect: 'human_like|uncertain'
  },
  {
    id: 'touch_straight_ballistic',
    label: 'Touch straight ballistic',
    fn: generateTouchStraightBallistic,
    expect: 'human_like|uncertain'
  },
  {
    id: 'touch_constant_script',
    label: 'Touch constant-speed script',
    fn: generateTouchConstantSpeedScript,
    expect: 'synthetic_like|uncertain'
  },
  {
    id: 'touch_perfect_ease',
    label: 'Touch perfect ease script',
    fn: generateTouchPerfectEaseScript,
    expect: 'uncertain|synthetic_like'
  },
  {
    id: 'touch_jitter',
    label: 'Touch random jitter',
    fn: generateTouchRandomJitter,
    expect: 'synthetic_like|uncertain'
  }
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
      modelType: result.modelType,
      classifierProfile: result.classifierProfile,
      humanLikeScore: result.humanLikeScore,
      syntheticRisk: result.syntheticRisk,
      confidence: result.confidence,
      contributions: result.contributions,
      features: extracted.features
    };
  });
}

export function runTouchSyntheticBattery({ start, end, extract, classify, container, targetCenter, targetRadius }) {
  return TOUCH_SYNTHETIC_FAMILIES.map((fam) => {
    const traj = fam.fn(start, end);
    const extracted = extract({
      samples: traj.samples,
      container,
      targetCenter: targetCenter || end,
      targetRadius,
      pointerType: 'touch',
      reactionMs: 220,
      challengeDurationMs: traj.samples[traj.samples.length - 1].t - traj.samples[0].t + 250
    });
    const result = classify(extracted.features);
    return {
      id: fam.id,
      label: fam.label,
      expect: fam.expect,
      state: result.state,
      modelType: result.modelType,
      classifierProfile: result.classifierProfile,
      humanLikeScore: result.humanLikeScore,
      syntheticRisk: result.syntheticRisk,
      confidence: result.confidence,
      contributions: result.contributions,
      diagnostics: result.diagnostics,
      features: extracted.features
    };
  });
}