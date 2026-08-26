/**
 * Central feature extraction pipeline.
 * Raw trajectory → preprocess → geometry/kinematics/corrections/fitts/neuromotor → features
 */

import { preprocessTrajectory, withNormalizedCoords } from './preprocess.js';
import { computeGeometry } from './geometry.js';
import { computeKinematics, minimumJerkDeviation } from './kinematics.js';
import { computeCorrections } from './corrections.js';
import { fittsMetrics } from './fitts.js';
import { analyzeSubmovements, residualEnergyProxy } from './neuromotor.js';
import { clamp } from './math.js';

/**
 * @param {object} input
 * @param {Array<{x:number,y:number,t:number}>} input.samples board-local px
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
  const start = samples[0] || { x: 0, y: 0, t: 0 };
  const end = samples[samples.length - 1] || start;
  const targetCenter = input.targetCenter || end;
  const targetRadius = input.targetRadius || 64;

  const geometry = computeGeometry(samples, start, end, targetCenter);
  const kinematics = computeKinematics(samples);
  const corrections = computeCorrections(samples, start, targetCenter, targetRadius, kinematics);
  const fitts = fittsMetrics(geometry.startTargetDistance, targetRadius * 2, kinematics.movementTimeMs);
  const neuromotor = analyzeSubmovements(kinematics.velocities, kinematics.movementTimeMs);
  const residuals = residualEnergyProxy(samples, geometry.startTargetDistance);
  const minJerkDev = minimumJerkDeviation(corrections.progress || []);

  const reactionMs = Math.max(0, input.reactionMs || 0);
  const totalMs = Math.max(
    kinematics.movementTimeMs,
    input.challengeDurationMs || 0
  );

  /** @type {Record<string, number|string|object|null|undefined>} */
  const features = {
    pointerType,
    sampleCount: samples.length,
    rawSampleCount: rawTrajectory.length,
    droppedDuplicates,
    droppedInvalid,
    reactionMs,
    movementTime: kinematics.movementTimeMs,
    totalMs,

    pathLength: geometry.pathLength,
    displacement: geometry.displacement,
    pathEfficiency: geometry.pathEfficiency,
    pathDeviationRatio: geometry.pathDeviationRatio,
    pathExcess: geometry.pathExcess,
    startTargetDistance: geometry.startTargetDistance,

    meanVelocity: kinematics.meanVelocity,
    medianVelocity: kinematics.medianVelocity,
    maxVelocity: kinematics.maxVelocity,
    minMovingVelocity: kinematics.minMovingVelocity,
    velocityStd: kinematics.velocityStd,
    velocityVariance: kinematics.velocityVariance,
    velocityCV: kinematics.velocityCV,
    normalizedPeakTime: kinematics.normalizedPeakTime,
    velocityPeakCount: kinematics.velocityPeakCount,
    velocityValleyCount: kinematics.velocityValleyCount,
    earlyAccelerationRatio: kinematics.earlyAccelerationRatio,
    lateDecelerationRatio: kinematics.lateDecelerationRatio,

    meanAcceleration: kinematics.meanAcceleration,
    accelerationStd: kinematics.accelerationStd,
    maxPositiveAcceleration: kinematics.maxPositiveAcceleration,
    maxNegativeAcceleration: kinematics.maxNegativeAcceleration,
    accelerationVariance: kinematics.accelerationVariance,
    accelerationSignChanges: kinematics.accelerationSignChanges,

    meanAbsoluteJerk: kinematics.meanAbsoluteJerk,
    jerkStd: kinematics.jerkStd,
    jerkVariance: kinematics.jerkVariance,
    maxAbsoluteJerk: kinematics.maxAbsoluteJerk,
    integratedSquaredJerk: kinematics.integratedSquaredJerk,
    normalizedJerk: kinematics.normalizedJerk,

    meanAbsDirectionChange: kinematics.meanAbsDirectionChange,
    directionChangeStd: kinematics.directionChangeStd,
    maxDirectionChange: kinematics.maxDirectionChange,
    directionChangeCount: kinematics.directionChangeCount,
    directionEntropy: kinematics.directionEntropy,

    meanCurvature: kinematics.meanCurvature,
    medianCurvature: kinematics.medianCurvature,
    curvatureStd: kinematics.curvatureStd,
    maxCurvature: kinematics.maxCurvature,
    integratedCurvature: kinematics.integratedCurvature,
    curvatureEntropy: kinematics.curvatureEntropy,

    meanAxisDeviation: geometry.meanAxisDeviation,
    maxAxisDeviation: geometry.maxAxisDeviation,
    axisDeviationStd: geometry.axisDeviationStd,
    meanAxisDeviationNorm: geometry.meanAxisDeviationNorm,
    maxAxisDeviationNorm: geometry.maxAxisDeviationNorm,
    axisCrossings: geometry.axisCrossings,

    backwardProgressCount: corrections.backwardProgressCount,
    backwardProgressDistance: corrections.backwardProgressDistance,
    largestBackwardCorrection: corrections.largestBackwardCorrection,

    microCorrectionCount: corrections.microCorrectionCount,
    microCorrectionMagnitude: corrections.microCorrectionMagnitude,
    lateMicroCorrectionCount: corrections.lateMicroCorrectionCount,
    lateVelocityDrop: corrections.lateVelocityDrop,

    overshootCount: corrections.overshootCount,
    overshootDistance: corrections.overshootDistance,
    overshootDuration: corrections.overshootDuration,

    sampleIntervalCV: kinematics.sampleIntervalCV,
    timingEntropy: kinematics.timingEntropy,
    dtMean: kinematics.dtMean,
    dtStd: kinematics.dtStd,
    dtCV: kinematics.dtCV,

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

  // Long travels with few samples are classifiable (often synthetic/teleport) — not "insufficient".
  if (path >= Math.max(minimum.pathLengthPx, 100) && samples >= 3) return false;
  if (disp >= Math.max(minimum.displacementPx, 80) && samples >= 3) return false;

  return (
    samples < minimum.sampleCount ||
    path < minimum.pathLengthPx ||
    dur < minimum.durationMs ||
    disp < minimum.displacementPx
  );
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}
