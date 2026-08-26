/**
 * Human Check architecture
 * ------------------------
 * Raw trajectory {x,y,t}
 *   → preprocess (dedupe / invalid / tiny jitter)
 *   → geometry (path, efficiency, axis deviation, Fitts ID)
 *   → kinematics (v, a, jerk, curvature, entropy, timing)
 *   → corrections (progress, overshoot, micro-corrections, phases)
 *   → neuromotor proxies (submovements; S-LN not claimed)
 *   → feature vector
 *   → HeuristicHumanCheckClassifier (provisional calibration)
 *   → state: human_like | synthetic_like | uncertain | insufficient_signal
 *
 * Privacy: no trajectory/features leave the browser.
 * Research mode (?debug=1) may store feature summaries in localStorage only when enabled.
 *
 * Sigma-Lognormal: architecture reserved in neuromotor.js — not faked.
 */
