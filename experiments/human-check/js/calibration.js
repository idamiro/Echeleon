/**
 * PROVISIONAL calibration + pointer-specific classification profiles.
 * NOT EMPIRICALLY CALIBRATED.
 *
 * Gaussian μ/σ and profile weights are PLACEHOLDERS for a research prototype.
 * They must later be replaced by real human distribution estimates per modality.
 * Do not treat these numbers as academically validated.
 */

/** Shared default mouse-like feature weights — PROVISIONAL */
const MOUSE_FEATURE_WEIGHTS = {
  pathEfficiency: 0.1,
  velocityCV: 0.14,
  normalizedPeakTime: 0.1,
  meanAbsDirectionChange: 0.1,
  microCorrectionCount: 0.1,
  lateMicroCorrectionCount: 0.08,
  sampleIntervalCV: 0.06,
  meanAxisDeviationNorm: 0.1,
  submovementCount: 0.1,
  normalizedJerk: 0.08
};

/**
 * Touch weights — PROVISIONAL — NOT EMPIRICALLY CALIBRATED
 * Reduce reliance on timing regularity / micro-corrections / jerk
 * (often modality artifacts). Preserve path / peak / axis / velocity structure.
 */
const TOUCH_FEATURE_WEIGHTS = {
  pathEfficiency: 0.14,
  velocityCV: 0.16,
  normalizedPeakTime: 0.14,
  meanAbsDirectionChange: 0.08,
  microCorrectionCount: 0.04,
  lateMicroCorrectionCount: 0.03,
  sampleIntervalCV: 0.02,
  meanAxisDeviationNorm: 0.14,
  submovementCount: 0.15,
  normalizedJerk: 0.04
};

const PEN_FEATURE_WEIGHTS = {
  pathEfficiency: 0.11,
  velocityCV: 0.14,
  normalizedPeakTime: 0.12,
  meanAbsDirectionChange: 0.09,
  microCorrectionCount: 0.07,
  lateMicroCorrectionCount: 0.06,
  sampleIntervalCV: 0.04,
  meanAxisDeviationNorm: 0.12,
  submovementCount: 0.12,
  normalizedJerk: 0.06
};

/**
 * Pointer-specific classification profiles.
 * PROVISIONAL — NOT EMPIRICALLY CALIBRATED
 */
export const classificationProfiles = {
  mouse: {
    id: 'mouse',
    label: 'mouse',
    provenance: 'PROVISIONAL — NOT EMPIRICALLY CALIBRATED',
    gaussians: {
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
    featureWeights: { ...MOUSE_FEATURE_WEIGHTS },
    interactionRiskWeights: {
      linearConstantMotion: 0.32,
      perfectEase: 0.28,
      randomNoise: 0.24,
      overRegularTiming: 0.14,
      teleport: 0.38
    },
    /** PROVISIONAL — mouse thresholds unchanged from prior global values */
    thresholds: {
      humanLike: 0.58,
      syntheticLike: 0.40,
      syntheticRiskHard: 0.62,
      syntheticRiskSoft: 0.55
    },
    minimum: {
      sampleCount: 8,
      pathLengthPx: 48,
      durationMs: 90,
      displacementPx: 36,
      /** Prefer path covering a meaningful fraction of start→target */
      minPathOverDistance: 0.55
    },
    confidence: {
      minConfidenceForceUncertain: 0.32,
      ambiguousBand: 0.18
    },
    /** Mouse risk computation mode — aggressive straightness / timing */
    riskMode: 'mouse'
  },

  touch: {
    id: 'touch',
    label: 'touch',
    provenance: 'PROVISIONAL — NOT EMPIRICALLY CALIBRATED — modality bias reduction only',
    gaussians: {
      // Finger swipes are often smoother / straighter / fewer corrections
      pathEfficiency: { mu: 0.92, sigma: 0.08 },
      velocityCV: { mu: 0.38, sigma: 0.22 },
      normalizedPeakTime: { mu: 0.42, sigma: 0.18 },
      meanAbsDirectionChange: { mu: 0.12, sigma: 0.12 },
      // Zero corrections is common for short finger drags
      microCorrectionCount: { mu: 0.4, sigma: 1.6 },
      lateMicroCorrectionCount: { mu: 0.25, sigma: 1.2 },
      // Touch cadence often refresh-tied — wider tolerance around lower CV
      sampleIntervalCV: { mu: 0.12, sigma: 0.22 },
      meanAxisDeviationNorm: { mu: 0.035, sigma: 0.04 },
      submovementCount: { mu: 1.3, sigma: 1.1 },
      normalizedJerkLog: { mu: 2.0, sigma: 2.0 }
    },
    featureWeights: { ...TOUCH_FEATURE_WEIGHTS },
    interactionRiskWeights: {
      linearConstantMotion: 0.16,
      perfectEase: 0.1,
      randomNoise: 0.3,
      overRegularTiming: 0.04,
      teleport: 0.4
    },
    /**
     * PROVISIONAL touch thresholds — modality-specific, NOT a global humanLike change.
     * Slightly softer human gate; synthetic gate similar.
     */
    thresholds: {
      humanLike: 0.54,
      syntheticLike: 0.38,
      syntheticRiskHard: 0.66,
      syntheticRiskSoft: 0.58
    },
    minimum: {
      sampleCount: 6,
      pathLengthPx: 32,
      durationMs: 80,
      displacementPx: 24,
      minPathOverDistance: 0.5
    },
    confidence: {
      minConfidenceForceUncertain: 0.28,
      ambiguousBand: 0.2
    },
    riskMode: 'touch'
  },

  pen: {
    id: 'pen',
    label: 'pen',
    provenance: 'PROVISIONAL — NOT EMPIRICALLY CALIBRATED',
    gaussians: {
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
    featureWeights: { ...PEN_FEATURE_WEIGHTS },
    interactionRiskWeights: {
      linearConstantMotion: 0.26,
      perfectEase: 0.22,
      randomNoise: 0.24,
      overRegularTiming: 0.1,
      teleport: 0.38
    },
    thresholds: {
      humanLike: 0.58,
      syntheticLike: 0.40,
      syntheticRiskHard: 0.62,
      syntheticRiskSoft: 0.55
    },
    minimum: {
      sampleCount: 7,
      pathLengthPx: 40,
      durationMs: 85,
      displacementPx: 30,
      minPathOverDistance: 0.55
    },
    confidence: {
      minConfidenceForceUncertain: 0.32,
      ambiguousBand: 0.18
    },
    riskMode: 'pen'
  }
};

export const calibration = {
  version: '2026-08-26-heuristic-v3-pointer-profiles',
  provenance: 'PROVISIONAL — NOT EMPIRICALLY CALIBRATED — pointer-specific profiles',
  profiles: classificationProfiles,

  // Backward-compat aliases used by older call sites
  minimum: classificationProfiles.mouse.minimum,
  thresholds: classificationProfiles.mouse.thresholds,
  mouse: classificationProfiles.mouse.gaussians,
  touch: classificationProfiles.touch.gaussians,
  pen: classificationProfiles.pen.gaussians,
  interactionWeights: classificationProfiles.mouse.interactionRiskWeights
};

/**
 * @param {string} pointerType
 * @returns {typeof classificationProfiles.mouse}
 */
export function profileForPointer(pointerType) {
  if (pointerType === 'touch') return classificationProfiles.touch;
  if (pointerType === 'pen') return classificationProfiles.pen;
  return classificationProfiles.mouse;
}

/** @deprecated use profileForPointer(...).gaussians */
export function calibForPointer(pointerType) {
  return profileForPointer(pointerType).gaussians;
}
