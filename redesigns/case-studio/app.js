import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 1170;
const H = 2532;
const STORE = 'vulcet-case-studio-v7';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const statusEl = $('#status');
const savePill = $('#savePill');
const previewHost = $('#previewHost');
const lockBtn = $('#lockOrbit');

let exteriorColor = '#1a1a1c';
let interiorColor = '#1a1a1c';
let tool = 'brush';
let brushColor = '#f4f1ea';
let brushSize = 28;
let layers = [];
let selected = null;
let history = [];
let future = [];
let saveTimer = 0;
let orbitLocked = false;

const artOff = document.createElement('canvas');
const exteriorTexOff = document.createElement('canvas');
const interiorTexOff = document.createElement('canvas');
artOff.width = exteriorTexOff.width = interiorTexOff.width = W;
artOff.height = exteriorTexOff.height = interiorTexOff.height = H;
const exteriorTexCtx = exteriorTexOff.getContext('2d', { alpha: false });
const interiorTexCtx = interiorTexOff.getContext('2d', { alpha: false });

function faceColor(face) {
  return face === 'interior' ? interiorColor : exteriorColor;
}

function say(msg) {
  if (statusEl) statusEl.textContent = msg;
}
function markSaved(ok = true) {
  savePill.textContent = ok ? 'Saved' : 'Saving…';
  savePill.style.color = ok ? '#2f8f57' : '#8a6d1d';
  savePill.style.background = ok ? '#e8f7ee' : '#fff6da';
}

