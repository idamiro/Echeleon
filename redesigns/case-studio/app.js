import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  ZONE,
  ARTWORK_ZONES,
  EDITABLE_ZONES,
  OUTER_EDGE_ZONES,
  ZONE_LABELS,
  DEBUG_ZONE_COLORS,
  splitCaseBySurfaces,
  isArtworkEditableZone,
  isEditableZone,
  migrateLayerSurface
} from './surfaces.js';

const W = 1170;
const H = 2532;
const STORE = 'vulcet-case-studio-v8';
const LEGACY_STORE = 'vulcet-case-studio-v7';
const caseDebug = new URLSearchParams(window.location.search).get('caseDebug') === '1';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const statusEl = $('#status');
const savePill = $('#savePill');
const previewHost = $('#previewHost');
const lockBtn = $('#lockOrbit');

let backExteriorColor = '#1a1a1c';
let outerEdgeColor = '#1a1a1c';
let interiorColor = '#1a1614';
let material = 'soft';
let gloss = 0.2;
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
artOff.width = W;
artOff.height = H;

const zoneCanvas = {};
const zoneCtx = {};
for (const z of ARTWORK_ZONES) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  zoneCanvas[z] = c;
  zoneCtx[z] = c.getContext('2d', { alpha: false });
}

function zoneBaseColor(zone) {
  if (OUTER_EDGE_ZONES.has(zone)) return outerEdgeColor;
  if (zone === ZONE.INTERIOR) return interiorColor;
  if (zone === ZONE.CAMERA_LIP) return backExteriorColor;
  if (zone === ZONE.BEVEL) return outerEdgeColor;
  return backExteriorColor;
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
    backExteriorColor,
    outerEdgeColor,
    interiorColor,
    material,
    gloss,
    title: $('#caseTitle').value,
    layers: layers.map((l) => {
      const o = { ...l };
      delete o.image;
      delete o._sampleCanvas;
      delete o._sampleCtx;
      delete o._sampleData;
      delete o.livePreview;
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
  const legacy = data.exteriorColor || data.caseColor || '#1a1a1c';
  backExteriorColor = data.backExteriorColor || legacy;
  outerEdgeColor = data.outerEdgeColor
    || data.leftOuterColor
    || data.rightOuterColor
    || backExteriorColor
    || legacy;
  interiorColor = data.interiorColor || '#1a1614';
  material = data.material || 'soft';
  gloss = data.gloss ?? 0.2;
  if (data.title) $('#caseTitle').value = data.title;
  layers = (data.layers || []).map(migrateLayerSurface).filter(Boolean);
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
  if (l.type === 'image' && l.useProjection) {
    stampProjectedImage(c, l);
    return;
  }
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

/** Project photo in mesh-local space onto UV canvas so it sticks to the leather. */
function stampProjectedImage(ctx, layer) {
  const img = layer.image;
  const mesh = meshForLayer(layer);
  const p = layer.proj;
  if (!img || !mesh?.geometry || !p) return;

  const geo = mesh.geometry;
  const posAttr = geo.attributes.position;
  const uvAttr = geo.attributes.uv;
  if (!posAttr || !uvAttr) return;

  let right = new THREE.Vector3(p.rx, p.ry, p.rz).normalize();
  let up = new THREE.Vector3(p.ux, p.uy, p.uz).normalize();
  const rot = layer.rotation || 0;
  if (rot) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const r2 = right.clone().multiplyScalar(c).addScaledVector(up, s);
    const u2 = up.clone().multiplyScalar(c).addScaledVector(right, -s);
    right = r2.normalize();
    up = u2.normalize();
  }
  const origin = new THREE.Vector3(p.ox, p.oy, p.oz);
  refreshProjectionOrigin(layer, origin, right, up);
  const halfW = Math.max(1e-4, (p.localW || 1) * 0.5 * (layer.scale || 1));
  const halfH = Math.max(1e-4, (p.localH || 1) * 0.5 * (layer.scale || 1));

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  if (!layer._sampleData) {
    const sc = document.createElement('canvas');
    sc.width = iw;
    sc.height = ih;
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    layer._sampleData = sctx.getImageData(0, 0, iw, ih).data;
  }
  const src = layer._sampleData;
  const out = ctx.getImageData(0, 0, W, H);
  const dd = out.data;
  const opacity = layer.opacity ?? 1;

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const triCount = posAttr.count / 3;
  const margin = 1.0;

  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    v0.fromBufferAttribute(posAttr, i);
    v1.fromBufferAttribute(posAttr, i + 1);
    v2.fromBufferAttribute(posAttr, i + 2);

    const S0 = ((v0.x - origin.x) * right.x + (v0.y - origin.y) * right.y + (v0.z - origin.z) * right.z) / halfW;
    const T0 = ((v0.x - origin.x) * up.x + (v0.y - origin.y) * up.y + (v0.z - origin.z) * up.z) / halfH;
    const S1 = ((v1.x - origin.x) * right.x + (v1.y - origin.y) * right.y + (v1.z - origin.z) * right.z) / halfW;
    const T1 = ((v1.x - origin.x) * up.x + (v1.y - origin.y) * up.y + (v1.z - origin.z) * up.z) / halfH;
    const S2 = ((v2.x - origin.x) * right.x + (v2.y - origin.y) * right.y + (v2.z - origin.z) * right.z) / halfW;
    const T2 = ((v2.x - origin.x) * up.x + (v2.y - origin.y) * up.y + (v2.z - origin.z) * up.z) / halfH;

    if (
      (S0 < -margin && S1 < -margin && S2 < -margin) ||
      (S0 > margin && S1 > margin && S2 > margin) ||
      (T0 < -margin && T1 < -margin && T2 < -margin) ||
      (T0 > margin && T1 > margin && T2 > margin)
    ) continue;

    const x0 = uvAttr.getX(i) * W;
    const y0 = (1 - uvAttr.getY(i)) * H;
    const x1 = uvAttr.getX(i + 1) * W;
    const y1 = (1 - uvAttr.getY(i + 1)) * H;
    const x2 = uvAttr.getX(i + 2) * W;
    const y2 = (1 - uvAttr.getY(i + 2)) * H;

    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) continue;

    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-6) continue;
    const invA = 1 / area;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        const cy = py + 0.5;
        const w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) * invA;
        const w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) * invA;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;

        const ss = w0 * S0 + w1 * S1 + w2 * S2;
        const tt = w0 * T0 + w1 * T1 + w2 * T2;
        if (ss < -1 || ss > 1 || tt < -1 || tt > 1) continue;

        const ix = Math.min(iw - 1, Math.max(0, ((ss + 1) * 0.5 * iw) | 0));
        const iy = Math.min(ih - 1, Math.max(0, ((1 - (tt + 1) * 0.5) * ih) | 0));
        const si = (iy * iw + ix) << 2;
        const srcA = src[si + 3] / 255;
        if (srcA < 0.02) continue;
        const a = srcA * opacity;
        const di = (py * W + px) << 2;
        const inv = 1 - a;
        dd[di] = (src[si] * a + dd[di] * inv) | 0;
        dd[di + 1] = (src[si + 1] * a + dd[di + 1] * inv) | 0;
        dd[di + 2] = (src[si + 2] * a + dd[di + 2] * inv) | 0;
        dd[di + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

function refreshProjectionOrigin(layer, originOut, right, up) {
  if (!layer.projBase) {
    if (originOut && layer.proj) originOut.set(layer.proj.ox, layer.proj.oy, layer.proj.oz);
    return;
  }
  const mesh = meshForLayer(layer);
  let span = 40;
  if (mesh?.geometry) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const sz = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    span = Math.max(sz.x, sz.y, sz.z) * 0.85;
  }
  const ox = ((layer.x / W) - 0.5) * span;
  const oy = ((layer.y / H) - 0.5) * span;
  const b = layer.projBase;
  const r = right || new THREE.Vector3(layer.proj.rx, layer.proj.ry, layer.proj.rz);
  const u = up || new THREE.Vector3(layer.proj.ux, layer.proj.uy, layer.proj.uz);
  const x = b.x + r.x * ox - u.x * oy;
  const y = b.y + r.y * ox - u.y * oy;
  const z = b.z + r.z * ox - u.z * oy;
  layer.proj.ox = x;
  layer.proj.oy = y;
  layer.proj.oz = z;
  if (originOut) originOut.set(x, y, z);
}

