import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 1170;
const H = 2532;
const STORE = 'vulcet-case-studio-v3';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const canvas = $('#art');
const ctx = canvas.getContext('2d', { alpha: false });
const statusEl = $('#status');
const stage = $('#stage');
const savePill = $('#savePill');

let caseColor = '#1a1a1c';
let material = 'soft';
let gloss = 0.2;
let tool = 'brush';
let brushColor = '#111111';
let brushSize = 16;
let mode = 'preview'; // design | preview
let layers = [];
let selected = null;
let drawing = false;
let dragging = false;
let xform = null; // { type: 'scale'|'rotate', ... }
let last = null;
let history = [];
let future = [];
let dirtyTex = true;
let saveTimer = 0;

const artOff = document.createElement('canvas');
const texOff = document.createElement('canvas');
artOff.width = texOff.width = W;
artOff.height = texOff.height = H;
const texCtx = texOff.getContext('2d', { alpha: false });

function say(msg) {
  statusEl.textContent = msg;
}
function markSaved(ok = true) {
  savePill.textContent = ok ? 'Saved' : 'Saving…';
  savePill.style.color = ok ? '#2f8f57' : '#8a6d1d';
  savePill.style.background = ok ? '#e8f7ee' : '#fff6da';
}

function serial() {
  return {
    caseColor,
    material,
    gloss,
    title: $('#caseTitle').value,
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
  updateUndo();
  scheduleSave();
}

function scheduleSave() {
  markSaved(false);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(serial()));
      markSaved(true);
    } catch {
      say('Design too large for browser storage — export to keep it.');
    }
  }, 280);
}

function updateUndo() {
  $('[data-act=undo]').disabled = history.length < 2;
  $('[data-act=redo]').disabled = !future.length;
}

async function loadImages(list) {
  await Promise.all(list.filter((l) => l.type === 'image' && l.src).map((l) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { l.image = im; res(); };
    im.onerror = res;
    im.src = l.src;
  })));
}

async function restore(data, announce = true) {
  caseColor = data.caseColor || '#1a1a1c';
  material = data.material || 'soft';
  gloss = data.gloss ?? 0.2;
  if (data.title) $('#caseTitle').value = data.title;
  layers = (data.layers || []).map((l) => ({ ...l }));
  selected = null;
  await loadImages(layers);
  syncUI();
  render();
  renderLayers();
  applyCaseTo3D();
  if (announce) say('Design restored.');
}

function measureText(c, l) {
  c.save();
  c.font = `700 ${l.fontSize || 120}px Inter, sans-serif`;
  const lines = String(l.text || 'Text').split('\n');
  l.w = Math.max(40, ...lines.map((t) => c.measureText(t).width));
  l.h = Math.max(l.fontSize || 120, lines.length * (l.fontSize || 120) * 1.1);
  c.restore();
}