function serial() {
  return {
    exteriorColor,
    interiorColor,
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
  const u = $('[data-act=undo]');
  const r = $('[data-act=redo]');
  if (u) u.disabled = history.length < 2;
  if (r) r.disabled = !future.length;
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
  exteriorColor = data.exteriorColor || data.caseColor || '#1a1a1c';
  interiorColor = data.interiorColor || data.caseColor || '#1a1a1c';
  if (data.title) $('#caseTitle').value = data.title;
  layers = (data.layers || []).map((l) => ({
    ...l,
    face: l.face === 'interior' ? 'interior' : 'exterior'
  }));
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
    c.fillStyle = l.color || '#f4f1ea';
    c.font = `700 ${l.fontSize || 120}px Inter, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    String(l.text || 'Text').split('\n').forEach((line, i, arr) => {
      const lh = (l.fontSize || 120) * 1.1;
      c.fillText(line, 0, (i - (arr.length - 1) / 2) * lh);
    });
  } else if (l.type === 'pattern') {
    c.fillStyle = l.color || '#f4f1ea';
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

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function paintFace(target, face, scale = 1, excludeId = null) {
  const aw = W * scale;
  const ah = H * scale;
  if (artOff.width !== aw || artOff.height !== ah) {
    artOff.width = aw;
    artOff.height = ah;
  }
  const a = artOff.getContext('2d', { alpha: true });
  a.clearRect(0, 0, aw, ah);
  layers
    .filter((l) => (l.face || 'exterior') === face && l.id !== excludeId)
    .forEach((l) => drawLayer(a, l, scale));

  target.clearRect(0, 0, aw, ah);
  target.fillStyle = faceColor(face);
  target.fillRect(0, 0, aw, ah);
  target.drawImage(artOff, 0, 0);
}

let paintRaf = 0;
let dirtyFaces = { exterior: false, interior: false };
const liveBase = document.createElement('canvas');
liveBase.width = W;
liveBase.height = H;
const liveBaseCtx = liveBase.getContext('2d', { alpha: false });
let liveMode = null; // null | 'stroke' | 'move'
let liveFace = 'exterior';
let liveExcludeId = null;
let pendingPtr = null;
let interactRaf = 0;
let wheelLiveTimer = 0;

function schedulePaint(face) {
  if (liveMode) return; // live path owns the canvas until gesture ends
  if (face === 'exterior' || face === 'both') dirtyFaces.exterior = true;
  if (face === 'interior' || face === 'both') dirtyFaces.interior = true;
  if (paintRaf) return;
  paintRaf = requestAnimationFrame(() => {
    paintRaf = 0;
    flushPaint();
  });
}

function flushPaint() {
  if (dirtyFaces.exterior) {
    paintFace(exteriorTexCtx, 'exterior', 1);
    if (exteriorTex) exteriorTex.needsUpdate = true;
  }
  if (dirtyFaces.interior) {
    paintFace(interiorTexCtx, 'interior', 1);
    if (interiorTex) interiorTex.needsUpdate = true;
  }
  dirtyFaces.exterior = dirtyFaces.interior = false;
}

function render(face = 'both') {
  schedulePaint(face);
}

function faceTexCtx(face) {
  return face === 'interior' ? interiorTexCtx : exteriorTexCtx;
}
function faceTex(face) {
  return face === 'interior' ? interiorTex : exteriorTex;
}
function markFaceTex(face) {
  const tex = faceTex(face);
  if (tex) tex.needsUpdate = true;
}

function beginLiveStroke(face, strokeId) {
  liveMode = 'stroke';
  liveFace = face;
  liveExcludeId = strokeId;
  paintFace(liveBaseCtx, face, 1, strokeId);
  const ctx = faceTexCtx(face);
  ctx.drawImage(liveBase, 0, 0);
  markFaceTex(face);
}

function drawStrokeDab(stroke, from, to) {
  const ctx = faceTexCtx(stroke.face);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.size;
  if (stroke.erase) {
    // Fast eraser: paint face colour over artwork (good enough while dragging)
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = faceColor(stroke.face);
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
  markFaceTex(stroke.face);
}

function beginLiveMove(face, layerId) {
  liveMode = 'move';
  liveFace = face;
  liveExcludeId = layerId;
  paintFace(liveBaseCtx, face, 1, layerId);
  const ctx = faceTexCtx(face);
  ctx.drawImage(liveBase, 0, 0);
  markFaceTex(face);
}

function liveMoveTick(layer) {
  const face = layer.face || 'exterior';
  if (face !== liveFace) beginLiveMove(face, layer.id);
  const ctx = faceTexCtx(face);
  ctx.drawImage(liveBase, 0, 0);
  drawLayer(ctx, layer, 1);
  markFaceTex(face);
}

function endLive() {
  const face = liveFace;
  liveMode = null;
  liveExcludeId = null;
  dirtyFaces[face] = true;
  flushPaint();
}

function renderLayers() {
  const html = (list) => {
    if (!list) return;
    list.innerHTML = '';
    [...layers].reverse().forEach((l, i) => {
      const li = document.createElement('li');
      li.className = `layer-item${l.id === selected ? ' is-on' : ''}`;
      const kind = l.type === 'image' ? 'IMG' : l.type === 'text' ? 'TXT' : l.type === 'pattern' ? 'ART' : l.erase ? 'ER' : 'BR';
      const thumb = l.type === 'image' && l.src ? `<img src="${l.src}" alt="">` : kind;
      const faceTag = (l.face || 'exterior') === 'interior' ? 'inside' : 'outside';
      li.innerHTML = `<span class="thumb">${thumb}</span><span><strong>${esc(l.name || 'Layer')}</strong><small>${faceTag} · ${l.type} · ${layers.length - i}</small></span>`;
      li.onclick = () => {
        selected = l.id;
        renderLayers();
        syncTransform(l);
        if (['image', 'text', 'pattern'].includes(l.type)) {
          placingArtwork = false;
          say('Layer selected · Lock, then drag on case to move · or use sliders');
        }
      };
      list.appendChild(li);
    });
  };
  html($('#layerList'));
  html($('#layerListSide'));
  const l = layers.find((x) => x.id === selected);
  if (l && ['image', 'text', 'pattern'].includes(l.type)) syncTransform(l);
  else {
    if ($('#transformHelp')) $('#transformHelp').hidden = false;
    if ($('#transformControls')) $('#transformControls').hidden = true;
  }
}

function syncTransform(l) {
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  if ($('#transformHelp')) $('#transformHelp').hidden = true;
  if ($('#transformControls')) $('#transformControls').hidden = false;
  if ($('#posXRange')) {
    $('#posXRange').value = Math.round((l.x / W) * 100);
    $('#posXOut').textContent = `${Math.round((l.x / W) * 100)}%`;
  }
  if ($('#posYRange')) {
    $('#posYRange').value = Math.round((l.y / H) * 100);
    $('#posYOut').textContent = `${Math.round((l.y / H) * 100)}%`;
  }
  if ($('#scaleRange')) {
    $('#scaleRange').value = Math.round((l.scale || 1) * 100);
    $('#scaleOut').textContent = `${Math.round((l.scale || 1) * 100)}%`;
  }
  if ($('#rotRange')) {
    const deg = Math.round(((l.rotation || 0) * 180) / Math.PI);
    $('#rotRange').value = deg;
    $('#rotOut').textContent = `${deg}°`;
  }
}

function syncUI() {
  $$('#exteriorSwatches .swatch').forEach((b) => b.classList.toggle('is-on', b.dataset.color === exteriorColor));
  $$('#interiorSwatches .swatch').forEach((b) => b.classList.toggle('is-on', b.dataset.color === interiorColor));
  $$('.seg-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === tool));
  if ($('#brushSize')) $('#brushSize').value = brushSize;
  if ($('#brushSizeOut')) $('#brushSizeOut').textContent = String(brushSize);
  if ($('#brushColor')) $('#brushColor').value = brushColor;
  setOrbitLocked(orbitLocked, false);
}

function setPanel(name) {
  $$('.rail-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.panel === name));
  $$('.panel-view').forEach((v) => v.classList.toggle('is-on', v.dataset.view === name));
  if (name === 'draw') tool = 'brush';
  syncUI();
}

function setOrbitLocked(on, announce = true) {
  orbitLocked = !!on;
  if (lockBtn) {
    lockBtn.classList.toggle('is-on', orbitLocked);
    lockBtn.setAttribute('aria-pressed', orbitLocked ? 'true' : 'false');
    lockBtn.textContent = orbitLocked ? 'Locked' : 'Lock';
  }
  previewHost?.classList.toggle('is-locked', orbitLocked);
  if (announce) {
    say(orbitLocked
      ? 'Scene locked · draw on the leather case'
      : 'Unlocked · drag to orbit · Lock before drawing');
  }
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
      const ratio = Math.min((W * 0.72) / im.width, (H * 0.4) / im.height);
      const layer = {
        id: uid(),
        type: 'image',
        face: 'exterior',
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
      tool = 'select';
      placingArtwork = true;
      setOrbitLocked(true);
      snapshot();
      render();
      renderLayers();
      syncTransform(layer);
      say('Photo added · drag on the locked case to place it');
    };
    im.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function addPattern(index) {
  // Patterns removed with Artwork panel — keep no-op for safety.
}

function buildPatterns() {
  // no-op
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
    const copy = { ...l, id: uid(), name: `${l.name} copy`, x: (l.x || 0) + 30, y: (l.y || 0) + 30 };
    if (l.image) copy.image = l.image;
    if (l.points) copy.points = l.points.map((p) => ({ ...p }));
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
  if (!renderer || !scene || !camera || !root) {
    say('3D view not ready yet');
    return;
  }
  flushPaint();
  // Snap orbit/camera instantly so the export matches what you see.
  root.rotation.x = orbit.x;
  root.rotation.y = orbit.y;
  camera.position.z = dist;
  camera.updateProjectionMatrix();

  const host = previewHost;
  const cssW = Math.max(2, host?.clientWidth || 800);
  const cssH = Math.max(2, host?.clientHeight || 600);
  const exportScale = Math.min(2.5, 1800 / Math.max(cssW, cssH));
  const prevSize = new THREE.Vector2();
  renderer.getSize(prevSize);
  const prevPR = renderer.getPixelRatio();

  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(cssW * exportScale), Math.round(cssH * exportScale), false);
  camera.aspect = cssW / cssH;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const url = renderer.domElement.toDataURL('image/png');

  renderer.setPixelRatio(prevPR);
  renderer.setSize(prevSize.x, prevSize.y, false);
  resize3D();
  renderer.render(scene, camera);

  const side =
    Math.abs(((orbit.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) < 0.55
      ? 'back'
      : Math.abs(((orbit.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) < 0.55
        ? 'front'
        : 'view';
  const a = document.createElement('a');
  a.download = `${($('#caseTitle').value || 'case').replace(/\s+/g, '-').toLowerCase()}-${side}.png`;
  a.href = url;
  a.click();
  say(`Exported ${side} photo from current 3D view`);
}

// ——— UI ———
$$('.rail-btn').forEach((b) => b.addEventListener('click', () => setPanel(b.dataset.panel)));
$$('[data-act]').forEach((b) => b.addEventListener('click', () => {
  const act = b.dataset.act;
  if (act === 'undo') undo();
  else if (act === 'redo') redo();
  else if (act === 'export') exportPNG();
  else mutate(act);
}));

$$('#exteriorSwatches .swatch, #interiorSwatches .swatch').forEach((b) => b.addEventListener('click', () => {
  const target = b.closest('.swatches')?.dataset.target || 'exterior';
  if (target === 'interior') interiorColor = b.dataset.color;
  else exteriorColor = b.dataset.color;
  syncUI();
  snapshot();
  render();
  applyCaseTo3D();
}));

$$('.seg-btn').forEach((b) => b.addEventListener('click', () => {
  tool = b.dataset.tool;
  placingArtwork = false;
  syncUI();
  setPanel('draw');
  if (!orbitLocked) {
    setOrbitLocked(true);
    say('Locked for drawing · unlock to orbit again');
  }
}));

$('#brushColor').oninput = (e) => { brushColor = e.target.value; };
$('#brushSize').oninput = (e) => {
  brushSize = +e.target.value;
  $('#brushSizeOut').textContent = String(brushSize);
};
$('#caseTitle').oninput = () => scheduleSave();

$('#addTextBtn').onclick = () => {
  const text = ($('#textInput').value || 'VULCET').trim();
  const fontSize = clamp(+$('#textSize').value || 120, 40, 280);
  const layer = {
    id: uid(),
    type: 'text',
    face: 'exterior',
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
  measureText(exteriorTexCtx, layer);
  layers.push(layer);
  selected = layer.id;
  snapshot();
  render();
  renderLayers();
  say('Text stamped on exterior case.');
};

$('#fileInput').onchange = (e) => { addImageFromFile(e.target.files[0]); e.target.value = ''; };

$('#scaleRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.scale = +e.target.value / 100;
  $('#scaleOut').textContent = `${e.target.value}%`;
  render(l.face || 'exterior');
});
$('#posXRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.x = (+e.target.value / 100) * W;
  $('#posXOut').textContent = `${e.target.value}%`;
  render(l.face || 'exterior');
});
$('#posYRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.y = (+e.target.value / 100) * H;
  $('#posYOut').textContent = `${e.target.value}%`;
  render(l.face || 'exterior');
});
$('#rotRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.rotation = (+e.target.value * Math.PI) / 180;
  $('#rotOut').textContent = `${e.target.value}°`;
  render(l.face || 'exterior');
});
['posXRange', 'posYRange', 'scaleRange', 'rotRange'].forEach((id) => {
  $(`#${id}`)?.addEventListener('change', () => snapshot());
});