/** Store projection in the case mesh's local space so it stays glued when orbiting. */
function applyProjection(layer, worldPoint, worldNormal, mesh) {
  if (!mesh) return;
  mesh.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const point = worldPoint.clone().applyMatrix4(inv);
  const n = worldNormal.clone().transformDirection(inv).normalize();
  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(n.dot(up)) > 0.92) up.set(1, 0, 0);
  up.addScaledVector(n, -up.dot(n)).normalize();
  const right = new THREE.Vector3().crossVectors(n, up).normalize();
  up.crossVectors(right, n).normalize();

  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const sz = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
  const localH = layer.proj?.localH || Math.max(sz.y, sz.z) * 0.32;
  const aspect = (layer.w && layer.h) ? layer.w / layer.h : 1;
  const localW = layer.proj?.localW || localH * aspect;

  layer.proj = {
    ox: point.x, oy: point.y, oz: point.z,
    nx: n.x, ny: n.y, nz: n.z,
    rx: right.x, ry: right.y, rz: right.z,
    ux: up.x, uy: up.y, uz: up.z,
    localW,
    localH
  };
  layer.projBase = { x: point.x, y: point.y, z: point.z };
  layer.useProjection = true;
}

function initImageProjection(layer) {
  const mesh = zoneMeshes[ZONE.BACK]
    || [...surfaceMeshes.values()].find((m) => m.userData.surfaceZone === ZONE.BACK)
    || casePickMeshes.find((m) => m.userData.surfaceZone === ZONE.BACK);
  if (!mesh) {
    say('Case not ready — wait a moment and upload again');
    return;
  }
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const point = box.getCenter(new THREE.Vector3());
  const normal = camera
    ? camera.position.clone().sub(point).normalize()
    : new THREE.Vector3(0, 0, 1);
  applyProjection(layer, point, normal, mesh);
  layer.x = W / 2;
  layer.y = H / 2;
  layer.surfaceZone = ZONE.BACK;
  layer.surfaceId = mesh.userData.surfaceId || null;
  dirtyZones[ZONE.BACK] = true;
  flushPaint();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function paintZone(targetCtx, zone, scale = 1, excludeId = null) {
  const aw = W * scale;
  const ah = H * scale;
  if (artOff.width !== aw || artOff.height !== ah) {
    artOff.width = aw;
    artOff.height = ah;
  }
  const a = artOff.getContext('2d', { alpha: true });
  a.clearRect(0, 0, aw, ah);
  layers
    .filter((l) => (l.surfaceZone || ZONE.BACK) === zone && l.id !== excludeId)
    .forEach((l) => drawLayer(a, l, scale));

  targetCtx.clearRect(0, 0, aw, ah);
  targetCtx.fillStyle = zoneBaseColor(zone);
  targetCtx.fillRect(0, 0, aw, ah);
  targetCtx.drawImage(artOff, 0, 0);
}

let paintRaf = 0;
const dirtyZones = Object.fromEntries([...ARTWORK_ZONES].map((z) => [z, false]));
let liveMode = null; // null | 'stroke' | 'move'
let liveZone = ZONE.BACK;
let liveExcludeId = null;
let pendingPtr = null;
let interactRaf = 0;
let wheelLiveTimer = 0;

function schedulePaint(zone) {
  if (liveMode) return;
  if (zone === 'all' || zone === 'both') {
    for (const z of ARTWORK_ZONES) dirtyZones[z] = true;
  } else if (ARTWORK_ZONES.has(zone)) {
    dirtyZones[zone] = true;
  }
  if (paintRaf) return;
  paintRaf = requestAnimationFrame(() => {
    paintRaf = 0;
    flushPaint();
  });
}

function flushPaint() {
  for (const z of ARTWORK_ZONES) {
    if (dirtyZones[z]) {
      paintZone(zoneCtx[z], z, 1);
      if (zoneTex[z]) zoneTex[z].needsUpdate = true;
      dirtyZones[z] = false;
    }
  }
}

function render(zone = 'all') {
  schedulePaint(zone);
}

function zoneTexCtx(zone) {
  return zoneCtx[zone];
}
function markZoneTex(zone) {
  const tex = zoneTex[zone];
  if (tex) tex.needsUpdate = true;
}

function beginLiveStroke(zone, strokeId) {
  liveMode = 'stroke';
  liveZone = zone;
  liveExcludeId = strokeId;
  paintZone(zoneCtx[zone], zone, 1, strokeId);
  markZoneTex(zone);
}

function drawStrokeDab(stroke, from, to) {
  const zone = stroke.surfaceZone || ZONE.BACK;
  const ctx = zoneTexCtx(zone);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.size;
  if (stroke.erase) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = zoneBaseColor(zone);
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
  markZoneTex(zone);
}

function beginLiveMove(zone, layerId) {
  liveMode = 'move';
  liveZone = zone;
  liveExcludeId = layerId;
  paintZone(zoneCtx[zone], zone, 1, layerId);
  markZoneTex(zone);
}

function liveMoveTick(layer) {
  const zone = layer.surfaceZone || ZONE.BACK;
  if (zone !== liveZone) beginLiveMove(zone, layer.id);
  refreshProjectionOrigin(layer);
  paintZone(zoneCtx[zone], zone, 1, layer.id);
  drawLayer(zoneCtx[zone], layer, 1);
  markZoneTex(zone);
}

function endLive() {
  const zone = liveZone;
  liveMode = null;
  liveExcludeId = null;
  dirtyZones[zone] = true;
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
      const zoneLabel = ZONE_LABELS[l.surfaceZone || ZONE.BACK] || 'back';
      li.innerHTML = `<span class="thumb">${thumb}</span><span><strong>${esc(l.name || 'Layer')}</strong><small>${zoneLabel} · ${l.type} · ${layers.length - i}</small></span>`;
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
  $$('#backSwatches .swatch').forEach((b) => b.classList.toggle('is-on', b.dataset.color === backExteriorColor));
  $$('#outerEdgeSwatches .swatch').forEach((b) => b.classList.toggle('is-on', b.dataset.color === outerEdgeColor));
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
      ? 'Scene locked · draw on back, outer edges, or interior'
      : 'Unlocked · drag to orbit · Lock before drawing on the case');
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
        surfaceZone: ZONE.BACK,
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
        visible: true,
        useProjection: true
      };
      layers.push(layer);
      selected = layer.id;
      tool = 'select';
      placingArtwork = true;
      setOrbitLocked(true);
      initImageProjection(layer);
      snapshot();
      renderLayers();
      syncTransform(layer);
      say('Photo on case · Lock, drag on exterior leather to place · scroll to scale');
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