function drawLayer(c, l, s = 1) {
  if (l.visible === false) return;
  c.save();
  c.globalAlpha = l.opacity ?? 1;
  if (l.type === 'stroke') {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = l.erase ? '#000' : l.color;
    c.globalCompositeOperation = l.erase ? 'destination-out' : 'source-over';
    c.lineWidth = l.size * s;
    c.beginPath();
    l.points.forEach((p, i) => {
      const x = p.x * s;
      const y = p.y * s;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    if (l.points.length === 1) c.lineTo(l.points[0].x * s + 0.1, l.points[0].y * s);
    c.stroke();
  } else if (l.type === 'image' && l.image) {
    c.translate(l.x * s, l.y * s);
    c.rotate(l.rotation || 0);
    const w = l.w * l.scale * s;
    const h = l.h * l.scale * s;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(l.image, -w / 2, -h / 2, w, h);
  } else if (l.type === 'text') {
    measureText(c, l);
    c.translate(l.x * s, l.y * s);
    c.rotate(l.rotation || 0);
    c.scale(l.scale * s, l.scale * s);
    c.fillStyle = l.color || '#111';
    c.font = `700 ${l.fontSize || 120}px Inter, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    String(l.text || 'Text').split('\n').forEach((line, i, arr) => {
      const lh = (l.fontSize || 120) * 1.1;
      c.fillText(line, 0, (i - (arr.length - 1) / 2) * lh);
    });
  } else if (l.type === 'pattern') {
    c.fillStyle = l.color || '#111';
    // simple wave pattern fill clipped later by case
    const step = l.step || 90;
    c.translate(l.x * s, l.y * s);
    c.rotate(l.rotation || 0);
    c.scale(l.scale * s, l.scale * s);
    c.beginPath();
    for (let y = -H; y < H * 2; y += step) {
      c.moveTo(-W, y);
      for (let x = -W; x <= W * 2; x += 40) {
        c.quadraticCurveTo(x + 20, y + (l.amp || 28) * Math.sin((x + y) * 0.01), x + 40, y);
      }
      c.lineTo(W * 2, y + step);
      c.lineTo(-W, y + step);
      c.closePath();
    }
    c.fill();
  }
  c.restore();
}

function paintCase(target, scale = 1) {
  const aw = W * scale;
  const ah = H * scale;
  if (artOff.width !== aw || artOff.height !== ah) {
    artOff.width = aw;
    artOff.height = ah;
  }
  const a = artOff.getContext('2d', { alpha: true });
  a.clearRect(0, 0, aw, ah);
  layers.forEach((l) => drawLayer(a, l, scale));

  target.clearRect(0, 0, aw, ah);
  target.fillStyle = caseColor;
  roundRect(target, 0, 0, aw, ah, 120 * scale);
  target.fill();

  target.save();
  roundRect(target, 0, 0, aw, ah, 120 * scale);
  target.clip();
  target.drawImage(artOff, 0, 0);
  target.restore();

  // camera hole
  target.save();
  target.globalCompositeOperation = 'destination-out';
  roundRect(target, 70 * scale, 90 * scale, 400 * scale, 360 * scale, 90 * scale);
  target.fill();
  target.restore();
  dirtyTex = true;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function layerSize(l) {
  if (l.type === 'text') measureText(ctx, l);
  if (l.type === 'pattern') return { w: (l.w || 900) * (l.scale || 1), h: (l.h || 900) * (l.scale || 1) };
  return { w: (l.w || 100) * (l.scale || 1), h: (l.h || 100) * (l.scale || 1) };
}

function toLocal(p, l) {
  const dx = p.x - l.x;
  const dy = p.y - l.y;
  const co = Math.cos(-(l.rotation || 0));
  const si = Math.sin(-(l.rotation || 0));
  return { x: dx * co - dy * si, y: dx * si + dy * co };
}

function hitRadius() {
  const r = canvas.getBoundingClientRect();
  return Math.max(40, (16 * W) / Math.max(1, r.width));
}

function handles(l) {
  const { w, h } = layerSize(l);
  return {
    w,
    h,
    corners: [
      { id: 'nw', x: -w / 2, y: -h / 2, cursor: 'nwse-resize' },
      { id: 'ne', x: w / 2, y: -h / 2, cursor: 'nesw-resize' },
      { id: 'se', x: w / 2, y: h / 2, cursor: 'nwse-resize' },
      { id: 'sw', x: -w / 2, y: h / 2, cursor: 'nesw-resize' }
    ],
    rotate: { id: 'rotate', x: 0, y: -h / 2 - 70, cursor: 'grab' }
  };
}

function hitHandle(p, l) {
  if (!['image', 'text', 'pattern'].includes(l.type) || l.visible === false) return null;
  const local = toLocal(p, l);
  const { corners, rotate } = handles(l);
  const r = hitRadius();
  for (const c of corners) if (Math.hypot(local.x - c.x, local.y - c.y) <= r) return c;
  if (Math.hypot(local.x - rotate.x, local.y - rotate.y) <= r) return rotate;
  return null;
}

function hitObject(p, l) {
  if (!['image', 'text', 'pattern'].includes(l.type) || l.visible === false) return false;
  const local = toLocal(p, l);
  const { w, h } = layerSize(l);
  return Math.abs(local.x) <= w / 2 && Math.abs(local.y) <= h / 2;
}

function drawSelection() {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type) || l.visible === false) return;
  const { w, h, corners, rotate } = handles(l);
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.rotation || 0);
  ctx.strokeStyle = '#2f6bff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(rotate.x, rotate.y);
  ctx.stroke();
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.setLineDash([]);
  corners.forEach((c) => {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#2f6bff';
    ctx.lineWidth = 3;
    ctx.fillRect(c.x - 12, c.y - 12, 24, 24);
    ctx.strokeRect(c.x - 12, c.y - 12, 24, 24);
  });
  ctx.beginPath();
  ctx.arc(rotate.x, rotate.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#2f6bff';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function render() {
  paintCase(ctx, 1);
  drawSelection();
  updateTexture();
}

function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * W) / r.width,
    y: ((e.clientY - r.top) * H) / r.height
  };
}

canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'design') return;
  canvas.setPointerCapture(e.pointerId);
  const p = point(e);
  const cur = layers.find((x) => x.id === selected);

  if (cur && ['image', 'text', 'pattern'].includes(cur.type)) {
    const h = hitHandle(p, cur);
    if (h) {
      xform = {
        type: h.id === 'rotate' ? 'rotate' : 'scale',
        scale: cur.scale || 1,
        rotation: cur.rotation || 0,
        angle: Math.atan2(p.y - cur.y, p.x - cur.x),
        local: toLocal(p, cur)
      };
      last = p;
      render();
      return;
    }
  }

  const hit = [...layers].reverse().find((l) => hitObject(p, l));
  if (hit) {
    selected = hit.id;
    dragging = true;
    last = p;
    tool = 'select';
    syncUI();
    render();
    renderLayers();
    say('Drag to move · corners to resize · top handle to rotate.');
    return;
  }

  if (tool === 'brush' || tool === 'eraser') {
    selected = null;
    drawing = true;
    const stroke = {
      id: uid(),
      type: 'stroke',
      name: tool === 'eraser' ? 'Eraser' : 'Brush',
      color: brushColor,
      size: brushSize,
      erase: tool === 'eraser',
      visible: true,
      opacity: 1,
      points: [p]
    };
    layers.push(stroke);
    selected = stroke.id;
    render();
    renderLayers();
    return;
  }

  selected = null;
  render();
  renderLayers();
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'design') return;
  const p = point(e);
  if (drawing) {
    layers[layers.length - 1].points.push(p);
    render();
    return;
  }
  const l = layers.find((x) => x.id === selected);
  if (!l) return;

  if (xform?.type === 'scale') {
    const local = toLocal(p, l);
    const start = Math.hypot(xform.local.x, xform.local.y) || 1;
    const now = Math.hypot(local.x, local.y) || 1;
    l.scale = clamp(xform.scale * (now / start), 0.08, 6);
    render();
    syncTransform(l);
    return;
  }
  if (xform?.type === 'rotate') {
    const ang = Math.atan2(p.y - l.y, p.x - l.x);
    l.rotation = xform.rotation + (ang - xform.angle);
    render();
    syncTransform(l);
    return;
  }
  if (dragging) {
    l.x += p.x - last.x;
    l.y += p.y - last.y;
    last = p;
    render();
  }
});

const endPointer = () => {
  if (drawing || dragging || xform) {
    drawing = false;
    dragging = false;
    xform = null;
    last = null;
    snapshot();
    renderLayers();
  }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', (e) => {
  if (mode !== 'design') return;
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  e.preventDefault();
  l.scale = clamp((l.scale || 1) * (e.deltaY > 0 ? 0.94 : 1.06), 0.08, 6);
  render();
  syncTransform(l);
  scheduleSave();
}, { passive: false });

function renderLayers() {
  const html = (list) => {
    list.innerHTML = '';
    [...layers].reverse().forEach((l, i) => {
      const li = document.createElement('li');
      li.className = `layer-item${l.id === selected ? ' is-on' : ''}`;
      const kind = l.type === 'image' ? 'IMG' : l.type === 'text' ? 'TXT' : l.type === 'pattern' ? 'ART' : l.erase ? 'ER' : 'BR';
      const thumb = l.type === 'image' && l.src ? `<img src="${l.src}" alt="">` : kind;
      li.innerHTML = `<span class="thumb">${thumb}</span><span><strong>${esc(l.name || 'Layer')}</strong><small>${l.type} · ${layers.length - i}</small></span>`;
      li.onclick = () => {
        selected = l.id;
        render();
        renderLayers();
        syncTransform(l);
      };
      list.appendChild(li);
    });
  };
  html($('#layerList'));
  html($('#layerListSide'));
  const l = layers.find((x) => x.id === selected);
  if (l && ['image', 'text', 'pattern'].includes(l.type)) syncTransform(l);
  else {
    $('#transformHelp').hidden = false;
    $('#transformControls').hidden = true;
  }
}

function syncTransform(l) {
  $('#transformHelp').hidden = true;
  $('#transformControls').hidden = false;
  $('#scaleRange').value = Math.round((l.scale || 1) * 100);
  $('#scaleOut').textContent = `${Math.round((l.scale || 1) * 100)}%`;
  const deg = Math.round(((l.rotation || 0) * 180) / Math.PI);
  $('#rotRange').value = deg;
  $('#rotOut').textContent = `${deg}°`;
}

function syncUI() {
  $$('.swatch').forEach((b) => b.classList.toggle('is-on', b.dataset.color === caseColor));
  $$('.mat').forEach((b) => b.classList.toggle('is-on', b.dataset.mat === material));
  $$('.seg-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === tool));
  $('#brushSize').value = brushSize;
  $('#brushSizeOut').textContent = String(brushSize);
  $('#gloss').value = Math.round(gloss * 100);
  $('#glossOut').textContent = `${Math.round(gloss * 100)}%`;
  $('#finishSelect').value = material === 'gloss' ? 'gloss' : material === 'matte' ? 'matte' : 'soft';
  $$('.rail-btn').forEach((b) => {
    // keep panel highlight separate from draw tool
  });
}

function setMode(next) {
  mode = next;
  stage.dataset.mode = next;
  $$('.view-toggle button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === next));
  if (next === 'preview') {
    updateTexture(true);
    resize3D();
    say('3D preview · drag to orbit');
  } else {
    say('2D design · draw, upload, transform');
  }
}

function setPanel(name) {
  $$('.rail-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.panel === name));
  $$('.panel-view').forEach((v) => v.classList.toggle('is-on', v.dataset.view === name));
  if (name === 'draw') tool = 'brush';
  if (name === 'select') tool = 'select';
  syncUI();
}

function addImageFromFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    say('Use PNG, JPG or WebP.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const im = new Image();
    im.onload = () => {
      const ratio = Math.min((W * 0.78) / im.width, (H * 0.42) / im.height);
      const layer = {
        id: uid(),
        type: 'image',
        name: file.name.slice(0, 28),
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
      layers.push(layer);
      selected = layer.id;
      setMode('design');
      setPanel('select');
      snapshot();
      render();
      renderLayers();
      say('Artwork added · drag and resize on the case.');
    };
    im.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function addPattern(index) {
  const colors = ['#111111', '#f4f1ea', '#111111', '#f4f1ea'];
  const amps = [34, 22, 40, 18];
  const layer = {
    id: uid(),
    type: 'pattern',
    name: `Pattern ${index + 1}`,
    color: colors[index % 4],
    amp: amps[index % 4],
    step: 70 + index * 12,
    x: W / 2,
    y: H / 2,
    w: W,
    h: H,
    scale: 1,
    rotation: index % 2 ? 0.15 : -0.08,
    opacity: 1,
    visible: true
  };
  // For dark case use light waves and vice versa
  if (caseColor === '#1a1a1c' || caseColor === '#2f4a3a') layer.color = '#f4f1ea';
  else layer.color = '#111111';
  layers.push(layer);
  selected = layer.id;
  setMode('design');
  snapshot();
  render();
  renderLayers();
  say('Pattern applied.');
}

function buildPatterns() {
  const grid = $('#patternGrid');
  for (let i = 0; i < 4; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pattern';
    btn.title = `Pattern ${i + 1}`;
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = i % 2 ? '#111' : '#f3f1ea';
    g.fillRect(0, 0, 180, 180);
    g.fillStyle = i % 2 ? '#f3f1ea' : '#111';
    g.beginPath();
    for (let y = -20; y < 220; y += 28) {
      g.moveTo(0, y);
      for (let x = 0; x <= 180; x += 20) g.quadraticCurveTo(x + 10, y + 12 * Math.sin((x + y) * 0.05), x + 20, y);
      g.lineTo(180, y + 28);
      g.lineTo(0, y + 28);
      g.closePath();
    }
    g.fill();
    btn.appendChild(c);
    btn.onclick = () => addPattern(i);
    grid.appendChild(btn);
  }
}

function mutate(act) {
  const i = layers.findIndex((l) => l.id === selected);
  if (i < 0) return;
  const l = layers[i];
  if (act === 'delete') {
    layers.splice(i, 1);
    selected = null;
  }
  if (act === 'duplicate') {
    const copy = { ...l, id: uid(), name: `${l.name} copy`, x: l.x + 30, y: l.y + 30 };
    if (l.image) copy.image = l.image;
    layers.splice(i + 1, 0, copy);
    selected = copy.id;
  }
  if (act === 'forward' && i < layers.length - 1) {
    layers.splice(i, 1);
    layers.splice(i + 1, 0, l);
  }
  if (act === 'backward' && i > 0) {
    layers.splice(i, 1);
    layers.splice(i - 1, 0, l);
  }
  snapshot();
  render();
  renderLayers();
}

function undo() {
  if (history.length < 2) return;
  future.push(history.pop());
  restore(JSON.parse(history[history.length - 1]), false);
  updateUndo();
  say('Undo');
}
function redo() {
  if (!future.length) return;
  const next = future.pop();
  history.push(next);
  restore(JSON.parse(next), false);
  updateUndo();
  say('Redo');
}

function exportPNG() {
  const out = document.createElement('canvas');
  out.width = W * 2;
  out.height = H * 2;
  paintCase(out.getContext('2d'), 2);
  const a = document.createElement('a');
  a.download = `${($('#caseTitle').value || 'case').replace(/\s+/g, '-').toLowerCase()}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  say('Exported PNG.');
}

// ——— UI bindings ———
$$('.rail-btn').forEach((b) => b.addEventListener('click', () => setPanel(b.dataset.panel)));
$$('.view-toggle button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$$('[data-act]').forEach((b) => b.addEventListener('click', () => {
  const act = b.dataset.act;
  if (act === 'undo') undo();
  else if (act === 'redo') redo();
  else if (act === 'export') exportPNG();
  else mutate(act);
}));

$$('.swatch').forEach((b) => b.addEventListener('click', () => {
  caseColor = b.dataset.color;
  syncUI();
  snapshot();
  render();
  applyCaseTo3D();
}));

$$('.mat').forEach((b) => b.addEventListener('click', () => {
  material = b.dataset.mat;
  if (material === 'gloss') gloss = 0.85;
  if (material === 'matte') gloss = 0.12;
  if (material === 'soft' || material === 'grain') gloss = 0.22;
  syncUI();
  snapshot();
  applyCaseTo3D();
}));

$$('.seg-btn').forEach((b) => b.addEventListener('click', () => {
  tool = b.dataset.tool;
  syncUI();
  setMode('design');
}));

$('#brushColor').oninput = (e) => { brushColor = e.target.value; };
$('#brushSize').oninput = (e) => {
  brushSize = +e.target.value;
  $('#brushSizeOut').textContent = String(brushSize);
};
$('#gloss').oninput = (e) => {
  gloss = +e.target.value / 100;
  $('#glossOut').textContent = `${e.target.value}%`;
  applyCaseTo3D();
};
$('#finishSelect').onchange = (e) => {
  material = e.target.value === 'gloss' ? 'gloss' : e.target.value === 'matte' ? 'matte' : 'soft';
  syncUI();
  applyCaseTo3D();
  snapshot();
};
$('#scaleRange').oninput = (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l) return;
  l.scale = +e.target.value / 100;
  $('#scaleOut').textContent = `${e.target.value}%`;
  render();
};
$('#scaleRange').onchange = () => snapshot();
$('#rotRange').oninput = (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l) return;
  l.rotation = (+e.target.value * Math.PI) / 180;
  $('#rotOut').textContent = `${e.target.value}°`;
  render();
};
$('#rotRange').onchange = () => snapshot();
$('#caseTitle').oninput = () => scheduleSave();

