/**
 * Human Check classifier — heuristic likelihood model (Layer 1)
 * + interface for future trained models (Layer 2).
 *
 * Heuristic outputs are NOT calibrated probabilities.
 * Use humanLikeScore / syntheticRisk — never imply P(human) for heuristics.
 *
 * PROVISIONAL calibration — see calibration.js
 * NOT EMPIRICALLY CALIBRATED
 */

import { calibration, calibForPointer } from './calibration.js';
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
          featureScores: {}
        }, features);
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
        featureScores: {}
      }, features);
    }

    if (hasInsufficientSignal(features, this.config.minimum)) {
      return this.#heuristicResult('insufficient_signal', {
        humanLikeScore: null,
        syntheticRisk: null,
        confidence: 0.15,
        contributions: ['Too few samples, too short a path, or too brief a movement to evaluate.'],
        risks: {},
        featureScores: {}
      }, features);
    }

    const validity = features.featureValidity || {};
    const cal = calibForPointer(features.pointerType);

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

    const weights = {
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

    // Only valid finite feature scores contribute; renormalize weights
    let score = 0;
    let wSum = 0;
    const featureScores = {};
    Object.keys(weights).forEach((k) => {
      const validityFn = FEATURE_SCORE_VALIDITY[k];
      const valid = validityFn ? validityFn(validity) : true;
      const s = rawScores[k];
      if (!valid || s == null || !Number.isFinite(s)) {
        featureScores[k] = null;
        return;
      }
      featureScores[k] = s;
      score += weights[k] * s;
      wSum += weights[k];
    });

    if (wSum < 0.25) {
      return this.#heuristicResult('insufficient_signal', {
        humanLikeScore: null,
        syntheticRisk: null,
        confidence: 0.2,
        contributions: ['Too few valid behavioral features to score.'],
        risks: {},
        featureScores
      }, features);
    }

    let humanLikeScore = clamp01(score / wSum);

    const risks = this.#interactionRisks(features);
    const w = this.config.interactionWeights;
    let syntheticRisk = clamp01(
      risks.linearConstantMotion * w.linearConstantMotion +
      risks.perfectEase * w.perfectEase +
      risks.randomNoise * w.randomNoise +
      risks.overRegularTiming * w.overRegularTiming +
      risks.teleport * w.teleport
    );

    humanLikeScore = clamp01(humanLikeScore * (1 - 0.72 * syntheticRisk) + 0.05 * (1 - syntheticRisk));

    const richness = clamp01(
      (features.sampleCount - 8) / 40 +
      (features.movementTime - 90) / 900 +
      (features.pathLength - 48) / 400
    );
    const decisiveness = Math.abs(humanLikeScore - 0.5) * 2;
    const confidence = clamp01(0.25 + 0.4 * richness + 0.35 * decisiveness);

    const contributions = this.#explain(features, featureScores, risks, humanLikeScore);

    let state = 'uncertain';
    const { humanLike, syntheticLike } = this.config.thresholds;
    if (humanLikeScore >= humanLike && syntheticRisk < 0.55) state = 'human_like';
    else if (humanLikeScore <= syntheticLike || syntheticRisk >= 0.62) state = 'synthetic_like';
    else state = 'uncertain';

    if (confidence < 0.32) {
      if (Math.abs(humanLikeScore - 0.5) < 0.18) state = 'uncertain';
    }

    return this.#heuristicResult(state, {
      humanLikeScore,
      syntheticRisk,
      confidence,
      contributions,
      risks,
      featureScores
    }, features);
  }

  /**
   * Structural checks for sparse trajectories — not full kinematics scoring.
   */
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
        humanLikeScore: null,
        syntheticRisk: null,
        humanProbability: undefined,
        confidence: 0.2,
        contributions: ['Keyboard path had too little movement to evaluate.'],
        risks: {},
        featureScores: {},
        features,
        calibrationVersion: this.config.version
      };
    }
    return {
      state: 'accessible_completion',
      modelType: 'heuristic',
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
      features,
      calibrationVersion: this.config.version
    };
  }

  #interactionRisks(f) {
    const nearPerfectLine = f.pathEfficiency >= 0.985;
    const noCorrections =
      (f.microCorrectionCount == null || f.microCorrectionCount === 0) &&
      (f.lateMicroCorrectionCount == null || f.lateMicroCorrectionCount === 0) &&
      (f.backwardProgressCount == null || f.backwardProgressCount === 0);
    const flatSpeed = num(f.velocityCV) && f.velocityCV < 0.22;
    const singleBallistic =
      (f.submovementCount == null || f.submovementCount <= 1) &&
      (f.velocityPeakCount == null || f.velocityPeakCount <= 1);

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
    if (num(f.maxVelocity) && f.maxVelocity > 8000 && num(f.velocityCV) && f.velocityCV < 0.15) teleport += 0.4;

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

    return {
      linearConstantMotion: clamp01(linearConstantMotion + (nearPerfectLine && flatSpeed ? 0.15 : 0)),
      perfectEase: clamp01(perfectEase + (nearPerfectLine && noCorrections && singleBallistic ? 0.2 : 0)),
      randomNoise,
      overRegularTiming,
      teleport: clamp01(teleport + piecewiseRobotic)
    };
  }

  #explain(f, featureScores, risks, humanLikeScore) {
    const lines = [];
    const riskEntries = Object.entries(risks).sort((a, b) => b[1] - a[1]);
    if (humanLikeScore <= 0.45) {
      riskEntries.slice(0, 3).forEach(([k, v]) => {
        if (v < 0.35) return;
        const map = {
          linearConstantMotion: 'Near-linear path with unusually constant speed',
          perfectEase: 'Smooth geometric path with little target-acquisition correction',
          randomNoise: 'Noise pattern that looks added rather than motor-structured',
          overRegularTiming: 'Unusually regular pointer-event timing',
          teleport: 'Sparse samples covering a long distance'
        };
        lines.push(map[k] || k);
      });
      if (f.pathEfficiency > 0.98) lines.push('Extremely high path efficiency');
      if ((f.microCorrectionCount == null || f.microCorrectionCount === 0) &&
        (f.lateMicroCorrectionCount == null || f.lateMicroCorrectionCount === 0)) {
        lines.push('No measurable micro-corrections near the target');
      }
    } else {
      Object.entries(featureScores)
        .filter(([, v]) => typeof v === 'number')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([k, v]) => {
          if (v < 0.45) return;
          const map = {
            velocityCV: 'Plausible speed variation across the movement',
            normalizedPeakTime: 'Acceleration then deceleration structure',
            microCorrectionCount: 'Small mid-path corrections',
            lateMicroCorrectionCount: 'Late-stage target acquisition adjustments',
            meanAxisDeviationNorm: 'Natural deviation from a perfect straight axis',
            submovementCount: 'Multiple velocity submovements',
            pathEfficiency: 'Path efficiency in a human-like range',
            meanAbsDirectionChange: 'Moderate directional variability',
            sampleIntervalCV: 'Irregular but plausible sample timing',
            normalizedJerk: 'Jerk profile within a provisional human-like band'
          };
          lines.push(map[k] || k);
        });
    }
    if (!lines.length) lines.push('Mixed signals — no single feature dominated.');
    return lines.slice(0, 4);
  }

  #heuristicResult(state, payload, features) {
    return {
      state,
      modelType: 'heuristic',
      humanLikeScore: payload.humanLikeScore,
      syntheticRisk: payload.syntheticRisk,
      // Explicitly undefined — heuristic must not claim calibrated probability
      humanProbability: undefined,
      confidence: payload.confidence,
      contributions: payload.contributions,
      risks: payload.risks,
      featureScores: payload.featureScores,
      features,
      calibrationVersion: this.config.version
    };
  }
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
  /**
   * @param {{bias:number, weights:Record<string, number>}} model
   * Coefficients must come from a real training run — do not invent them.
   */
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
