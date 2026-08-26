/**
 * Local research mode — stores feature summaries in localStorage.
 * Never uploads. Raw trajectories only when explicitly enabled.
 */

const KEY = 'vulcet.humanCheck.research.v1';
const RAW_KEY = 'vulcet.humanCheck.researchRaw.v1';

export function loadResearchStore() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{"samples":[]}');
  } catch {
    return { samples: [] };
  }
}

export function saveResearchSample(entry, { includeRaw = false, rawTrajectory = null } = {}) {
  const store = loadResearchStore();
  const sample = {
    sampleId: entry.sampleId || `hc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    pointerType: entry.pointerType,
    viewport: entry.viewport || null,
    geometry: entry.geometry || null,
    features: entry.features,
    label: entry.label || 'human',
    classification: entry.classification || null
  };
  store.samples.push(sample);
  localStorage.setItem(KEY, JSON.stringify(store));

  if (includeRaw && rawTrajectory) {
    let rawStore;
    try {
      rawStore = JSON.parse(localStorage.getItem(RAW_KEY) || '{"trajectories":[]}');
    } catch {
      rawStore = { trajectories: [] };
    }
    rawStore.trajectories.push({
      sampleId: sample.sampleId,
      points: rawTrajectory.map((p) => ({ x: p.x, y: p.y, t: p.t }))
    });
    localStorage.setItem(RAW_KEY, JSON.stringify(rawStore));
  }
  return sample;
}

export function clearResearchStore() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(RAW_KEY);
}

export function exportResearchJSON() {
  const store = loadResearchStore();
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(RAW_KEY) || 'null');
  } catch {
    raw = null;
  }
  return {
    exportedAt: new Date().toISOString(),
    note: 'Local Human Check research export — not uploaded automatically.',
    samples: store.samples,
    rawTrajectories: raw?.trajectories || []
  };
}

export function researchStats(featureKey) {
  const store = loadResearchStore();
  const vals = store.samples
    .map((s) => s.features?.[featureKey])
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!vals.length) {
    return { count: 0 };
  }
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  const pct = (p) => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
  };
  return {
    count: vals.length,
    mean,
    median,
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p05: pct(0.05),
    p25: pct(0.25),
    p50: pct(0.5),
    p75: pct(0.75),
    p95: pct(0.95)
  };
}

/**
 * Confusion-matrix utilities for labelled local samples.
 * Treat human_like as positive for "human" detection when label === 'human'.
 */
export function evaluateLabels(samples, predictState) {
  let TP = 0;
  let FP = 0;
  let TN = 0;
  let FN = 0;
  samples.forEach((s) => {
    const isHuman = s.label === 'human';
    const predHuman = predictState(s) === 'human_like';
    if (isHuman && predHuman) TP += 1;
    else if (!isHuman && predHuman) FP += 1;
    else if (!isHuman && !predHuman) TN += 1;
    else FN += 1;
  });
  const safe = (a, b) => (b === 0 ? 0 : a / b);
  const precision = safe(TP, TP + FP);
  const recall = safe(TP, TP + FN);
  const specificity = safe(TN, TN + FP);
  return {
    TP, FP, TN, FN,
    accuracy: safe(TP + TN, TP + TN + FP + FN),
    precision,
    recall,
    specificity,
    falsePositiveRate: safe(FP, FP + TN),
    falseNegativeRate: safe(FN, FN + TP),
    F1: safe(2 * precision * recall, precision + recall)
  };
}
