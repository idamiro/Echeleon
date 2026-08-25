(() => {
  /**
   * Human Check — local interaction classification (design experiment only).
   * Metrics never leave the browser. This is not bot detection.
   */
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
  const resultTitleEl = document.querySelector('[data-hc-result-title]');
  const resultRoot = document.querySelector('[data-hc-result-root]');
  const iconEl = document.querySelector('[data-hc-icon]');
  const insightEl = document.querySelector('[data-hc-insight]');
  const debugEl = document.querySelector('[data-hc-debug]');
  const debugBody = document.querySelector('[data-hc-debug-body]');
  const board = document.querySelector('[data-hc-board]');
  const target = document.querySelector('[data-hc-target]');
  const disc = document.querySelector('[data-hc-disc]');
  const statEls = {
    duration: document.querySelector('[data-hc-stat="duration"]'),
    efficiency: document.querySelector('[data-hc-stat="efficiency"]'),
    corrections: document.querySelector('[data-hc-stat="corrections"]')
  };

  if (!board || !disc || !target) return;

  let discSize = 72;
  let targetSize = 128;
  let pos = { x: 0, y: 0 };
  let drag = null;
  let keyboardActive = false;
  let challengeShownAt = 0;
  let firstInteractAt = 0;
  let samples = [];
  let metrics = null;
  let classification = null;
  let settled = false;
  let rafInertia = 0;
  /** @type {'mouse'|'touch'|'pen'|'keyboard'|null} */
  let inputMethod = null;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const ICONS = {
    natural: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5"/><path d="M14 24.5l6.2 6.2L34 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    suspicious: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5"/><path d="M16 24h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    insufficient: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3.5 4"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>`
  };

  const showStage = (name) => {
    Object.entries(stages).forEach(([key, el]) => {
      if (!el) return;
      const active = key === name;
      el.classList.toggle('is-active', active);
      el.hidden = !active;
    });
  };

  const measure = () => {
    const styles = getComputedStyle(document.body);
    discSize = parseFloat(styles.getPropertyValue('--hc-disc')) || disc.offsetWidth || 72;
    targetSize = parseFloat(styles.getPropertyValue('--hc-target')) || target.offsetWidth || 128;
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

  const discCenter = () => ({
    x: pos.x + discSize / 2,
    y: pos.y + discSize / 2
  });

  const updateTargetProximity = () => {
    const d = dist(discCenter(), targetCenterLocal());
    const ready = d < targetSize * 0.34;
    const near = d < targetSize * 0.78;
    target.classList.toggle('is-near', near && !ready);
    target.classList.toggle('is-ready', ready);
    return ready;
  };

  const resetChallenge = () => {
    measure();
    settled = false;
    keyboardActive = false;
    firstInteractAt = 0;
    samples = [];
    metrics = null;
    classification = null;
    inputMethod = null;
    cancelAnimationFrame(rafInertia);
    disc.classList.remove('is-dragging', 'is-keyboard-active');
    disc.setAttribute('aria-grabbed', 'false');
    target.classList.remove('is-near', 'is-ready');
    trailPanel.hidden = true;
    revealBtn.setAttribute('aria-expanded', 'false');
    revealBtn.hidden = false;
    if (insightEl) insightEl.textContent = '';
    if (debugEl) debugEl.hidden = !debugMode;
    if (debugBody) debugBody.textContent = 'Waiting for interaction…';

    const br = boardRect();
    const startX = br.width * 0.18 - discSize / 2;
    const startY = br.height * (br.width < 420 ? 0.38 : 0.55) - discSize / 2;
    setDiscPosition(startX, startY, 1);
    challengeShownAt = performance.now();
    hintEl.textContent = 'Drag, or use keyboard controls.';
  };

  const markInteract = () => {
    if (!firstInteractAt) firstInteractAt = performance.now();
  };

  const pushSample = (clientX, clientY, t = performance.now()) => {
    const br = boardRect();
    samples.push({
      x: clientX - br.left,
      y: clientY - br.top,
      t
    });
  };

  const analyze = () => {
    if (samples.length < 2) {
      return {
        reactionMs: Math.max(0, (firstInteractAt || performance.now()) - challengeShownAt),
        durationMs: 0,
        sampleCount: samples.length,
        pathLength: 0,
        directDistance: 0,
        efficiency: 1,
        avgVelocity: 0,
        velocityVariance: 0,
        corrections: 0,
        totalMs: Math.max(0, (firstInteractAt || performance.now()) - challengeShownAt),
        inputMethod: inputMethod || 'mouse'
      };
    }

    const start = samples[0];
    const end = samples[samples.length - 1];
    let pathLength = 0;
    const velocities = [];
    let corrections = 0;
    let prevAngle = null;

    for (let i = 1; i < samples.length; i += 1) {
      const a = samples[i - 1];
      const b = samples[i];
      const segment = Math.hypot(b.x - a.x, b.y - a.y);
      pathLength += segment;
      const dt = Math.max(1, b.t - a.t) / 1000;
      velocities.push(segment / dt);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (prevAngle !== null) {
        let delta = Math.abs(angle - prevAngle);
        if (delta > Math.PI) delta = (Math.PI * 2) - delta;
        if (delta > 0.55 && segment > 2.5) corrections += 1;
      }
      prevAngle = angle;
    }

    const directDistance = Math.hypot(end.x - start.x, end.y - start.y);
    const durationMs = end.t - start.t;
    const avgVelocity = velocities.length ? velocities.reduce((s, v) => s + v, 0) / velocities.length : 0;
    const variance = velocities.length
      ? velocities.reduce((s, v) => s + ((v - avgVelocity) ** 2), 0) / velocities.length
      : 0;
    const efficiency = pathLength > 0 ? clamp(directDistance / pathLength, 0, 1) : 1;
    const totalMs = Math.max(durationMs, (end.t - challengeShownAt));

    return {
      reactionMs: Math.max(0, firstInteractAt - challengeShownAt),
      durationMs,
      sampleCount: samples.length,
      pathLength,
      directDistance,
      efficiency,
      avgVelocity,
      velocityVariance: variance,
      corrections,
      totalMs,
      inputMethod: inputMethod || 'mouse'
    };
  };

  /**
   * classifyInteraction(metrics)
   * ----------------------------
   * Design-experiment classifier. Combines multiple signals; never one threshold alone.
   *
   * Returns:
   *   { classification: 'natural'|'suspicious'|'insufficient',
   *     naturalnessScore: 0–100,
   *     flags: {...}, title, note, timeLabel, insight }
   *
   * Score intent (pointer paths):
   *   65–100 → lean natural
   *   30–64  → candidate for “suspiciously precise” (needs ≥2 machine-like flags)
   *   0–29   → thin / incomplete signal (or extreme machine-likeness with thin data)
   *
   * Keyboard: discrete motion is not scored like pointer biometrics.
   * Touch: sample density & variance thresholds are relaxed.
   */
  const classifyInteraction = (m) => {
    const method = m.inputMethod || 'mouse';
    const isTouch = method === 'touch';
    const isKeyboard = method === 'keyboard';
    const effPct = Math.round(m.efficiency * 100);

    const flags = {
      tinyPath: m.pathLength < (isKeyboard ? 36 : 22),
      tinyDuration: m.durationMs < (isKeyboard ? 80 : 45),
      fewSamples: m.sampleCount < (isTouch ? 5 : isKeyboard ? 4 : 6),
      highEfficiency: m.efficiency >= 0.96,
      nearPerfect: m.efficiency >= 0.985,
      zeroCorrections: m.corrections === 0,
      lowVariance: m.velocityVariance < (isTouch ? 1200 : 2500),
      veryLowVariance: m.velocityVariance < (isTouch ? 400 : 900),
      instantDrag: m.durationMs > 0 && m.durationMs < (isTouch ? 110 : 140) && m.efficiency >= 0.94,
      longEnough: m.durationMs >= (isTouch ? 180 : 220),
      someCurve: m.efficiency < 0.93,
      someCorrections: m.corrections >= 1,
      variedSpeed: m.velocityVariance >= (isTouch ? 2500 : 6000),
      hesitation: m.reactionMs >= 280,
      machineLike: 0,
      thinData: false
    };

    // --- Hard data-quality guards (insufficient) ---
    const insufficientHard =
      m.sampleCount < 2 ||
      (flags.tinyPath && flags.tinyDuration) ||
      (flags.fewSamples && m.pathLength < 40) ||
      (m.durationMs < 30 && m.pathLength < 30) ||
      (isKeyboard && m.sampleCount < 4 && m.pathLength < 80);

    if (insufficientHard) {
      flags.thinData = true;
      return finish('insufficient', 18, flags, m, method, {
        title: 'Not enough movement.',
        note: pickInsufficientNote(m, flags),
        timeLabel: 'Not enough signal to evaluate',
        insight: `Only ${m.sampleCount} motion sample${m.sampleCount === 1 ? '' : 's'} ${m.sampleCount === 1 ? 'was' : 'were'} captured.`
      });
    }

    // --- Keyboard: accessible completion, not pointer biometrics ---
    if (isKeyboard) {
      const kbScore = m.pathLength >= 80 && m.sampleCount >= 4 ? 78 : 62;
      if (m.pathLength < 50 || m.sampleCount < 4) {
        flags.thinData = true;
        return finish('insufficient', 24, flags, m, method, {
          title: 'Not enough movement.',
          note: 'Try a few more arrow-key steps before placing.',
          timeLabel: 'Not enough signal to evaluate',
          insight: `Only ${m.sampleCount} motion samples were captured.`
        });
      }
      return finish('natural', kbScore, flags, m, method, {
        title: 'Human enough.',
        note: 'Completed with keyboard controls.',
        timeLabel: `Verified in ${(m.totalMs / 1000).toFixed(1)} seconds`,
        insight: `${m.sampleCount} keyboard steps across ${Math.round(m.pathLength)}px.`
      });
    }

    // --- Pointer naturalness score (starts biased toward natural) ---
    let score = 70;
    const machine = [];

    // Natural signals (additive)
    if (flags.someCorrections) score += Math.min(14, 5 + m.corrections * 3);
    if (flags.someCurve) score += 8;
    if (m.efficiency < 0.85) score += 4;
    if (flags.variedSpeed) score += 10;
    else if (m.velocityVariance >= (isTouch ? 900 : 2000)) score += 5;
    if (flags.longEnough) score += 6;
    if (m.durationMs >= 400 && m.durationMs <= 2400) score += 4;
    if (flags.hesitation) score += 3;
    if (m.sampleCount >= (isTouch ? 8 : 14)) score += 5;

    // Machine-like signals (subtractive) — stacked, never one alone
    if (flags.nearPerfect) {
      score -= isTouch ? 10 : 16;
      machine.push('nearPerfect');
    } else if (flags.highEfficiency) {
      score -= isTouch ? 6 : 11;
      machine.push('highEfficiency');
    }

    if (flags.zeroCorrections && m.efficiency >= 0.92) {
      score -= isTouch ? 5 : 9;
      machine.push('zeroCorrections');
    }

    if (flags.veryLowVariance && m.efficiency >= 0.9) {
      score -= isTouch ? 4 : 10;
      machine.push('veryLowVariance');
    } else if (flags.lowVariance && flags.highEfficiency) {
      score -= isTouch ? 2 : 5;
      machine.push('lowVariance');
    }

    if (flags.instantDrag) {
      score -= isTouch ? 6 : 12;
      machine.push('instantDrag');
    }

    if (m.durationMs < 90 && m.efficiency >= 0.97) {
      score -= 8;
      machine.push('snapStraight');
    }

    if (m.avgVelocity > (isTouch ? 4200 : 5500) && m.efficiency >= 0.95) {
      score -= 6;
      machine.push('extremeVelocity');
    }

    // Sparse but long teleport-like path
    if (m.sampleCount <= (isTouch ? 4 : 5) && m.pathLength > 120 && m.efficiency >= 0.97) {
      score -= 8;
      machine.push('sparsePerfect');
    }

    flags.machineLike = machine.length;
    flags.thinData = m.sampleCount < (isTouch ? 6 : 8) || m.durationMs < 120;
    score = clamp(Math.round(score), 0, 100);

    // Decision: require combined evidence for suspicious; prefer natural on ambiguity
    let kind = 'natural';
    if (score < 30 && flags.thinData && flags.machineLike < 2) {
      kind = 'insufficient';
    } else if (score < 65 && flags.machineLike >= 2) {
      kind = 'suspicious';
    } else if (score < 30 && flags.machineLike >= 2) {
      kind = 'suspicious';
    } else {
      kind = 'natural';
    }

    if (kind === 'insufficient') {
      return finish('insufficient', score, flags, m, method, {
        title: 'Not enough movement.',
        note: pickInsufficientNote(m, flags),
        timeLabel: 'Not enough signal to evaluate',
        insight: `Only ${m.sampleCount} motion samples were captured.`
      });
    }

    if (kind === 'suspicious') {
      return finish('suspicious', score, flags, m, method, {
        title: 'Suspiciously precise.',
        note: pickSuspiciousNote(m, flags),
        timeLabel: `Movement analysed in ${(m.totalMs / 1000).toFixed(1)} seconds`,
        insight: `${effPct}% path efficiency with ${m.corrections === 0 ? 'almost no' : m.corrections} correction${m.corrections === 1 ? '' : 's'}.`
      });
    }

    return finish('natural', score, flags, m, method, {
      title: 'Human enough.',
      note: pickNaturalNote(m, flags),
      timeLabel: `Verified in ${(m.totalMs / 1000).toFixed(1)} seconds`,
      insight: pickNaturalInsight(m)
    });
  };

  const finish = (classificationName, naturalnessScore, flags, m, method, copy) => ({
    classification: classificationName,
    naturalnessScore,
    flags,
    inputMethod: method,
    metrics: m,
    machineFlags: flags.machineLike,
    ...copy
  });

  const pickNaturalNote = (m, flags) => {
    if (m.corrections >= 2 && flags.variedSpeed) {
      return 'A little hesitation. A few corrections. Very human.';
    }
    if (m.corrections >= 1 || flags.someCurve) {
      return 'Your movement had natural variation.';
    }
    if (flags.hesitation) {
      return 'There was a natural pause before you started.';
    }
    if (m.efficiency < 0.9) {
      return 'The path moved with natural variation.';
    }
    return 'The motion settled with quiet precision.';
  };

  const pickSuspiciousNote = (m, flags) => {
    if (flags.instantDrag || flags.nearPerfect) {
      return 'That movement was unusually direct.';
    }
    if (flags.zeroCorrections && flags.highEfficiency) {
      return 'Almost no variation in the path.';
    }
    return 'A little too perfect for this experiment.';
  };

  const pickInsufficientNote = (m) => {
    if (m.durationMs < 50) return 'That was too short to say much.';
    if (m.sampleCount < 5) return 'There wasn’t enough interaction to read the motion.';
    return 'Try a more natural drag.';
  };

  const pickNaturalInsight = (m) => {
    const bits = [];
    if (m.corrections > 0) {
      bits.push(`${m.corrections} direction correction${m.corrections === 1 ? '' : 's'}`);
    }
    if (m.velocityVariance >= 4000) bits.push('varied speed');
    else if (m.efficiency < 0.92) bits.push('a lightly curved path');
    if (!bits.length) bits.push('quiet pacing');
    return `${bits.join(' and ')}.`;
  };

  const renderDebug = (result) => {
    if (!debugMode || !debugEl || !debugBody) return;
    debugEl.hidden = false;
    const m = result.metrics;
    debugBody.textContent = [
      `classification: ${result.classification}`,
      `naturalnessScore: ${result.naturalnessScore}`,
      `inputMethod: ${result.inputMethod}`,
      `machineFlags: ${result.machineFlags}`,
      `reactionMs: ${Math.round(m.reactionMs)}`,
      `durationMs: ${Math.round(m.durationMs)}`,
      `sampleCount: ${m.sampleCount}`,
      `pathLength: ${Math.round(m.pathLength)}`,
      `directDistance: ${Math.round(m.directDistance)}`,
      `efficiency: ${m.efficiency.toFixed(3)}`,
      `avgVelocity: ${Math.round(m.avgVelocity)}`,
      `velocityVariance: ${Math.round(m.velocityVariance)}`,
      `corrections: ${m.corrections}`
    ].join('\n');
  };

  const applyResult = (result) => {
    classification = result;
    resultRoot?.setAttribute('data-hc-result', result.classification);
    if (iconEl) iconEl.innerHTML = ICONS[result.classification] || ICONS.natural;
    if (resultTitleEl) resultTitleEl.textContent = result.title;
    timeEl.textContent = result.timeLabel;
    noteEl.textContent = result.note;
    if (insightEl) insightEl.textContent = result.insight;

    const seconds = (result.metrics.totalMs / 1000).toFixed(1);
    statEls.duration.textContent = `${seconds}s`;
    statEls.efficiency.textContent = `${Math.round(result.metrics.efficiency * 100)}%`;
    statEls.corrections.textContent = String(result.metrics.corrections);

    // Hide trail CTA only when there is essentially no path to show
    const showTrail = result.metrics.sampleCount >= 2 && result.metrics.pathLength >= 2;
    revealBtn.hidden = !showTrail;

    renderDebug(result);
  };

  const complete = () => {
    if (settled) return;
    settled = true;
    metrics = analyze();
    const elapsedMs = Math.max(metrics.totalMs, performance.now() - challengeShownAt);
    metrics.totalMs = elapsedMs;
    metrics.inputMethod = inputMethod || metrics.inputMethod || 'mouse';
    const result = classifyInteraction(metrics);
    applyResult(result);
    showStage('result');
    if (!revealBtn.hidden) drawTrail();
  };

  const trySettle = () => {
    if (!updateTargetProximity()) return false;
    const goal = targetCenterLocal();
    const offsetX = goal.x - discSize / 2;
    const offsetY = goal.y - discSize / 2;

    if (reducedMotion) {
      setDiscPosition(offsetX, offsetY, 1);
      complete();
      return true;
    }

    const start = { ...pos };
    const from = performance.now();
    const duration = 320;
    const step = (now) => {
      const t = clamp((now - from) / duration, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      setDiscPosition(
        start.x + (offsetX - start.x) * e,
        start.y + (offsetY - start.y) * e,
        1
      );
      if (t < 1) requestAnimationFrame(step);
      else complete();
    };
    requestAnimationFrame(step);
    return true;
  };

  const pointerDown = (event) => {
    if (settled || event.button === 2) return;
    markInteract();
    keyboardActive = false;
    const type = event.pointerType || 'mouse';
    inputMethod = type === 'touch' || type === 'pen' ? type : 'mouse';
    disc.classList.add('is-dragging');
    disc.setAttribute('aria-grabbed', 'true');
    try {
      disc.setPointerCapture(event.pointerId);
    } catch (_) {
      /* Synthetic or already-released pointers may throw; drag still works via listeners. */
    }
    const br = boardRect();
    drag = {
      id: event.pointerId,
      offsetX: event.clientX - br.left - pos.x,
      offsetY: event.clientY - br.top - pos.y,
      last: { x: event.clientX, y: event.clientY, t: performance.now() },
      vx: 0,
      vy: 0
    };
    pushSample(event.clientX, event.clientY);
    setDiscPosition(pos.x, pos.y, 1.06);
    document.documentElement.style.overflow = 'hidden';
    event.preventDefault();
  };

  const pointerMove = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const br = boardRect();
    const nextX = event.clientX - br.left - drag.offsetX;
    const nextY = event.clientY - br.top - drag.offsetY;
    const now = performance.now();
    const dt = Math.max(1, now - drag.last.t);
    drag.vx = (event.clientX - drag.last.x) / dt;
    drag.vy = (event.clientY - drag.last.y) / dt;
    drag.last = { x: event.clientX, y: event.clientY, t: now };
    setDiscPosition(nextX, nextY, 1.06);
    pushSample(event.clientX, event.clientY, now);
    updateTargetProximity();
    event.preventDefault();
  };

  const endDrag = (event) => {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const releaseVx = drag.vx;
    const releaseVy = drag.vy;
    drag = null;
    disc.classList.remove('is-dragging');
    disc.setAttribute('aria-grabbed', 'false');
    document.documentElement.style.overflow = '';

    if (trySettle()) return;

    if (reducedMotion) {
      setDiscPosition(pos.x, pos.y, 1);
      updateTargetProximity();
      return;
    }

    let vx = releaseVx * 14;
    let vy = releaseVy * 14;
    const tick = () => {
      vx *= 0.86;
      vy *= 0.86;
      setDiscPosition(pos.x + vx, pos.y + vy, 1);
      updateTargetProximity();
      if (Math.hypot(vx, vy) > 0.35) {
        rafInertia = requestAnimationFrame(tick);
      } else if (!trySettle()) {
        setDiscPosition(pos.x, pos.y, 1);
      }
    };
    rafInertia = requestAnimationFrame(tick);
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
      disc.classList.add('is-keyboard-active');
      disc.setAttribute('aria-grabbed', 'true');
      setDiscPosition(pos.x, pos.y, 1.05);
      hintEl.textContent = 'Arrow keys to move. Enter to place.';
      pushSample(boardRect().left + discCenter().x, boardRect().top + discCenter().y);
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!keyboardActive) {
        keyboardActive = true;
        disc.classList.add('is-keyboard-active');
        disc.setAttribute('aria-grabbed', 'true');
        setDiscPosition(pos.x, pos.y, 1.05);
        hintEl.textContent = 'Arrow keys to move. Enter to place.';
        pushSample(boardRect().left + discCenter().x, boardRect().top + discCenter().y);
      } else {
        keyboardActive = false;
        disc.classList.remove('is-keyboard-active');
        disc.setAttribute('aria-grabbed', 'false');
        pushSample(boardRect().left + discCenter().x, boardRect().top + discCenter().y);
        if (!trySettle()) {
          setDiscPosition(pos.x, pos.y, 1);
          hintEl.textContent = 'Move closer to the ring, then press Enter.';
        }
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      keyboardActive = false;
      disc.classList.remove('is-keyboard-active');
      disc.setAttribute('aria-grabbed', 'false');
      setDiscPosition(pos.x, pos.y, 1);
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
    pushSample(boardRect().left + discCenter().x, boardRect().top + discCenter().y);
    updateTargetProximity();
  };

  const drawTrail = () => {
    if (!trailCanvas || !samples.length) return;
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
    samples.forEach((s, i) => {
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

    const start = samples[0];
    const end = samples[samples.length - 1];
    ctx.fillStyle = '#171715';
    ctx.beginPath();
    ctx.arc((start.x / br.width) * w, (start.y / br.height) * h, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((end.x / br.width) * w, (end.y / br.height) * h, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  const startChallenge = () => {
    showStage('challenge');
    void board.offsetWidth;
    resetChallenge();
    requestAnimationFrame(() => {
      disc.focus({ preventScroll: true });
    });
  };

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
  disc.addEventListener('pointercancel', endDrag);
  disc.addEventListener('lostpointercapture', endDrag);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => {
    if (!stages.challenge.hidden && !settled) {
      measure();
      setDiscPosition(pos.x, pos.y, 1);
      updateTargetProximity();
    }
  });

  if (debugMode && debugEl) {
    debugEl.hidden = false;
    if (debugBody) debugBody.textContent = 'Waiting for interaction…';
  }

  // Expose classifier for local tuning when ?debug=1
  if (debugMode) {
    window.__hcClassifyInteraction = classifyInteraction;
  }

  showStage('intro');
})();
