import type { AssessmentInput, ImpulseRisk, SignalItem } from './types';
import { estimatedUses } from './normalize';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount < 10 ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Deterministic supporting / pausing signals from inputs + derived metrics */
export function buildSignals(
  input: AssessmentInput,
  metrics: {
    utility: number;
    need: number;
    value: number;
    impulseRisk: ImpulseRisk;
    costPerUse: number | null;
    estimatedUses: number | null;
  }
): { whyItMakesSense: SignalItem[]; whatGivesPause: SignalItem[] } {
  const sense: SignalItem[] = [];
  const pause: SignalItem[] = [];

  // --- sense ---
  if (input.frequency === 'daily' || input.frequency === 'few_times_week') {
    sense.push({
      id: 'freq_high',
      weight: 90,
      text: 'You would likely use this frequently.',
    });
  }
  if (input.overlap === 'no') {
    sense.push({
      id: 'overlap_none',
      weight: 80,
      text: 'You do not already own something that does the same job.',
    });
  }
  if (input.overlap === 'needs_replacing') {
    sense.push({
      id: 'overlap_replace',
      weight: 75,
      text: 'What you own now needs replacing.',
    });
  }
  if (input.importance >= 4) {
    sense.push({
      id: 'importance_high',
      weight: 70 + input.importance,
      text: 'You rated this as meaningfully important to your life or work.',
    });
  }
  if (input.considered === 'more_month' || input.considered === 'few_weeks') {
    sense.push({
      id: 'considered_long',
      weight: 65,
      text: 'You have been considering this for more than a few days.',
    });
  }
  if (input.affordability === 'barely') {
    sense.push({
      id: 'afford_ok',
      weight: 55,
      text: 'The spend would barely affect your available money.',
    });
  }
  if (input.ownershipYears >= 2) {
    sense.push({
      id: 'own_long',
      weight: 50,
      text: `You expect to keep using it for about ${input.ownershipYears} years.`,
    });
  }
  if (metrics.costPerUse != null && metrics.costPerUse <= 2 && metrics.utility >= 60) {
    sense.push({
      id: 'cpu_ok',
      weight: 60,
      text: `At your expected usage, estimated cost per use is ${formatMoney(metrics.costPerUse, input.currency)}.`,
    });
  }
  if (input.reason === 'genuine_need' || input.reason === 'improve_regular') {
    sense.push({
      id: 'reason_solid',
      weight: 40,
      text:
        input.reason === 'genuine_need'
          ? 'You described a genuine need.'
          : 'It would improve something you already do regularly.',
    });
  }

  // --- pause ---
  if (input.overlap === 'works_fine') {
    pause.push({
      id: 'overlap_fine',
      weight: 95,
      text: 'You already own something that serves the same purpose and still works.',
    });
  }
  if (input.considered === 'today') {
    pause.push({
      id: 'today',
      weight: 90,
      text: 'You only started considering this today.',
    });
  }
  if (input.reason === 'just_discovered') {
    pause.push({
      id: 'discovered',
      weight: 88,
      text: 'You just discovered it.',
    });
  }
  if (input.reason === 'on_sale') {
    pause.push({
      id: 'sale',
      weight: 82,
      text: 'A sale or discount is part of what is driving this.',
    });
  }
  if (input.frequency === 'rarely') {
    pause.push({
      id: 'rare',
      weight: 85,
      text: 'Expected use looks rare.',
    });
  }
  if (input.frequency === 'few_times_month') {
    pause.push({
      id: 'sparse',
      weight: 70,
      text: 'You would only use this a few times a month.',
    });
  }
  if (input.affordability === 'significantly') {
    pause.push({
      id: 'afford_hit',
      weight: 92,
      text: 'Buying this would significantly affect your available spending money.',
    });
  }
  if (input.affordability === 'noticeably') {
    pause.push({
      id: 'afford_notice',
      weight: 60,
      text: 'The spend would be noticeable in your budget.',
    });
  }
  if (input.importance <= 2) {
    pause.push({
      id: 'imp_low',
      weight: 75,
      text: 'If you could not buy it, the effect on your life or work would be limited.',
    });
  }
  if (metrics.impulseRisk === 'HIGH') {
    pause.push({
      id: 'impulse_high',
      weight: 68,
      text: 'Several impulse signals showed up together.',
    });
  }
  if (metrics.need < 40 && metrics.utility >= 65) {
    pause.push({
      id: 'useful_not_necessary',
      weight: 72,
      text: 'Useful does not always mean necessary — utility is ahead of need.',
    });
  }
  if (metrics.costPerUse != null && metrics.costPerUse > 15) {
    pause.push({
      id: 'cpu_high',
      weight: 58,
      text: `At your expected usage, estimated cost per use is ${formatMoney(metrics.costPerUse, input.currency)}.`,
    });
  }

  // Always ensure we can pick at least something soft
  if (sense.length === 0 && metrics.utility >= 50) {
    sense.push({
      id: 'util_fallback',
      weight: 30,
      text: 'On balance, the usefulness signals are moderate to strong.',
    });
  }
  if (pause.length === 0) {
    pause.push({
      id: 'pause_fallback',
      weight: 20,
      text: 'No major red flags stood out — still worth a clear decision, not autopilot.',
    });
  }

  const top = (arr: SignalItem[], n: number) =>
    [...arr].sort((a, b) => b.weight - a.weight).slice(0, n);

  // Avoid duplicate themes: if both sale and discovered, keep stronger
  return {
    whyItMakesSense: top(sense, 2),
    whatGivesPause: top(pause, 2),
  };
}

export function buildObservations(
  input: AssessmentInput,
  metrics: {
    costPerUse: number | null;
    estimatedUses: number | null;
    contradictions: string[];
  },
  impulseFlags: string[]
): string[] {
  const out: string[] = [];
  const uses = metrics.estimatedUses ?? Math.round(estimatedUses(input));

  if (input.frequency === 'daily' || input.frequency === 'few_times_week') {
    out.push("You'd likely use this frequently.");
  } else if (input.frequency === 'rarely') {
    out.push('Expected use looks rare.');
  }

  if (input.overlap === 'works_fine') {
    out.push('You already own something that serves the same purpose.');
  } else if (input.overlap === 'no') {
    out.push('Nothing you own already covers this job.');
  }

  if (metrics.costPerUse != null) {
    out.push(
      `At your expected usage (~${uses} uses), estimated cost per use is ${formatMoney(metrics.costPerUse, input.currency)}.`
    );
  }

  if (input.considered === 'today') {
    out.push('You only started considering this today.');
  }

  for (const c of metrics.contradictions.slice(0, 1)) {
    out.push(c);
  }

  if (impulseFlags.includes('on_sale') && !out.some((o) => o.includes('sale'))) {
    out.push('A sale is part of the pull.');
  }

  return out.slice(0, 4);
}
