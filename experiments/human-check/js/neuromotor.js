/**
 * Neuromotor / submovement proxies.
 *
 * Architecture acknowledges Sigma-Lognormal modeling conceptually.
 * This module does NOT claim validated lognormal stroke fitting.
 * It provides velocity-submovement decomposition as a lightweight proxy
 * and exposes `experimentalNeuromotorMetrics` for future S-LN work.
 *
 * PROVISIONAL — replace with empirical neuromotor fitting when justified.
 */

import { mean } from './math.js';

/**
 * Detect velocity submovements via local peaks separated by valleys.
 */
export function analyzeSubmovements(velocities, movementTimeMs) {
  if (!velocities || velocities.length < 5) {
    return {
      submovementCount: velocities && velocities.length ? 1 : 0,
      primaryPeakDominance: 1,
      lateSubmovementCount: 0,
      meanSubmovementDuration: movementTimeMs || 0,
      experimentalNeuromotorMetrics: {
        implemented: false,
        model: 'submovement-proxy',
        note: 'Sigma-Lognormal fitting not implemented — using velocity peak decomposition only.',
        estimatedStrokeCount: velocities && velocities.length ? 1 : 0,
        lognormalFitError: null,
        strokeOverlap: null,
        neuromotorComplexity: null
      }
    };
  }

  const maxV = Math.max(...velocities);
  const peakThresh = Math.max(maxV * 0.18, 25);
  const peaks = [];
  for (let i = 1; i < velocities.length - 1; i += 1) {
    if (velocities[i] >= velocities[i - 1] && velocities[i] >= velocities[i + 1] && velocities[i] >= peakThresh) {
      // Enforce separation from previous peak
      if (!peaks.length || i - peaks[peaks.length - 1].i >= 3) {
        peaks.push({ i, v: velocities[i] });
      } else if (velocities[i] > peaks[peaks.length - 1].v) {
        peaks[peaks.length - 1] = { i, v: velocities[i] };
      }
    }
  }
  if (!peaks.length) peaks.push({ i: velocities.indexOf(maxV), v: maxV });

  const primary = Math.max(...peaks.map((p) => p.v));
  const primaryPeakDominance = primary > 0 ? primary / peaks.reduce((s, p) => s + p.v, 0) : 1;
  const lateCut = Math.floor(velocities.length * 0.65);
  const lateSubmovementCount = peaks.filter((p) => p.i >= lateCut).length;
  const meanSubmovementDuration = peaks.length
    ? (movementTimeMs || 0) / peaks.length
    : movementTimeMs || 0;

  return {
    submovementCount: peaks.length,
    primaryPeakDominance,
    lateSubmovementCount,
    meanSubmovementDuration,
    experimentalNeuromotorMetrics: {
      implemented: false,
      model: 'submovement-proxy',
      note: 'Sigma-Lognormal fitting not implemented — using velocity peak decomposition only.',
      estimatedStrokeCount: peaks.length,
      lognormalFitError: null,
      strokeOverlap: null,
      neuromotorComplexity: peaks.length + lateSubmovementCount * 0.5,
      peakVelocities: peaks.map((p) => p.v)
    }
  };
}

/**
 * Soft residual high-frequency energy proxy after removing linear trend.
 * Lightweight — not a full spectral analyzer.
 */
export function residualEnergyProxy(samples, axisLen) {
  if (!samples || samples.length < 6) {
    return { residualEnergy: 0, highFrequencyEnergyRatio: 0 };
  }
  const start = samples[0];
  const end = samples[samples.length - 1];
  let residualEnergy = 0;
  let totalEnergy = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const τ = i / (samples.length - 1);
    const ix = start.x + (end.x - start.x) * τ;
    const iy = start.y + (end.y - start.y) * τ;
    const rx = samples[i].x - ix;
    const ry = samples[i].y - iy;
    const e = rx * rx + ry * ry;
    residualEnergy += e;
    totalEnergy += e + 1;
  }
  // High-frequency: difference of consecutive residuals
  let hf = 0;
  let prevR = null;
  for (let i = 0; i < samples.length; i += 1) {
    const τ = i / (samples.length - 1);
    const ix = start.x + (end.x - start.x) * τ;
    const iy = start.y + (end.y - start.y) * τ;
    const r = Math.hypot(samples[i].x - ix, samples[i].y - iy);
    if (prevR != null) hf += (r - prevR) ** 2;
    prevR = r;
  }
  const scale = Math.max(axisLen, 1) ** 2 * samples.length;
  return {
    residualEnergy: residualEnergy / scale,
    highFrequencyEnergyRatio: residualEnergy > 1e-9 ? hf / (residualEnergy + 1e-9) : 0
  };
}
