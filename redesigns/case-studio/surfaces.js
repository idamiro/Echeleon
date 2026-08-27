/**
 * Case Studio — semantic surface classification for the leather case GLB.
 * Classification is in CASE-LOCAL space and is independent of camera orbit.
 *
 * Leather_Case local axes (verified from GLB):
 *   Z ≈ thickness (toward phone = +Z)
 *   Y ≈ height
 *   X ≈ width
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

/** Zones the user may paint / place artwork onto */
export const EDITABLE_ZONES = new Set([ZONE.BACK, ZONE.LEFT, ZONE.RIGHT]);

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
 * Infer case-local thickness / height / width axes from phone offset + bbox.
 * @returns {{thickAxis:'x'|'y'|'z', heightAxis:'x'|'y'|'z', widthAxis:'x'|'y'|'z', towardPhoneSign:number}}
 */
export function inferCaseAxes(caseLocalSize, toPhoneFromCenter) {
  const abs = [
    Math.abs(toPhoneFromCenter.x),
    Math.abs(toPhoneFromCenter.y),
    Math.abs(toPhoneFromCenter.z)
  ];
  const thickAxis = abs[0] >= abs[1] && abs[0] >= abs[2] ? 'x' : abs[1] >= abs[2] ? 'y' : 'z';
  const towardPhoneSign = Math.sign(
    thickAxis === 'x' ? toPhoneFromCenter.x
      : thickAxis === 'y' ? toPhoneFromCenter.y
        : toPhoneFromCenter.z
  ) || 1;

  const dims = { x: caseLocalSize.x, y: caseLocalSize.y, z: caseLocalSize.z };
  const rest = ['x', 'y', 'z'].filter((a) => a !== thickAxis).sort((a, b) => dims[b] - dims[a]);
  return {
    thickAxis,
    heightAxis: rest[0],
    widthAxis: rest[1],
    towardPhoneSign,
    dims
  };
}

function comp(v, axis) {
  return axis === 'x' ? v.x : axis === 'y' ? v.y : v.z;
}

/**
 * Split leather case geometry into semantic surface zone BufferGeometries.
 * Preserves original primary UV values exactly (copied per triangle).
 *
 * @param {THREE.Mesh} mesh
 * @param {THREE.Vector3} phoneCenterWorld
 * @returns {{ geometries: Record<string, THREE.BufferGeometry>, stats: object, axes: object }}
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

  // Camera cutout region: upper portion of back face (high height axis)
  const hMin = comp(bb.min, axes.heightAxis);
  const hMax = comp(bb.max, axes.heightAxis);
  const hSpan = Math.max(1e-6, hMax - hMin);
  const wMin = comp(bb.min, axes.widthAxis);
  const wMax = comp(bb.max, axes.widthAxis);
  const wSpan = Math.max(1e-6, wMax - wMin);
  // iPhone 14 Pro camera island ≈ top (~80–100% height) and one side of width
  const camH0 = hMin + hSpan * 0.72;
  const camW0 = wMin + wSpan * 0.55; // island sits toward +width in local X for this asset

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

  const cLocal = new THREE.Vector3();
  const nLocal = new THREE.Vector3();
  const toP = new THREE.Vector3();

  const DOT_BACK = 0.42;
  const DOT_SIDE = 0.55;

  for (let t = 0; t < triCount; t += 1) {
    const i = t * 3;
    cLocal.set(
      (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
      (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    );

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

    toP.copy(phoneLocal).sub(cLocal);
    // Interior: geometric normal points toward the phone
    if (nLocal.dot(toP) > 0) {
      buckets[ZONE.INTERIOR].push(t);
      continue;
    }

    const nThick = comp(nLocal, axes.thickAxis);
    const nH = comp(nLocal, axes.heightAxis);
    const nW = comp(nLocal, axes.widthAxis);
    const awaySign = -axes.towardPhoneSign;
    const aT = Math.abs(nThick);
    const aH = Math.abs(nH);
    const aW = Math.abs(nW);

    const cH = comp(cLocal, axes.heightAxis);
    const cW = comp(cLocal, axes.widthAxis);
    const inCameraRegion = cH >= camH0 && cW >= camW0;

    // Camera outer lip: near cutout, normals not purely back-facing
    if (inCameraRegion && nThick * awaySign > 0.15 && aT < 0.92 && (aW > 0.25 || aH > 0.25)) {
      buckets[ZONE.CAMERA_LIP].push(t);
      continue;
    }

    // Back exterior panel
    if (nThick * awaySign > DOT_BACK && aT >= aH && aT >= aW) {
      buckets[ZONE.BACK].push(t);
      continue;
    }

    // Left / right outer side walls (width axis)
    if (aW >= DOT_SIDE && aW >= aH && aW >= aT * 0.75) {
      buckets[nW >= 0 ? ZONE.RIGHT : ZONE.LEFT].push(t);
      continue;
    }

    // Top / bottom outer walls (height axis)
    if (aH >= DOT_SIDE && aH >= aW && aH >= aT * 0.75) {
      buckets[nH >= 0 ? ZONE.TOP : ZONE.BOTTOM].push(t);
      continue;
    }

    // Remaining exterior transitions
    if (aT >= aH && aT >= aW && nThick * awaySign > 0) {
      buckets[ZONE.BACK].push(t);
    } else if (aW >= aH) {
      buckets[nW >= 0 ? ZONE.RIGHT : ZONE.LEFT].push(t);
    } else if (aH >= aW) {
      buckets[nH >= 0 ? ZONE.TOP : ZONE.BOTTOM].push(t);
    } else {
      buckets[ZONE.BEVEL].push(t);
    }
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
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (g.attributes.uv2) g.deleteAttribute('uv2');
    if (g.attributes.TEXCOORD_1) g.deleteAttribute('TEXCOORD_1');
    if (tris.length) {
      g.computeVertexNormals();
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
        : null
    };
  }

  return { geometries, stats, axes, phoneLocal: phoneLocal.toArray() };
}

export function isEditableZone(zone) {
  return EDITABLE_ZONES.has(zone);
}

/**
 * Migrate legacy layer face → surfaceZone.
 * Interior artwork is not editable — move to back or drop strokes.
 */
export function migrateLayerSurface(layer) {
  if (layer.surfaceZone && layer.surfaceZone !== 'exterior' && layer.surfaceZone !== 'interior') {
    if (layer.surfaceZone === ZONE.INTERIOR) {
      if (layer.type === 'stroke') return null;
      return { ...layer, surfaceZone: ZONE.BACK, face: undefined };
    }
    return layer;
  }
  if (layer.face === 'interior') {
    if (layer.type === 'stroke') return null;
    const next = { ...layer, surfaceZone: ZONE.BACK };
    delete next.face;
    return next;
  }
  const next = { ...layer, surfaceZone: ZONE.BACK };
  delete next.face;
  return next;
}