$$('#backSwatches .swatch, #outerEdgeSwatches .swatch, #interiorSwatches .swatch').forEach((b) => b.addEventListener('click', () => {
  const target = b.closest('.swatches')?.dataset.target || 'back';
  if (target === 'outerEdge') outerEdgeColor = b.dataset.color;
  else if (target === 'interior') interiorColor = b.dataset.color;
  else backExteriorColor = b.dataset.color;
  syncUI();
  snapshot();
  render('all');
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
    surfaceZone: ZONE.BACK,
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
  measureText(zoneCtx[ZONE.BACK], layer);
  layers.push(layer);
  selected = layer.id;
  snapshot();
  render(ZONE.BACK);
  renderLayers();
  say('Text stamped on exterior case.');
};

$('#fileInput').onchange = (e) => { addImageFromFile(e.target.files[0]); e.target.value = ''; };

$('#scaleRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.scale = +e.target.value / 100;
  $('#scaleOut').textContent = `${e.target.value}%`;
  if (l.type === 'image' && l.useProjection) {
    if (liveMode !== 'move') beginLiveMove(l.surfaceZone || ZONE.BACK, l.id);
    liveMoveTick(l);
  } else render(l.surfaceZone || ZONE.BACK);
});
$('#posXRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.x = (+e.target.value / 100) * W;
  $('#posXOut').textContent = `${e.target.value}%`;
  if (l.type === 'image' && l.useProjection) {
    refreshProjectionOrigin(l);
    if (liveMode !== 'move') beginLiveMove(l.surfaceZone || ZONE.BACK, l.id);
    liveMoveTick(l);
  } else render(l.surfaceZone || ZONE.BACK);
});
$('#posYRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.y = (+e.target.value / 100) * H;
  $('#posYOut').textContent = `${e.target.value}%`;
  if (l.type === 'image' && l.useProjection) {
    refreshProjectionOrigin(l);
    if (liveMode !== 'move') beginLiveMove(l.surfaceZone || ZONE.BACK, l.id);
    liveMoveTick(l);
  } else render(l.surfaceZone || ZONE.BACK);
});
$('#rotRange')?.addEventListener('input', (e) => {
  const l = layers.find((x) => x.id === selected);
  if (!l || !['image', 'text', 'pattern'].includes(l.type)) return;
  l.rotation = (+e.target.value * Math.PI) / 180;
  $('#rotOut').textContent = `${e.target.value}°`;
  if (l.type === 'image' && l.useProjection) {
    if (liveMode !== 'move') beginLiveMove(l.surfaceZone || ZONE.BACK, l.id);
    liveMoveTick(l);
  } else render(l.surfaceZone || ZONE.BACK);
});
['posXRange', 'posYRange', 'scaleRange', 'rotRange'].forEach((id) => {
  $(`#${id}`)?.addEventListener('change', () => {
    const l = layers.find((x) => x.id === selected);
    if (l?.type === 'image' && l.useProjection && liveMode === 'move') endLive();
    snapshot();
  });
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
  say('Locked · click/drag on exterior surfaces to place artwork');
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
const zoneTex = {};
const zoneMat = {};
const zoneMeshes = {};
/** Exact zone-mesh registry: surfaceId → Mesh (never overwrite by zone alone). */
const surfaceMeshes = new Map();
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

function normalizeNodeName(name) {
  return String(name || '').toLowerCase().replace(/[_\s-]+/g, ' ').trim();
}

/** Locate the Leather Case group/node (not the phone). */
function findLeatherCaseNode(root) {
  let found = null;
  root.traverse((o) => {
    if (found || o.isMesh) return;
    const n = normalizeNodeName(o.name);
    if (n === 'leather case' || (n.includes('leather') && n.includes('case'))) found = o;
  });
  return found;
}

/**
 * Pick the true customizable shell mesh(es) by coverage of the Leather Case group bbox.
 * Small children (buttons, camera trim, logos) are excluded and left original.
 */
function selectShellMeshes(caseNode) {
  if (!caseNode) return [];
  caseNode.updateMatrixWorld(true);
  const caseBox = new THREE.Box3().setFromObject(caseNode);
  const caseSize = caseBox.getSize(new THREE.Vector3());
  const axes = [
    { axis: 'x', v: caseSize.x },
    { axis: 'y', v: caseSize.y },
    { axis: 'z', v: caseSize.z }
  ].sort((a, b) => b.v - a.v);
  const heightAxis = axes[0].axis;
  const widthAxis = axes[1].axis;
  const thickAxis = axes[2].axis;

  const splitRe = /_(Exterior|Interior|back|leftOuter|rightOuter|topOuter|bottomOuter|cameraLip|bevel|interior)/i;
  const candidates = [];
  caseNode.traverse((o) => {
    if (!o.isMesh || splitRe.test(o.name || '')) return;
    const geo = o.geometry;
    if (!geo?.attributes?.position) return;
    const tri = geo.index
      ? (geo.index.count / 3) | 0
      : ((geo.attributes.position.count || 0) / 3) | 0;
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const hCov = size[heightAxis] / Math.max(1e-9, caseSize[heightAxis]);
    const wCov = size[widthAxis] / Math.max(1e-9, caseSize[widthAxis]);
    const tCov = size[thickAxis] / Math.max(1e-9, caseSize[thickAxis]);
    candidates.push({
      mesh: o,
      tri,
      hCov,
      wCov,
      tCov,
      score: hCov * wCov * Math.min(1, tCov)
    });
  });

  // Full-shell coverage: nearly the whole case footprint + meaningful thickness
  const shells = candidates.filter((c) => c.hCov >= 0.85 && c.wCov >= 0.85 && c.tCov >= 0.45);
  shells.sort((a, b) => b.score - a.score || b.tri - a.tri);
  if (shells.length) {
    // Prefer exactly one true shell mesh
    return [shells[0].mesh];
  }
  candidates.sort((a, b) => b.score - a.score || b.tri - a.tri);
  return candidates[0] ? [candidates[0].mesh] : [];
}

function meshForLayer(layer) {
  if (layer?.surfaceId && surfaceMeshes.has(layer.surfaceId)) {
    return surfaceMeshes.get(layer.surfaceId);
  }
  const zone = layer?.surfaceZone || ZONE.BACK;
  return zoneMeshes[zone] || null;
}

function copyPBRMaps(fromMat, toMat) {
  if (!fromMat) return;
  if (fromMat.normalMap) {
    toMat.normalMap = fromMat.normalMap;
    toMat.normalScale = fromMat.normalScale?.clone?.() || new THREE.Vector2(1, 1);
  }
  if (fromMat.roughnessMap) toMat.roughnessMap = fromMat.roughnessMap;
  if (fromMat.aoMap) {
    toMat.aoMap = fromMat.aoMap;
    toMat.aoMapIntensity = fromMat.aoMapIntensity ?? 1;
  }
}

function makeCaseMat(map, sourceMat, opts = {}) {
  const softRoughness = material === 'gloss' ? 0.55 : material === 'matte' ? 0.8 : 0.68;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: map || null,
    roughness: opts.roughness ?? softRoughness,
    metalness: 0,
    clearcoat: opts.clearcoat ?? (material === 'gloss' ? 0.85 : material === 'soft' ? 0.35 : 0.15),
    clearcoatRoughness: opts.clearcoatRoughness ?? (material === 'gloss' ? 0.08 : 0.4),
    side: THREE.FrontSide
  });
  copyPBRMaps(sourceMat, mat);
  return mat;
}