$('#addTextBtn').onclick = () => {
  const text = ($('#textInput').value || 'VULCET').trim();
  const fontSize = clamp(+$('#textSize').value || 120, 40, 280);
  const layer = {
    id: uid(),
    type: 'text',
    name: text.split('\n')[0].slice(0, 24),
    text,
    fontSize,
    color: $('#textColor').value,
    x: W / 2,
    y: H * 0.55,
    scale: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    w: 400,
    h: fontSize
  };
  measureText(ctx, layer);
  layers.push(layer);
  selected = layer.id;
  setMode('design');
  setPanel('select');
  snapshot();
  render();
  renderLayers();
  say('Text added.');
};

$('#fileInput').onchange = (e) => { addImageFromFile(e.target.files[0]); e.target.value = ''; };
$('#fileInput2').onchange = (e) => { addImageFromFile(e.target.files[0]); e.target.value = ''; };

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
    e.preventDefault();
    mutate('delete');
  }
});

// ——— 3D ———
// Must be an absolute URL — `new URL(rel, '/path/...')` throws Invalid URL in browsers.
const ASSET_BASE = (() => {
  const path = window.location.pathname;
  const marker = '/case-studio';
  const i = path.indexOf(marker);
  if (i !== -1) {
    const root = `${path.slice(0, i + marker.length).replace(/\/?$/, '/')}`;
    return new URL(`${root}assets/`, window.location.origin).href;
  }
  return new URL('./assets/', window.location.href).href;
})();
const PRODUCT_GLB = new URL('iphone-14-pro-leather-case.glb?v=leather2', ASSET_BASE).href;

