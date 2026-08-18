import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

(() => {
  'use strict';

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  const W = 900;
  const H = 1800;
  const STORE = 'vulcet-case-studio-v2';
  const ROTATE_HANDLE = 64;

  function handleHitRadius() {
    const r = canvas.getBoundingClientRect();
    // ~14 CSS px touch target, converted into canvas space
    return Math.max(36, (14 * W) / Math.max(1, r.width));
  }

  const canvas = $('#design-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const artCanvas = document.createElement('canvas');
  const textureCanvas = document.createElement('canvas');
  const textureCtx = textureCanvas.getContext('2d', { alpha: false });
  const stage = $('.stage');
  const status = $('#studio-status');

  artCanvas.width = textureCanvas.width = W;
  artCanvas.height = textureCanvas.height = H;

  let baseColor = '#f1eee7';
  let finish = 'matte';
  let tool = 'brush';
  let brushColor = '#111111';
  let brushSize = 18;
  let brushOpacity = 1;
  let textFont = 'Inter';
  let textWeight = 700;
  let layers = [];
  let selected = null;
  let drawing = false;
  let dragging = false;
  let transformMode = null; // 'scale' | 'rotate' | null
  let activeHandle = null;
  let transformOrigin = null;
  let lastPoint = null;
  let history = [];
  let future = [];
  let textureDirty = true;
  let saveTimer = 0;
  let pinchStart = null;

  const say = (m) => { status.textContent = m; };
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function rounded(c, x, y, w, h, r) {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
  }

  function casePath(c, scale = 1) {
    rounded(c, 0, 0, W * scale, H * scale, 96 * scale);
  }

  function cameraPath(c, scale = 1) {
    rounded(c, 62 * scale, 72 * scale, 330 * scale, 304 * scale, 78 * scale);
  }

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * W / r.width,
      y: (e.clientY - r.top) * H / r.height
    };
  }

  function layerSize(l) {
    if (l.type === 'text') measureTextLayer(ctx, l);
    return { w: (l.w || 100) * (l.scale || 1), h: (l.h || 100) * (l.scale || 1) };
  }

  function serial() {
    return {
      baseColor,
      finish,
      layers: layers.map((l) => {
        const o = { ...l };
        delete o.image;
        return o;
      })
    };
  }

  function snapshot() {
    history.push(JSON.stringify(serial()));
    if (history.length > 50) history.shift();
    future = [];
    scheduleSave();
    updateActions();
  }

  function restore(data, announce = true) {
    baseColor = data.baseColor || '#f1eee7';
    finish = data.finish || 'matte';
    layers = (data.layers || []).map((l) => ({ ...l }));
    selected = null;
    loadImages().then(() => {
      syncControls();
      render();
      renderLayers();
      if (announce) say('Design restored.');
    });
  }

  function loadImages() {
    return Promise.all(layers.filter((l) => l.type === 'image' && l.src).map((l) => new Promise((resolve) => {
      const im = new Image();
      im.onload = () => { l.image = im; resolve(); };
      im.onerror = resolve;
      im.src = l.src;
    })));
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify(serial()));
      } catch {
        say('Design is too large for temporary browser storage. Download it to keep a copy.');
      }
    }, 250);
  }

  function updateActions() {
    const undoBtn = $('[data-action=undo]');
    const redoBtn = $('[data-action=redo]');
    if (undoBtn) undoBtn.disabled = history.length < 2;
    if (redoBtn) redoBtn.disabled = !future.length;
  }

  function measureTextLayer(c, l) {
    c.save();
    c.font = `${l.fontWeight || 600} ${l.fontSize || 96}px "${l.fontFamily || 'Inter'}"`;
    const lines = (l.text || 'Text').split('\n');
    const spacing = l.letterSpacing || 0;
    l.w = Math.max(40, ...lines.map((line) => c.measureText(line).width + Math.max(0, line.length - 1) * spacing));
    l.h = Math.max(l.fontSize || 96, lines.length * (l.fontSize || 96) * (l.lineHeight || 1.05));
    c.restore();
  }

  function drawSpacedText(c, text, x, y, spacing, align) {
    if (!spacing) {
      c.textAlign = align;
      c.fillText(text, x, y);
      return;
    }
    const widths = [...text].map((ch) => c.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, text.length - 1) * spacing;
    let cursor = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
    c.textAlign = 'left';
    [...text].forEach((ch, i) => {
      c.fillText(ch, cursor, y);
      cursor += widths[i] + spacing;
    });
  }

  function drawLayer(c, l, scale = 1) {
    if (l.visible === false) return;
    c.save();
    c.globalAlpha = l.opacity ?? 1;
    if (l.type === 'stroke') {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = l.erase ? '#000' : l.color;
      c.globalCompositeOperation = l.erase ? 'destination-out' : 'source-over';
      c.lineWidth = l.size * scale;
      c.beginPath();
      l.points.forEach((p, i) => {
        const x = p.x * scale;
        const y = p.y * scale;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      if (l.points.length === 1) c.lineTo((l.points[0].x + 0.1) * scale, l.points[0].y * scale);
      c.stroke();
    } else if (l.type === 'image' && l.image) {
      c.translate(l.x * scale, l.y * scale);
      c.rotate(l.rotation || 0);
      const w = l.w * l.scale * scale;
      const h = l.h * l.scale * scale;
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(l.image, -w / 2, -h / 2, w, h);
    } else if (l.type === 'text') {
      measureTextLayer(c, l);
      c.translate(l.x * scale, l.y * scale);
      c.rotate(l.rotation || 0);
      c.scale(l.scale * scale, l.scale * scale);
      c.fillStyle = l.color || '#111';
      c.font = `${l.fontWeight || 600} ${l.fontSize || 96}px "${l.fontFamily || 'Inter'}"`;
      c.textBaseline = 'middle';
      const lines = (l.text || 'Text').split('\n');
      const lh = (l.fontSize || 96) * (l.lineHeight || 1.05);
      const startY = -((lines.length - 1) * lh) / 2;
      lines.forEach((line, i) => {
        drawSpacedText(c, line, 0, startY + i * lh, l.letterSpacing || 0, l.align || 'center');
      });
    }
    c.restore();
  }

  function renderArtwork(target, scale = 1) {
    const aw = W * scale;
    const ah = H * scale;
    if (artCanvas.width !== aw || artCanvas.height !== ah) {
      artCanvas.width = aw;
      artCanvas.height = ah;
    }
    const a = artCanvas.getContext('2d', { alpha: true });
    a.clearRect(0, 0, aw, ah);
    layers.forEach((l) => drawLayer(a, l, scale));
    target.clearRect(0, 0, aw, ah);
    target.fillStyle = baseColor;
    casePath(target, scale);
    target.fill();
    target.save();
    casePath(target, scale);
    target.clip();
    target.drawImage(artCanvas, 0, 0);
    target.restore();
    // camera cutout
    target.save();
    target.globalCompositeOperation = 'destination-out';
    cameraPath(target, scale);
    target.fill();
    target.restore();
    textureDirty = true;
  }

  function renderTexture() {
    if (textureCanvas.width !== W || textureCanvas.height !== H) {
      textureCanvas.width = W;
      textureCanvas.height = H;
    }
    renderArtwork(textureCtx, 1);
  }

  function render(target = ctx, scale = 1) {
    renderArtwork(target, scale);
    if (target === ctx) drawSelection();
    updateTexture();
  }

  function toLocal(p, l) {
    const dx = p.x - l.x;
    const dy = p.y - l.y;
    const co = Math.cos(-(l.rotation || 0));
    const si = Math.sin(-(l.rotation || 0));
    return { x: dx * co - dy * si, y: dx * si + dy * co };
  }

  function handlePoints(l) {
    const { w, h } = layerSize(l);
    return {
      corners: [
        { id: 'nw', x: -w / 2, y: -h / 2, cursor: 'nwse-resize' },
        { id: 'ne', x: w / 2, y: -h / 2, cursor: 'nesw-resize' },
        { id: 'se', x: w / 2, y: h / 2, cursor: 'nwse-resize' },
        { id: 'sw', x: -w / 2, y: h / 2, cursor: 'nesw-resize' }
      ],
      rotate: { id: 'rotate', x: 0, y: -h / 2 - ROTATE_HANDLE, cursor: 'grab' },
      w,
      h
    };
  }

  function hitHandle(p, l) {
    if (!['image', 'text'].includes(l.type) || l.visible === false) return null;
    const local = toLocal(p, l);
    const { corners, rotate } = handlePoints(l);
    const radius = handleHitRadius();
    for (const c of corners) {
      if (Math.hypot(local.x - c.x, local.y - c.y) <= radius) return c;
    }
    if (Math.hypot(local.x - rotate.x, local.y - rotate.y) <= radius) return rotate;
    return null;
  }

  function hitObject(p, l) {
    if (!['image', 'text'].includes(l.type) || l.visible === false) return false;
    const local = toLocal(p, l);
    const { w, h } = layerSize(l);
    return Math.abs(local.x) <= w / 2 && Math.abs(local.y) <= h / 2;
  }

  function drawSelection() {
    const l = layers.find((x) => x.id === selected);
    if (!l || !['image', 'text'].includes(l.type) || l.visible === false) return;
    const { corners, rotate, w, h } = handlePoints(l);
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rotation || 0);

    // rotate stem
    ctx.strokeStyle = '#2f5bff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(rotate.x, rotate.y);
    ctx.stroke();

    ctx.setLineDash([12, 8]);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([]);

    const drawHandle = (x, y, kind) => {
      ctx.beginPath();
      if (kind === 'rotate') {
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#2f5bff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.rect(x - 10, y - 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#2f5bff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    };

    corners.forEach((c) => drawHandle(c.x, c.y, 'corner'));
    drawHandle(rotate.x, rotate.y, 'rotate');
    ctx.restore();
  }

  function updateCursor(p) {
    const l = layers.find((x) => x.id === selected);
    if (l && ['image', 'text'].includes(l.type)) {
      const handle = hitHandle(p, l);
      if (handle) {
        canvas.style.cursor = handle.cursor;
        return;
      }
      if (hitObject(p, l)) {
        canvas.style.cursor = dragging ? 'grabbing' : 'move';
        return;
      }
    }
    const hit = [...layers].reverse().find((layer) => hitObject(p, layer));
    canvas.style.cursor = hit ? 'move' : (tool === 'eraser' ? 'cell' : 'crosshair');
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (stage.dataset.view === 'preview') return;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    const current = layers.find((x) => x.id === selected);

    if (current && ['image', 'text'].includes(current.type)) {
      const handle = hitHandle(p, current);
      if (handle) {
        activeHandle = handle;
        transformMode = handle.id === 'rotate' ? 'rotate' : 'scale';
        transformOrigin = {
          scale: current.scale || 1,
          rotation: current.rotation || 0,
          dist: Math.hypot(p.x - current.x, p.y - current.y) || 1,
          angle: Math.atan2(p.y - current.y, p.x - current.x),
          local: toLocal(p, current)
        };
        lastPoint = p;
        render();
        renderSelectionControls();
        say(transformMode === 'rotate' ? 'Rotate — drag around the centre.' : 'Resize — drag the corner.');
        return;
      }
    }

    const hit = [...layers].reverse().find((l) => hitObject(p, l));
    if (hit) {
      selected = hit.id;
      dragging = true;
      lastPoint = p;
      render();
      renderLayers();
      say('Drag to move · corners to resize · top handle to rotate.');
      return;
    }

    selected = null;
    drawing = true;
    const l = {
      id: uid(),
      type: 'stroke',
      name: tool === 'eraser' ? 'Eraser' : 'Brush stroke',
      color: brushColor,
      size: brushSize,
      opacity: brushOpacity,
      erase: tool === 'eraser',
      visible: true,
      points: [p]
    };
    layers.push(l);
    selected = l.id;
    lastPoint = p;
    render();
    renderLayers();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = point(e);
    if (!drawing && !dragging && !transformMode) {
      updateCursor(p);
      return;
    }

    if (drawing) {
      layers[layers.length - 1].points.push(p);
      render();
      return;
    }

    const l = layers.find((x) => x.id === selected);
    if (!l) return;

    if (transformMode === 'scale' && transformOrigin) {
      const local = toLocal(p, l);
      // Use distance from centre vs original handle distance
      const startLocalDist = Math.hypot(transformOrigin.local.x, transformOrigin.local.y) || 1;
      const nowLocalDist = Math.hypot(local.x, local.y) || 1;
      const ratio = nowLocalDist / startLocalDist;
      l.scale = clamp(transformOrigin.scale * ratio, 0.08, 8);
      render();
      renderSelectionControls(false);
      return;
    }

    if (transformMode === 'rotate' && transformOrigin) {
      const angle = Math.atan2(p.y - l.y, p.x - l.x);
      l.rotation = transformOrigin.rotation + (angle - transformOrigin.angle);
      render();
      renderSelectionControls(false);
      return;
    }

    if (dragging) {
      l.x += p.x - lastPoint.x;
      l.y += p.y - lastPoint.y;
      lastPoint = p;
      render();
    }
  });

  const pointerEnd = () => {
    if (drawing || dragging || transformMode) {
      drawing = false;
      dragging = false;
      transformMode = null;
      activeHandle = null;
      transformOrigin = null;
      lastPoint = null;
      snapshot();
      renderLayers();
      renderSelectionControls();
    }
  };
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);

  // Scroll to scale selected image/text
  canvas.addEventListener('wheel', (e) => {
    const l = layers.find((x) => x.id === selected);
    if (!l || !['image', 'text'].includes(l.type) || stage.dataset.view === 'preview') return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.94 : 1.06;
    l.scale = clamp((l.scale || 1) * factor, 0.08, 8);
    render();
    renderSelectionControls(false);
    scheduleSave();
  }, { passive: false });

  // Pinch to scale on touch
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const l = layers.find((x) => x.id === selected);
      if (!l || !['image', 'text'].includes(l.type)) return;
      pinchStart = {
        dist: Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        ),
        scale: l.scale || 1
      };
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStart) {
      e.preventDefault();
      const l = layers.find((x) => x.id === selected);
      if (!l) return;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      l.scale = clamp(pinchStart.scale * (dist / (pinchStart.dist || 1)), 0.08, 8);
      render();
      renderSelectionControls(false);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    if (pinchStart) {
      pinchStart = null;
      snapshot();
      renderLayers();
    }
  });

  function renderLayers() {
    const list = $('#layers-list');
    list.innerHTML = '';
    [...layers].reverse().forEach((l, i) => {
      const li = document.createElement('li');
      li.className = `layer-item${l.id === selected ? ' is-selected' : ''}${l.visible === false ? ' is-hidden' : ''}`;
      li.dataset.id = l.id;
      li.tabIndex = 0;
      const type = l.type === 'image' ? 'IMG' : l.type === 'text' ? 'TXT' : l.erase ? 'ER' : 'BR';
      const thumb = l.type === 'image' && l.src
        ? `<img src="${l.src}" alt="">`
        : type;
      li.innerHTML = `<span class="layer-thumb">${thumb}</span><span class="layer-copy"><strong>${escapeHtml(l.name || 'Layer')}</strong><small>${l.type} · ${layers.length - i}</small></span><span class="layer-buttons"><button class="layer-visibility" type="button" aria-label="${l.visible === false ? 'Show layer' : 'Hide layer'}">${l.visible === false ? '○' : '●'}</button><button class="layer-delete" type="button" aria-label="Delete layer">×</button></span>`;
      const choose = () => {
        selected = l.id;
        render();
        renderLayers();
        renderSelectionControls();
      };
      li.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        choose();
      });
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          choose();
        }
      });
      li.querySelector('.layer-visibility').addEventListener('click', (e) => {
        e.stopPropagation();
        l.visible = l.visible === false;
        snapshot();
        render();
        renderLayers();
      });
      li.querySelector('.layer-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        selected = l.id;
        mutate('delete');
      });
      list.appendChild(li);
    });
    const count = $('#layer-count');
    if (count) count.textContent = String(layers.length);
    renderSelectionControls();
  }

  function commonSelection(l, label) {
    return `<div class="selection-title"><strong>${escapeHtml(l.name || 'Layer')}</strong><span>${label}</span></div>
      <div class="nudge-row" role="group" aria-label="Nudge position">
        <button type="button" data-nudge="left" aria-label="Nudge left">←</button>
        <button type="button" data-nudge="up" aria-label="Nudge up">↑</button>
        <button type="button" data-nudge="down" aria-label="Nudge down">↓</button>
        <button type="button" data-nudge="right" aria-label="Nudge right">→</button>
      </div>
      <label>Scale <input data-property="scale" type="range" min="0.08" max="6" step="0.01" value="${l.scale || 1}"></label>
      <label>Rotation <input data-property="rotation" type="range" min="-180" max="180" step="1" value="${Math.round(((l.rotation || 0) * 180) / Math.PI)}"></label>
      <label>${l.type === 'image' ? 'Image strength' : 'Opacity'} <input data-property="opacity" type="range" min="0.15" max="1" step="0.01" value="${l.opacity ?? 1}"></label>`;
  }

  function bindSelection(l, box) {
    box.querySelectorAll('[data-property]').forEach((input) => {
      const apply = () => {
        const key = input.dataset.property;
        if (key === 'scale' || key === 'opacity' || key === 'fontSize' || key === 'letterSpacing' || key === 'lineHeight') {
          l[key] = parseFloat(input.value);
        } else if (key === 'rotation') {
          l.rotation = (parseFloat(input.value) * Math.PI) / 180;
        } else if (key === 'fontFamily') {
          l.fontFamily = input.value;
        } else if (key === 'text') {
          l.text = input.value;
          l.name = input.value.split('\n')[0].slice(0, 28) || 'Text';
        } else if (key === 'color') {
          l.color = input.value;
        }
        if (l.type === 'text') measureTextLayer(ctx, l);
        render();
        scheduleSave();
      };
      input.addEventListener('input', apply);
      input.addEventListener('change', () => { snapshot(); renderLayers(); });
    });
    box.querySelectorAll('[data-nudge]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = 12;
        const dir = btn.dataset.nudge;
        if (dir === 'left') l.x -= step;
        if (dir === 'right') l.x += step;
        if (dir === 'up') l.y -= step;
        if (dir === 'down') l.y += step;
        snapshot();
        render();
        renderLayers();
      });
    });
    box.querySelectorAll('[data-align]').forEach((btn) => {
      btn.addEventListener('click', () => {
        l.align = btn.dataset.align;
        snapshot();
        render();
        renderSelectionControls();
      });
    });
  }

  function renderSelectionControls(rebuild = true) {
    const box = $('#selection-controls');
    const l = layers.find((x) => x.id === selected);
    if (!l) {
      box.innerHTML = '<p>Select an image or text layer to move, resize, and refine it.</p>';
      return;
    }
    if (!rebuild) {
      const scale = box.querySelector('[data-property=scale]');
      const rot = box.querySelector('[data-property=rotation]');
      if (scale) scale.value = l.scale || 1;
      if (rot) rot.value = Math.round(((l.rotation || 0) * 180) / Math.PI);
      return;
    }
    if (l.type === 'image') {
      box.innerHTML = commonSelection(l, 'Image');
      bindSelection(l, box);
    } else if (l.type === 'text') {
      box.innerHTML = `${commonSelection(l, 'Text')}
        <label>Content <textarea data-property="text" rows="2" maxlength="120">${escapeHtml(l.text)}</textarea></label>
        <div class="selection-grid">
          <label>Typeface <select data-property="fontFamily">
            <option value="Inter"${l.fontFamily === 'Inter' ? ' selected' : ''}>Sans</option>
            <option value="Instrument Serif"${l.fontFamily === 'Instrument Serif' ? ' selected' : ''}>Serif</option>
            <option value="Arial Black"${l.fontFamily === 'Arial Black' ? ' selected' : ''}>Display</option>
            <option value="monospace"${l.fontFamily === 'monospace' ? ' selected' : ''}>Mono</option>
          </select></label>
          <label>Size <input data-property="fontSize" type="number" min="24" max="280" value="${l.fontSize}"></label>
          <label>Tracking <input data-property="letterSpacing" type="number" min="-8" max="40" value="${l.letterSpacing || 0}"></label>
          <label>Line height <input data-property="lineHeight" type="number" min="0.8" max="2" step="0.05" value="${l.lineHeight || 1.05}"></label>
        </div>
        <label>Colour <input data-property="color" type="color" value="${l.color || '#111111'}"></label>
        <div class="text-align" role="group" aria-label="Text alignment">
          <button type="button" data-align="left" class="${l.align === 'left' ? 'is-active' : ''}">Left</button>
          <button type="button" data-align="center" class="${!l.align || l.align === 'center' ? 'is-active' : ''}">Centre</button>
          <button type="button" data-align="right" class="${l.align === 'right' ? 'is-active' : ''}">Right</button>
        </div>`;
      bindSelection(l, box);
    } else {
      box.innerHTML = `<div class="selection-title"><strong>${escapeHtml(l.name || 'Stroke')}</strong><span>${l.erase ? 'Eraser' : 'Brush'}</span></div><p>Stroke layers can be reordered, duplicated, or deleted.</p>`;
    }
  }

  function syncControls() {
    $('#case-color').value = baseColor;
    $$('.swatch').forEach((s) => s.classList.toggle('is-active', s.dataset.color === baseColor));
    $$('.finish-button').forEach((b) => b.classList.toggle('is-active', b.dataset.finish === finish));
    $$('.tool-button').forEach((b) => {
      const on = b.dataset.tool === tool;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.body.dataset.caseFinish = finish;
  }

  $$('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      baseColor = btn.dataset.color;
      $('#case-color').value = baseColor;
      syncControls();
      snapshot();
      render();
      say('Case colour updated.');
    });
  });

  $('#case-color').addEventListener('input', (e) => {
    baseColor = e.target.value;
    $$('.swatch').forEach((s) => s.classList.remove('is-active'));
    snapshot();
    render();
  });

  $$('.finish-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      finish = btn.dataset.finish;
      syncControls();
      applyFinishTo3D();
      snapshot();
      say(finish === 'glossy' ? 'Glossy finish applied.' : 'Matte finish applied.');
    });
  });

  $$('.tool-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      tool = btn.dataset.tool;
      syncControls();
      say(`${tool === 'brush' ? 'Brush' : 'Eraser'} selected.`);
    });
  });

  $('#brush-color').addEventListener('input', (e) => { brushColor = e.target.value; });
  $('#brush-size').addEventListener('input', (e) => {
    brushSize = +e.target.value;
    $('#size-value').textContent = String(brushSize);
  });
  $('#brush-opacity').addEventListener('input', (e) => {
    brushOpacity = +e.target.value / 100;
    $('#opacity-value').textContent = `${e.target.value}%`;
  });

  $$('.font-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      textFont = btn.dataset.font;
      textWeight = +btn.dataset.weight;
      $$('.font-preset').forEach((b) => b.classList.toggle('is-active', b === btn));
    });
  });

  $('#add-text').addEventListener('click', () => {
    const text = ($('#text-input').value || 'VULCET').trim();
    const fontSize = clamp(+$('#text-size').value || 96, 24, 280);
    const l = {
      id: uid(),
      type: 'text',
      name: text.split('\n')[0].slice(0, 28),
      text,
      fontFamily: textFont,
      fontWeight: textWeight,
      fontSize,
      letterSpacing: 0,
      lineHeight: 1.05,
      align: 'center',
      color: $('#text-color').value,
      opacity: 1,
      visible: true,
      x: W / 2,
      y: H * 0.58,
      scale: 1,
      rotation: 0,
      w: 300,
      h: fontSize
    };
    measureTextLayer(ctx, l);
    layers.push(l);
    selected = l.id;
    snapshot();
    render();
    renderLayers();
    say('Text added. Drag it, or use corner handles to resize.');
  });

  $('#image-upload').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      say('Choose a PNG, JPG or WebP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        // Fit nicely on case, leave room to scale up/down
        const targetW = W * 0.72;
        const targetH = H * 0.42;
        const ratio = Math.min(targetW / im.width, targetH / im.height);
        const l = {
          id: uid(),
          type: 'image',
          name: f.name.slice(0, 28),
          src: reader.result,
          image: im,
          x: W / 2,
          y: H * 0.55,
          w: im.width * ratio,
          h: im.height * ratio,
          scale: 1,
          rotation: 0,
          opacity: 1,
          visible: true
        };
        layers.push(l);
        selected = l.id;
        snapshot();
        render();
        renderLayers();
        say('Photo added. Drag to place · pull corners to resize · top handle to rotate.');
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  function mutate(action) {
    const i = layers.findIndex((l) => l.id === selected);
    if (i < 0) return false;
    const l = layers[i];
    if (action === 'delete') {
      layers.splice(i, 1);
      selected = null;
    }
    if (action === 'duplicate') {
      const copy = { ...l, id: uid(), name: `${l.name} copy`, x: l.x + 24, y: l.y + 24 };
      if (l.image) copy.image = l.image;
      layers.splice(i + 1, 0, copy);
      selected = copy.id;
    }
    if (action === 'forward' && i < layers.length - 1) {
      layers.splice(i, 1);
      layers.splice(i + 1, 0, l);
    }
    if (action === 'backward' && i > 0) {
      layers.splice(i, 1);
      layers.splice(i - 1, 0, l);
    }
    snapshot();
    render();
    renderLayers();
    return true;
  }

  function undo() {
    if (history.length < 2) return;
    future.push(history.pop());
    restore(JSON.parse(history[history.length - 1]), false);
    updateActions();
    say('Undo.');
  }

  function redo() {
    if (!future.length) return;
    const next = future.pop();
    history.push(next);
    restore(JSON.parse(next), false);
    updateActions();
    say('Redo.');
  }

  function resetDesign(seed = null) {
    layers = seed ? seed : [];
    selected = null;
    history = [];
    future = [];
    snapshot();
    render();
    renderLayers();
  }

  function applyPreset(name) {
    if (name === 'blank') {
      baseColor = '#f1eee7';
      finish = 'matte';
      resetDesign([]);
      syncControls();
      say('Blank case ready.');
      return;
    }
    if (name === 'monogram') {
      baseColor = '#171719';
      finish = 'matte';
      const l = {
        id: uid(),
        type: 'text',
        name: 'V',
        text: 'V',
        fontFamily: 'Instrument Serif',
        fontWeight: 400,
        fontSize: 420,
        letterSpacing: 0,
        lineHeight: 1,
        align: 'center',
        color: '#f4f2ec',
        opacity: 1,
        visible: true,
        x: W / 2,
        y: H * 0.58,
        scale: 1,
        rotation: 0,
        w: 300,
        h: 420
      };
      measureTextLayer(ctx, l);
      resetDesign([l]);
      selected = l.id;
      syncControls();
      render();
      renderLayers();
      say('Monogram starter loaded.');
      return;
    }
    if (name === 'signal') {
      baseColor = '#f1eee7';
      finish = 'glossy';
      const bar = {
        id: uid(),
        type: 'stroke',
        name: 'Signal bar',
        color: '#9b1c2c',
        size: 120,
        opacity: 1,
        erase: false,
        visible: true,
        points: [{ x: 120, y: H * 0.72 }, { x: W - 120, y: H * 0.72 }]
      };
      const text = {
        id: uid(),
        type: 'text',
        name: 'VULCET',
        text: 'VULCET',
        fontFamily: 'Inter',
        fontWeight: 800,
        fontSize: 110,
        letterSpacing: 18,
        lineHeight: 1,
        align: 'center',
        color: '#121214',
        opacity: 1,
        visible: true,
        x: W / 2,
        y: H * 0.52,
        scale: 1,
        rotation: 0,
        w: 500,
        h: 110
      };
      measureTextLayer(ctx, text);
      resetDesign([bar, text]);
      selected = text.id;
      syncControls();
      applyFinishTo3D();
      render();
      renderLayers();
      say('Signal starter loaded.');
    }
  }

  $$('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  function downloadArtwork() {
    const out = document.createElement('canvas');
    out.width = 1800;
    out.height = 3600;
    const octx = out.getContext('2d');
    renderArtwork(octx, 2);
    const a = document.createElement('a');
    a.download = 'vulcet-case-studio-artwork.png';
    a.href = out.toDataURL('image/png');
    a.click();
    say('High-resolution artwork downloaded.');
  }

  function downloadMockup() {
    const out = document.createElement('canvas');
    const scale = 2;
    const pw = 980 * scale;
    const ph = 1960 * scale;
    out.width = pw + 280 * scale;
    out.height = ph + 280 * scale;
    const o = out.getContext('2d');
    o.fillStyle = '#d8d3c9';
    o.fillRect(0, 0, out.width, out.height);

    const ox = 140 * scale;
    const oy = 140 * scale;
    // soft shadow
    o.save();
    o.shadowColor = 'rgba(0,0,0,.28)';
    o.shadowBlur = 60 * scale;
    o.shadowOffsetY = 28 * scale;
    rounded(o, ox, oy, pw, ph, 110 * scale);
    o.fillStyle = baseColor;
    o.fill();
    o.restore();

    // case body with artwork
    o.save();
    rounded(o, ox, oy, pw, ph, 110 * scale);
    o.clip();
    const art = document.createElement('canvas');
    art.width = pw;
    art.height = ph;
    renderArtwork(art.getContext('2d'), (pw / W));
    o.drawImage(art, ox, oy);
    o.restore();

    // rim
    o.strokeStyle = 'rgba(0,0,0,.35)';
    o.lineWidth = 10 * scale;
    rounded(o, ox, oy, pw, ph, 110 * scale);
    o.stroke();

    // camera island
    o.fillStyle = '#121214';
    rounded(o, ox + 70 * scale, oy + 78 * scale, 340 * scale, 310 * scale, 82 * scale);
    o.fill();
    const lenses = [
      [ox + 130 * scale, oy + 130 * scale],
      [ox + 300 * scale, oy + 160 * scale],
      [ox + 170 * scale, oy + 290 * scale]
    ];
    lenses.forEach(([x, y]) => {
      o.beginPath();
      o.fillStyle = '#2a2a2e';
      o.arc(x, y, 52 * scale, 0, Math.PI * 2);
      o.fill();
      o.beginPath();
      o.fillStyle = '#070b12';
      o.arc(x, y, 36 * scale, 0, Math.PI * 2);
      o.fill();
    });

    const a = document.createElement('a');
    a.download = 'vulcet-case-studio-mockup.png';
    a.href = out.toDataURL('image/png');
    a.click();
    say('Phone mockup downloaded.');
  }

  $$('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'undo') undo();
      else if (action === 'redo') redo();
      else if (action === 'reset') {
        if (confirm('Reset the entire design?')) {
          baseColor = '#f1eee7';
          finish = 'matte';
          resetDesign([]);
          syncControls();
          applyFinishTo3D();
          say('Design reset.');
        }
      } else if (action === 'clear') {
        layers = [];
        selected = null;
        snapshot();
        render();
        renderLayers();
        say('Artwork cleared.');
      } else if (action === 'download') downloadArtwork();
      else if (action === 'download-mockup') downloadMockup();
      else mutate(action);
    });
  });

  $('#show-safe').addEventListener('change', (e) => {
    $('.safe-guide').hidden = !e.target.checked;
  });
  $('#show-bleed').addEventListener('change', (e) => {
    $('.bleed-guide').hidden = !e.target.checked;
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      mutate('delete');
    } else if (e.key === 'Escape') {
      selected = null;
      render();
      renderLayers();
    } else if (selected) {
      const l = layers.find((x) => x.id === selected);
      if (!l) return;
      const step = e.shiftKey ? 24 : 8;
      if (e.key === 'ArrowLeft') { l.x -= step; e.preventDefault(); snapshot(); render(); }
      if (e.key === 'ArrowRight') { l.x += step; e.preventDefault(); snapshot(); render(); }
      if (e.key === 'ArrowUp') { l.y -= step; e.preventDefault(); snapshot(); render(); }
      if (e.key === 'ArrowDown') { l.y += step; e.preventDefault(); snapshot(); render(); }
      if (e.key === ']' || e.key === '=') {
        l.scale = clamp((l.scale || 1) * 1.06, 0.08, 8);
        e.preventDefault();
        snapshot();
        render();
        renderSelectionControls();
      }
      if (e.key === '[' || e.key === '-') {
        l.scale = clamp((l.scale || 1) * 0.94, 0.08, 8);
        e.preventDefault();
        snapshot();
        render();
        renderSelectionControls();
      }
    }
  });

  function setMode(mode) {
    stage.dataset.view = mode;
    $$('.mode-button').forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('[data-design-hint]').hidden = mode !== 'design';
    $('[data-preview-hint]').hidden = mode !== 'preview';
    $('[data-view-controls]').hidden = mode !== 'preview';
    if (mode === 'preview') {
      updateTexture(true);
      resize3D();
    }
    say(mode === 'preview' ? '3D preview active. Drag to rotate.' : 'Design view active.');
  }

  $$('.mode-button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // Mobile panels
  $$('[data-open-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.openPanel;
      $$('.tools-panel, .layers-panel').forEach((p) => p.classList.toggle('is-open', p.id === id));
    });
  });
  $$('[data-close-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('aside')?.classList.remove('is-open');
    });
  });
  document.addEventListener('pointerdown', (e) => {
    if (innerWidth > 820) return;
    if (!e.target.closest('.tools-panel, .layers-panel, .mobile-panel-bar')) {
      $$('.tools-panel, .layers-panel').forEach((p) => p.classList.remove('is-open'));
    }
  });

  // ——— 3D ———
  let renderer, scene, camera, phone, caseTexture, caseRimMat, backMat, raf;
  let viewTarget = { x: 0.22, y: Math.PI - 0.55, z: 0 };
  let distance = 7.4;
  let pointer3D = null;

  function applyFinishTo3D() {
    if (!caseRimMat || !backMat) return;
    if (finish === 'glossy') {
      caseRimMat.roughness = 0.18;
      caseRimMat.clearcoat = 1;
      caseRimMat.clearcoatRoughness = 0.08;
      backMat.roughness = 0.22;
      backMat.clearcoat = 0.95;
      backMat.clearcoatRoughness = 0.12;
      backMat.emissiveIntensity = 0.1;
    } else {
      caseRimMat.roughness = 0.42;
      caseRimMat.clearcoat = 0.35;
      caseRimMat.clearcoatRoughness = 0.4;
      backMat.roughness = 0.48;
      backMat.clearcoat = 0.25;
      backMat.clearcoatRoughness = 0.45;
      backMat.emissiveIntensity = 0.08;
    }
  }

  function init3D() {
    const host = $('#preview-stage');
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.append(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0.15, distance);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a32, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 3.8);
      key.position.set(3.8, 5.2, 5.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xd7e4ff, 2.1);
      rim.position.set(-4.2, 1.2, -3.2);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0xfff0e4, 1.15);
      fill.position.set(0.5, -3.5, 2.8);
      scene.add(fill);

      // soft ground shadow disc
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(2.4, 64),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2.35;
      scene.add(ground);

      phone = new THREE.Group();
      scene.add(phone);
      buildPhone();

      renderer.domElement.addEventListener('pointerdown', (e) => {
        renderer.domElement.setPointerCapture(e.pointerId);
        pointer3D = { x: e.clientX, y: e.clientY };
      });
      renderer.domElement.addEventListener('pointermove', (e) => {
        if (!pointer3D) return;
        viewTarget.y += (e.clientX - pointer3D.x) * 0.009;
        viewTarget.x = clamp(viewTarget.x + (e.clientY - pointer3D.y) * 0.009, -1.15, 1.15);
        pointer3D = { x: e.clientX, y: e.clientY };
      });
      renderer.domElement.addEventListener('pointerup', () => { pointer3D = null; });
      renderer.domElement.addEventListener('pointercancel', () => { pointer3D = null; });
      renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        distance = clamp(distance + e.deltaY * 0.004, 5, 9.2);
      }, { passive: false });

      let pinch = 0;
      renderer.domElement.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          if (pinch) distance = clamp(distance + (pinch - d) * 0.012, 5, 9.2);
          pinch = d;
        }
      }, { passive: false });
      renderer.domElement.addEventListener('touchend', () => { pinch = 0; });

      resize3D();
      animate();
    } catch {
      $('.webgl-message').hidden = false;
      say('3D preview is unavailable in this browser.');
    }
  }

  function rrShape(w, h, r, cx = 0, cy = 0) {
    const s = new THREE.Shape();
    const x = cx - w / 2;
    const y = cy - h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function buildPhone() {
    const titanium = new THREE.MeshPhysicalMaterial({
      color: 0x7a7670,
      roughness: 0.26,
      metalness: 0.92,
      clearcoat: 0.35
    });
    const darkGlass = new THREE.MeshPhysicalMaterial({
      color: 0x05060a,
      roughness: 0.06,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.04
    });

    const bodyGeo = new THREE.ExtrudeGeometry(rrShape(2.02, 4.16, 0.268), {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.048,
      bevelThickness: 0.046
    });
    bodyGeo.center();
    const body = new THREE.Mesh(bodyGeo, titanium);
    body.castShadow = true;
    phone.add(body);

    const screen = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(1.9, 4.02, 0.23)), darkGlass);
    screen.position.z = 0.215;
    phone.add(screen);

    const islandFront = new THREE.Mesh(
      new THREE.ShapeGeometry(rrShape(0.52, 0.13, 0.065, 0, 1.62)),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    islandFront.position.z = 0.222;
    phone.add(islandFront);

    const buttonMat = new THREE.MeshStandardMaterial({ color: 0x6b6762, roughness: 0.22, metalness: 0.95 });
    [[-1.07, 0.9, 0.055, 0.34], [-1.07, 0.3, 0.055, 0.6], [1.07, 0.5, 0.055, 0.78], [-1.07, 1.38, 0.055, 0.2]].forEach(([x, y, w, h]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), buttonMat);
      b.position.set(x, y, 0.01);
      b.castShadow = true;
      phone.add(b);
    });

    const caseShape = rrShape(2.2, 4.32, 0.3);
    const hole = rrShape(0.86, 0.82, 0.2, -0.52, 1.42);
    caseShape.holes.push(hole);
    const geo = new THREE.ShapeGeometry(caseShape, 36);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + 1.1) / 2.2, (pos.getY(i) + 2.16) / 4.32);
    }

    renderTexture();
    caseTexture = new THREE.CanvasTexture(textureCanvas);
    caseTexture.colorSpace = THREE.SRGBColorSpace;
    caseTexture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());

    backMat = new THREE.MeshPhysicalMaterial({
      map: caseTexture,
      emissive: 0xffffff,
      emissiveMap: caseTexture,
      emissiveIntensity: 0.08,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
      side: THREE.DoubleSide
    });
    const back = new THREE.Mesh(geo, backMat);
    back.position.z = -0.2;
    back.rotation.y = Math.PI;
    back.castShadow = true;
    phone.add(back);

    const rimShape = rrShape(2.2, 4.32, 0.3);
    rimShape.holes.push(rrShape(2.0, 4.12, 0.24));
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.042
    });
    rimGeo.center();
    caseRimMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(baseColor),
      roughness: 0.42,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4
    });
    const rimMesh = new THREE.Mesh(rimGeo, caseRimMat);
    rimMesh.name = 'case-rim';
    rimMesh.position.z = -0.07;
    rimMesh.castShadow = true;
    phone.add(rimMesh);

    const islandGeo = new THREE.ExtrudeGeometry(rrShape(0.86, 0.82, 0.2), {
      depth: 0.08,
      bevelEnabled: true,
      bevelSize: 0.028,
      bevelThickness: 0.026,
      bevelSegments: 5
    });
    islandGeo.center();
    const cameraIsland = new THREE.Mesh(
      islandGeo,
      new THREE.MeshPhysicalMaterial({ color: 0x2c2c30, roughness: 0.22, metalness: 0.8, clearcoat: 0.5 })
    );
    cameraIsland.position.set(0.52, 1.42, -0.3);
    cameraIsland.rotation.y = Math.PI;
    phone.add(cameraIsland);

    const lensPositions = [[0.7, 1.61], [0.33, 1.5], [0.61, 1.22]];
    lensPositions.forEach(([x, y]) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.178, 0.08, 48), titanium);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, -0.365);
      phone.add(ring);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.138, 0.09, 48),
        new THREE.MeshPhysicalMaterial({
          color: 0x030711,
          roughness: 0.03,
          metalness: 0.55,
          clearcoat: 1,
          iridescence: 0.55,
          iridescenceIOR: 1.4
        })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, y, -0.41);
      phone.add(lens);
    });

    const flash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.025, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xfff4d1, emissive: 0xffe7a5, emissiveIntensity: 0.3, roughness: 0.18 })
    );
    flash.rotation.x = Math.PI / 2;
    flash.position.set(0.33, 1.22, -0.36);
    phone.add(flash);

    applyFinishTo3D();
    phone.rotation.set(viewTarget.x, viewTarget.y, 0);
  }

  function updateTexture(force = false) {
    if (!renderer || (!textureDirty && !force)) return;
    renderTexture();
    if (caseTexture) caseTexture.needsUpdate = true;
    if (caseRimMat) caseRimMat.color.set(baseColor);
    textureDirty = false;
  }

  function resize3D() {
    if (!renderer) return;
    const h = $('#preview-stage');
    const w = h.clientWidth || 600;
    const hh = h.clientHeight || 600;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
  }

  function animate() {
    raf = requestAnimationFrame(animate);
    if (!renderer) return;
    phone.rotation.x += (viewTarget.x - phone.rotation.x) * 0.09;
    phone.rotation.y += (viewTarget.y - phone.rotation.y) * 0.09;
    camera.position.z += (distance - camera.position.z) * 0.1;
    renderer.render(scene, camera);
  }

  $$('[data-view-controls] [data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      if (v === 'front') { viewTarget = { x: 0.05, y: 0, z: 0 }; distance = 7.2; }
      if (v === 'back') { viewTarget = { x: 0.12, y: Math.PI, z: 0 }; distance = 7.2; }
      if (v === 'angle') { viewTarget = { x: 0.28, y: Math.PI - 0.7, z: 0 }; distance = 7.6; }
      if (v === 'home') { viewTarget = { x: 0.22, y: Math.PI - 0.55, z: 0 }; distance = 7.4; }
    });
  });

  window.addEventListener('resize', () => {
    resize3D();
  });

  // boot
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      const data = JSON.parse(saved);
      history = [saved];
      restore(data, false);
      say('Welcome back — your last design was restored.');
    } else {
      applyPreset('signal');
      say('Ready — try a starter, or upload a photo and resize it with the corner handles.');
    }
  } catch {
    applyPreset('signal');
  }

  updateActions();
  init3D();
})();
