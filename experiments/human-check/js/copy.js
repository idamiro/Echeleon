/**
 * Result / recording copy for Human Check.
 */

export const ICONS = {
  human_like: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5"/><path d="M14 24.5l6.2 6.2L34 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  synthetic_like: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5"/><path d="M16 24h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  uncertain: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5"/><path d="M24 16v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="33" r="1.6" fill="currentColor"/></svg>`,
  insufficient_signal: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3.5 4"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>`
};

export const REC_LINES = {
  intro: 'Human verification interrupts the experience.',
  challenge: 'What if the interaction became the signal?',
  result: 'Verification as interaction, not interruption. — Vulcet'
};

export function copyForResult(result) {
  const secs = (result.features.totalMs / 1000).toFixed(1);
  const f = result.features;
  const evidence = buildEvidence(f, result.state);

  switch (result.state) {
    case 'human_like':
      return {
        title: 'Human enough.',
        note: f.pointerType === 'keyboard'
          ? 'Completed through the accessible keyboard path.'
          : 'The movement showed structured variation across timing, speed and path shape.',
        evidence,
        timeLabel: `Observed in ${secs} seconds`,
        caveat: f.pointerType === 'keyboard'
          ? 'A real system would use appropriate signals for non-pointer input — not mouse-like trajectory scoring.'
          : 'One interaction signal — not proof of identity.',
        insight: (result.contributions || []).slice(0, 2).join(' · ') || evidence
      };
    case 'synthetic_like':
      return {
        title: 'Movement looks synthetic.',
        note: 'Geometry, timing and kinematics together looked more scripted than motor-controlled.',
        evidence,
        timeLabel: `Observed in ${secs} seconds`,
        caveat: 'That does not prove a bot. It shows why a single trajectory signal is never enough for real verification.',
        insight: (result.contributions || []).slice(0, 2).join(' · ') || evidence
      };
    case 'uncertain':
      return {
        title: 'Not enough confidence.',
        note: 'Signals were mixed — some human-like structure, some synthetic-like regularity.',
        evidence,
        timeLabel: `Observed in ${secs} seconds`,
        caveat: 'Ambiguity is expected. A production system would need more than one movement.',
        insight: (result.contributions || []).slice(0, 2).join(' · ') || evidence
      };
    case 'insufficient_signal':
    default:
      return {
        title: 'Not enough movement data.',
        note: 'There wasn’t enough interaction to observe meaningful motor structure.',
        evidence,
        timeLabel: '',
        caveat: 'This isn’t a failed check — just too little motion to read.',
        insight: `Only ${f.sampleCount} analysis samples were available.`
      };
  }
}

function buildEvidence(f, state) {
  if (state === 'insufficient_signal') {
    return `${f.sampleCount} samples · ${(f.movementTime / 1000).toFixed(2)}s · ${Math.round(f.pathLength)}px path`;
  }
  const parts = [
    `${Math.round(f.pathEfficiency * 100)}% efficiency`,
    `vCV ${f.velocityCV.toFixed(2)}`,
    `${f.microCorrectionCount} micro-corrections`,
    `${f.submovementCount} submovements`
  ];
  return parts.join(' · ');
}