let renderer, scene, camera, root, caseTex, caseMat, phoneSize;
let caseMats = [];
let orbit = { x: 0.28, y: Math.PI - 0.55 };
let dist = 7.6;
let dragging3d = null;

function isLeatherCaseMesh(mesh) {
  const name = `${mesh.name || ''} ${mesh.parent?.name || ''}`.toLowerCase();
  return name.includes('leather') || (name.includes('case') && !/(iphone|ipohne|phone|glass|screen|body)/.test(name));
}

function applyCaseTo3D() {
  if (!caseMats.length && !caseMat) return;
  const g = material === 'gloss' ? Math.max(gloss, 0.7) : gloss;
  const roughness = clamp(1 - g, 0.08, 0.85);
  const clearcoat = material === 'gloss' ? 1 : material === 'soft' ? 0.35 : 0.15;
  const clearcoatRoughness = material === 'gloss' ? 0.08 : 0.4;

  for (const mat of caseMats) {
    mat.color.set(0xffffff);
    mat.roughness = roughness;
    if ('clearcoat' in mat) {
      mat.clearcoat = clearcoat;
      mat.clearcoatRoughness = clearcoatRoughness;
    }
    if (caseTex) {
      mat.map = caseTex;
      if ('emissiveMap' in mat) {
        mat.emissiveMap = caseTex;
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = 0.04;
      }
    }
    mat.needsUpdate = true;
  }
  if (caseTex) caseTex.needsUpdate = true;
  // Re-bake canvas so caseColor changes show on the textured case
  dirtyTex = true;
  updateTexture(true);
}

