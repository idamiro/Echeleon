/**
 * Case Studio — semantic surface classification for the leather case GLB.
 * Classification is in CASE-LOCAL space and is independent of camera orbit.
 *
 * Shell local proportions (this Sketchfab asset):
 *   smallest axis ≈ thickness
 *   middle axis ≈ width
 *   largest axis ≈ height
 */

import * as THREE from 'three';

export const ZONE = {
  BACK: 'back',
  LEFT: 'leftOuter',
  RIGHT: 'rightOuter',
  TOP: 'topOuter',
  BOTTOM: 'bottomOuter',
  CAMERA_LIP: 'cameraLip',
  BEVEL: 'bevel',
  INTERIOR: 'interior'
};

/** Zones that support artwork canvases / raycast painting */
export const ARTWORK_ZONES = new Set([
  ZONE.BACK,
  ZONE.LEFT,
  ZONE.RIGHT,
  ZONE.TOP,
  ZONE.BOTTOM,
  ZONE.INTERIOR
]);

/** @deprecated use ARTWORK_ZONES — kept as alias for older call sites */
export const EDITABLE_ZONES = ARTWORK_ZONES;

/** Zones that share the single Outer Edge user colour */
export const OUTER_EDGE_ZONES = new Set([
  ZONE.LEFT,
  ZONE.RIGHT,
  ZONE.TOP,
  ZONE.BOTTOM
]);

/** Material colour groups — independent of artwork surfaceZone */
export const COLOR_GROUP = {
  BACK: 'back',
  OUTER_EDGE: 'outerEdge',
  INTERIOR: 'interior',
  CAMERA: 'camera'
};

export function colorGroupForZone(zone) {
  if (zone === ZONE.INTERIOR) return COLOR_GROUP.INTERIOR;
  if (zone === ZONE.CAMERA_LIP) return COLOR_GROUP.CAMERA;
  if (OUTER_EDGE_ZONES.has(zone) || zone === ZONE.BEVEL) return COLOR_GROUP.OUTER_EDGE;
  return COLOR_GROUP.BACK;
}

export const ZONE_LABELS = {
  [ZONE.BACK]: 'back',
  [ZONE.LEFT]: 'left side',
  [ZONE.RIGHT]: 'right side',
  [ZONE.TOP]: 'top',
  [ZONE.BOTTOM]: 'bottom',
  [ZONE.CAMERA_LIP]: 'camera lip',
  [ZONE.BEVEL]: 'edge',
  [ZONE.INTERIOR]: 'interior'
};

/** Debug visualisation colours (?caseDebug=1) */
export const DEBUG_ZONE_COLORS = {
  [ZONE.BACK]: 0xe74c3c,
  [ZONE.LEFT]: 0x3498db,
  [ZONE.RIGHT]: 0x2ecc71,
  [ZONE.TOP]: 0xf1c40f,
  [ZONE.BOTTOM]: 0x9b59b6,
  [ZONE.CAMERA_LIP]: 0xe67e22,
  [ZONE.BEVEL]: 0x95a5a6,
  [ZONE.INTERIOR]: 0x2c3e50
};

/**
 * Infer case-local axes from bbox proportions (not phone offset direction).
 * Phone vector only helps choose the thickness sign when it is meaningful.
 */
export function inferCaseAxes(caseLocalSize, toPhoneFromCenter) {
  const dims = { x: caseLocalSize.x, y: caseLocalSize.y, z: caseLocalSize.z };
  const order = ['x', 'y', 'z'].sort((a, b) => dims[a] - dims[b]);
  const thickAxis = order[0];
  const widthAxis = order[1];
  const heightAxis = order[2];

  const thickSpan = Math.max(1e-9, dims[thickAxis]);
  const thickOffset = thickAxis === 'x' ? toPhoneFromCenter.x
    : thickAxis === 'y' ? toPhoneFromCenter.y
      : toPhoneFromCenter.z;
  // Only trust phone for thickness sign when it clearly lies along thickness
  let towardPhoneSign = Math.sign(thickOffset) || 1;
  if (Math.abs(thickOffset) < thickSpan * 0.35) {
    towardPhoneSign = 1;
  }

  return {
    thickAxis,
    heightAxis,
    widthAxis,
    towardPhoneSign,
    dims
  };
}

function comp(v, axis) {
  return axis === 'x' ? v.x : axis === 'y' ? v.y : v.z;
}

