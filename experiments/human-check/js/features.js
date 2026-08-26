/**
 * Central feature extraction pipeline.
 *
 * Circle-center userTrajectory
 *   → preprocess
 *   → analysisTrajectory (cleaned)
 *   → resampledTrajectory (~100 Hz) for distribution/shape features
 *   → geometry / kinematics / corrections
 *   → featureValidity
 *   → features (invalid higher-order metrics are null)
 *
 * Timing features (dt*) always come from cleaned event intervals — never resampled.
 */

import { preprocessTrajectory, withNormalizedCoords, resampleUniformTime } from './preprocess.js';
import { computeGeometry } from './geometry.js';
import { computeKinematics, minimumJerkDeviation } from './kinematics.js';
import { computeCorrections } from './corrections.js';
import { fittsMetrics } from './fitts.js';
import { analyzeSubmovements, residualEnergyProxy } from './neuromotor.js';
import { computeFeatureValidity } from './validity.js';
import { clamp } from './math.js';

/**
 * @param {object} input
 * @param {Array<{x:number,y:number,t:number}>} input.samples board-local circle-center trajectory
 * @param {{width:number,height:number}} input.container
 * @param {{x:number,y:number}} input.targetCenter board-local
 * @param {number} input.targetRadius
 * @param {string} input.pointerType mouse|touch|pen|keyboard|unknown
 * @param {number} [input.reactionMs]
 * @param {number} [input.challengeDurationMs]
 */
