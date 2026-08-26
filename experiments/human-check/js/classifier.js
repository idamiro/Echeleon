/**
 * Human Check classifier — heuristic likelihood model (Layer 1)
 * + interface for future trained models (Layer 2).
 *
 * Heuristic outputs are NOT calibrated probabilities.
 * Use humanLikeScore / syntheticRisk — never imply P(human) for heuristics.
 *
 * Pointer-specific profiles (mouse / touch / pen) live in calibration.js.
 * PROVISIONAL — NOT EMPIRICALLY CALIBRATED
 */

import { calibration, profileForPointer } from './calibration.js';
import {
  hasInsufficientSignal,
  isSparseStructuralCandidate,
  clamp01
} from './features.js';
import { FEATURE_SCORE_VALIDITY } from './validity.js';
import { clamp } from './math.js';

/**
 * Soft Gaussian-like plausibility in [0,1].
 * Centers (μ, σ) are PROVISIONAL placeholders — not trained.
 */
export function gaussianPlausibility(x, mu, sigma) {
  if (!(sigma > 0) || !Number.isFinite(x)) return null;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/**
 * @typedef {'human_like'|'synthetic_like'|'uncertain'|'insufficient_signal'|'accessible_completion'} ClassificationState
 */

/**
 * Heuristic classifier — modelType: "heuristic"
 */
export class HeuristicHumanCheckClassifier {
  constructor(config = calibration) {
    this.config = config;
  }

  /**
   * @param {object} features
   * @returns {ClassificationResult}
   */
  predict(features) {
    if (features.pointerType === 'keyboard') {
      return this.#keyboardResult(features);
    }

    const profile = profileForPointer(features.pointerType);
    const norms = normalizedGeometry(features);

    // Sparse long paths: structural anomaly only — do not invent jerk/entropy human scores
    if (isSparseStructuralCandidate(features) && !features.featureValidity?.fullBehavioral) {
      const structural = this.#structuralAnomaly(features);
      if (structural.syntheticRisk >= 0.62) {
        return this.#heuristicResult('synthetic_like', {
          humanLikeScore: clamp01(1 - structural.syntheticRisk),
          syntheticRisk: structural.syntheticRisk,
          confidence: 0.55,
          contributions: structural.contributions,
          risks: structural.risks,
          featureScores: {},
          diagnostics: baseDiagnostics(profile, features, norms, {}, structural.risks, [])
        }, features, profile);
      }
      return this.#heuristicResult('insufficient_signal', {
        humanLikeScore: null,
        syntheticRisk: structural.syntheticRisk,
        confidence: 0.25,
        contributions: [
          'Too few samples for full behavioral analysis.',
          'No strong structural synthetic anomaly detected.'
        ],
        risks: structural.risks,
        featureScores: {},
        diagnostics: baseDiagnostics(profile, features, norms, {}, structural.risks, [
          'insufficient samples for full behavioral analysis'
        ])
      }, features, profile);
    }

    if (hasInsufficientSignal(features, profile.minimum, norms)) {
      return this.#heuristicResult('insufficient_signal', {
        humanLikeScore: null,
        syntheticRisk: null,
        confidence: 0.15,
        contributions: ['Too few samples, too short a path, or too brief a movement to evaluate.'],
        risks: {},
        featureScores: {},
        diagnostics: baseDiagnostics(profile, features, norms, {}, {}, [
          'insufficient signal for modality profile'
        ])
      }, features, profile);
    }

    const validity = features.featureValidity || {};
    const cal = profile.gaussians;
    const weights = profile.featureWeights;

    const rawScores = {
      pathEfficiency: num(features.pathEfficiency)
        ? gaussianPlausibility(features.pathEfficiency, cal.pathEfficiency.mu, cal.pathEfficiency.sigma)
        : null,
      velocityCV: num(features.velocityCV)
        ? gaussianPlausibility(features.velocityCV, cal.velocityCV.mu, cal.velocityCV.sigma)
        : null,
      normalizedPeakTime: num(features.normalizedPeakTime)
        ? gaussianPlausibility(features.normalizedPeakTime, cal.normalizedPeakTime.mu, cal.normalizedPeakTime.sigma)
        : null,
      meanAbsDirectionChange: num(features.meanAbsDirectionChange)
        ? gaussianPlausibility(
          features.meanAbsDirectionChange,
          cal.meanAbsDirectionChange.mu,
          cal.meanAbsDirectionChange.sigma
        )
        : null,
      microCorrectionCount: num(features.microCorrectionCount)
        ? gaussianPlausibility(
          features.microCorrectionCount,
          cal.microCorrectionCount.mu,
          cal.microCorrectionCount.sigma
        )
        : null,
      lateMicroCorrectionCount: num(features.lateMicroCorrectionCount)
        ? gaussianPlausibility(
          features.lateMicroCorrectionCount,
          cal.lateMicroCorrectionCount.mu,
          cal.lateMicroCorrectionCount.sigma
        )
        : null,
      sampleIntervalCV: num(features.sampleIntervalCV)
        ? gaussianPlausibility(
          features.sampleIntervalCV,
          cal.sampleIntervalCV.mu,
          cal.sampleIntervalCV.sigma
        )
        : null,
      meanAxisDeviationNorm: num(features.meanAxisDeviationNorm)
        ? gaussianPlausibility(
          features.meanAxisDeviationNorm,
          cal.meanAxisDeviationNorm.mu,
          cal.meanAxisDeviationNorm.sigma
        )
        : null,
      submovementCount: num(features.submovementCount)
        ? gaussianPlausibility(
          features.submovementCount,
          cal.submovementCount.mu,
          cal.submovementCount.sigma
        )
        : null,
      normalizedJerk: num(features.normalizedJerk)
        ? gaussianPlausibility(
          Math.log10(Math.max(features.normalizedJerk, 1e-6)),
          cal.normalizedJerkLog.mu,
          cal.normalizedJerkLog.sigma
        )
        : null
    };

    let score = 0;
    let wSum = 0;
    const featureScores = {};
    const weightedContributions = {};
    const totalExpectedWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    Object.keys(weights).forEach((k) => {
      const validityFn = FEATURE_SCORE_VALIDITY[k];
      const valid = validityFn ? validityFn(validity) : true;
      const s = rawScores[k];
      if (!valid || s == null || !Number.isFinite(s)) {
        featureScores[k] = null;
        weightedContributions[k] = null;
        return;
      }
      featureScores[k] = s;
      const contrib = weights[k] * s;
      weightedContributions[k] = contrib;
      score += contrib;
      wSum += weights[k];
    });

    if (wSum < 0.25) {
      return this.#heuristicResult('insufficient_signal', {
        humanLikeScore: null,
        syntheticRisk: null,
        confidence: 0.2,
        contributions: ['Too few valid behavioral features to score.'],
        risks: {},
        featureScores,
        diagnostics: baseDiagnostics(profile, features, norms, weightedContributions, {}, [
          'too few valid features'
        ])
      }, features, profile);
    }

    let humanLikeScore = clamp01(score / wSum);

    const risks = this.#interactionRisks(features, profile);
    const w = profile.interactionRiskWeights;
    let syntheticRisk = clamp01(
      risks.linearConstantMotion * w.linearConstantMotion +
      risks.perfectEase * w.perfectEase +
      risks.randomNoise * w.randomNoise +
      risks.overRegularTiming * w.overRegularTiming +
      risks.teleport * w.teleport
    );

    // Touch: timing regularity alone must not dominate synthetic risk
    if (profile.riskMode === 'touch' && risks.overRegularTiming > 0.5) {
      const other =
        risks.linearConstantMotion + risks.perfectEase + risks.randomNoise + risks.teleport;
      if (other < 0.35) {
        syntheticRisk = clamp01(syntheticRisk * 0.45 + risks.teleport * 0.15);
      }
    }

    // Touch: exact event clock + mechanical ease/line is still scripted
    if (
      profile.riskMode === 'touch' &&
      num(features.sampleIntervalCV) &&
      features.sampleIntervalCV < 0.04 &&
      risks.perfectEase >= 0.55 &&
      risks.overRegularTiming >= 0.55
    ) {
      syntheticRisk = Math.max(syntheticRisk, 0.6);
    }

    humanLikeScore = clamp01(humanLikeScore * (1 - 0.72 * syntheticRisk) + 0.05 * (1 - syntheticRisk));

    const validFeatureRatio = totalExpectedWeight > 0 ? wSum / totalExpectedWeight : 0;
    const confidence = computeConfidence(features, norms, profile, humanLikeScore, validFeatureRatio);

    const { contributions, topPositive, topNegative, uncertaintyDrivers } = this.#explainDetailed(
      features,
      featureScores,
      weightedContributions,
      risks,
      humanLikeScore,
      profile
    );

    let state = 'uncertain';
    const th = profile.thresholds;
    if (humanLikeScore >= th.humanLike && syntheticRisk < th.syntheticRiskSoft) state = 'human_like';
    else if (humanLikeScore <= th.syntheticLike || syntheticRisk >= th.syntheticRiskHard) {
      state = 'synthetic_like';
    } else state = 'uncertain';

    if (confidence < profile.confidence.minConfidenceForceUncertain) {
      if (Math.abs(humanLikeScore - 0.5) < profile.confidence.ambiguousBand) {
        state = 'uncertain';
      }
    }

    const diagnostics = {
      ...baseDiagnostics(profile, features, norms, weightedContributions, risks, uncertaintyDrivers),
      topPositive,
      topNegative,
      uncertaintyDrivers,
      validFeatureRatio,
      humanLikeScore,
      syntheticRisk,
      confidence
    };

    return this.#heuristicResult(state, {
      humanLikeScore,
      syntheticRisk,
      confidence,
      contributions,
      risks,
      featureScores,
      weightedContributions,
      diagnostics
    }, features, profile);
  }

  #structuralAnomaly(f) {
    const risks = {
      linearConstantMotion: 0,
      perfectEase: 0,
      randomNoise: 0,
      overRegularTiming: 0,
      teleport: 0
    };
    const contributions = [];

    const teleport =
      (f.sampleCount <= 6 && f.pathLength > 140 && f.pathEfficiency > 0.97 ? 0.9 : 0) +
      (f.sampleCount <= 5 && f.displacement > 200 && f.pathEfficiency > 0.95 ? 0.85 : 0) +
      (num(f.maxVelocity) && f.maxVelocity > 8000 ? 0.4 : 0);
    risks.teleport = clamp01(teleport);

    if (f.pathEfficiency > 0.99 && f.sampleCount <= 6) {
      risks.linearConstantMotion = 0.7;
      contributions.push('Near-perfect straight path with very few samples');
    }
    if (risks.teleport >= 0.5) {
      contributions.push('Sparse samples covering a long distance (teleport-like)');
    }
    if (!contributions.length) contributions.push('Sparse trajectory — structural check only');

    return {
      syntheticRisk: clamp01(Math.max(risks.teleport, risks.linearConstantMotion)),
      risks,
      contributions
    };
  }

  #keyboardResult(features) {
    if (
      features.sampleCount < 4 ||
      features.pathLength < 40 ||
      features.displacement < 30
    ) {
      return {
        state: 'insufficient_signal',
        modelType: 'heuristic',
        classifierProfile: 'keyboard',
        humanLikeScore: null,
        syntheticRisk: null,
        humanProbability: undefined,
        confidence: 0.2,
        contributions: ['Keyboard path had too little movement to evaluate.'],
        risks: {},
        featureScores: {},
        diagnostics: null,
        features,
        calibrationVersion: this.config.version
      };
    }
    return {
      state: 'accessible_completion',
      modelType: 'heuristic',
      classifierProfile: 'keyboard',
      humanLikeScore: null,
      syntheticRisk: null,
      humanProbability: undefined,
      confidence: 1,
      contributions: [
        'Accessible keyboard completion.',
        'Pointer trajectory classifier not applied.'
      ],
      risks: {},
      featureScores: {},
      diagnostics: null,
      features,
      calibrationVersion: this.config.version
    };
  }

  /**
   * Pointer-type-specific interaction risks.
   * Touch: straight / smooth / regular-timing alone is less suspicious.
   */
  #interactionRisks(f, profile) {
    const mode = profile.riskMode || 'mouse';
    const nearPerfectLine = f.pathEfficiency >= 0.985;
    const veryStraight = f.pathEfficiency >= 0.97;
    const noCorrections =
      (f.microCorrectionCount == null || f.microCorrectionCount === 0) &&
      (f.lateMicroCorrectionCount == null || f.lateMicroCorrectionCount === 0) &&
      (f.backwardProgressCount == null || f.backwardProgressCount === 0);
    const flatSpeed = num(f.velocityCV) && f.velocityCV < 0.22;
    const veryFlatSpeed = num(f.velocityCV) && f.velocityCV < 0.12;
    const singleBallistic =
      (f.submovementCount == null || f.submovementCount <= 1) &&
      (f.velocityPeakCount == null || f.velocityPeakCount <= 1);
    const mechanicalTiming =
      num(f.sampleIntervalCV) && f.sampleIntervalCV < 0.06;

    if (mode === 'touch') {
      let risksBumpLinear = 0;
      // Straight finger swipe is normal — require constant/near-zero velocity CV
      const linearConstantMotion = clamp01(
        0.25 * upper(f.pathEfficiency, 0.985, 0.998) +
        0.45 * (num(f.velocityCV) ? upper(1 - Math.min(f.velocityCV, 1), 0.82, 0.97) : 0) +
        0.15 * (num(f.meanCurvature) ? upper(1 - Math.min(f.meanCurvature * 40, 1), 0.75, 0.95) : 0) +
        0.15 * (veryFlatSpeed && nearPerfectLine && mechanicalTiming ? 1 : 0)
      );

      // Smooth ballistic finger motion is normal — need mechanical combo
      let perfectEase = clamp01(
        0.15 * upper(f.pathEfficiency, 0.98, 0.998) +
        0.15 * (num(f.normalizedPeakTime) ? gaussianNear(f.normalizedPeakTime, 0.45, 0.08) : 0) +
        0.1 * (noCorrections ? 0.35 : 0) +
        0.25 * (mechanicalTiming ? 1 : 0) +
        0.2 * (veryFlatSpeed ? 1 : 0) +
        0.15 * (singleBallistic && nearPerfectLine && mechanicalTiming ? 1 : 0)
      );
      if (!(mechanicalTiming && (veryFlatSpeed || nearPerfectLine))) {
        perfectEase *= 0.35;
      }

      const randomNoise = clamp01(
        0.4 * (num(f.directionEntropy) ? upper(f.directionEntropy / 3.2, 0.75, 1) : 0) +
        0.35 * (num(f.highFrequencyEnergyRatio) ? upper(f.highFrequencyEnergyRatio, 0.55, 0.9) : 0) +
        0.15 * (num(f.backwardProgressCount) ? upper(1 - Math.min(f.backwardProgressCount / 2, 1), 0.7, 1) : 0) +
        0.1 * (num(f.lateDecelerationRatio) ? upper(1 - Math.min(f.lateDecelerationRatio, 1), 0.55, 0.9) : 0)
      );

      // Timing regularity alone is weak for touch
      let overRegularTiming = clamp01(
        0.7 * (num(f.sampleIntervalCV) ? upper(1 - Math.min(f.sampleIntervalCV, 1), 0.9, 0.99) : 0) +
        0.3 * (num(f.timingEntropy) ? upper(1 - Math.min(f.timingEntropy / 3, 1), 0.75, 0.95) : 0)
      );
      if (!(veryFlatSpeed && nearPerfectLine)) {
        overRegularTiming = Math.min(overRegularTiming, 0.22);
      }

      // Exact constant clock + near-perfect geometry is still scripted on touch
      const exactClock = num(f.sampleIntervalCV) && f.sampleIntervalCV < 0.04;
      if (exactClock && f.pathEfficiency >= 0.97) {
        overRegularTiming = Math.max(overRegularTiming, 0.7);
        perfectEase = Math.max(perfectEase, 0.65);
        if (veryFlatSpeed || (num(f.velocityCV) && f.velocityCV < 0.2)) {
          risksBumpLinear = 0.55;
        }
      }

      let teleport = 0;
      if (f.sampleCount <= 6 && f.pathLength > 140 && f.pathEfficiency > 0.97) teleport += 0.85;
      if (num(f.maxVelocity) && f.maxVelocity > 8000 && num(f.velocityCV) && f.velocityCV < 0.15) {
        teleport += 0.4;
      }

      return {
        linearConstantMotion: clamp01(Math.max(linearConstantMotion, risksBumpLinear || 0)),
        perfectEase: clamp01(perfectEase),
        randomNoise,
        overRegularTiming: clamp01(overRegularTiming),
        teleport: clamp01(teleport)
      };
    }

    // Mouse / pen (pen uses slightly softer perfect-ease via weights)
    const linearConstantMotion = clamp01(
      0.4 * upper(f.pathEfficiency, 0.965, 0.995) +
      0.35 * (num(f.velocityCV) ? upper(1 - Math.min(f.velocityCV, 1), 0.7, 0.95) : 0) +
      0.15 * (num(f.meanCurvature) ? upper(1 - Math.min(f.meanCurvature * 25, 1), 0.65, 0.95) : 0) +
      0.1 * (noCorrections ? 1 : 0)
    );

    const perfectEase = clamp01(
      0.3 * upper(f.pathEfficiency, 0.955, 0.995) +
      0.2 * (num(f.normalizedPeakTime) ? gaussianNear(f.normalizedPeakTime, 0.45, 0.1) : 0) +
      0.2 * (noCorrections ? 1 : 0) +
      0.15 * (num(f.minimumJerkDeviation) ? upper(1 - Math.min(f.minimumJerkDeviation, 1), 0.7, 0.95) : 0) +
      0.15 * (singleBallistic && nearPerfectLine ? 1 : 0)
    );

    const randomNoise = clamp01(
      0.35 * (num(f.directionEntropy) ? upper(f.directionEntropy / 3.2, 0.75, 1) : 0) +
      0.3 * (num(f.highFrequencyEnergyRatio) ? upper(f.highFrequencyEnergyRatio, 0.55, 0.9) : 0) +
      0.2 * (num(f.backwardProgressCount) ? upper(1 - Math.min(f.backwardProgressCount / 2, 1), 0.7, 1) : 0) +
      0.15 * (num(f.lateDecelerationRatio) ? upper(1 - Math.min(f.lateDecelerationRatio, 1), 0.55, 0.9) : 0)
    );

    const overRegularTiming = clamp01(
      0.7 * (num(f.sampleIntervalCV) ? upper(1 - Math.min(f.sampleIntervalCV, 1), 0.82, 0.98) : 0) +
      0.3 * (num(f.timingEntropy) ? upper(1 - Math.min(f.timingEntropy / 3, 1), 0.65, 0.95) : 0)
    );

    let teleport = 0;
    if (f.sampleCount <= 6 && f.pathLength > 140 && f.pathEfficiency > 0.97) teleport += 0.85;
    if (num(f.maxVelocity) && f.maxVelocity > 8000 && num(f.velocityCV) && f.velocityCV < 0.15) {
      teleport += 0.4;
    }

    const roboticCorners =
      num(f.directionChangeCount) &&
      f.directionChangeCount >= 1 &&
      num(f.maxDirectionChange) &&
      f.maxDirectionChange > 1.2 &&
      num(f.meanCurvature) &&
      f.meanCurvature < 0.025 &&
      num(f.sampleIntervalCV) &&
      f.sampleIntervalCV < 0.08 &&
      (f.microCorrectionCount == null || f.microCorrectionCount === 0);
    const piecewiseRobotic = roboticCorners ? 0.85 : 0;

    const penEaseScale = mode === 'pen' ? 0.85 : 1;

    return {
      linearConstantMotion: clamp01(
        linearConstantMotion + (nearPerfectLine && flatSpeed ? 0.15 : 0)
      ),
      perfectEase: clamp01(
        (perfectEase + (nearPerfectLine && noCorrections && singleBallistic ? 0.2 : 0)) * penEaseScale
      ),
      randomNoise,
      overRegularTiming,
      teleport: clamp01(teleport + piecewiseRobotic)
    };
  }

  #explainDetailed(f, featureScores, weightedContributions, risks, humanLikeScore, profile) {
    const featureLabels = {
      velocityCV: 'speed variation',
      normalizedPeakTime: 'accel/decel structure',
      microCorrectionCount: 'micro-corrections',
      lateMicroCorrectionCount: 'late corrections',
      meanAxisDeviationNorm: 'axis deviation',
      submovementCount: 'submovements',
      pathEfficiency: 'path efficiency',
      meanAbsDirectionChange: 'direction change',
      sampleIntervalCV: 'timing regularity',
      normalizedJerk: 'jerk profile'
    };
    const riskLabels = {
      linearConstantMotion: 'straight constant motion',
      perfectEase: 'perfect ease / no correction',
      randomNoise: 'random noise pattern',
      overRegularTiming: 'timing regularity',
      teleport: 'teleport / sparse long path'
    };

    const scored = Object.entries(featureScores)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => ({
        key: k,
        score: v,
        weight: profile.featureWeights[k] || 0,
        weighted: weightedContributions[k] || 0
      }));

    const topPositive = [...scored]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((x) => x.score >= 0.45)
      .map((x) => `${featureLabels[x.key] || x.key} (${x.score.toFixed(2)})`);

    const topNegative = [...scored]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .filter((x) => x.score < 0.45)
      .map((x) => `${featureLabels[x.key] || x.key} (${x.score.toFixed(2)})`);

    const uncertaintyDrivers = [];
    Object.entries(risks)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => {
        if (v >= 0.28) uncertaintyDrivers.push(riskLabels[k] || k);
      });
    scored
      .filter((x) => x.score < 0.35 && x.weight >= 0.08)
      .slice(0, 3)
      .forEach((x) => {
        const label = featureLabels[x.key] || x.key;
        if (!uncertaintyDrivers.includes(label)) uncertaintyDrivers.push(label);
      });

    const contributions = [];
    if (humanLikeScore <= 0.45) {
      uncertaintyDrivers.slice(0, 4).forEach((d) => contributions.push(d));
    } else {
      topPositive.slice(0, 3).forEach((p) => contributions.push(p));
    }
    if (!contributions.length) contributions.push('Mixed signals — no single feature dominated.');

    return {
      contributions: contributions.slice(0, 4),
      topPositive,
      topNegative,
      uncertaintyDrivers: uncertaintyDrivers.slice(0, 5)
    };
  }

  #heuristicResult(state, payload, features, profile) {
    return {
      state,
      modelType: 'heuristic',
      classifierProfile: profile?.id || features.pointerType || 'mouse',
      calibrationProvenance: profile?.provenance || this.config.provenance,
      humanLikeScore: payload.humanLikeScore,
      syntheticRisk: payload.syntheticRisk,
      humanProbability: undefined,
      confidence: payload.confidence,
      contributions: payload.contributions,
      risks: payload.risks,
      featureScores: payload.featureScores,
      weightedContributions: payload.weightedContributions || {},
      diagnostics: payload.diagnostics || null,
      features,
      calibrationVersion: this.config.version
    };
  }
}