$('#placeOnCaseBtn')?.addEventListener('click', () => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) {
    say('Select a photo or text layer first');
    return;
  }
  placingArtwork = true;
  setOrbitLocked(true);
  tool = 'select';
  syncUI();
  say('Locked · click/drag on the case to place artwork');
});

lockBtn?.addEventListener('click', () => setOrbitLocked(!orbitLocked));

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
    e.preventDefault();
    mutate('delete');
  } else if (e.key.toLowerCase() === 'l') {
    setOrbitLocked(!orbitLocked);
  }
});

// ——— 3D ———
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
const PRODUCT_GLB = new URL('iphone-14-pro-leather-case.glb?v=fix2', ASSET_BASE).href;

let renderer, scene, camera, root, phoneSize;
let exteriorTex = null;
let interiorTex = null;
let exteriorMat = null;
let interiorMat = null;
let caseMats = [];
let casePickMeshes = [];
let orbit = { x: 0.18, y: Math.PI };
let dist = 7.3;
let dragging3d = null;
let painting = false;
let paintStroke = null;
let placingArtwork = false;
let draggingArtwork = false;
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function isLeatherCaseMesh(mesh) {
  const name = `${mesh.name || ''} ${mesh.parent?.name || ''}`.toLowerCase();
  return name.includes('leather') || (name.includes('case') && !/(iphone|ipohne|phone|glass|screen|body)/.test(name));
}

