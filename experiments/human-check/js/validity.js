/**
 * Feature validity minima.
 * Invalid features must be null / ignored — never scored as meaningful zeros.
 *
 * sampleCount here means cleaned analysis samples (circle-center trajectory).
 */

export const FEATURE_MIN_SAMPLES = {
  velocity: 2,
  acceleration: 3,
  jerk: 4,
  curvature: 3,
  directionChange: 3,
  entropy: 8,
  submovements: 8,
  microCorrections: 6,
  minJerkCompare: 6,
  residualEnergy: 6,
  /** Full behavioral heuristic (not structural-only) */
  fullBehavioral: 8
};

/**
 * @param {number} sampleCount
 */
export function computeFeatureValidity(sampleCount) {
  const n = sampleCount || 0;
  return {
    velocity: n >= FEATURE_MIN_SAMPLES.velocity,
    acceleration: n >= FEATURE_MIN_SAMPLES.acceleration,
    jerk: n >= FEATURE_MIN_SAMPLES.jerk,
    curvature: n >= FEATURE_MIN_SAMPLES.curvature,
    directionChange: n >= FEATURE_MIN_SAMPLES.directionChange,
    entropy: n >= FEATURE_MIN_SAMPLES.entropy,
    submovements: n >= FEATURE_MIN_SAMPLES.submovements,
    microCorrections: n >= FEATURE_MIN_SAMPLES.microCorrections,
    minJerkCompare: n >= FEATURE_MIN_SAMPLES.minJerkCompare,
    residualEnergy: n >= FEATURE_MIN_SAMPLES.residualEnergy,
    fullBehavioral: n >= FEATURE_MIN_SAMPLES.fullBehavioral
  };
}

/** Map classifier feature keys → validity flags */
export const FEATURE_SCORE_VALIDITY = {
  pathEfficiency: () => true, // geometry from ≥2 points always ok if we reached scoring
  velocityCV: (v) => v.velocity,
  normalizedPeakTime: (v) => v.velocity,
  meanAbsDirectionChange: (v) => v.directionChange,
  microCorrectionCount: (v) => v.microCorrections,
  lateMicroCorrectionCount: (v) => v.microCorrections,
  sampleIntervalCV: () => true, // from raw event timing
  meanAxisDeviationNorm: () => true,
  submovementCount: (v) => v.submovements,
  normalizedJerk: (v) => v.jerk
};
