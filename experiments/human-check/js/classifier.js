/**
 * Human Check classifier — heuristic likelihood model (Layer 1)
 * + interface for future trained models (Layer 2).
 *
 * Outputs probabilities — NOT identity proof.
 * PROVISIONAL calibration — see calibration.js
 */

import { calibration, calibForPointer } from './calibration.js';
import { hasInsufficientSignal, clamp01 } from './features.js';
import { clamp } from './math.js';

/**
 * Soft Gaussian-like plausibility in [0,1].
 * p = exp(-(x-μ)² / (2σ²))
 */
export function gaussianPlausibility(x, mu, sigma) {
  if (!(sigma > 0) || !Number.isFinite(x)) return 0.5;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/**
 * One-sided: values above maxIdeal become less plausible.
 */
export function upperPenalty(x, start, full) {
  if (x <= start) return 1;
  if (x >= full) return 0;
  return 1 - (x - start) / (full - start);
}

/**
 * @typedef {'human_like'|'synthetic_like'|'uncertain'|'insufficient_signal'} ClassificationState
 */

/**
 * @implements {HumanCheckClassifier}
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

    if (hasInsufficientSignal(features, this.config.minimum)) {
      return this.#result('insufficient_signal', {
        humanProbability: 0.5,
        syntheticRisk: 0.5,
        confidence: 0.15,
        contributions: ['Too few samples, too short a path, or too brief a movement to evaluate.'],
        risks: {},
        featureScores: {}
      }, features);
    }

    const cal = calibForPointer(features.pointerType);
    const featureScores = {
      pathEfficiency: gaussianPlausibility(features.pathEfficiency, cal.pathEfficiency.mu, cal.pathEfficiency.sigma),
      velocityCV: gaussianPlausibility(features.velocityCV, cal.velocityCV.mu, cal.velocityCV.sigma),
      normalizedPeakTime: gaussianPlausibility(features.normalizedPeakTime, cal.normalizedPeakTime.mu, cal.normalizedPeakTime.sigma),
      meanAbsDirectionChange: gaussianPlausibility(
        features.meanAbsDirectionChange,
        cal.meanAbsDirectionChange.mu,
        cal.meanAbsDirectionChange.sigma
      ),
      microCorrectionCount: gaussianPlausibility(
        features.microCorrectionCount,
        cal.microCorrectionCount.mu,
        cal.microCorrectionCount.sigma
      ),
      lateMicroCorrectionCount: gaussianPlausibility(
        features.lateMicroCorrectionCount,
        cal.lateMicroCorrectionCount.mu,
        cal.lateMicroCorrectionCount.sigma
      ),
      sampleIntervalCV: gaussianPlausibility(
        features.sampleIntervalCV,
        cal.sampleIntervalCV.mu,
        cal.sampleIntervalCV.sigma
      ),
      meanAxisDeviationNorm: gaussianPlausibility(
        features.meanAxisDeviationNorm,
        cal.meanAxisDeviationNorm.mu,
        cal.meanAxisDeviationNorm.sigma
      ),
      submovementCount: gaussianPlausibility(
        features.submovementCount,
        cal.submovementCount.mu,
        cal.submovementCount.sigma
      ),
      normalizedJerk: gaussianPlausibility(
        Math.log10(Math.max(features.normalizedJerk, 1e-6)),
        cal.normalizedJerkLog.mu,
        cal.normalizedJerkLog.sigma
      )
    };

    // Weighted blend of feature plausibilities
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

    let score = 0;
    let wSum = 0;
    Object.keys(weights).forEach((k) => {
      score += weights[k] * featureScores[k];
      wSum += weights[k];
    });
    let humanProbability = clamp01(score / wSum);

    const risks = this.#interactionRisks(features);
    const w = this.config.interactionWeights;
    let syntheticRisk = clamp01(
      risks.linearConstantMotion * w.linearConstantMotion +
      risks.perfectEase * w.perfectEase +
      risks.randomNoise * w.randomNoise +
      risks.overRegularTiming * w.overRegularTiming +
      risks.teleport * w.teleport
    );

    // Blend: high interaction risk pulls probability down
    humanProbability = clamp01(humanProbability * (1 - 0.72 * syntheticRisk) + 0.05 * (1 - syntheticRisk));

    // Confidence rises with sample richness and decisive risk/plausibility
    const richness = clamp01(
      (features.sampleCount - 8) / 40 +
      (features.movementTime - 90) / 900 +
      (features.pathLength - 48) / 400
    );
    const decisiveness = Math.abs(humanProbability - 0.5) * 2;
    const confidence = clamp01(0.25 + 0.4 * richness + 0.35 * decisiveness);

    const contributions = this.#explain(features, featureScores, risks, humanProbability);

    let state = 'uncertain';
    const { humanLike, syntheticLike } = this.config.thresholds;
    if (humanProbability >= humanLike && syntheticRisk < 0.55) state = 'human_like';
    else if (humanProbability <= syntheticLike || syntheticRisk >= 0.62) state = 'synthetic_like';
    else state = 'uncertain';

    // Low confidence → uncertain even if score leans
    if (confidence < 0.32 && state !== 'insufficient_signal') {
      if (Math.abs(humanProbability - 0.5) < 0.18) state = 'uncertain';
    }

    return this.#result(state, {
      humanProbability,
      syntheticRisk,
      confidence,
      contributions,
      risks,
      featureScores
    }, features);
  }

  #keyboardResult(features) {
    if (
      features.sampleCount < 4 ||
      features.pathLength < 40 ||
      features.displacement < 30
    ) {
      return this.#result('insufficient_signal', {
        humanProbability: 0.5,
        syntheticRisk: 0.5,
        confidence: 0.2,
        contributions: ['Keyboard path had too little movement to evaluate.'],
        risks: {},
        featureScores: {}
      }, features);
    }
    return this.#result('human_like', {
      humanProbability: 0.72,
      syntheticRisk: 0.2,
      confidence: 0.55,
      contributions: [
        'Completed through the accessible keyboard path.',
        'Pointer trajectory biometrics were not applied.'
      ],
      risks: {},
      featureScores: {}
    }, features);
  }

  #interactionRisks(f) {
    // Combinations matter more than any single metric.
    const nearPerfectLine = f.pathEfficiency >= 0.985;
    const noCorrections = f.microCorrectionCount === 0 && f.lateMicroCorrectionCount === 0 && f.backwardProgressCount === 0;
    const flatSpeed = f.velocityCV < 0.22;
    const singleBallistic = f.submovementCount <= 1 && f.velocityPeakCount <= 1;

    const linearConstantMotion = clamp01(
      0.4 * upper(f.pathEfficiency, 0.965, 0.995) +
      0.35 * upper(1 - Math.min(f.velocityCV, 1), 0.7, 0.95) +
      0.15 * upper(1 - Math.min(f.meanCurvature * 25, 1), 0.65, 0.95) +
      0.1 * (noCorrections ? 1 : 0)
    );

    const perfectEase = clamp01(
      0.3 * upper(f.pathEfficiency, 0.955, 0.995) +
      0.2 * gaussianNear(f.normalizedPeakTime, 0.45, 0.1) +
      0.2 * (noCorrections ? 1 : 0) +
      0.15 * upper(1 - Math.min(f.minimumJerkDeviation, 1), 0.7, 0.95) +
      0.15 * (singleBallistic && nearPerfectLine ? 1 : 0)
    );

    // White-noise jitter: high direction entropy + high HF residual + monotonic progress
    const randomNoise = clamp01(
      0.35 * upper(f.directionEntropy / 3.2, 0.75, 1) +
      0.3 * upper(f.highFrequencyEnergyRatio, 0.55, 0.9) +
      0.2 * upper(1 - Math.min(f.backwardProgressCount / 2, 1), 0.7, 1) +
      0.15 * upper(1 - Math.min(f.lateDecelerationRatio, 1), 0.55, 0.9)
    );

    const overRegularTiming = clamp01(
      0.7 * upper(1 - Math.min(f.sampleIntervalCV, 1), 0.82, 0.98) +
      0.3 * upper(1 - Math.min(f.timingEntropy / 3, 1), 0.65, 0.95)
    );

    // Sparse samples covering long distance — teleport / scripted jumps
    let teleport = 0;
    if (f.sampleCount <= 6 && f.pathLength > 140 && f.pathEfficiency > 0.97) teleport += 0.85;
    if (f.maxVelocity > 8000 && f.velocityCV < 0.15) teleport += 0.4;

    // Piecewise robotic: large discrete heading snaps, tiny curvature elsewhere, metronomic timing
    const roboticCorners =
      f.directionChangeCount >= 1 &&
      f.maxDirectionChange > 1.2 &&
      f.meanCurvature < 0.025 &&
      f.sampleIntervalCV < 0.08 &&
      f.microCorrectionCount === 0;
    const piecewiseRobotic = roboticCorners ? 0.85 : 0;

    return {
      linearConstantMotion: clamp01(linearConstantMotion + (nearPerfectLine && flatSpeed ? 0.15 : 0)),
      perfectEase: clamp01(perfectEase + (nearPerfectLine && noCorrections && singleBallistic ? 0.2 : 0)),
      randomNoise,
      overRegularTiming,
      teleport: clamp01(teleport + piecewiseRobotic)
    };
  }

  #explain(f, featureScores, risks, humanProbability) {
    const lines = [];
    const riskEntries = Object.entries(risks).sort((a, b) => b[1] - a[1]);
    if (humanProbability <= 0.45) {
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
      if (f.microCorrectionCount === 0 && f.lateMicroCorrectionCount === 0) {
        lines.push('No measurable micro-corrections near the target');
      }
    } else {
      const scored = Object.entries(featureScores).sort((a, b) => b[1] - a[1]);
      scored.slice(0, 3).forEach(([k, v]) => {
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

  #result(state, payload, features) {
    return {
      state,
      humanProbability: payload.humanProbability,
      syntheticRisk: payload.syntheticRisk,
      confidence: payload.confidence,
      contributions: payload.contributions,
      risks: payload.risks,
      featureScores: payload.featureScores,
      features,
      calibrationVersion: this.config.version
    };
  }
}

function upper(x, start, full) {
  return upperPenaltyLocal(x, start, full);
}

function upperPenaltyLocal(x, start, full) {
  if (x <= start) return 0;
  if (x >= full) return 1;
  return (x - start) / (full - start);
}

function gaussianNear(x, mu, sigma) {
  return gaussianPlausibility(x, mu, sigma);
}

/** Future trained-model interface placeholder */
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
      humanProbability,
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
