import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const W = 1170;
const H = 2532;
const STORE = 'vulcet-case-studio-v5';

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
let material = 'soft';
let gloss = 0.2;
let tool = 'brush';
let brushColor = '#f4f1ea';
let brushSize = 28;
let layers = [];
let selected = null;
let history = [];
let future = [];
let dirtyTex = true;
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
  material = data.material || 'soft';
  gloss = data.gloss ?? 0.2;
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

function paintFace(target, face, scale = 1) {
  const aw = W * scale;
  const ah = H * scale;
  if (artOff.width !== aw || artOff.height !== ah) {
    artOff.width = aw;
    artOff.height = ah;
  }
  const a = artOff.getContext('2d', { alpha: true });
  a.clearRect(0, 0, aw, ah);
  layers.filter((l) => (l.face || 'exterior') === face).forEach((l) => drawLayer(a, l, scale));

  target.clearRect(0, 0, aw, ah);
  target.fillStyle = faceColor(face);
  roundRect(target, 0, 0, aw, ah, 120 * scale);
  target.fill();

  target.save();
  roundRect(target, 0, 0, aw, ah, 120 * scale);
  target.clip();
  target.drawImage(artOff, 0, 0);
  target.restore();
  dirtyTex = true;
}

function render() {
  paintFace(exteriorTexCtx, 'exterior', 1);
  paintFace(interiorTexCtx, 'interior', 1);
  updateTexture();
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
      };
      list.appendChild(li);
    });
  };
  html($('#layerList'));
  html($('#layerListSide'));
}

