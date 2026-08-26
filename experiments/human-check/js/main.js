/**
 * Human Check — main interaction boot.
 *
 * Pipeline:
 *   Pointer events
 *   → circle-center userTrajectory (board-local)
 *   → preprocessing
 *   → optional ~100 Hz resampled analysis representation
 *   → geometry / kinematics / corrections / neuromotor proxies
 *   → feature validity
 *   → heuristic likelihood model
 *   → state
 *
 * Each pointer drag is one behavioral observation.
 * Only a release inside the target is classified.
 * Failed releases are discarded; next drag starts a fresh sample buffer.
 * There is no post-release inertia. Snap after success is presentation-only.
 *
 * Local-only research prototype. Not production bot detection.
 */

import { extractFeatures } from './features.js';
import { defaultClassifier } from './classifier.js';
import { ICONS, REC_LINES, copyForResult } from './copy.js';
import { renderDebugPanel, formatBatteryReport } from './debug.js';
import { runSyntheticBattery, replayTrajectory } from './synthetic.js';
import {
  saveResearchSample,
  exportResearchJSON,
  clearResearchStore,
  loadResearchStore
} from './research.js';
import { clamp } from './math.js';
import {
  isSuccessfulRelease,
  appendReleaseEndpoint,
  TARGET_ACCEPTANCE_RATIO,
  resolvePointerEndAction,
  mayCompleteObservation,
  cancelledAttemptState
} from './interaction.js';

