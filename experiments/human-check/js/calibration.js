/**
 * PROVISIONAL calibration constants for Human Check.
 * Replace with empirical dataset calibration (median/MAD or trained coefficients).
 *
 * Units assume board-local pixels and milliseconds unless noted.
 */

export const calibration = {
  version: '2026-08-26-heuristic-v1',
  provenance: 'PROVISIONAL — not trained on a labelled human/synthetic corpus',

  /** Minimum data quality before classification is attempted */
  minimum: {
    sampleCount: 8,
    pathLengthPx: 48,
    durationMs: 90,
    displacementPx: 36
  },

  /**
   * Classifier thresholds on humanProbability (0..1)
   * Outside the band → uncertain
   */
  thresholds: {
    humanLike: 0.58,
    syntheticLike: 0.40
  },

  mouse: {
    // Plausibility centers (μ) and scales (σ) for soft Gaussian-like scores
    pathEfficiency: { mu: 0.86, sigma: 0.11 },
    velocityCV: { mu: 0.55, sigma: 0.28 },
    normalizedPeakTime: { mu: 0.42, sigma: 0.18 },
    meanAbsDirectionChange: { mu: 0.22, sigma: 0.16 },
    microCorrectionCount: { mu: 2.0, sigma: 2.2 },
    lateMicroCorrectionCount: { mu: 1.0, sigma: 1.4 },
    sampleIntervalCV: { mu: 0.22, sigma: 0.18 },
    meanAxisDeviationNorm: { mu: 0.06, sigma: 0.05 },
    submovementCount: { mu: 2.0, sigma: 1.4 },
    normalizedJerkLog: { mu: 2.5, sigma: 1.8 }
  },

  touch: {
    pathEfficiency: { mu: 0.88, sigma: 0.12 },
    velocityCV: { mu: 0.42, sigma: 0.26 },
    normalizedPeakTime: { mu: 0.4, sigma: 0.2 },
    meanAbsDirectionChange: { mu: 0.18, sigma: 0.15 },
    microCorrectionCount: { mu: 1.4, sigma: 1.8 },
    lateMicroCorrectionCount: { mu: 0.7, sigma: 1.2 },
    sampleIntervalCV: { mu: 0.18, sigma: 0.16 },
    meanAxisDeviationNorm: { mu: 0.05, sigma: 0.05 },
    submovementCount: { mu: 1.6, sigma: 1.3 },
    normalizedJerkLog: { mu: 2.2, sigma: 1.8 }
  },

  pen: {
    pathEfficiency: { mu: 0.87, sigma: 0.11 },
    velocityCV: { mu: 0.5, sigma: 0.26 },
    normalizedPeakTime: { mu: 0.41, sigma: 0.18 },
    meanAbsDirectionChange: { mu: 0.2, sigma: 0.15 },
    microCorrectionCount: { mu: 1.8, sigma: 2.0 },
    lateMicroCorrectionCount: { mu: 0.9, sigma: 1.3 },
    sampleIntervalCV: { mu: 0.2, sigma: 0.17 },
    meanAxisDeviationNorm: { mu: 0.055, sigma: 0.05 },
    submovementCount: { mu: 1.8, sigma: 1.3 },
    normalizedJerkLog: { mu: 2.4, sigma: 1.8 }
  },

  /** Interaction-risk weights (combination penalties) — PROVISIONAL */
    interactionWeights: {
      linearConstantMotion: 0.32,
      perfectEase: 0.28,
      randomNoise: 0.24,
      overRegularTiming: 0.14,
      teleport: 0.38
    }
};

export function calibForPointer(pointerType) {
  if (pointerType === 'touch') return calibration.touch;
  if (pointerType === 'pen') return calibration.pen;
  return calibration.mouse;
}