function makeCaseMat(map) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: map || null,
    roughness: 0.55,
    metalness: 0.04,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    side: THREE.FrontSide
  });
  // Never keep Sketchfab leather photo maps on the case.
  mat.normalMap = null;
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.aoMap = null;
  mat.emissiveMap = null;
  return mat;
}

function ensureFaceTexture(face) {
  const isIn = face === 'interior';
  const off = isIn ? interiorTexOff : exteriorTexOff;
  let tex = isIn ? interiorTex : exteriorTex;
  if (!tex) {
    // Ensure canvas has content before first upload
    paintFace(isIn ? interiorTexCtx : exteriorTexCtx, face, 1);
    tex = new THREE.CanvasTexture(off);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy?.() || 1);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (isIn) interiorTex = tex;
    else exteriorTex = tex;
  } else {
    tex.needsUpdate = true;
  }
  return tex;
}

function applyCaseTo3D() {
  if (!exteriorMat && !interiorMat) return;
  // Fixed soft-case finish (Material / Finish UI removed).
  if (exteriorMat) {
    exteriorMat.color.set(0xffffff);
    exteriorMat.roughness = 0.55;
    exteriorMat.clearcoat = 0.28;
    exteriorMat.clearcoatRoughness = 0.42;
    exteriorMat.needsUpdate = true;
  }
  if (interiorMat) {
    interiorMat.color.set(0xffffff);
    interiorMat.roughness = 0.72;
    interiorMat.clearcoat = 0.1;
    interiorMat.clearcoatRoughness = 0.55;
    interiorMat.needsUpdate = true;
  }
  // Colour lives in the baked canvases — refresh both faces.
  schedulePaint('both');
}