function normalizedGeometry(f) {
  const dist = Math.max(f.startTargetDistance || 0, 1);
  const boardW = f.boardWidth || f.containerWidth || 0;
  const boardH = f.boardHeight || f.containerHeight || 0;
  const diagonal = boardW > 0 && boardH > 0 ? Math.hypot(boardW, boardH) : dist * 2;
  return {
    normalizedPathLength: (f.pathLength || 0) / dist,
    normalizedDisplacement: (f.displacement || 0) / dist,
    pathOverDiagonal: diagonal > 0 ? (f.pathLength || 0) / diagonal : 0,
    startTargetDistance: dist,
    boardDiagonal: diagonal
  };
}

function computeConfidence(features, norms, profile, humanLikeScore, validFeatureRatio) {
  const minN = profile.minimum.sampleCount || 8;
  const sampleQ = clamp01((features.sampleCount - minN) / 24);
  const durQ = clamp01((features.movementTime - 80) / 520);
  // Path coverage relative to start→target (device-size independent)
  const coverage = clamp01((norms.normalizedPathLength - 0.7) / 0.55);
  const richness = clamp01(
    0.32 * clamp01(validFeatureRatio) +
    0.24 * sampleQ +
    0.22 * durQ +
    0.22 * coverage
  );
  const decisiveness = Math.abs(humanLikeScore - 0.5) * 2;
  return clamp01(0.28 + 0.4 * richness + 0.32 * decisiveness);
}

