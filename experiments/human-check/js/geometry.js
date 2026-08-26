/**
 * Geometry features relative to start → target axis.
 */

import { clamp, hypot, mean, std, safeDiv } from './math.js';

export function startTargetAxis(start, target) {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const len = hypot(dx, dy);
  return {
    dx,
    dy,
    len,
    ux: safeDiv(dx, len, 1),
    uy: safeDiv(dy, len, 0)
  };
}

/** Projection progress of point along start→target (0 at start, 1 at target). */
export function progressAlongAxis(point, start, axis) {
  if (axis.len < 1e-9) return 0;
  const vx = point.x - start.x;
  const vy = point.y - start.y;
  return (vx * axis.dx + vy * axis.dy) / (axis.len * axis.len);
}

export function perpendicularDeviation(point, start, axis) {
  if (axis.len < 1e-9) return 0;
  const vx = point.x - start.x;
  const vy = point.y - start.y;
  // 2D cross magnitude / length
  return Math.abs(vx * axis.uy - vy * axis.ux);
}

export function computeGeometry(samples, start, end, targetCenter) {
  if (samples.length < 2) {
    return {
      pathLength: 0,
      displacement: 0,
      pathEfficiency: 1,
      pathDeviationRatio: 0,
      pathExcess: 1,
      meanAxisDeviation: 0,
      maxAxisDeviation: 0,
      axisDeviationStd: 0,
      meanAxisDeviationNorm: 0,
      maxAxisDeviationNorm: 0,
      axisCrossings: 0,
      startTargetDistance: hypot(targetCenter.x - start.x, targetCenter.y - start.y)
    };
  }

  let pathLength = 0;
  for (let i = 1; i < samples.length; i += 1) {
    pathLength += hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }

  const displacement = hypot(end.x - start.x, end.y - start.y);
  const pathEfficiency = pathLength > 1e-9 ? clamp(displacement / pathLength, 0, 1) : 1;
  const pathExcess = displacement > 1e-9 ? pathLength / displacement : 1;
  const pathDeviationRatio = displacement > 1e-9 ? (pathLength - displacement) / displacement : 0;

  const axis = startTargetAxis(start, targetCenter);
  const startTargetDistance = axis.len;
  const deviations = [];
  let signedPrev = 0;
  let crossings = 0;

  for (let i = 0; i < samples.length; i += 1) {
    const p = samples[i];
    const vx = p.x - start.x;
    const vy = p.y - start.y;
    const signed = vx * axis.uy - vy * axis.ux;
    deviations.push(Math.abs(signed));
    if (i > 0 && signedPrev !== 0 && signed !== 0 && signedPrev * signed < 0) crossings += 1;
    signedPrev = signed;
  }

  const meanAxisDeviation = mean(deviations);
  const maxAxisDeviation = deviations.length ? Math.max(...deviations) : 0;
  const axisDeviationStd = std(deviations, meanAxisDeviation);
  const norm = Math.max(startTargetDistance, 1);

  return {
    pathLength,
    displacement,
    pathEfficiency,
    pathDeviationRatio,
    pathExcess,
    meanAxisDeviation,
    maxAxisDeviation,
    axisDeviationStd,
    meanAxisDeviationNorm: meanAxisDeviation / norm,
    maxAxisDeviationNorm: maxAxisDeviation / norm,
    axisCrossings: crossings,
    startTargetDistance
  };
}
