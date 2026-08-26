/**
 * Debug panel rendering — feature groups, path viz, velocity graph, synthetic battery.
 * Heuristic scores are humanLikeScore / syntheticRisk — never "P(human)".
 */

export function renderDebugPanel(root, payload) {
  if (!root) return;
  const { result, series, geometryMeta, battery } = payload;
  const f = result.features;
  const d = result.diagnostics || {};
  const profile = result.classifierProfile || f.pointerType || 'mouse';

  const scoreLine = result.state === 'accessible_completion'
    ? [
      `state: ${result.state}`,
      `modelType: ${result.modelType || 'heuristic'}`,
      'humanLikeScore: null (keyboard bypass)',
      'syntheticRisk: null',
      `confidence: ${fmtNum(result.confidence)}`,
      `pointerType: ${f.pointerType}`,
      '',
      'Accessible keyboard completion.',
      'Pointer trajectory classifier not applied.',
      '',
      'contributions:',
      ...(result.contributions || []).map((c) => `• ${c}`)
    ]
    : [
      `Classifier profile: ${profile}`,
      `Calibration: provisional`,
      `state: ${result.state}`,
      `modelType: ${result.modelType || 'heuristic'}`,
      `humanLikeScore: ${fmtNum(result.humanLikeScore)}`,
      `syntheticRisk: ${fmtNum(result.syntheticRisk)}`,
      `confidence: ${fmtNum(result.confidence)}`,
      `pointerType: ${f.pointerType}`,
      '',
      'Note: humanLikeScore is NOT a calibrated probability.',
      '',
      'Top positive signals:',
      ...((d.topPositive && d.topPositive.length) ? d.topPositive.map((x) => `• ${x}`) : ['• —']),
      '',
      'Top negative signals:',
      ...((d.topNegative && d.topNegative.length) ? d.topNegative.map((x) => `• ${x}`) : ['• —']),
      '',
      ...(f.pointerType === 'touch' && (d.uncertaintyDrivers || []).length
        ? [
          'Touch uncertainty drivers:',
          ...d.uncertaintyDrivers.map((x) => `• ${x}`),
          ''
        ]
        : []),
      'contributions:',
      ...(result.contributions || []).map((c) => `• ${c}`)
    ];

  root.innerHTML = `
    <p class="hc-debug-title">Debug · ${result.calibrationVersion || 'heuristic'} · profile=${escapeText(profile)}</p>
    <div class="hc-debug-grid">
      <section>
        <h3>Classification</h3>
        <pre>${escapeText(scoreLine.join('\n'))}</pre>
      </section>
      <section>
        <h3>Touch / modality snapshot</h3>
        <pre>${escapeText(fmt({
          pointerType: f.pointerType,
          state: result.state,
          humanLikeScore: fmtNum(result.humanLikeScore),
          syntheticRisk: fmtNum(result.syntheticRisk),
          confidence: fmtNum(result.confidence),
          sampleCount: f.sampleCount,
          movementTime: rnd(f.movementTime),
          pathLength: rnd(f.pathLength),
          displacement: rnd(f.displacement),
          startTargetDistance: rnd(f.startTargetDistance),
          normalizedPathLength: fmtNum(d.normalizedPathLength, 3),
          normalizedDisplacement: fmtNum(d.normalizedDisplacement, 3),
          pathEfficiency: fmtNum(f.pathEfficiency, 3),
          velocityCV: fmtNum(f.velocityCV, 3),
          normalizedPeakTime: fmtNum(f.normalizedPeakTime, 3),
          sampleIntervalCV: fmtNum(f.sampleIntervalCV, 3),
          timingEntropy: fmtNum(f.timingEntropy, 3),
          meanAbsDirectionChange: fmtNum(f.meanAbsDirectionChange, 3),
          microCorrectionCount: nullish(f.microCorrectionCount),
          lateMicroCorrectionCount: nullish(f.lateMicroCorrectionCount),
          meanAxisDeviationNorm: fmtNum(f.meanAxisDeviationNorm, 4),
          submovementCount: nullish(f.submovementCount),
          normalizedJerk: f.normalizedJerk == null ? 'null' : Number(f.normalizedJerk).toExponential(2)
        }))}</pre>
      </section>
      <section>
        <h3>Weighted feature contributions</h3>
        <pre>${escapeText(fmt(Object.fromEntries(
          Object.entries(result.weightedContributions || {}).map(([k, v]) => [
            k,
            v == null ? 'null' : Number(v).toFixed(4)
          ])
        )))}</pre>
      </section>
      <section>
        <h3>Feature validity</h3>
        <pre>${escapeText(fmt(f.featureValidity || {}))}</pre>
      </section>
      <section>
        <h3>Geometry</h3>
        <pre>${escapeText(fmt({
          distance: rnd(f.startTargetDistance),
          pathLength: rnd(f.pathLength),
          displacement: rnd(f.displacement),
          pathEfficiency: fmtNum(f.pathEfficiency, 3),
          pathDeviationRatio: fmtNum(f.pathDeviationRatio, 3),
          meanAxisDeviationNorm: fmtNum(f.meanAxisDeviationNorm, 4),
          maxAxisDeviationNorm: fmtNum(f.maxAxisDeviationNorm, 4),
          fittsID: fmtNum(f.fittsID, 3),
          fittsWidth: rnd(f.fittsWidth)
        }))}</pre>
      </section>
      <section>
        <h3>Timing (raw event intervals)</h3>
        <pre>${escapeText(fmt({
          movementTimeMs: rnd(f.movementTime),
          reactionMs: rnd(f.reactionMs),
          sampleCount: f.sampleCount,
          resampledSampleCount: f.resampledSampleCount,
          dtMean: fmtNum(f.dtMean, 2),
          dtStd: fmtNum(f.dtStd, 2),
          sampleIntervalCV: fmtNum(f.sampleIntervalCV, 3),
          timingEntropy: fmtNum(f.timingEntropy, 3)
        }))}</pre>
      </section>
      <section>
        <h3>Kinematics</h3>
        <pre>${escapeText(fmt({
          meanVelocity: rnd(f.meanVelocity),
          maxVelocity: rnd(f.maxVelocity),
          velocityCV: fmtNum(f.velocityCV, 3),
          normalizedPeakTime: fmtNum(f.normalizedPeakTime, 3),
          accelerationStd: rnd(f.accelerationStd),
          meanAbsoluteJerk: rnd(f.meanAbsoluteJerk),
          normalizedJerk: f.normalizedJerk == null ? 'null' : Number(f.normalizedJerk).toExponential(2)
        }))}</pre>
      </section>
      <section>
        <h3>Direction</h3>
        <pre>${escapeText(fmt({
          meanAbsDirectionChange: fmtNum(f.meanAbsDirectionChange, 3),
          directionChangeCount: nullish(f.directionChangeCount),
          directionEntropy: fmtNum(f.directionEntropy, 3),
          meanCurvature: fmtNum(f.meanCurvature, 4),
          curvatureEntropy: fmtNum(f.curvatureEntropy, 3)
        }))}</pre>
      </section>
      <section>
        <h3>Corrections</h3>
        <pre>${escapeText(fmt({
          microCorrectionCount: nullish(f.microCorrectionCount),
          lateMicroCorrectionCount: nullish(f.lateMicroCorrectionCount),
          backwardProgressCount: nullish(f.backwardProgressCount),
          overshootCount: nullish(f.overshootCount),
          overshootDistance: rnd(f.overshootDistance),
          submovementCount: nullish(f.submovementCount),
          lateSubmovementCount: nullish(f.lateSubmovementCount),
          minimumJerkDeviation: fmtNum(f.minimumJerkDeviation, 3)
        }))}</pre>
      </section>
      <section>
        <h3>Interaction risks</h3>
        <pre>${escapeText(fmt(Object.fromEntries(
          Object.entries(result.risks || {}).map(([k, v]) => [k, typeof v === 'number' ? v.toFixed(3) : v])
        )))}</pre>
      </section>
      <section>
        <h3>Neuromotor</h3>
        <pre>${escapeText(JSON.stringify(f.experimentalNeuromotorMetrics || {}, null, 2))}</pre>
      </section>
    </div>
    <div class="hc-debug-viz">
      <canvas data-hc-debug-path width="320" height="200" aria-label="Debug trajectory"></canvas>
      <canvas data-hc-debug-vel width="320" height="120" aria-label="Velocity vs time"></canvas>
    </div>
    <div class="hc-debug-actions">
      <button type="button" class="button button--secondary" data-hc-run-battery>Run synthetic battery</button>
      <button type="button" class="button button--secondary" data-hc-export-research>Export research JSON</button>
      <button type="button" class="button button--secondary" data-hc-clear-research>Clear research store</button>
      <label class="hc-debug-check"><input type="checkbox" data-hc-research-mode> Research capture</label>
      <label class="hc-debug-check"><input type="checkbox" data-hc-research-raw> Store raw trajectories</label>
    </div>
    <pre class="hc-debug-battery" data-hc-battery-out>${battery ? escapeText(battery) : 'Synthetic battery not run yet.'}</pre>
  `;

  drawPath(root.querySelector('[data-hc-debug-path]'), series, geometryMeta);
  drawVelocity(root.querySelector('[data-hc-debug-vel]'), series?.velocities || []);
}