function updateTexture(force = false) {
  if (!renderer || (!dirtyTex && !force)) return;
  if (texOff.width !== W) {
    texOff.width = W;
    texOff.height = H;
  }
  paintCase(texCtx, 1);
  if (!caseTex) {
    caseTex = new THREE.CanvasTexture(texOff);
    caseTex.colorSpace = THREE.SRGBColorSpace;
    caseTex.flipY = false;
    caseTex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  } else {
    caseTex.needsUpdate = true;
  }
  for (const mat of caseMats) {
    mat.map = caseTex;
    if ('emissiveMap' in mat) mat.emissiveMap = caseTex;
    mat.needsUpdate = true;
  }
  if (caseMat) {
    caseMat.map = caseTex;
    if ('emissiveMap' in caseMat) caseMat.emissiveMap = caseTex;
    caseMat.needsUpdate = true;
  }
  dirtyTex = false;
}

function fit(obj, targetH = 4.1) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  if (size.y > 1e-6) obj.scale.multiplyScalar(targetH / size.y);
  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.sub(box2.getCenter(new THREE.Vector3()));
  obj.updateMatrixWorld(true);
  return box2.getSize(new THREE.Vector3());
}

function loadGltf(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function prepareProduct(sceneRoot) {
  caseMats = [];
  caseMat = null;
  updateTexture(true);

  const artMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: caseTex || null,
    emissive: 0xffffff,
    emissiveMap: caseTex || null,
    emissiveIntensity: 0.04,
    roughness: 0.55,
    metalness: 0.05,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    side: THREE.DoubleSide
  });
  artMat.userData.isArt = true;
  caseMats.push(artMat);
  caseMat = artMat;

  let caseCount = 0;
  sceneRoot.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (isLeatherCaseMesh(o)) {
      caseCount += 1;
      if (o.geometry && !o.geometry.getAttribute('normal')) {
        o.geometry.computeVertexNormals();
      }
      // Artwork / design maps ONLY onto the leather case — never the phone.
      o.material = artMat;
      return;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      m.needsUpdate = true;
    });
  });

  if (!caseCount) {
    throw new Error('Leather case mesh not found in product GLB');
  }

  phoneSize = fit(sceneRoot, 4.1);
  return caseCount;
}

