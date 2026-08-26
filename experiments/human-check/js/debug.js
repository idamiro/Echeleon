/**
 * Debug panel rendering — feature groups, path viz, velocity graph, synthetic battery.
 */

export function renderDebugPanel(root, payload) {
  if (!root) return;
  const { result, series, geometryMeta, battery } = payload;
  const f = result.features;
  const pct = (v) => `${Math.round((v || 0) * 100)}%`;

  root.innerHTML = `
    <p class="hc-debug-title">Debug · ${result.calibrationVersion || 'heuristic'}</p>
    <div class="hc-debug-grid">
      <section>
        <h3>Classification</h3>
        <pre>${escapeText([
          `state: ${result.state}`,
          `humanProbability: ${result.humanProbability.toFixed(3)}`,
          `syntheticRisk: ${result.syntheticRisk.toFixed(3)}`,
          `confidence: ${result.confidence.toFixed(3)}`,
          `pointerType: ${f.pointerType}`,
          '',
          'contributions:',
          ...(result.contributions || []).map((c) => `• ${c}`)
        ].join('\n'))}</pre>
      </section>
      <section>
        <h3>Geometry</h3>
        <pre>${escapeText(fmt({
          distance: rnd(f.startTargetDistance),
          pathLength: rnd(f.pathLength),
          displacement: rnd(f.displacement),
          pathEfficiency: f.pathEfficiency.toFixed(3),
          pathDeviationRatio: f.pathDeviationRatio.toFixed(3),
          meanAxisDeviationNorm: f.meanAxisDeviationNorm.toFixed(4),
          maxAxisDeviationNorm: f.maxAxisDeviationNorm.toFixed(4),
          fittsID: f.fittsID.toFixed(3),
          fittsWidth: rnd(f.fittsWidth)
        }))}</pre>
      </section>
      <section>
        <h3>Timing</h3>
        <pre>${escapeText(fmt({
          movementTimeMs: rnd(f.movementTime),
          reactionMs: rnd(f.reactionMs),
          sampleCount: f.sampleCount,
          dtMean: f.dtMean.toFixed(2),
          sampleIntervalCV: f.sampleIntervalCV.toFixed(3),
          timingEntropy: f.timingEntropy.toFixed(3)
        }))}</pre>
      </section>
      <section>
        <h3>Kinematics</h3>
        <pre>${escapeText(fmt({
          meanVelocity: rnd(f.meanVelocity),
          maxVelocity: rnd(f.maxVelocity),
          velocityCV: f.velocityCV.toFixed(3),
          normalizedPeakTime: f.normalizedPeakTime.toFixed(3),
          accelerationStd: rnd(f.accelerationStd),
          meanAbsoluteJerk: rnd(f.meanAbsoluteJerk),
          normalizedJerk: f.normalizedJerk.toExponential(2)
        }))}</pre>
      </section>
      <section>
        <h3>Direction</h3>
        <pre>${escapeText(fmt({
          meanAbsDirectionChange: f.meanAbsDirectionChange.toFixed(3),
          directionChangeCount: f.directionChangeCount,
          directionEntropy: f.directionEntropy.toFixed(3),
          meanCurvature: f.meanCurvature.toFixed(4),
          curvatureEntropy: f.curvatureEntropy.toFixed(3)
        }))}</pre>
      </section>
      <section>
        <h3>Corrections</h3>
        <pre>${escapeText(fmt({
          microCorrectionCount: f.microCorrectionCount,
          lateMicroCorrectionCount: f.lateMicroCorrectionCount,
          backwardProgressCount: f.backwardProgressCount,
          overshootCount: f.overshootCount,
          overshootDistance: rnd(f.overshootDistance),
          submovementCount: f.submovementCount,
          lateSubmovementCount: f.lateSubmovementCount,
          minimumJerkDeviation: f.minimumJerkDeviation.toFixed(3)
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
  return Math.round(v * 100) / 100;
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

  const samples = series?.progress
    ? null
    : null;
  // analysis samples passed via geometryMeta.linkedSamples optionally
  const pts = geometryMeta.samples || [];
  const container = geometryMeta.container || { width: 1, height: 1 };
  const sx = (x) => (x / container.width) * w;
  const sy = (y) => (y / container.height) * h;

  // Ideal axis
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
  ctx.fillText('velocity / normalized time', 8, 12);
}

export function formatBatteryReport(rows) {
  return rows.map((r) => {
    const risk = r.syntheticRisk >= 0.62 ? 'HIGH' : r.syntheticRisk >= 0.4 ? 'MEDIUM' : 'LOW';
    return `${r.label}\n  state: ${r.state} · synthetic risk: ${risk} (${r.syntheticRisk.toFixed(2)}) · P(human)=${r.humanProbability.toFixed(2)}\n  expect: ${r.expect}`;
  }).join('\n\n') + '\n\nNote: a replayed genuine human trajectory may still look human-like — trajectory-only detection cannot stop exact replay.';
}