function makeInteriorMat(sourceMat) {
  if (sourceMat?.clone) {
    const mat = sourceMat.clone();
    mat.side = THREE.FrontSide;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
    return mat;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0,
    side: THREE.FrontSide
  });

  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -1;

  return mat;
}

function ensureZoneTexture(zone) {
  if (!ARTWORK_ZONES.has(zone)) return null;
  let tex = zoneTex[zone];
  if (!tex) {
    paintZone(zoneCtx[zone], zone, 1);
    tex = new THREE.CanvasTexture(zoneCanvas[zone]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() || 1;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    zoneTex[zone] = tex;
  } else {
    tex.needsUpdate = true;
  }
  return tex;
}

function applyCaseTo3D() {
  if (!caseMats.length && !surfaceMeshes.size) return;
  const g = material === 'gloss' ? Math.max(gloss, 0.7) : gloss;
  const roughness = clamp(1 - g, 0.08, 0.85);
  const clearcoat = material === 'gloss' ? 1 : material === 'soft' ? 0.35 : 0.15;
  const clearcoatRoughness = material === 'gloss' ? 0.08 : 0.4;

  for (const mesh of surfaceMeshes.values()) {
    const mat = mesh.material;
    const zone = mesh.userData.surfaceZone;
    if (!mat || !zone) continue;
    if (ARTWORK_ZONES.has(zone)) {
      if (!caseDebug) mat.color.set(0xffffff);
      mat.map = caseDebug ? null : ensureZoneTexture(zone);
      mat.roughness = roughness;
      mat.clearcoat = clearcoat;
      mat.clearcoatRoughness = clearcoatRoughness;
    } else if (zone === ZONE.CAMERA_LIP) {
      // Camera lip follows Back colour — never Outer Edge
      if (!caseDebug) mat.color.set(backExteriorColor);
      mat.map = null;
      mat.roughness = roughness;
      mat.clearcoat = clearcoat;
      mat.clearcoatRoughness = clearcoatRoughness;
    } else if (zone === ZONE.BEVEL) {
      if (!caseDebug) mat.color.set(outerEdgeColor);
      mat.map = null;
      mat.roughness = roughness;
      mat.clearcoat = clearcoat;
      mat.clearcoatRoughness = clearcoatRoughness;
    } else {
      if (!caseDebug) mat.color.set(backExteriorColor);
      mat.map = null;
      mat.roughness = roughness;
      mat.clearcoat = clearcoat;
      mat.clearcoatRoughness = clearcoatRoughness;
    }
    if (caseDebug) {
      mat.color.set(DEBUG_ZONE_COLORS[zone] ?? 0xffffff);
      mat.map = null;
    }
    mat.needsUpdate = true;
  }
  schedulePaint('all');
}

function updateTexture(force = false) {
  if (!renderer) return;
  if (force) {
    for (const z of ARTWORK_ZONES) dirtyZones[z] = true;
    flushPaint();
  } else {
    schedulePaint('all');
  }
  for (const mesh of surfaceMeshes.values()) {
    const zone = mesh.userData.surfaceZone;
    if (!ARTWORK_ZONES.has(zone)) continue;
    const mat = mesh.material;
    if (!mat) continue;
    mat.map = ensureZoneTexture(zone);
    mat.needsUpdate = true;
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

function seatCaseOnPhone(product) {
  let phoneNode = null;
  const caseNode = findLeatherCaseNode(product);
  product.traverse((o) => {
    const n = normalizeNodeName(o.name);
    if (!phoneNode && (n.includes('ipohne') || n.includes('iphone')) && !n.includes('leather')) phoneNode = o;
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
  surfaceMeshes.clear();
  for (const k of Object.keys(zoneTex)) delete zoneTex[k];
  for (const k of Object.keys(zoneMat)) delete zoneMat[k];
  for (const k of Object.keys(zoneMeshes)) delete zoneMeshes[k];

  seatCaseOnPhone(sceneRoot);
  sceneRoot.updateMatrixWorld(true);

  let phoneNode = null;
  sceneRoot.traverse((o) => {
    const n = normalizeNodeName(o.name);
    if (!phoneNode && (n.includes('ipohne') || n.includes('iphone')) && !n.includes('leather')) phoneNode = o;
  });
  const phoneCenterWorld = new THREE.Vector3();
  if (phoneNode) {
    new THREE.Box3().setFromObject(phoneNode).getCenter(phoneCenterWorld);
  }

  // Normalize colour spaces on all materials; do not customize yet
  sceneRoot.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      m.needsUpdate = true;
    });
  });

  const caseNode = findLeatherCaseNode(sceneRoot);
  const shellMeshes = selectShellMeshes(caseNode);
  if (!shellMeshes.length) throw new Error('Leather case shell mesh not found in product GLB');

  if (caseDebug) {
    console.log('[caseDebug] shell meshes', shellMeshes.map((m) => ({
      name: m.name,
      parent: m.parent?.name,
      tris: m.geometry?.index
        ? (m.geometry.index.count / 3) | 0
        : ((m.geometry?.attributes?.position?.count || 0) / 3) | 0
    })));
  }

  // Customize only verified full-size shell mesh(es). Leave accessories original.
  let caseCount = 0;
  shellMeshes.forEach((mesh, shellIndex) => {
    caseCount += 1;
    if (mesh.geometry && !mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
    const sourceMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const { geometries, stats, axes } = splitCaseBySurfaces(mesh, phoneCenterWorld);
    if (caseDebug) {
      console.log('[caseDebug] splitCaseBySurfaces stats', stats);
      console.log('[caseDebug] axes', axes);
    }
    const parent = mesh.parent || sceneRoot;
    const shellKey = `shell${shellIndex}`;

    for (const [zone, geo] of Object.entries(geometries)) {
      if (!geo.attributes.position?.count) continue;

      let mat;
      if (ARTWORK_ZONES.has(zone)) {
        paintZone(zoneCtx[zone], zone, 1);
        mat = makeCaseMat(ensureZoneTexture(zone), sourceMat);
      } else if (zone === ZONE.CAMERA_LIP) {
        mat = makeCaseMat(null, sourceMat);
        mat.color.set(backExteriorColor);
      } else if (OUTER_EDGE_ZONES.has(zone) || zone === ZONE.BEVEL) {
        mat = makeCaseMat(null, sourceMat);
        mat.color.set(outerEdgeColor);
      } else {
        mat = makeCaseMat(null, sourceMat);
        mat.color.set(backExteriorColor);
      }
      if (caseDebug) {
        mat.color.set(DEBUG_ZONE_COLORS[zone] ?? 0xffffff);
        mat.map = null;
      }
      caseMats.push(mat);

      const surfaceId = `${shellKey}:${zone}`;
      const zoneMesh = new THREE.Mesh(geo, mat);
      zoneMesh.name = `${mesh.name || 'Leather'}_${zone}`;
      zoneMesh.userData.surfaceZone = zone;
      zoneMesh.userData.surfaceId = surfaceId;
      zoneMesh.userData.shellKey = shellKey;
      zoneMesh.castShadow = true;
      zoneMesh.receiveShadow = true;
      zoneMesh.position.copy(mesh.position);
      zoneMesh.quaternion.copy(mesh.quaternion);
      zoneMesh.scale.copy(mesh.scale);
      if (zone === ZONE.INTERIOR) zoneMesh.renderOrder = 1;

      parent.add(zoneMesh);
      casePickMeshes.push(zoneMesh);
      surfaceMeshes.set(surfaceId, zoneMesh);

      // With a single shell, zoneMaps remain convenient mirrors of that shell.
      // Never overwrite an existing zone entry from a different shell.
      if (!zoneMeshes[zone]) zoneMeshes[zone] = zoneMesh;
      if (!zoneMat[zone]) zoneMat[zone] = mat;
    }
    mesh.visible = false;
  });

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
  if (!l || !['image', 'text', 'pattern'].includes(l.type) || !hit) return false;
  const zone = hit.object?.userData?.surfaceZone || ZONE.BACK;
  const surfaceId = hit.object?.userData?.surfaceId || null;
  if (!isArtworkEditableZone(zone)) {
    say('Draw on back, outer edges, or interior');
    return false;
  }
  if (l.type === 'image') {
    const mesh = hit.object;
    const n = hit.face?.normal
      ? hit.face.normal.clone().transformDirection(mesh.matrixWorld).normalize()
      : (hit.normal?.clone?.() || new THREE.Vector3(0, 0, 1));
    if (camera) {
      const toCam = camera.position.clone().sub(hit.point).normalize();
      if (n.dot(toCam) < 0) n.negate();
    }
    l.surfaceZone = zone;
    l.surfaceId = surfaceId;
    l.x = W / 2;
    l.y = H / 2;
    const keepW = l.proj?.localW;
    const keepH = l.proj?.localH;
    applyProjection(l, hit.point.clone(), n, mesh);
    if (keepW) l.proj.localW = keepW;
    if (keepH) l.proj.localH = keepH;
    if (liveMode !== 'move') beginLiveMove(zone, l.id);
    liveMoveTick(l);
    return true;
  }
  if (!hit.uv) return false;
  const pt = uvToCanvas(hit.uv);
  if (liveMode !== 'move') beginLiveMove(zone, l.id);
  l.surfaceZone = zone;
  l.surfaceId = surfaceId;
  l.x = pt.x;
  l.y = pt.y;
  liveMoveTick(l);
  return true;
}

function paintAtHit(hit) {
  if (!hit?.uv) return false;
  const zone = hit.object?.userData?.surfaceZone || ZONE.BACK;
  const surfaceId = hit.object?.userData?.surfaceId || null;
  if (!isArtworkEditableZone(zone)) {
    say('Draw on back, outer edges, or interior');
    return false;
  }
  const pt = uvToCanvas(hit.uv);
  if (!painting || !paintStroke) {
    painting = true;
    paintStroke = {
      id: uid(),
      type: 'stroke',
      surfaceZone: zone,
      surfaceId,
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
    beginLiveStroke(zone, paintStroke.id);
    drawStrokeDab(paintStroke, pt, { x: pt.x + 0.01, y: pt.y });
    return true;
  }
  if (paintStroke.surfaceZone !== zone) {
    dirtyZones[paintStroke.surfaceZone] = true;
    flushPaint();
    liveMode = null;
    liveExcludeId = null;
    paintStroke = null;
    return paintAtHit(hit);
  }
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
        say('Aim at an exterior leather surface to draw');
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
      if (liveMode !== 'move') beginLiveMove(sel.surfaceZone || ZONE.BACK, sel.id);
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
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    previewHost.append(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f2f5);
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.12, dist);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444450, 1.55));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(3.5, 5, 5.5);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd7e4ff, 2.4);
    rim.position.set(-4, 1, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xfff0e4, 1.45);
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
    say('3D only · orbit free, then Lock and draw on exterior surfaces');
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
    let saved = localStorage.getItem(STORE);
    let migratedFromLegacy = false;
    if (!saved) {
      const legacySaved = localStorage.getItem(LEGACY_STORE);
      if (legacySaved) {
        try {
          JSON.parse(legacySaved);
          saved = legacySaved;
          migratedFromLegacy = true;
        } catch (err) {
          console.warn('Could not migrate legacy Case Studio state', err);
        }
      }
    }
    if (saved) {
      history = [saved];
      await restore(JSON.parse(saved), false);
      if (migratedFromLegacy) {
        const migrated = JSON.stringify(serial());
        localStorage.setItem(STORE, migrated);
        history = [migrated];
      }
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