function framePhone(size) {
  const maxDim = Math.max(size.x, size.y, size.z || 0.2);
  dist = clamp(maxDim * 1.9, 5.6, 10);
  camera.position.set(0, size.y * 0.04, dist);
  camera.near = 0.05;
  camera.far = 80;
  camera.updateProjectionMatrix();
}

function resize3D() {
  if (!renderer || !camera) return;
  const host = $('#previewHost');
  const stageEl = $('#stage');
  const w = Math.max(
    2,
    host.clientWidth || stageEl?.clientWidth || host.parentElement?.clientWidth || 800
  );
  const h = Math.max(
    2,
    host.clientHeight || stageEl?.clientHeight || host.parentElement?.clientHeight || 600
  );
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !root || !camera) return;
  root.rotation.x += (orbit.x - root.rotation.x) * 0.1;
  root.rotation.y += (orbit.y - root.rotation.y) * 0.1;
  camera.position.z += (dist - camera.position.z) * 0.1;
  renderer.render(scene, camera);
}

function setCam(name) {
  $$('.view-angles button').forEach((b) => b.classList.toggle('is-on', b.dataset.cam === name));
  if (name === 'front') { orbit = { x: 0.05, y: 0 }; dist = 7.3; }
  if (name === 'back') { orbit = { x: 0.18, y: Math.PI }; dist = 7.3; }
  if (name === 'angle') { orbit = { x: 0.32, y: Math.PI - 0.7 }; dist = 7.8; }
}