function updateTexture(force = false) {
  if (!renderer) return;
  if (force) {
    dirtyFaces.exterior = dirtyFaces.interior = true;
    flushPaint();
  } else {
    schedulePaint('both');
  }
  if (exteriorMat) {
    exteriorMat.map = ensureFaceTexture('exterior');
    exteriorMat.needsUpdate = true;
  }
  if (interiorMat) {
    interiorMat.map = ensureFaceTexture('interior');
    interiorMat.needsUpdate = true;
  }
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

function splitCaseByFacing(mesh, phoneCenterWorld) {
  // Exterior = faces looking away from the phone (outer back + outer sides).
  // Interior = faces looking toward the phone (cavity + inner side walls).
  // Requires the case to already be seated around the phone.
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.updateMatrixWorld(true);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const pos = src.attributes.position;
  const triCount = pos.count / 3;
  const extTris = [];
  const intTris = [];
  const cLocal = new THREE.Vector3();
  const cWorld = new THREE.Vector3();
  const nLocal = new THREE.Vector3();
  const nWorld = new THREE.Vector3();
  const toPhone = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    cLocal.set(
      (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
      (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    );
    cWorld.copy(cLocal).applyMatrix4(mesh.matrixWorld);

    const e1x = pos.getX(i + 1) - pos.getX(i);
    const e1y = pos.getY(i + 1) - pos.getY(i);
    const e1z = pos.getZ(i + 1) - pos.getZ(i);
    const e2x = pos.getX(i + 2) - pos.getX(i);
    const e2y = pos.getY(i + 2) - pos.getY(i);
    const e2z = pos.getZ(i + 2) - pos.getZ(i);
    nLocal.set(
      e1y * e2z - e1z * e2y,
      e1z * e2x - e1x * e2z,
      e1x * e2y - e1y * e2x
    );
    if (nLocal.lengthSq() < 1e-20) {
      extTris.push(t);
      continue;
    }
    nLocal.normalize();
    nWorld.copy(nLocal).applyMatrix3(normalMatrix).normalize();
    toPhone.copy(phoneCenterWorld).sub(cWorld);
    // Strict: only clearly inward-facing faces are interior.
    // Outer side walls face away from the phone → exterior.
    (nWorld.dot(toPhone) > 0 ? intTris : extTris).push(t);
  }

  function buildFromTris(tris) {
    const g = new THREE.BufferGeometry();
    const attrs = Object.keys(src.attributes);
    for (const name of attrs) {
      const attr = src.attributes[name];
      const itemSize = attr.itemSize;
      const array = new attr.array.constructor(Math.max(1, tris.length) * 3 * itemSize);
      let w = 0;
      for (const t of tris) {
        const base = t * 3;
        for (let v = 0; v < 3; v++) {
          const vi = base + v;
          for (let c = 0; c < itemSize; c++) array[w++] = attr.array[vi * itemSize + c];
        }
      }
      g.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
    }
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (g.attributes.uv2) g.deleteAttribute('uv2');
    if (g.attributes.TEXCOORD_1) g.deleteAttribute('TEXCOORD_1');
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  if (!extTris.length && intTris.length) {
    return {
      exterior: buildFromTris(intTris),
      interior: buildFromTris([])
    };
  }

  return {
    exterior: buildFromTris(extTris.length ? extTris : Array.from({ length: triCount }, (_, i) => i)),
    interior: buildFromTris(intTris)
  };
}

function seatCaseOnPhone(product) {
  let phoneNode = null;
  let caseNode = null;
  product.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (!phoneNode && (n.includes('ipohne') || n.includes('iphone')) && !n.includes('leather')) phoneNode = o;
    // Sketchfab node is "Leather_Case" (underscore), not "leather case".
    if (!caseNode && !o.isMesh && n.includes('leather') && n.includes('case')) caseNode = o;
  });
  if (!phoneNode || !caseNode) return;

  product.updateMatrixWorld(true);
  const parent = caseNode.parent || product;
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();

  const phoneBox = new THREE.Box3().setFromObject(phoneNode);
  const caseBox = new THREE.Box3().setFromObject(caseNode);
  const phoneCenter = phoneBox.getCenter(new THREE.Vector3());
  const caseCenter = caseBox.getCenter(new THREE.Vector3());
  const phoneSize = phoneBox.getSize(new THREE.Vector3());
  const caseSize = caseBox.getSize(new THREE.Vector3());

  // Asset ships with phone + case side-by-side. Nest the case onto the phone:
  // match centres on the two long axes; bias slightly on the thin (depth) axis
  // so the phone sits in the cavity (screen / +thin side stays open).
  const axes = [
    { key: 'x', p: phoneSize.x, c: caseSize.x },
    { key: 'y', p: phoneSize.y, c: caseSize.y },
    { key: 'z', p: phoneSize.z, c: caseSize.z }
  ].sort((a, b) => a.p - b.p);
  const thin = axes[0].key;
  const target = phoneCenter.clone();
  const overhang = Math.max(0, caseSize[thin] - phoneSize[thin]);
  target[thin] = phoneCenter[thin] - overhang * 0.25;

  const localBefore = caseCenter.clone().applyMatrix4(inv);
  const localAfter = target.clone().applyMatrix4(inv);
  caseNode.position.add(localAfter.sub(localBefore));
}

function prepareProduct(sceneRoot) {
  caseMats = [];
  casePickMeshes = [];
  exteriorMat = null;
  interiorMat = null;

  // Seat case onto phone BEFORE splitting so "toward phone" classification is correct.
  seatCaseOnPhone(sceneRoot);
  sceneRoot.updateMatrixWorld(true);

  let phoneNode = null;
  sceneRoot.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (!phoneNode && (n.includes('ipohne') || n.includes('iphone')) && !n.includes('leather')) phoneNode = o;
  });
  const phoneCenterWorld = new THREE.Vector3();
  if (phoneNode) {
    new THREE.Box3().setFromObject(phoneNode).getCenter(phoneCenterWorld);
  }

  paintFace(exteriorTexCtx, 'exterior', 1);
  paintFace(interiorTexCtx, 'interior', 1);
  exteriorMat = makeCaseMat(ensureFaceTexture('exterior'));
  interiorMat = makeCaseMat(ensureFaceTexture('interior'));
  exteriorMat.userData.face = 'exterior';
  interiorMat.userData.face = 'interior';
  caseMats = [exteriorMat, interiorMat];

  let caseCount = 0;
  const caseMeshes = [];
  sceneRoot.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (isLeatherCaseMesh(o) && !o.name.includes('_Exterior') && !o.name.includes('_Interior')) {
      caseMeshes.push(o);
      return;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      m.needsUpdate = true;
    });
  });

  for (const mesh of caseMeshes) {
    caseCount += 1;
    if (mesh.geometry && !mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
    const { exterior, interior } = splitCaseByFacing(mesh, phoneCenterWorld);
    const parent = mesh.parent || sceneRoot;

    const exteriorMesh = new THREE.Mesh(exterior, exteriorMat);
    exteriorMesh.name = `${mesh.name || 'Leather'}_Exterior`;
    exteriorMesh.userData.face = 'exterior';
    exteriorMesh.castShadow = true;
    exteriorMesh.receiveShadow = true;
    exteriorMesh.position.copy(mesh.position);
    exteriorMesh.quaternion.copy(mesh.quaternion);
    exteriorMesh.scale.copy(mesh.scale);

    const interiorMesh = new THREE.Mesh(interior, interiorMat);
    interiorMesh.name = `${mesh.name || 'Leather'}_Interior`;
    interiorMesh.userData.face = 'interior';
    interiorMesh.castShadow = true;
    interiorMesh.receiveShadow = true;
    interiorMesh.position.copy(mesh.position);
    interiorMesh.quaternion.copy(mesh.quaternion);
    interiorMesh.scale.copy(mesh.scale);
    interiorMesh.renderOrder = 1;
    interiorMat.polygonOffset = true;
    interiorMat.polygonOffsetFactor = -1;
    interiorMat.polygonOffsetUnits = -1;

    parent.add(exteriorMesh);
    parent.add(interiorMesh);
    casePickMeshes.push(exteriorMesh, interiorMesh);
    mesh.visible = false;
  }

  if (!caseCount) throw new Error('Leather case mesh not found in product GLB');

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
  if (!renderer || !camera || !previewHost) return;
  const stageEl = $('#stage');
  const w = Math.max(2, previewHost.clientWidth || stageEl?.clientWidth || 800);
  const h = Math.max(2, previewHost.clientHeight || stageEl?.clientHeight || 600);
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
  $$('.view-angles button[data-cam]').forEach((b) => b.classList.toggle('is-on', b.dataset.cam === name));
  if (name === 'front') { orbit = { x: 0.05, y: 0 }; dist = 7.3; }
  if (name === 'back') { orbit = { x: 0.18, y: Math.PI }; dist = 7.3; }
  if (name === 'angle') { orbit = { x: 0.32, y: Math.PI - 0.7 }; dist = 7.8; }
}

