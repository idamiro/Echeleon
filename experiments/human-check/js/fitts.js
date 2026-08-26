/**
 * Fitts' Law helpers — Shannon formulation.
 * ID = log2(D/W + 1)
 * PROVISIONAL characterization metric — not a hard classification rule.
 */

import { safeDiv } from './math.js';

export function fittsIndexOfDifficulty(distance, width) {
  const D = Math.max(0, distance);
  const W = Math.max(1e-6, width);
  return Math.log2(D / W + 1);
}

export function fittsMetrics(distance, width, movementTimeMs) {
  const id = fittsIndexOfDifficulty(distance, width);
  const tSec = Math.max(movementTimeMs / 1000, 1e-3);
  // Throughput bits/s — only meaningful for population comparison
  const throughput = safeDiv(id, tSec);
  return {
    fittsID: id,
    fittsThroughput: throughput,
    fittsDistance: distance,
    fittsWidth: width
  };
}