function baseDiagnostics(profile, features, norms, weightedContributions, risks, drivers) {
  return {
    classifierProfile: profile.id,
    calibration: 'provisional',
    provenance: profile.provenance,
    pointerType: features.pointerType,
    sampleCount: features.sampleCount,
    movementTime: features.movementTime,
    pathLength: features.pathLength,
    displacement: features.displacement,
    startTargetDistance: features.startTargetDistance,
    normalizedPathLength: norms.normalizedPathLength,
    normalizedDisplacement: norms.normalizedDisplacement,
    pathEfficiency: features.pathEfficiency,
    velocityCV: features.velocityCV,
    normalizedPeakTime: features.normalizedPeakTime,
    sampleIntervalCV: features.sampleIntervalCV,
    timingEntropy: features.timingEntropy,
    meanAbsDirectionChange: features.meanAbsDirectionChange,
    microCorrectionCount: features.microCorrectionCount,
    lateMicroCorrectionCount: features.lateMicroCorrectionCount,
    meanAxisDeviationNorm: features.meanAxisDeviationNorm,
    submovementCount: features.submovementCount,
    normalizedJerk: features.normalizedJerk,
    risks: { ...risks },
    weightedContributions: { ...weightedContributions },
    uncertaintyDrivers: drivers || []
  };
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function upper(x, start, full) {
  if (!num(x)) return 0;
  if (x <= start) return 0;
  if (x >= full) return 1;
  return (x - start) / (full - start);
}

function gaussianNear(x, mu, sigma) {
  return gaussianPlausibility(x, mu, sigma) || 0;
}

/**
 * Future trained logistic model — may expose humanProbability once calibrated.
 * modelType: "trained_logistic"
 */
export class LogisticRegressionClassifier {
  constructor(model) {
    this.model = model;
    if (!model || !model.weights) {
      throw new Error('LogisticRegressionClassifier requires trained weights — none provided.');
    }
  }

  predict(features) {
    let z = this.model.bias || 0;
    Object.entries(this.model.weights).forEach(([k, w]) => {
      if (typeof features[k] === 'number') z += w * features[k];
    });
    const humanProbability = 1 / (1 + Math.exp(-z));
    return {
      state: humanProbability >= 0.62 ? 'human_like' : humanProbability <= 0.38 ? 'synthetic_like' : 'uncertain',
      modelType: 'trained_logistic',
      humanProbability,
      humanLikeScore: undefined,
      syntheticRisk: 1 - humanProbability,
      confidence: Math.abs(humanProbability - 0.5) * 2,
      contributions: ['Logistic regression model output'],
      risks: {},
      featureScores: {},
      features,
      calibrationVersion: 'trained-logistic'
    };
  }
}

export const defaultClassifier = new HeuristicHumanCheckClassifier();