async function init3D() {
  const host = $('#previewHost');
  if (!host || host.querySelector('canvas')) return;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0xf0f2f5, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.append(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f2f5);
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.12, dist);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a44, 1.65));
    const key = new THREE.DirectionalLight(0xffffff, 3.8);
    key.position.set(3.5, 5, 5.5);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd7e4ff, 2.2);
    rim.position.set(-4, 1, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xfff0e4, 1.25);
    fill.position.set(0.5, -3.2, 2.5);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    scene.add(ground);

    root = new THREE.Group();
    scene.add(root);

    const el = renderer.domElement;
    el.style.display = 'block';
    el.style.width = '100%';
    el.style.height = '100%';
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      dragging3d = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging3d) return;
      orbit.y += (e.clientX - dragging3d.x) * 0.009;
      orbit.x = clamp(orbit.x + (e.clientY - dragging3d.y) * 0.009, -1.1, 1.1);
      dragging3d = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', () => { dragging3d = null; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      dist = clamp(dist + e.deltaY * 0.004, 5.2, 9.5);
    }, { passive: false });

    $$('.view-angles button').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));

    resize3D();
    animate();
    window.addEventListener('resize', resize3D);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => resize3D());
      ro.observe(host);
      const stageEl = $('#stage');
      if (stageEl) ro.observe(stageEl);
    }
    requestAnimationFrame(() => {
      resize3D();
      requestAnimationFrame(resize3D);
    });

    say('Loading iPhone 14 Pro + leather case…');
    const loader = new GLTFLoader();
    const productGltf = await loadGltf(loader, PRODUCT_GLB);

    while (root.children.length) root.remove(root.children[0]);
    const product = productGltf.scene;
    product.name = 'iphone-14-pro-leather-case';
    const caseCount = prepareProduct(product);
    root.add(product);
    framePhone(phoneSize);
    root.rotation.set(orbit.x, orbit.y, 0);
    applyCaseTo3D();
    resize3D();
    say(`Leather case ready · artwork on case only (${caseCount}) · Front = screen · Back = case`);
  } catch (err) {
    console.error(err);
    say('Could not load 3D model.');
  }
}

// boot
buildPatterns();
setPanel('artwork');
setMode('preview');
setCam('angle');

(async () => {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      history = [saved];
      await restore(JSON.parse(saved), false);
      say('Welcome back — last design restored.');
    } else {
      addPattern(0);
      // addPattern already snapshots; trim to one baseline
      history = [JSON.stringify(serial())];
      future = [];
      updateUndo();
    }
  } catch {
    layers = [];
    addPattern(0);
  }
  syncUI();
  render();
  await init3D();
})();
