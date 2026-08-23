import type { ImpulseRisk } from '../scoring/types'

/** Presentation-only banding — scoring engine still uses 0–100 internally. */
export type Band3 = 'low' | 'mid' | 'high'

export function bandFromScore(n: number): Band3 {
  if (n >= 70) return 'high'
  if (n >= 45) return 'mid'
  return 'low'
}

export function useLabel(score: number): 'LOW' | 'MODERATE' | 'HIGH' {
  const b = bandFromScore(score)
  if (b === 'high') return 'HIGH'
  if (b === 'mid') return 'MODERATE'
  return 'LOW'
}

export function needLabel(score: number): 'WEAK' | 'MODERATE' | 'STRONG' {
  const b = bandFromScore(score)
  if (b === 'high') return 'STRONG'
  if (b === 'mid') return 'MODERATE'
  return 'WEAK'
}

export function worthLabel(score: number): 'POOR' | 'FAIR' | 'GOOD' {
  const b = bandFromScore(score)
  if (b === 'high') return 'GOOD'
  if (b === 'mid') return 'FAIR'
  return 'POOR'
}

export function urgeLabel(risk: ImpulseRisk): 'LOW' | 'MEDIUM' | 'HIGH' {
  return risk
}

export interface ReadSignal {
  key: string
  name: string
  level: string
  tone: Band3
}

export function buildTheRead(args: {
  utility: number
  need: number
  value: number
  impulseRisk: ImpulseRisk
}): ReadSignal[] {
  return [
    {
      key: 'use',
      name: 'USE',
      level: useLabel(args.utility),
      tone: bandFromScore(args.utility),
    },
    {
      key: 'need',
      name: 'NEED',
      level: needLabel(args.need),
      tone: bandFromScore(args.need),
    },
    {
      key: 'worth',
      name: 'WORTH',
      level: worthLabel(args.value),
      tone: bandFromScore(args.value),
    },
    {
      key: 'urge',
      name: 'URGE',
      level: urgeLabel(args.impulseRisk),
      tone:
        args.impulseRisk === 'HIGH'
          ? 'high'
          : args.impulseRisk === 'MEDIUM'
            ? 'mid'
            : 'low',
    },
  ]
}