function syncUI() {
  $$('#exteriorSwatches .swatch').forEach((b) => b.classList.toggle('is-on', b.dataset.color === exteriorColor));
  $$('#interiorSwatches .swatch').forEach((b) => b.classList.toggle('is-on', b.dataset.color === interiorColor));
  $$('.mat').forEach((b) => b.classList.toggle('is-on', b.dataset.mat === material));
  $$('.seg-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === tool));
  if ($('#brushSize')) $('#brushSize').value = brushSize;
  if ($('#brushSizeOut')) $('#brushSizeOut').textContent = String(brushSize);
  if ($('#brushColor')) $('#brushColor').value = brushColor;
  if ($('#gloss')) $('#gloss').value = Math.round(gloss * 100);
  if ($('#glossOut')) $('#glossOut').textContent = `${Math.round(gloss * 100)}%`;
  if ($('#finishSelect')) {
    $('#finishSelect').value = material === 'gloss' ? 'gloss' : material === 'matte' ? 'matte' : 'soft';
  }
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
      snapshot();
      render();
      renderLayers();
      say('Artwork stamped on exterior case.');
    };
    im.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function addPattern(index) {
  const amps = [34, 22, 40, 18];
  const base = exteriorColor;
  const layer = {
    id: uid(),
    type: 'pattern',
    face: 'exterior',
    name: `Pattern ${index + 1}`,
    color: '#f4f1ea',
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
  if (base === '#f4f1ea' || base === '#d8c3a8') layer.color = '#111111';
  layers.push(layer);
  selected = layer.id;
  snapshot();
  render();
  renderLayers();
  say('Pattern applied on exterior.');
}

function buildPatterns() {
  const grid = $('#patternGrid');
  if (!grid) return;
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
  const out = document.createElement('canvas');
  const gap = 80;
  out.width = W * 2 + gap;
  out.height = H;
  const c = out.getContext('2d');
  c.fillStyle = '#c5c8cf';
  c.fillRect(0, 0, out.width, out.height);
  const left = document.createElement('canvas');
  left.width = W;
  left.height = H;
  const right = document.createElement('canvas');
  right.width = W;
  right.height = H;
  paintFace(left.getContext('2d'), 'exterior', 1);
  paintFace(right.getContext('2d'), 'interior', 1);
  c.drawImage(left, 0, 0);
  c.drawImage(right, W + gap, 0);
  const a = document.createElement('a');
  a.download = `${($('#caseTitle').value || 'case').replace(/\s+/g, '-').toLowerCase()}-exterior-interior.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  say('Exported exterior + interior PNG.');
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
$('#fileInput2').onchange = (e) => { addImageFromFile(e.target.files[0]); e.target.value = ''; };

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
const PRODUCT_GLB = new URL('iphone-14-pro-leather-case.glb?v=3donly1', ASSET_BASE).href;

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
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function isLeatherCaseMesh(mesh) {
  const name = `${mesh.name || ''} ${mesh.parent?.name || ''}`.toLowerCase();
  return name.includes('leather') || (name.includes('case') && !/(iphone|ipohne|phone|glass|screen|body)/.test(name));
}

function makeCaseMat(map) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: map || null,
    roughness: 0.55,
    metalness: 0.05,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    side: THREE.FrontSide
  });
}

function ensureFaceTexture(face) {
  const isIn = face === 'interior';
  const off = isIn ? interiorTexOff : exteriorTexOff;
  const ctx2 = isIn ? interiorTexCtx : exteriorTexCtx;
  paintFace(ctx2, face, 1);
  let tex = isIn ? interiorTex : exteriorTex;
  if (!tex) {
    tex = new THREE.CanvasTexture(off);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = Math.min(16, renderer?.capabilities.getMaxAnisotropy?.() || 1);
    if (isIn) interiorTex = tex;
    else exteriorTex = tex;
  } else {
    tex.needsUpdate = true;
  }
  return tex;
}

function applyCaseTo3D() {
  if (!exteriorMat && !interiorMat) return;
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
    mat.needsUpdate = true;
  }
  dirtyTex = true;
  updateTexture(true);
}

function updateTexture(force = false) {
  if (!renderer || (!dirtyTex && !force)) return;
  const ext = ensureFaceTexture('exterior');
  const inn = ensureFaceTexture('interior');
  if (exteriorMat) {
    exteriorMat.map = ext;
    exteriorMat.needsUpdate = true;
  }
  if (interiorMat) {
    interiorMat.map = inn;
    interiorMat.needsUpdate = true;
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

function splitCaseByFacing(mesh) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  src.computeBoundingBox();
  const center = src.boundingBox.getCenter(new THREE.Vector3());
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const triCount = pos.count / 3;
  const extTris = [];
  const intTris = [];

  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    const ax = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const ay = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const az = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    if (nor) {
      nx = (nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2)) / 3;
      ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3;
      nz = (nor.getZ(i) + nor.getZ(i + 1) + nor.getZ(i + 2)) / 3;
    } else {
      const e1x = pos.getX(i + 1) - pos.getX(i);
      const e1y = pos.getY(i + 1) - pos.getY(i);
      const e1z = pos.getZ(i + 1) - pos.getZ(i);
      const e2x = pos.getX(i + 2) - pos.getX(i);
      const e2y = pos.getY(i + 2) - pos.getY(i);
      const e2z = pos.getZ(i + 2) - pos.getZ(i);
      nx = e1y * e2z - e1z * e2y;
      ny = e1z * e2x - e1x * e2z;
      nz = e1x * e2y - e1y * e2x;
    }
    const dot = nx * (ax - center.x) + ny * (ay - center.y) + nz * (az - center.z);
    (dot >= 0 ? extTris : intTris).push(t);
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
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  return {
    exterior: buildFromTris(extTris.length ? extTris : Array.from({ length: triCount }, (_, i) => i)),
    interior: buildFromTris(intTris.length ? intTris : [])
  };
}

function seatCaseOnPhone(product) {
  let phoneNode = null;
  let caseNode = null;
  product.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (!phoneNode && (n.includes('ipohne') || n.includes('iphone')) && !n.includes('leather')) phoneNode = o;
    if (!caseNode && n === 'leather case') caseNode = o;
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
  const caseSize = caseBox.getSize(new THREE.Vector3());

  const target = new THREE.Vector3(
    phoneCenter.x,
    phoneCenter.y,
    phoneBox.min.z - caseSize.z * 0.12
  );
  const localBefore = caseCenter.clone().applyMatrix4(inv);
  const localAfter = target.clone().applyMatrix4(inv);
  caseNode.position.add(localAfter.sub(localBefore));
}

function prepareProduct(sceneRoot) {
  caseMats = [];
  casePickMeshes = [];
  exteriorMat = null;
  interiorMat = null;
  updateTexture(true);

  exteriorMat = makeCaseMat(exteriorTex);
  interiorMat = makeCaseMat(interiorTex);
  exteriorMat.userData.face = 'exterior';
  interiorMat.userData.face = 'interior';
  caseMats = [exteriorMat, interiorMat];

  let caseCount = 0;
  const caseMeshes = [];
  sceneRoot.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (isLeatherCaseMesh(o)) {
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
    const { exterior, interior } = splitCaseByFacing(mesh);
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
    interiorMat.polygonOffsetFactor = 1;
    interiorMat.polygonOffsetUnits = 1;

    parent.add(exteriorMesh);
    parent.add(interiorMesh);
    casePickMeshes.push(exteriorMesh, interiorMesh);
    mesh.visible = false;
    mesh.geometry.dispose?.();
  }

  if (!caseCount) throw new Error('Leather case mesh not found in product GLB');

  seatCaseOnPhone(sceneRoot);
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
  return {
    x: clamp(uv.x, 0, 1) * W,
    y: (1 - clamp(uv.y, 0, 1)) * H
  };
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
  } else if (paintStroke.face === face) {
    paintStroke.points.push(pt);
  } else {
    return false;
  }
  render();
  return true;
}

function bindViewportPointer(el) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    el.setPointerCapture(e.pointerId);

    if (orbitLocked && (tool === 'brush' || tool === 'eraser')) {
      const hit = hitCase(e.clientX, e.clientY);
      if (hit) {
        paintAtHit(hit);
        renderLayers();
        return;
      }
      say('Aim at the leather case to draw');
      return;
    }

    dragging3d = { x: e.clientX, y: e.clientY };
  });

  el.addEventListener('pointermove', (e) => {
    if (painting && orbitLocked) {
      const hit = hitCase(e.clientX, e.clientY);
      if (hit) paintAtHit(hit);
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
      snapshot();
      renderLayers();
      say('Stroke saved on case');
    }
    dragging3d = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('wheel', (e) => {
    if (orbitLocked) return;
    e.preventDefault();
    dist = clamp(dist + e.deltaY * 0.004, 5.2, 9.5);
  }, { passive: false });
}

async function init3D() {
  if (!previewHost || previewHost.querySelector('canvas')) return;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
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
buildPatterns();
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