function hitCase(clientX, clientY) {
  if (!renderer || !camera || !casePickMeshes.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(casePickMeshes, false);
  return hits[0] || null;
}

function uvToCanvas(uv) {
  // glTF UV: v=0 at bottom. CanvasTexture flipY=true → canvas top is v=1.
  return {
    x: clamp(uv.x, 0, 1) * W,
    y: (1 - clamp(uv.y, 0, 1)) * H
  };
}

function moveSelectedToUv(hit) {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type) || !hit?.uv) return false;
  const face = hit.object?.userData?.face === 'interior' ? 'interior' : 'exterior';
  const pt = uvToCanvas(hit.uv);
  if (liveMode !== 'move') beginLiveMove(face, l.id);
  l.face = face;
  l.x = pt.x;
  l.y = pt.y;
  liveMoveTick(l);
  return true;
}

function paintAtHit(hit) {
  if (!hit?.uv) return false;
  const face = hit.object?.userData?.face === 'interior' ? 'interior' : 'exterior';
  const pt = uvToCanvas(hit.uv);
  if (!painting || !paintStroke) {
    painting = true;
    paintStroke = {
      id: uid(),
      type: 'stroke',
      face,
      name: tool === 'eraser' ? 'Eraser' : 'Brush',
      color: brushColor,
      size: brushSize,
      erase: tool === 'eraser',
      visible: true,
      opacity: 1,
      points: [pt]
    };
    layers.push(paintStroke);
    selected = paintStroke.id;
    beginLiveStroke(face, paintStroke.id);
    drawStrokeDab(paintStroke, pt, { x: pt.x + 0.01, y: pt.y });
    return true;
  }
  if (paintStroke.face !== face) return false;
  const last = paintStroke.points[paintStroke.points.length - 1];
  if (Math.hypot(pt.x - last.x, pt.y - last.y) < 0.8) return true;
  paintStroke.points.push(pt);
  drawStrokeDab(paintStroke, last, pt);
  return true;
}

