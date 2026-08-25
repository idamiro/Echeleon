(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const recording = new URLSearchParams(window.location.search).get('recording') === '1';
  if (recording) document.documentElement.classList.add('hc-recording');

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
  let settled = false;
  let rafInertia = 0;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
    // Prefer live layout sizes when available (responsive + zoom)
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
    const ready = d < targetSize * 0.28;
    const near = d < targetSize * 0.72;
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
    cancelAnimationFrame(rafInertia);
    disc.classList.remove('is-dragging', 'is-keyboard-active');
    disc.setAttribute('aria-grabbed', 'false');
    target.classList.remove('is-near', 'is-ready');
    trailPanel.hidden = true;
    revealBtn.setAttribute('aria-expanded', 'false');

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
        reactionMs: firstInteractAt - challengeShownAt,
        durationMs: 0,
        sampleCount: samples.length,
        pathLength: 0,
        directDistance: 0,
        efficiency: 1,
        avgVelocity: 0,
        velocityVariance: 0,
        corrections: 0,
        totalMs: Math.max(0, (firstInteractAt || performance.now()) - challengeShownAt)
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
      totalMs
    };
  };

  const resultNote = (m) => {
    if (m.corrections >= 2 || m.velocityVariance > 18000) {
      return 'Your movement had natural variation.';
    }
    if (m.efficiency < 0.82) {
      return 'The path wasn’t perfectly straight — that’s fine.';
    }
    if (m.reactionMs > 350) {
      return 'There was a natural pause before you started.';
    }
    return 'The motion settled with quiet precision.';
  };

  const complete = () => {
    if (settled) return;
    settled = true;
    metrics = analyze();
    const seconds = (metrics.totalMs / 1000).toFixed(1);
    timeEl.textContent = `Verified in ${seconds} seconds`;
    noteEl.textContent = resultNote(metrics);
    statEls.duration.textContent = `${seconds}s`;
    statEls.efficiency.textContent = `${Math.round(metrics.efficiency * 100)}%`;
    statEls.corrections.textContent = String(metrics.corrections);
    showStage('result');
    drawTrail();
  };

  const trySettle = () => {
    if (!updateTargetProximity()) return false;
    const center = discCenter();
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
    disc.classList.add('is-dragging');
    disc.setAttribute('aria-grabbed', 'true');
    disc.setPointerCapture(event.pointerId);
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

    // subtle inertia then settle scale
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
    if (stages.challenge.hidden) return;
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape'];
    if (!keys.includes(event.key)) return;
    if (document.activeElement !== disc && !keyboardActive) return;

    markInteract();
    const step = event.shiftKey ? 18 : 10;

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!keyboardActive) {
        keyboardActive = true;
        disc.classList.add('is-keyboard-active');
        disc.setAttribute('aria-grabbed', 'true');
        setDiscPosition(pos.x, pos.y, 1.05);
        hintEl.textContent = 'Arrow keys to move. Enter to place.';
        pushSample(boardRect().left + discCenter().x, boardRect().top + discCenter().y);
      } else if (event.key === 'Enter' || event.key === ' ') {
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

    // target ghost
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

  beginBtn?.addEventListener('click', () => {
    showStage('challenge');
    requestAnimationFrame(() => {
      resetChallenge();
      disc.focus({ preventScroll: true });
    });
  });

  retryBtn?.addEventListener('click', () => {
    showStage('challenge');
    requestAnimationFrame(() => {
      resetChallenge();
      disc.focus({ preventScroll: true });
    });
  });

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

  // Intro ready
  showStage('intro');
})();
