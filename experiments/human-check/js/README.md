/**
 * Human Check architecture
 * ------------------------
 *
 * Pipeline:
 *
 *   Pointer events
 *   → circle-center userTrajectory (board-local; same frame as target center)
 *   → preprocessing (dedupe / invalid / tiny jitter)
 *   → optional ~100 Hz uniform-time resampledTrajectory (entropy / shape only)
 *   → geometry (path, efficiency, axis deviation, Fitts ID)
 *   → kinematics (v, a, jerk, curvature; timing from raw event intervals)
 *   → corrections (progress, overshoot, micro-corrections, phases)
 *   → neuromotor proxies (submovements; Sigma-Lognormal not implemented)
 *   → feature validity (null invalid higher-order metrics)
 *   → heuristic likelihood model (humanLikeScore / syntheticRisk — not P(human))
 *   → state
 *
 * States:
 *   human_like | synthetic_like | uncertain | insufficient_signal | accessible_completion
 *
 * Interaction / measurement boundary:
 *   - Each pointer drag is one behavioral observation.
 *   - Only a release inside the target acceptance region is classified.
 *   - Failed releases are discarded as attempts; the circle stays where released.
 *   - The next drag starts a fresh sample buffer from the current circle center
 *     (no synthetic jump, no mixing of prior failed strokes).
 *   - Eligibility is decided at the user-controlled release position, before any snap.
 *   - Post-release snap to the target center is presentation-only and is never sampled.
 *   - There is no post-release inertia in Human Check — UI momentum cannot complete
 *     verification or move the circle between attempts.
 *
 * Keyboard:
 *   Completing via keyboard yields accessible_completion.
 *   Confirmation eligibility uses the same release-position rule (no animation help).
 *   Pointer trajectory classifier is not applied; humanLikeScore / syntheticRisk are null.
 *   User-facing copy may still say “Human enough.” Debug/research must state the bypass.
 *
 * Heuristic scores:
 *   humanLikeScore and syntheticRisk are provisional heuristics in [0,1].
 *   They are NOT calibrated probabilities. A future trained_logistic model may expose
 *   humanProbability only once coefficients come from real training/calibration.
 *
 * Sparse trajectories:
 *   Very few samples on a long path get structural anomaly checks only.
 *   Full jerk / entropy / submovement scoring is not invented from 3-point paths.
 *
 * Privacy: no trajectory/features leave the browser.
 * Research mode (?debug=1) may store feature summaries in localStorage only when enabled.
 *
 * Known limitations:
 *   - Replay of a genuine human trajectory can still look human-like.
 *   - Sigma-Lognormal remains unimplemented (proxy notes only in neuromotor.js).
 *   - Calibration Gaussians are PROVISIONAL / NOT EMPIRICALLY CALIBRATED.
 *   - Not a production anti-bot system.
 */