function queuePointer(e, kind) {
  pendingPtr = { x: e.clientX, y: e.clientY, kind };
  if (interactRaf) return;
  interactRaf = requestAnimationFrame(() => {
    interactRaf = 0;
    const p = pendingPtr;
    pendingPtr = null;
    if (!p) return;
    if (p.kind === 'paint' && painting) {
      const hit = hitCase(p.x, p.y);
      if (hit) paintAtHit(hit);
    } else if (p.kind === 'move' && draggingArtwork) {
      const hit = hitCase(p.x, p.y);
      if (hit) moveSelectedToUv(hit);
    }
  });
}

function bindViewportPointer(el) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    el.setPointerCapture(e.pointerId);

    if (orbitLocked) {
      const hit = hitCase(e.clientX, e.clientY);
      const sel = layers.find((x) => x.id === selected);

      if (placingArtwork || (sel && ['image', 'text', 'pattern'].includes(sel.type) && tool !== 'brush' && tool !== 'eraser')) {
        if (hit && moveSelectedToUv(hit)) {
          draggingArtwork = true;
          placingArtwork = true;
          return;
        }
      }

      if (tool === 'brush' || tool === 'eraser') {
        if (hit) {
          paintAtHit(hit);
          return;
        }
        say('Aim at the leather case to draw');
        return;
      }
    }

    dragging3d = { x: e.clientX, y: e.clientY };
  });

  el.addEventListener('pointermove', (e) => {
    if (orbitLocked && draggingArtwork) {
      queuePointer(e, 'move');
      return;
    }
    if (painting && orbitLocked) {
      queuePointer(e, 'paint');
      return;
    }
    if (!dragging3d || orbitLocked) return;
    orbit.y += (e.clientX - dragging3d.x) * 0.009;
    orbit.x = clamp(orbit.x + (e.clientY - dragging3d.y) * 0.009, -1.1, 1.1);
    dragging3d = { x: e.clientX, y: e.clientY };
  });

  const end = () => {
    if (painting) {
      painting = false;
      paintStroke = null;
      endLive();
      snapshot();
      renderLayers();
      say('Stroke saved on case');
    }
    if (draggingArtwork) {
      const l = layers.find((x) => x.id === selected);
      draggingArtwork = false;
      placingArtwork = false;
      endLive();
      if (l) syncTransform(l);
      snapshot();
      renderLayers();
      say('Artwork moved on case');
    }
    dragging3d = null;
    pendingPtr = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('wheel', (e) => {
    const sel = layers.find((x) => x.id === selected);
    if (orbitLocked && sel && ['image', 'text', 'pattern'].includes(sel.type)) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.09;
      sel.scale = clamp((sel.scale || 1) * factor, 0.05, 6);
      if (liveMode !== 'move') beginLiveMove(sel.face || 'exterior', sel.id);
      liveMoveTick(sel);
      syncTransform(sel);
      clearTimeout(wheelLiveTimer);
      wheelLiveTimer = setTimeout(() => {
        if (liveMode === 'move' && !draggingArtwork) {
          endLive();
          snapshot();
        }
      }, 200);
      return;
    }
    if (orbitLocked) return;
    e.preventDefault();
    dist = clamp(dist + e.deltaY * 0.004, 5.2, 9.5);
  }, { passive: false });
}

async function init3D() {
  if (!previewHost || previewHost.querySelector('canvas')) return;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0xf0f2f5, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    previewHost.append(renderer.domElement);

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
    bindViewportPointer(el);

    $$('.view-angles button[data-cam]').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));

    resize3D();
    animate();
    window.addEventListener('resize', resize3D);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => resize3D());
      ro.observe(previewHost);
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
    prepareProduct(product);
    root.add(product);
    framePhone(phoneSize);
    root.rotation.set(orbit.x, orbit.y, 0);
    applyCaseTo3D();
    resize3D();
    say('3D only · orbit free, then Lock and draw on the case');
  } catch (err) {
    console.error(err);
    say('Could not load 3D model.');
  }
}

// boot
setPanel('draw');
setCam('back');
setOrbitLocked(false, false);

(async () => {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      history = [saved];
      await restore(JSON.parse(saved), false);
      say('Welcome back — last design restored.');
    } else {
      layers = [];
      history = [JSON.stringify(serial())];
      future = [];
      updateUndo();
    }
  } catch {
    layers = [];
    history = [JSON.stringify(serial())];
    future = [];
  }
  syncUI();
  render();
  await init3D();
})();