export function extractFeatures(input) {
  const pointerType = input.pointerType || 'unknown';
  const container = input.container || { width: 1, height: 1 };
  const normalized = withNormalizedCoords(input.samples || [], container);
  const { rawTrajectory, analysisTrajectory, droppedDuplicates, droppedInvalid } =
    preprocessTrajectory(normalized);

  const samples = analysisTrajectory;
  const validity = computeFeatureValidity(samples.length);
  const resampledTrajectory = validity.entropy || validity.residualEnergy
    ? resampleUniformTime(samples)
    : samples.slice();

  const start = samples[0] || { x: 0, y: 0, t: 0 };
  const end = samples[samples.length - 1] || start;
  const targetCenter = input.targetCenter || end;
  const targetRadius = input.targetRadius || 64;

  const geometry = computeGeometry(samples, start, end, targetCenter);
  const kinematics = computeKinematics(samples);
  const corrections = computeCorrections(samples, start, targetCenter, targetRadius, kinematics);
  const fitts = fittsMetrics(geometry.startTargetDistance, targetRadius * 2, kinematics.movementTimeMs);

  // Distribution / residual features prefer uniform-time resampled path
  const resampledKinematics = validity.entropy
    ? computeKinematics(resampledTrajectory)
    : null;
  const neuromotor = validity.submovements
    ? analyzeSubmovements(kinematics.velocities, kinematics.movementTimeMs)
    : {
      submovementCount: null,
      primaryPeakDominance: null,
      lateSubmovementCount: null,
      meanSubmovementDuration: null,
      experimentalNeuromotorMetrics: {
        implemented: false,
        model: 'submovement-proxy',
        note: 'Insufficient samples for submovement analysis.'
      }
    };
  const residuals = validity.residualEnergy
    ? residualEnergyProxy(resampledTrajectory, geometry.startTargetDistance)
    : { residualEnergy: null, highFrequencyEnergyRatio: null };

  const minJerkDev = validity.minJerkCompare
    ? minimumJerkDeviation(corrections.progress || [], samples)
    : null;

  const reactionMs = Math.max(0, input.reactionMs || 0);
  const totalMs = Math.max(kinematics.movementTimeMs, input.challengeDurationMs || 0);

  const nullIf = (ok, value) => (ok ? value : null);

  const features = {
    pointerType,
    sampleCount: samples.length,
    rawSampleCount: rawTrajectory.length,
    resampledSampleCount: resampledTrajectory.length,
    droppedDuplicates,
    droppedInvalid,
    featureValidity: validity,
    reactionMs,
    movementTime: kinematics.movementTimeMs,
    totalMs,

    pathLength: geometry.pathLength,
    displacement: geometry.displacement,
    pathEfficiency: geometry.pathEfficiency,
    pathDeviationRatio: geometry.pathDeviationRatio,
    pathExcess: geometry.pathExcess,
    startTargetDistance: geometry.startTargetDistance,

    meanVelocity: nullIf(validity.velocity, kinematics.meanVelocity),
    medianVelocity: nullIf(validity.velocity, kinematics.medianVelocity),
    maxVelocity: nullIf(validity.velocity, kinematics.maxVelocity),
    minMovingVelocity: nullIf(validity.velocity, kinematics.minMovingVelocity),
    velocityStd: nullIf(validity.velocity, kinematics.velocityStd),
    velocityVariance: nullIf(validity.velocity, kinematics.velocityVariance),
    velocityCV: nullIf(validity.velocity, kinematics.velocityCV),
    normalizedPeakTime: nullIf(validity.velocity, kinematics.normalizedPeakTime),
    velocityPeakCount: nullIf(validity.velocity, kinematics.velocityPeakCount),
    velocityValleyCount: nullIf(validity.velocity, kinematics.velocityValleyCount),
    earlyAccelerationRatio: nullIf(validity.acceleration, kinematics.earlyAccelerationRatio),
    lateDecelerationRatio: nullIf(validity.acceleration, kinematics.lateDecelerationRatio),

    meanAcceleration: nullIf(validity.acceleration, kinematics.meanAcceleration),
    accelerationStd: nullIf(validity.acceleration, kinematics.accelerationStd),
    maxPositiveAcceleration: nullIf(validity.acceleration, kinematics.maxPositiveAcceleration),
    maxNegativeAcceleration: nullIf(validity.acceleration, kinematics.maxNegativeAcceleration),
    accelerationVariance: nullIf(validity.acceleration, kinematics.accelerationVariance),
    accelerationSignChanges: nullIf(validity.acceleration, kinematics.accelerationSignChanges),

    meanAbsoluteJerk: nullIf(validity.jerk, kinematics.meanAbsoluteJerk),
    jerkStd: nullIf(validity.jerk, kinematics.jerkStd),
    jerkVariance: nullIf(validity.jerk, kinematics.jerkVariance),
    maxAbsoluteJerk: nullIf(validity.jerk, kinematics.maxAbsoluteJerk),
    integratedSquaredJerk: nullIf(validity.jerk, kinematics.integratedSquaredJerk),
    normalizedJerk: nullIf(validity.jerk, kinematics.normalizedJerk),

    meanAbsDirectionChange: nullIf(validity.directionChange, kinematics.meanAbsDirectionChange),
    directionChangeStd: nullIf(validity.directionChange, kinematics.directionChangeStd),
    maxDirectionChange: nullIf(validity.directionChange, kinematics.maxDirectionChange),
    directionChangeCount: nullIf(validity.directionChange, kinematics.directionChangeCount),
    directionEntropy: nullIf(
      validity.entropy,
      resampledKinematics ? resampledKinematics.directionEntropy : kinematics.directionEntropy
    ),

    meanCurvature: nullIf(validity.curvature, kinematics.meanCurvature),
    medianCurvature: nullIf(validity.curvature, kinematics.medianCurvature),
    curvatureStd: nullIf(validity.curvature, kinematics.curvatureStd),
    maxCurvature: nullIf(validity.curvature, kinematics.maxCurvature),
    integratedCurvature: nullIf(validity.curvature, kinematics.integratedCurvature),
    curvatureEntropy: nullIf(
      validity.entropy,
      resampledKinematics ? resampledKinematics.curvatureEntropy : kinematics.curvatureEntropy
    ),

    meanAxisDeviation: geometry.meanAxisDeviation,
    maxAxisDeviation: geometry.maxAxisDeviation,
    axisDeviationStd: geometry.axisDeviationStd,
    meanAxisDeviationNorm: geometry.meanAxisDeviationNorm,
    maxAxisDeviationNorm: geometry.maxAxisDeviationNorm,
    axisCrossings: geometry.axisCrossings,

    backwardProgressCount: nullIf(validity.microCorrections, corrections.backwardProgressCount),
    backwardProgressDistance: nullIf(validity.microCorrections, corrections.backwardProgressDistance),
    largestBackwardCorrection: nullIf(validity.microCorrections, corrections.largestBackwardCorrection),

    microCorrectionCount: nullIf(validity.microCorrections, corrections.microCorrectionCount),
    microCorrectionMagnitude: nullIf(validity.microCorrections, corrections.microCorrectionMagnitude),
    lateMicroCorrectionCount: nullIf(validity.microCorrections, corrections.lateMicroCorrectionCount),
    lateVelocityDrop: nullIf(validity.velocity, corrections.lateVelocityDrop),

    overshootCount: corrections.overshootCount,
    overshootDistance: corrections.overshootDistance,
    overshootDuration: corrections.overshootDuration,

    // Timing from cleaned event intervals only (not resampled)
    sampleIntervalCV: samples.length >= 2 ? kinematics.sampleIntervalCV : null,
    timingEntropy: samples.length >= 2 ? kinematics.timingEntropy : null,
    dtMean: samples.length >= 2 ? kinematics.dtMean : null,
    dtStd: samples.length >= 2 ? kinematics.dtStd : null,
    dtCV: samples.length >= 2 ? kinematics.dtCV : null,

    fittsID: fitts.fittsID,
    fittsThroughput: fitts.fittsThroughput,
    fittsDistance: fitts.fittsDistance,
    fittsWidth: fitts.fittsWidth,

    submovementCount: neuromotor.submovementCount,
    primaryPeakDominance: neuromotor.primaryPeakDominance,
    lateSubmovementCount: neuromotor.lateSubmovementCount,
    meanSubmovementDuration: neuromotor.meanSubmovementDuration,

    residualEnergy: residuals.residualEnergy,
    highFrequencyEnergyRatio: residuals.highFrequencyEnergyRatio,
    minimumJerkDeviation: minJerkDev,

    experimentalNeuromotorMetrics: neuromotor.experimentalNeuromotorMetrics
  };

  return {
    features,
    rawTrajectory,
    analysisTrajectory: samples,
    resampledTrajectory,
    series: {
      velocities: kinematics.velocities,
      accelerations: kinematics.accelerations,
      curvatures: kinematics.curvatures,
      progress: corrections.progress,
      dts: kinematics.dts
    },
    geometryMeta: {
      start,
      end,
      targetCenter,
      targetRadius,
      container
    }
  };
}

export function hasInsufficientSignal(features, minimum) {
  const samples = features.sampleCount || 0;
  const path = features.pathLength || 0;
  const dur = features.movementTime || 0;
  const disp = features.displacement || 0;

  if (samples < 3) return true;
  if (disp < 20 && path < 24) return true;

  // Long sparse travels are NOT "insufficient" — they go to structural anomaly checks.
  if (path >= Math.max(minimum.pathLengthPx, 100) && samples >= 3) return false;
  if (disp >= Math.max(minimum.displacementPx, 80) && samples >= 3) return false;

  return (
    samples < minimum.sampleCount ||
    path < minimum.pathLengthPx ||
    dur < minimum.durationMs ||
    disp < minimum.displacementPx
  );
}

/** Sparse but long path eligible for structural-only synthetic checks */
export function isSparseStructuralCandidate(features) {
  const n = features.sampleCount || 0;
  const path = features.pathLength || 0;
  const disp = features.displacement || 0;
  return n >= 3 && n < 8 && (path >= 100 || disp >= 80);
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}