function quantKey(x, y, z, s) {
  return `${Math.round(x * s)}|${Math.round(y * s)}|${Math.round(z * s)}`;
}

function edgeKey(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function traceLoops(edgeByKey, vertEdges) {
  const used = new Set();
  const loops = [];

  for (const start of edgeByKey.values()) {
    if (used.has(start.key)) continue;
    const loop = [];
    let key = start.key;
    let prevVert = start.a;
    let guard = 0;
    const startKey = start.key;
    while (key && guard++ < edgeByKey.size + 2) {
      if (used.has(key)) break;
      used.add(key);
      const edge = edgeByKey.get(key);
      if (!edge) break;
      loop.push(edge);
      const nextVert = edge.a === prevVert ? edge.b : edge.a;
      const candidates = vertEdges.get(nextVert) || [];
      let nextKey = null;
      for (const ck of candidates) {
        if (ck !== key && !used.has(ck)) {
          nextKey = ck;
          break;
        }
      }
      if (!nextKey) {
        if (candidates.includes(startKey) && loop.length >= 3) break;
        break;
      }
      prevVert = nextVert;
      key = nextKey;
      if (key === startKey) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function loopProjectedArea(loop, pos, heightAxis, widthAxis) {
  let area = 0;
  const pts = [];
  for (const e of loop) {
    const p0 = { x: pos.getX(e.vi0), y: pos.getY(e.vi0), z: pos.getZ(e.vi0) };
    const p1 = { x: pos.getX(e.vi1), y: pos.getY(e.vi1), z: pos.getZ(e.vi1) };
    pts.push([
      (comp(p0, widthAxis) + comp(p1, widthAxis)) * 0.5,
      (comp(p0, heightAxis) + comp(p1, heightAxis)) * 0.5
    ]);
  }
  for (let i = 0; i < pts.length; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    area += x0 * y1 - x1 * y0;
  }
  return Math.abs(area) * 0.5;
}

/**
 * Split leather case geometry into semantic surface zone BufferGeometries.
 * Patch classification + outer/hole rim topology (interior↔exterior interface).
 */
export function splitCaseBySurfaces(mesh, phoneCenterWorld) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.updateMatrixWorld(true);
  if (!src.boundingBox) src.computeBoundingBox();

  const pos = src.attributes.position;
  const triCount = (pos.count / 3) | 0;
  const phoneLocal = phoneCenterWorld.clone().applyMatrix4(
    new THREE.Matrix4().copy(mesh.matrixWorld).invert()
  );
  const bb = src.boundingBox;
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const toPhone = phoneLocal.clone().sub(center);
  const axes = inferCaseAxes(size, toPhone);

  const buckets = {
    [ZONE.BACK]: [],
    [ZONE.LEFT]: [],
    [ZONE.RIGHT]: [],
    [ZONE.TOP]: [],
    [ZONE.BOTTOM]: [],
    [ZONE.CAMERA_LIP]: [],
    [ZONE.BEVEL]: [],
    [ZONE.INTERIOR]: []
  };

  const centers = new Array(triCount);
  const normals = new Array(triCount);
  const isInterior = new Uint8Array(triCount);
  const cLocal = new THREE.Vector3();
  const nLocal = new THREE.Vector3();
  const toCenter = new THREE.Vector3();

  for (let t = 0; t < triCount; t += 1) {
    const i = t * 3;
    cLocal.set(
      (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
      (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    );
    centers[t] = cLocal.clone();

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
    ).normalize();
    normals[t] = nLocal.clone();

    // Inward faces of a hollow shell point toward the bbox center
    toCenter.copy(center).sub(cLocal);
    if (nLocal.dot(toCenter) > 0) isInterior[t] = 1;
  }

  // Refine thickness sign from the dominant outward exterior thick face (true back plate)
  {
    let posThick = 0;
    let negThick = 0;
    for (let t = 0; t < triCount; t += 1) {
      if (isInterior[t]) continue;
      const nT = comp(normals[t], axes.thickAxis);
      const aT = Math.abs(nT);
      const aH = Math.abs(comp(normals[t], axes.heightAxis));
      const aW = Math.abs(comp(normals[t], axes.widthAxis));
      if (aT < 0.7 || aT < aH || aT < aW) continue;
      const fromC = comp(centers[t], axes.thickAxis) - comp(center, axes.thickAxis);
      // outward thick face: normal and offset from center share sign
      if (nT * fromC > 0) {
        if (nT > 0) posThick += 1;
        else negThick += 1;
      }
    }
    // toward-phone is opposite the dominant outer back normal
    if (posThick + negThick > 20) {
      axes.towardPhoneSign = posThick >= negThick ? -1 : 1;
    }
  }
  const awaySign = -axes.towardPhoneSign;

  const qScale = 1 / Math.max(1e-9, size.length() * 1e-5);
  const vertKeys = new Array(pos.count);
  for (let i = 0; i < pos.count; i += 1) {
    vertKeys[i] = quantKey(pos.getX(i), pos.getY(i), pos.getZ(i), qScale);
  }

  const edgeMap = new Map();
  for (let t = 0; t < triCount; t += 1) {
    const i = t * 3;
    const verts = [i, i + 1, i + 2];
    for (let e = 0; e < 3; e += 1) {
      const i0 = verts[e];
      const i1 = verts[(e + 1) % 3];
      const a = vertKeys[i0];
      const b = vertKeys[i1];
      const key = edgeKey(a, b);
      let rec = edgeMap.get(key);
      if (!rec) {
        rec = { key, a, b, tris: [], samples: [] };
        edgeMap.set(key, rec);
      }
      if (!rec.tris.includes(t)) rec.tris.push(t);
      rec.samples.push({ tri: t, vi0: i0, vi1: i1 });
    }
  }

  const neighbors = Array.from({ length: triCount }, () => []);
  for (const rec of edgeMap.values()) {
    if (rec.tris.length === 2) {
      neighbors[rec.tris[0]].push(rec.tris[1]);
      neighbors[rec.tris[1]].push(rec.tris[0]);
    }
  }

  // Rim loops at interior↔exterior interface (watertight shell has no open boundaries)
  const rimByKey = new Map();
  const rimVertEdges = new Map();
  for (const rec of edgeMap.values()) {
    if (rec.tris.length !== 2) continue;
    const [t0, t1] = rec.tris;
    if (isInterior[t0] === isInterior[t1]) continue;
    const exteriorTri = isInterior[t0] ? t1 : t0;
    const sample = rec.samples.find((s) => s.tri === exteriorTri) || rec.samples[0];
    const edge = {
      key: rec.key,
      a: rec.a,
      b: rec.b,
      tri: exteriorTri,
      vi0: sample.vi0,
      vi1: sample.vi1
    };
    rimByKey.set(rec.key, edge);
    if (!rimVertEdges.has(rec.a)) rimVertEdges.set(rec.a, []);
    if (!rimVertEdges.has(rec.b)) rimVertEdges.set(rec.b, []);
    rimVertEdges.get(rec.a).push(rec.key);
    rimVertEdges.get(rec.b).push(rec.key);
  }

  const loops = traceLoops(rimByKey, rimVertEdges);
  const loopAreas = loops.map((loop) => loopProjectedArea(loop, pos, axes.heightAxis, axes.widthAxis));
  let outerLoopIdx = 0;
  let bestArea = -1;
  for (let li = 0; li < loopAreas.length; li += 1) {
    if (loopAreas[li] > bestArea) {
      bestArea = loopAreas[li];
      outerLoopIdx = li;
    }
  }

  const touchesOuter = new Uint8Array(triCount);
  const touchesCamera = new Uint8Array(triCount);
  const touchesOtherHole = new Uint8Array(triCount);

  // Internal holes = every rim loop except the outer perimeter.
  // Camera opening = largest internal hole by projected area (not bbox %).
  let cameraLoopIdx = -1;
  let cameraArea = -1;
  for (let li = 0; li < loops.length; li += 1) {
    if (li === outerLoopIdx) continue;
    if (loopAreas[li] > cameraArea) {
      cameraArea = loopAreas[li];
      cameraLoopIdx = li;
    }
  }

  let camMinW = Infinity;
  let camMaxW = -Infinity;
  let camMinH = Infinity;
  let camMaxH = -Infinity;
  for (let li = 0; li < loops.length; li += 1) {
    for (const e of loops[li]) {
      if (li === outerLoopIdx) {
        touchesOuter[e.tri] = 1;
      } else if (li === cameraLoopIdx) {
        touchesCamera[e.tri] = 1;
        for (const vi of [e.vi0, e.vi1]) {
          const p = { x: pos.getX(vi), y: pos.getY(vi), z: pos.getZ(vi) };
          const w = comp(p, axes.widthAxis);
          const h = comp(p, axes.heightAxis);
          camMinW = Math.min(camMinW, w);
          camMaxW = Math.max(camMaxW, w);
          camMinH = Math.min(camMinH, h);
          camMaxH = Math.max(camMaxH, h);
        }
      } else {
        touchesOtherHole[e.tri] = 1;
      }
    }
  }

  // Local influence box around the camera hole loop only
  let camPadW = 0;
  let camPadH = 0;
  if (Number.isFinite(camMinW)) {
    camPadW = Math.max((camMaxW - camMinW) * 0.35, size[axes.widthAxis] * 0.015);
    camPadH = Math.max((camMaxH - camMinH) * 0.35, size[axes.heightAxis] * 0.015);
    camMinW -= camPadW;
    camMaxW += camPadW;
    camMinH -= camPadH;
    camMaxH += camPadH;
  }

  function inCameraRegion(t) {
    if (!Number.isFinite(camMinW)) return false;
    const c = centers[t];
    const w = comp(c, axes.widthAxis);
    const h = comp(c, axes.heightAxis);
    return w >= camMinW && w <= camMaxW && h >= camMinH && h <= camMaxH;
  }

  const wMin = comp(bb.min, axes.widthAxis);
  const wMax = comp(bb.max, axes.widthAxis);
  const wSpan = Math.max(1e-9, wMax - wMin);
  const hMin = comp(bb.min, axes.heightAxis);
  const hMax = comp(bb.max, axes.heightAxis);
  const hSpan = Math.max(1e-9, hMax - hMin);
  const OUTER_BAND = 0.12;

  function nearLeftOuter(t) {
    return comp(centers[t], axes.widthAxis) <= wMin + wSpan * OUTER_BAND;
  }
  function nearRightOuter(t) {
    return comp(centers[t], axes.widthAxis) >= wMax - wSpan * OUTER_BAND;
  }
  function nearBottomOuter(t) {
    return comp(centers[t], axes.heightAxis) <= hMin + hSpan * OUTER_BAND;
  }
  function nearTopOuter(t) {
    return comp(centers[t], axes.heightAxis) >= hMax - hSpan * OUTER_BAND;
  }

  const assigned = new Array(triCount).fill(null);
  for (let t = 0; t < triCount; t += 1) {
    if (!isInterior[t]) continue;
    assigned[t] = ZONE.INTERIOR;
    buckets[ZONE.INTERIOR].push(t);
  }

  function isStrongBack(t) {
    const n = normals[t];
    const nThick = comp(n, axes.thickAxis);
    const aT = Math.abs(nThick);
    const aH = Math.abs(comp(n, axes.heightAxis));
    const aW = Math.abs(comp(n, axes.widthAxis));
    return nThick * awaySign > 0.55 && aT >= aH && aT >= aW && aT > 0.7;
  }

  // CAMERA_LIP: seed from the camera INTERNAL hole loop — never reject because
  // the hole sits near the top/left/right bbox edge of the case.
  const PATCH_DOT = 0.82;
  const cameraQueue = [];
  for (let t = 0; t < triCount; t += 1) {
    if (assigned[t] || !touchesCamera[t]) continue;
    assigned[t] = ZONE.CAMERA_LIP;
    buckets[ZONE.CAMERA_LIP].push(t);
    cameraQueue.push(t);
  }
  while (cameraQueue.length) {
    const t = cameraQueue.pop();
    const n0 = normals[t];
    for (const n of neighbors[t]) {
      if (assigned[n]) continue;
      if (!inCameraRegion(n) && !touchesCamera[n]) continue;
      // Stay local to the camera hole — do not flood into the outer phone-opening rim
      if (touchesOuter[n] && !touchesCamera[n] && !inCameraRegion(n)) continue;
      if (n0.dot(normals[n]) < 0.72) continue;
      if (isStrongBack(n) && !touchesCamera[n]) continue;
      assigned[n] = ZONE.CAMERA_LIP;
      buckets[ZONE.CAMERA_LIP].push(n);
      cameraQueue.push(n);
    }
  }

  // Connected exterior patches
  const patches = [];
  const visited = new Uint8Array(triCount);
  for (let seed = 0; seed < triCount; seed += 1) {
    if (assigned[seed] || visited[seed]) continue;
    const seedN = normals[seed];
    const patch = [];
    const stack = [seed];
    visited[seed] = 1;
    while (stack.length) {
      const t = stack.pop();
      patch.push(t);
      for (const n of neighbors[t]) {
        if (assigned[n] || visited[n]) continue;
        if (seedN.dot(normals[n]) < PATCH_DOT) continue;
        visited[n] = 1;
        stack.push(n);
      }
    }
    patches.push(patch);
  }

  function classifyPatch(patch) {
    const avgN = new THREE.Vector3();
    const centroid = new THREE.Vector3();
    let hitCam = false;
    let inCam = false;
    let touchCam = false;
    let nLeft = 0;
    let nRight = 0;
    let nTop = 0;
    let nBottom = 0;
    for (const t of patch) {
      avgN.add(normals[t]);
      centroid.add(centers[t]);
      if (touchesCamera[t]) hitCam = true;
      if (inCameraRegion(t)) inCam = true;
      if (nearLeftOuter(t)) nLeft += 1;
      if (nearRightOuter(t)) nRight += 1;
      if (nearTopOuter(t)) nTop += 1;
      if (nearBottomOuter(t)) nBottom += 1;
      for (const n of neighbors[t]) {
        if (assigned[n] === ZONE.CAMERA_LIP) touchCam = true;
      }
    }
    avgN.normalize();
    centroid.multiplyScalar(1 / Math.max(1, patch.length));

    const nThick = comp(avgN, axes.thickAxis);
    const nH = comp(avgN, axes.heightAxis);
    const nW = comp(avgN, axes.widthAxis);
    const aT = Math.abs(nThick);
    const aH = Math.abs(nH);
    const aW = Math.abs(nW);
    const frac = 1 / Math.max(1, patch.length);

    // Camera-hole local patches — never Outer Edge
    if (hitCam) return ZONE.CAMERA_LIP;
    if (touchCam && inCam && (nLeft + nRight) * frac < 0.55) return ZONE.CAMERA_LIP;
    if (inCam && patch.length <= 64 && (nLeft + nRight) * frac < 0.45 && aT < 0.92) {
      return ZONE.CAMERA_LIP;
    }

    const fromCThick = comp(centroid, axes.thickAxis) - comp(center, axes.thickAxis);
    if (aT >= aH && aT >= aW && aT > 0.42 && nThick * fromCThick > 0) return ZONE.BACK;
    if (nThick * awaySign > 0.42 && aT >= aH && aT >= aW) return ZONE.BACK;

    if (aW >= 0.55 && aW >= aH && aW >= aT * 0.75) {
      if (nW < 0 && nLeft * frac >= 0.35) return ZONE.LEFT;
      if (nW > 0 && nRight * frac >= 0.35) return ZONE.RIGHT;
    }
    if (aH >= 0.55 && aH >= aW && aH >= aT * 0.75) {
      if (nH < 0 && nBottom * frac >= 0.35) return ZONE.BOTTOM;
      if (nH > 0 && nTop * frac >= 0.35) return ZONE.TOP;
    }

    if (aT >= aH && aT >= aW && nThick * awaySign > 0) return ZONE.BACK;
    return ZONE.BEVEL;
  }

  for (const patch of patches) {
    const zone = classifyPatch(patch);
    for (const t of patch) {
      assigned[t] = zone;
      buckets[zone].push(t);
    }
  }

  // Outer-perimeter wall reach (topology): exterior, not strong back, not camera.
  // Any BACK triangle on this wall is a mis-coloured top/bottom/side strip — rebucket.
  const outerWall = new Uint8Array(triCount);
  {
    const q = [];
    for (let t = 0; t < triCount; t += 1) {
      if (!touchesOuter[t] || assigned[t] === ZONE.INTERIOR) continue;
      if (assigned[t] === ZONE.CAMERA_LIP) continue;
      if (isStrongBack(t)) continue;
      outerWall[t] = 1;
      q.push(t);
    }
    while (q.length) {
      const t = q.pop();
      for (const n of neighbors[t]) {
        if (outerWall[n] || assigned[n] === ZONE.INTERIOR) continue;
        if (assigned[n] === ZONE.CAMERA_LIP) continue;
        if (isStrongBack(n)) continue;
        outerWall[n] = 1;
        q.push(n);
      }
    }
  }

  function rebucket(t, nextZone) {
    const prev = assigned[t];
    if (prev === nextZone) return;
    const arr = buckets[prev];
    if (arr) {
      const idx = arr.indexOf(t);
      if (idx >= 0) arr.splice(idx, 1);
    }
    assigned[t] = nextZone;
    buckets[nextZone].push(t);
  }

  for (let t = 0; t < triCount; t += 1) {
    if (!outerWall[t]) continue;
    if (assigned[t] === ZONE.CAMERA_LIP || assigned[t] === ZONE.INTERIOR) continue;
    // Already a perimeter artwork/side zone — keep for raycast, colour group is Outer Edge
    if (OUTER_EDGE_ZONES.has(assigned[t]) || assigned[t] === ZONE.BEVEL) continue;
    if (assigned[t] !== ZONE.BACK) continue;
    if (isStrongBack(t)) continue;

    const n = normals[t];
    const nH = comp(n, axes.heightAxis);
    const nW = comp(n, axes.widthAxis);
    const aH = Math.abs(nH);
    const aW = Math.abs(nW);
    const aT = Math.abs(comp(n, axes.thickAxis));
    if (aW >= aH && aW >= aT * 0.55) {
      rebucket(t, nW >= 0 ? ZONE.RIGHT : ZONE.LEFT);
    } else if (aH >= aW && aH >= aT * 0.55) {
      rebucket(t, nH >= 0 ? ZONE.TOP : ZONE.BOTTOM);
    } else {
      rebucket(t, ZONE.BEVEL);
    }
  }

  // Reclaim camera-local BEVEL next to CAMERA_LIP (never steal outer-edge walls)
  {
    const isCam = new Uint8Array(triCount);
    for (const t of buckets[ZONE.CAMERA_LIP]) isCam[t] = 1;
    const reclaim = [];
    for (let t = 0; t < triCount; t += 1) {
      if (!isCam[t]) continue;
      for (const n of neighbors[t]) {
        if (isCam[n] || assigned[n] !== ZONE.BEVEL) continue;
        if (!inCameraRegion(n) && !touchesCamera[n]) continue;
        reclaim.push(n);
      }
    }
    for (const t of reclaim) rebucket(t, ZONE.CAMERA_LIP);
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
        for (let v = 0; v < 3; v += 1) {
          const vi = base + v;
          for (let c = 0; c < itemSize; c += 1) {
            array[w++] = attr.array[vi * itemSize + c];
          }
        }
      }
      g.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
    }
    if (tris.length) {
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      g.computeBoundingBox();
      g.computeBoundingSphere();
    }
    return g;
  }

  const geometries = {};
  const stats = {};
  for (const [zone, tris] of Object.entries(buckets)) {
    geometries[zone] = buildFromTris(tris);
    const g = geometries[zone];
    const uv = g.attributes.uv;
    let minU = 1;
    let maxU = 0;
    let minV = 1;
    let maxV = 0;
    if (uv) {
      for (let i = 0; i < uv.count; i += 1) {
        minU = Math.min(minU, uv.getX(i));
        maxU = Math.max(maxU, uv.getX(i));
        minV = Math.min(minV, uv.getY(i));
        maxV = Math.max(maxV, uv.getY(i));
      }
    }
    stats[zone] = {
      triangleCount: tris.length,
      uvBounds: uv && tris.length ? { minU, maxU, minV, maxV } : null,
      bbox: g.boundingBox
        ? {
          min: g.boundingBox.min.toArray(),
          max: g.boundingBox.max.toArray()
        }
        : null,
      rimLoops: loops.length,
      outerLoopEdges: loops[outerLoopIdx]?.length || 0
    };
  }

  return { geometries, stats, axes, phoneLocal: phoneLocal.toArray() };
}

export function isArtworkEditableZone(zone) {
  return ARTWORK_ZONES.has(zone);
}

/** @deprecated use isArtworkEditableZone */
export function isEditableZone(zone) {
  return isArtworkEditableZone(zone);
}

/**
 * Migrate legacy layer face → surfaceZone.
 * Interior is now a valid artwork target.
 */
export function migrateLayerSurface(layer) {
  if (layer.surfaceZone && layer.surfaceZone !== 'exterior' && layer.surfaceZone !== 'interior') {
    return layer;
  }
  if (layer.face === 'interior' || layer.surfaceZone === 'interior') {
    const next = { ...layer, surfaceZone: ZONE.INTERIOR };
    delete next.face;
    return next;
  }
  if (layer.surfaceZone === 'exterior') {
    const next = { ...layer, surfaceZone: ZONE.BACK };
    delete next.face;
    return next;
  }
  const next = { ...layer, surfaceZone: layer.surfaceZone || ZONE.BACK };
  delete next.face;
  return next;
}