function fmt(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n');
}

function rnd(v) {
  if (v == null || !Number.isFinite(v)) return 'null';
  return Math.round(v * 100) / 100;
}

function fmtNum(v, digits = 3) {
  if (v == null || !Number.isFinite(v)) return 'null';
  return Number(v).toFixed(digits);
}

function nullish(v) {
  return v == null ? 'null' : v;
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function drawPath(canvas, series, geometryMeta) {
  if (!canvas || !geometryMeta) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f7f4ed';
  ctx.fillRect(0, 0, w, h);

  const pts = geometryMeta.samples || [];
  const container = geometryMeta.container || { width: 1, height: 1 };
  const sx = (x) => (x / container.width) * w;
  const sy = (y) => (y / container.height) * h;

  const start = geometryMeta.start;
  const target = geometryMeta.targetCenter;
  if (start && target) {
    ctx.strokeStyle = 'rgba(23,23,21,0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx(start.x), sy(start.y));
    ctx.lineTo(sx(target.x), sy(target.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(sx(target.x), sy(target.y), Math.max(6, (geometryMeta.targetRadius / container.width) * w * 0.5), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(23,23,21,0.4)';
    ctx.stroke();
  }

  if (pts.length > 1) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = sx(p.x);
      const y = sy(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#171715';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawVelocity(canvas, velocities) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f7f4ed';
  ctx.fillRect(0, 0, w, h);
  if (!velocities.length) return;
  const maxV = Math.max(...velocities, 1);
  ctx.strokeStyle = '#171715';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  velocities.forEach((v, i) => {
    const x = (i / Math.max(velocities.length - 1, 1)) * (w - 16) + 8;
    const y = h - 10 - (v / maxV) * (h - 24);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = 'rgba(23,23,21,0.55)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('velocity / sample index', 8, 12);
}

export function formatBatteryReport(rows) {
  return rows.map((r) => {
    const riskVal = r.syntheticRisk;
    const riskLabel = riskVal == null
      ? 'n/a'
      : riskVal >= 0.62 ? 'HIGH' : riskVal >= 0.4 ? 'MEDIUM' : 'LOW';
    const score = r.humanLikeScore == null ? 'null' : Number(r.humanLikeScore).toFixed(2);
    const risk = riskVal == null ? 'null' : `${riskLabel} (${Number(riskVal).toFixed(2)})`;
    return `${r.label}\n  state: ${r.state} · syntheticRisk: ${risk} · humanLikeScore=${score}\n  expect: ${r.expect}`;
  }).join('\n\n') + '\n\nNote: heuristic humanLikeScore is not a calibrated probability. Replayed genuine trajectories may still look human-like.';
}