const params = new URLSearchParams(window.location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const recording = params.get('recording') === '1';
const debugMode = params.get('debug') === '1';
if (recording) document.documentElement.classList.add('hc-recording');
if (debugMode) document.documentElement.classList.add('hc-debug-mode');

const stages = {
  intro: document.querySelector('[data-hc-stage="intro"]'),
  challenge: document.querySelector('[data-hc-stage="challenge"]'),
  result: document.querySelector('[data-hc-stage="result"]')
};

const beginBtn = document.querySelector('[data-hc-begin]');
const retryBtn = document.querySelector('[data-hc-retry]');
const revealBtn = document.querySelector('[data-hc-reveal]');
const trailPanel = document.querySelector('[data-hc-trail-panel]');
const trailCanvas = document.querySelector('[data-hc-trail]');
const timeEl = document.querySelector('[data-hc-time]');
const noteEl = document.querySelector('[data-hc-note]');
const hintEl = document.querySelector('[data-hc-hint]');
const evidenceEl = document.querySelector('[data-hc-evidence]');
const caveatEl = document.querySelector('[data-hc-caveat]');
const resultTitleEl = document.querySelector('[data-hc-result-title]');
const resultRoot = document.querySelector('[data-hc-result-root]');
const iconEl = document.querySelector('[data-hc-icon]');
const insightEl = document.querySelector('[data-hc-insight]');
const explainEl = document.querySelector('[data-hc-explain]');
const recLine = document.querySelector('[data-hc-rec-line]');
const debugEl = document.querySelector('[data-hc-debug]');
const board = document.querySelector('[data-hc-board]');
const target = document.querySelector('[data-hc-target]');
const disc = document.querySelector('[data-hc-disc]');
const statEls = {
  duration: document.querySelector('[data-hc-stat="duration"]'),
  efficiency: document.querySelector('[data-hc-stat="efficiency"]'),
  corrections: document.querySelector('[data-hc-stat="corrections"]')
};

if (!board || !disc || !target) {
  console.warn('[Human Check] Missing board elements');
} else {
  boot();
}

function boot() {
  let discSize = 72;
  let targetSize = 136;
  let pos = { x: 0, y: 0 };
  let drag = null;
  let keyboardActive = false;
  let challengeShownAt = 0;
  let firstInteractAt = 0;
  /** Live buffer while observationOpen; frozen into userTrajectory at end of user control */
  let samples = [];
  /** Frozen circle-center trajectory used for analysis (excludes snap; never includes inertia) */
  let userTrajectory = [];
  /** True only while the user controls the disc (pointer drag or keyboard move) */
  let observationOpen = false;
  let lastExtraction = null;
  let lastResult = null;
  let settled = false;
  /** @type {'mouse'|'touch'|'pen'|'keyboard'|null} */
  let inputMethod = null;
  let lastHumanTrajectory = null;
  let researchMode = false;
  let researchRaw = false;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const showStage = (name) => {
    Object.entries(stages).forEach(([key, el]) => {
      if (!el) return;
      const active = key === name;
      el.classList.toggle('is-active', active);
      el.hidden = !active;
    });
    document.documentElement.setAttribute('data-hc-rec-phase', name);
    if (recording && recLine) {
      recLine.hidden = false;
      if (name === 'result' && lastResult) {
        const short =
          lastResult.state === 'human_like' || lastResult.state === 'accessible_completion'
            ? 'Human enough. One signal — not proof.'
            : lastResult.state === 'synthetic_like' ? 'Movement looks synthetic.'
              : lastResult.state === 'uncertain' ? 'Not enough confidence.'
                : 'Not enough movement data.';
        recLine.textContent = `${short}  ·  Verification as interaction, not interruption.`;
      } else {
        recLine.textContent = REC_LINES[name] || '';
      }
    }
  };

  const measure = () => {
    const styles = getComputedStyle(document.body);
    discSize = parseFloat(styles.getPropertyValue('--hc-disc')) || disc.offsetWidth || 72;
    targetSize = parseFloat(styles.getPropertyValue('--hc-target')) || target.offsetWidth || 136;
    if (disc.offsetWidth) discSize = disc.offsetWidth;
    if (target.offsetWidth) targetSize = target.offsetWidth;
  };

  const boardRect = () => board.getBoundingClientRect();

  const targetCenterLocal = () => {
    const br = boardRect();
    const tr = target.getBoundingClientRect();
    return {
      x: tr.left - br.left + tr.width / 2,
      y: tr.top - br.top + tr.height / 2
    };
  };

  const maxPos = () => {
    const br = boardRect();
    return {
      x: Math.max(0, br.width - discSize),
      y: Math.max(0, br.height - discSize)
    };
  };

  const setDiscPosition = (x, y, scale = 1) => {
    const max = maxPos();
    pos = { x: clamp(x, 0, max.x), y: clamp(y, 0, max.y) };
    disc.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`;
  };

  const discCenter = () => ({ x: pos.x + discSize / 2, y: pos.y + discSize / 2 });

  const updateTargetProximity = () => {
    const ready = isReleaseInsideTarget();
    const d = dist(discCenter(), targetCenterLocal());
    const near = d < targetSize * 0.78;
    target.classList.toggle('is-near', near && !ready);
    target.classList.toggle('is-ready', ready);
    return ready;
  };

  /** Eligibility from current user-controlled disc center — never after snap. */
  const isReleaseInsideTarget = () =>
    isSuccessfulRelease(discCenter(), targetCenterLocal(), targetSize, TARGET_ACCEPTANCE_RATIO);

  const resetChallenge = () => {
    measure();
    settled = false;
    keyboardActive = false;
    firstInteractAt = 0;
    samples = [];
    userTrajectory = [];
    observationOpen = false;
    lastExtraction = null;
    lastResult = null;
    inputMethod = null;
    disc.classList.remove('is-dragging', 'is-keyboard-active');
    disc.setAttribute('aria-grabbed', 'false');
    target.classList.remove('is-near', 'is-ready');
    trailPanel.hidden = true;
    revealBtn.setAttribute('aria-expanded', 'false');
    revealBtn.hidden = false;

    const br = boardRect();
    const startX = br.width * 0.12 - discSize / 2;
    const startY = br.height * (br.width < 420 ? 0.32 : 0.68) - discSize / 2;
    setDiscPosition(startX, startY, 1);
    challengeShownAt = performance.now();
    hintEl.textContent = 'Drag, or use keyboard controls.';
  };

  const markInteract = () => {
    if (!firstInteractAt) firstInteractAt = performance.now();
  };

  /**
   * Start a fresh behavioral attempt without moving the circle.
   * One pointer drag = one observation; failed attempts are discarded.
   */
  const beginBehavioralAttempt = () => {
    samples = [];
    userTrajectory = [];
    observationOpen = true;
  };

  /**
   * Record board-local disc center after setDiscPosition.
   * Pointer client coords are never the behavioral trajectory.
   * No-op when observation is closed (snap is presentation-only).
   */
  const recordDiscCenterSample = (t = performance.now(), extra = {}) => {
    if (!observationOpen || settled) return;
    const c = discCenter();
    samples.push({
      x: c.x,
      y: c.y,
      t,
      ...extra
    });
  };

  /** Finalize release endpoint, then freeze trajectory for analysis. */
  const finalizeAndCloseObservation = (t = performance.now(), extra = {}) => {
    if (observationOpen) {
      appendReleaseEndpoint(samples, discCenter(), t, extra);
    }
    observationOpen = false;
    userTrajectory = samples.map((s) => ({ ...s }));
  };

  const analyzeAndClassify = () => {
    const br = boardRect();
    const trajectory = userTrajectory.length ? userTrajectory : samples.slice();
    const extracted = extractFeatures({
      samples: trajectory,
      container: { width: br.width, height: br.height },
      targetCenter: targetCenterLocal(),
      targetRadius: targetSize / 2,
      pointerType: inputMethod || 'mouse',
      reactionMs: Math.max(0, (firstInteractAt || performance.now()) - challengeShownAt),
      challengeDurationMs: performance.now() - challengeShownAt
    });
    extracted.geometryMeta.samples = extracted.analysisTrajectory;
    const result = defaultClassifier.predict(extracted.features);
    // Attach totalMs for copy
    result.features.totalMs = Math.max(
      result.features.totalMs || 0,
      performance.now() - challengeShownAt
    );
    return { extracted, result };
  };

  const applyResult = (result, extracted) => {
    lastResult = result;
    lastExtraction = extracted;
    const copy = copyForResult(result);
    const stateKey = result.state;
    resultRoot?.setAttribute('data-hc-result',
      stateKey === 'human_like' || stateKey === 'accessible_completion' ? 'natural'
        : stateKey === 'synthetic_like' ? 'suspicious'
          : stateKey === 'uncertain' ? 'uncertain'
            : 'insufficient');
    if (iconEl) {
      iconEl.innerHTML = ICONS[stateKey]
        || (stateKey === 'accessible_completion' ? ICONS.human_like : ICONS.insufficient_signal);
    }
    if (resultTitleEl) resultTitleEl.textContent = copy.title;
    noteEl.textContent = copy.note;
    if (evidenceEl) {
      evidenceEl.textContent = copy.evidence || '';
      evidenceEl.hidden = !copy.evidence;
    }
    if (timeEl) {
      timeEl.textContent = copy.timeLabel || '';
      timeEl.hidden = !copy.timeLabel;
    }
    if (caveatEl) {
      caveatEl.textContent = copy.caveat || '';
      caveatEl.hidden = !copy.caveat;
    }
    if (insightEl) insightEl.textContent = copy.insight || '';

    const seconds = (result.features.totalMs / 1000).toFixed(1);
    if (statEls.duration) statEls.duration.textContent = `${seconds}s`;
    if (statEls.efficiency) statEls.efficiency.textContent = `${Math.round(result.features.pathEfficiency * 100)}%`;
    if (statEls.corrections) {
      statEls.corrections.textContent = String(
        result.features.microCorrectionCount ?? result.features.directionChangeCount ?? 0
      );
    }

    const showTrail = result.features.sampleCount >= 2 && result.features.pathLength >= 2;
    revealBtn.hidden = !showTrail;
    if (explainEl) explainEl.hidden = false;

    if (inputMethod !== 'keyboard' && extracted?.analysisTrajectory?.length > 4) {
      lastHumanTrajectory = extracted.analysisTrajectory.map((p) => ({ x: p.x, y: p.y, t: p.t }));
    }

    if (researchMode) {
      saveResearchSample({
        pointerType: result.features.pointerType,
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
        geometry: {
          fittsID: result.features.fittsID,
          distance: result.features.startTargetDistance,
          width: result.features.fittsWidth
        },
        features: result.features,
        label: inputMethod === 'keyboard' ? 'accessible' : 'human',
        classification: result.state,
        modelType: result.modelType,
        humanLikeScore: result.humanLikeScore,
        syntheticRisk: result.syntheticRisk,
        confidence: result.confidence
      }, {
        includeRaw: researchRaw,
        rawTrajectory: extracted?.rawTrajectory || null
      });
    }

    if (debugMode) refreshDebug();
  };

  const drawTrail = () => {
    const pts = lastExtraction?.analysisTrajectory || userTrajectory;
    if (!trailCanvas || !pts.length) return;
    const ctx = trailCanvas.getContext('2d');
    const w = trailCanvas.width;
    const h = trailCanvas.height;
    const br = { width: board.clientWidth, height: board.clientHeight };
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f7f4ed';
    ctx.fillRect(0, 0, w, h);
    const tc = targetCenterLocal();
    ctx.beginPath();
    ctx.arc((tc.x / br.width) * w, (tc.y / br.height) * h, (targetSize / br.width) * w * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(23,23,21,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    pts.forEach((s, i) => {
      const x = (s.x / br.width) * w;
      const y = (s.y / br.height) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#171715';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const completeSuccessfulAttempt = () => {
    if (settled) return;
    settled = true;
    // Classification uses frozen userTrajectory ending at release — not snap endpoint.
    const { extracted, result } = analyzeAndClassify();
    applyResult(result, extracted);
    showStage('result');
    if (!revealBtn.hidden) drawTrail();
  };

  /**
   * Visual snap to target center after a successful user release.
   * Presentation only — never records samples; never re-checks eligibility.
   */
  const animateSnapToTarget = (onDone) => {
    const goal = targetCenterLocal();
    const offsetX = goal.x - discSize / 2;
    const offsetY = goal.y - discSize / 2;
    if (reducedMotion) {
      setDiscPosition(offsetX, offsetY, 1);
      onDone();
      return;
    }
    const start = { ...pos };
    const from = performance.now();
    const duration = 320;
    const step = (now) => {
      const t = clamp((now - from) / duration, 0, 1);
      const e = 1 - (1 - t) ** 3;
      setDiscPosition(start.x + (offsetX - start.x) * e, start.y + (offsetY - start.y) * e, 1);
      if (t < 1) requestAnimationFrame(step);
      else onDone();
    };
    requestAnimationFrame(step);
  };

  /** Failed release: keep circle where user left it; discard attempt; no classification. */
  const endUnsuccessfulAttempt = ({ hint } = {}) => {
    setDiscPosition(pos.x, pos.y, 1);
    updateTargetProximity();
    samples = [];
    userTrajectory = [];
    observationOpen = false;
    if (hintEl && hint) hintEl.textContent = hint;
  };

  /**
   * Shared success path after eligibility was already decided from the release position.
   * Must NOT re-evaluate target proximity after animation.
   */
  const settleSuccessfulRelease = () => {
    animateSnapToTarget(() => completeSuccessfulAttempt());
  };

  const pointerDown = (event) => {
    if (settled || event.button === 2) return;
    markInteract();
    keyboardActive = false;
    const type = event.pointerType || 'mouse';
    inputMethod = type === 'touch' || type === 'pen' ? type : 'mouse';
    disc.classList.add('is-dragging');
    disc.setAttribute('aria-grabbed', 'true');
    try { disc.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
    const br = boardRect();
    drag = {
      id: event.pointerId,
      offsetX: event.clientX - br.left - pos.x,
      offsetY: event.clientY - br.top - pos.y
    };
    // Fresh attempt from current visible position — no jump from a prior discarded drag.
    beginBehavioralAttempt();
    setDiscPosition(pos.x, pos.y, 1.06);
    recordDiscCenterSample(performance.now(), {
      pointerType: type,
      pressure: event.pressure,
      width: event.width,
      height: event.height,
      buttons: event.buttons
    });
    document.documentElement.style.overflow = 'hidden';
    event.preventDefault();
  };

  const pointerMove = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const br = boardRect();
    const nextX = event.clientX - br.left - drag.offsetX;
    const nextY = event.clientY - br.top - drag.offsetY;
    const now = performance.now();
    setDiscPosition(nextX, nextY, 1.06);
    recordDiscCenterSample(now, {
      pointerType: event.pointerType,
      pressure: event.pressure,
      width: event.width,
      height: event.height,
      buttons: event.buttons
    });
    updateTargetProximity();
    event.preventDefault();
  };

  /**
   * Intentional pointerup only — may succeed or fail based on release position.
   * pointercancel / lostpointercapture must never call this.
   */
  const endDrag = (event) => {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const offsetX = drag.offsetX;
    const offsetY = drag.offsetY;
    drag = null;

    // Sync disc to pointerup position when coords are available (may differ from last move).
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const br = boardRect();
      setDiscPosition(event.clientX - br.left - offsetX, event.clientY - br.top - offsetY, 1);
    }

    const releaseT = performance.now();
    const meta = event
      ? {
        pointerType: event.pointerType,
        pressure: event.pressure,
        width: event.width,
        height: event.height,
        buttons: event.buttons
      }
      : {};

    // Eligibility from user-controlled release position — before any snap.
    const reachedTargetAtRelease = isReleaseInsideTarget();
    finalizeAndCloseObservation(releaseT, meta);

    disc.classList.remove('is-dragging');
    disc.setAttribute('aria-grabbed', 'false');
    document.documentElement.style.overflow = '';

    if (!reachedTargetAtRelease) {
      endUnsuccessfulAttempt({ hint: 'Move the circle into the ring.' });
      return;
    }

    // Successful user release: presentation snap only, then classify frozen trajectory.
    settleSuccessfulRelease();
  };

  /**
   * Browser/platform terminated the pointer sequence — not a valid release.
   * Never classify, never snap, never research-record. Keep circle where it is.
   */
  const cancelDrag = (event) => {
    if (!drag) return;
    if (event && event.pointerId != null && event.pointerId !== drag.id) return;

    const pointerId = drag.id;
    drag = null;
    observationOpen = false;
    samples = [];
    userTrajectory = [];

    disc.classList.remove('is-dragging');
    disc.setAttribute('aria-grabbed', 'false');
    document.documentElement.style.overflow = '';
    setDiscPosition(pos.x, pos.y, 1);
    updateTargetProximity();

    try {
      if (pointerId != null && disc.hasPointerCapture?.(pointerId)) {
        disc.releasePointerCapture(pointerId);
      }
    } catch (_) { /* ignore */ }
  };

  /**
   * Defensive: unexpected capture loss cancels an active drag.
   * After a normal pointerup, drag is already null → no-op (no double completion).
   */
  const handleLostPointerCapture = (event) => {
    if (!drag) return;
    if (event && event.pointerId != null && event.pointerId !== drag.id) return;
    cancelDrag(event);
  };

  const onKeyDown = (event) => {
    if (stages.challenge.hidden || settled) return;
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape'];
    if (!keys.includes(event.key)) return;
    const fromDisc = event.target === disc || document.activeElement === disc;
    if (!fromDisc && !keyboardActive) return;
    markInteract();
    inputMethod = 'keyboard';
    const step = event.shiftKey ? 28 : 16;
    const isArrow = event.key.startsWith('Arrow');
    if (isArrow && !keyboardActive) {
      keyboardActive = true;
      beginBehavioralAttempt();
      disc.classList.add('is-keyboard-active');
      disc.setAttribute('aria-grabbed', 'true');
      setDiscPosition(pos.x, pos.y, 1.05);
      hintEl.textContent = 'Arrow keys to move. Enter to place.';
      recordDiscCenterSample();
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!keyboardActive) {
        keyboardActive = true;
        beginBehavioralAttempt();
        disc.classList.add('is-keyboard-active');
        disc.setAttribute('aria-grabbed', 'true');
        setDiscPosition(pos.x, pos.y, 1.05);
        hintEl.textContent = 'Arrow keys to move. Enter to place.';
        recordDiscCenterSample();
      } else {
        keyboardActive = false;
        disc.classList.remove('is-keyboard-active');
        disc.setAttribute('aria-grabbed', 'false');
        const reachedTargetAtConfirm = isReleaseInsideTarget();
        finalizeAndCloseObservation(performance.now());
        if (!reachedTargetAtConfirm) {
          endUnsuccessfulAttempt({ hint: 'Move the circle into the ring.' });
          return;
        }
        settleSuccessfulRelease();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      keyboardActive = false;
      disc.classList.remove('is-keyboard-active');
      disc.setAttribute('aria-grabbed', 'false');
      endUnsuccessfulAttempt();
      return;
    }
    if (!keyboardActive) return;
    event.preventDefault();
    let { x, y } = pos;
    if (event.key === 'ArrowUp') y -= step;
    if (event.key === 'ArrowDown') y += step;
    if (event.key === 'ArrowLeft') x -= step;
    if (event.key === 'ArrowRight') x += step;
    setDiscPosition(x, y, 1.05);
    recordDiscCenterSample();
    updateTargetProximity();
  };

  const startChallenge = () => {
    showStage('challenge');
    void board.offsetWidth;
    resetChallenge();
    requestAnimationFrame(() => disc.focus({ preventScroll: true }));
  };

  function refreshDebug(batteryText) {
    if (!debugMode || !debugEl || !lastResult || !lastExtraction) {
      if (debugMode && debugEl && !lastResult) {
        debugEl.hidden = false;
        debugEl.innerHTML = `<p class="hc-debug-title">Debug</p><pre>Waiting for interaction…\nResearch samples: ${loadResearchStore().samples.length}</pre>
          <div class="hc-debug-actions">
            <button type="button" class="button button--secondary" data-hc-run-battery>Run synthetic battery</button>
            <button type="button" class="button button--secondary" data-hc-export-research>Export research JSON</button>
            <button type="button" class="button button--secondary" data-hc-clear-research>Clear research store</button>
            <label class="hc-debug-check"><input type="checkbox" data-hc-research-mode ${researchMode ? 'checked' : ''}> Research capture</label>
            <label class="hc-debug-check"><input type="checkbox" data-hc-research-raw ${researchRaw ? 'checked' : ''}> Store raw trajectories</label>
          </div>
          <pre class="hc-debug-battery" data-hc-battery-out>${batteryText || 'Synthetic battery not run yet.'}</pre>`;
        wireDebugActions(debugEl);
      }
      return;
    }
    debugEl.hidden = false;
    renderDebugPanel(debugEl, {
      result: lastResult,
      series: lastExtraction.series,
      geometryMeta: lastExtraction.geometryMeta,
      battery: batteryText
    });
    // restore research checkboxes after re-render
    const rm = debugEl.querySelector('[data-hc-research-mode]');
    const rr = debugEl.querySelector('[data-hc-research-raw]');
    if (rm) rm.checked = researchMode;
    if (rr) rr.checked = researchRaw;
    wireDebugActions(debugEl);
  }

  function wireDebugActions(root) {
    root.querySelector('[data-hc-run-battery]')?.addEventListener('click', () => {
      const br = boardRect();
      const start = { x: br.width * 0.15, y: br.height * 0.7 };
      const end = targetCenterLocal();
      const rows = runSyntheticBattery({
        start,
        end,
        container: { width: br.width, height: br.height },
        targetCenter: end,
        targetRadius: targetSize / 2,
        extract: extractFeatures,
        classify: (f) => defaultClassifier.predict(f)
      });
      // Replay last human if available
      if (lastHumanTrajectory?.length > 4) {
        const replay = replayTrajectory(lastHumanTrajectory);
        const extracted = extractFeatures({
          samples: replay.samples,
          container: { width: br.width, height: br.height },
          targetCenter: end,
          targetRadius: targetSize / 2,
          pointerType: 'mouse',
          reactionMs: 300,
          challengeDurationMs: 800
        });
        const result = defaultClassifier.predict(extracted.features);
        rows.push({
          id: 'human_replay',
          label: 'Human replay (local)',
          expect: 'human_like (limitation)',
          state: result.state,
          humanLikeScore: result.humanLikeScore,
          syntheticRisk: result.syntheticRisk,
          confidence: result.confidence
        });
      }
      const text = formatBatteryReport(rows);
      refreshDebug(text);
      console.table(rows.map((r) => ({
        id: r.id,
        state: r.state,
        humanLike: r.humanLikeScore,
        risk: r.syntheticRisk
      })));
    });
    root.querySelector('[data-hc-export-research]')?.addEventListener('click', () => {
      const data = exportResearchJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `human-check-research-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    root.querySelector('[data-hc-clear-research]')?.addEventListener('click', () => {
      clearResearchStore();
      refreshDebug('Research store cleared.');
    });
    root.querySelector('[data-hc-research-mode]')?.addEventListener('change', (e) => {
      researchMode = e.target.checked;
    });
    root.querySelector('[data-hc-research-raw]')?.addEventListener('change', (e) => {
      researchRaw = e.target.checked;
    });
  }

  beginBtn?.addEventListener('click', startChallenge);
  retryBtn?.addEventListener('click', startChallenge);
  revealBtn?.addEventListener('click', () => {
    const open = trailPanel.hidden;
    trailPanel.hidden = !open;
    revealBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) drawTrail();
  });

  disc.addEventListener('pointerdown', pointerDown, { passive: false });
  disc.addEventListener('pointermove', pointerMove, { passive: false });
  disc.addEventListener('pointerup', endDrag);
  disc.addEventListener('pointercancel', cancelDrag);
  disc.addEventListener('lostpointercapture', handleLostPointerCapture);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => {
    if (!stages.challenge.hidden && !settled) {
      measure();
      setDiscPosition(pos.x, pos.y, 1);
      updateTargetProximity();
    }
  });

  // Public debug API
  if (debugMode) {
    window.__hc = {
      extractFeatures,
      classifier: defaultClassifier,
      isSuccessfulRelease,
      TARGET_ACCEPTANCE_RATIO,
      resolvePointerEndAction,
      mayCompleteObservation,
      cancelledAttemptState,
      runSyntheticBattery: () => debugEl?.querySelector('[data-hc-run-battery]')?.click(),
      loadResearchStore
    };
    refreshDebug();
  }

  showStage('intro');
  if (recording && recLine) {
    recLine.hidden = false;
    recLine.textContent = REC_LINES.intro;
  }
}
