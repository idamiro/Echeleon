import { describe, expect, it } from 'vitest'
import {
  buildTheRead,
  needLabel,
  urgeLabel,
  useLabel,
  worthLabel,
} from './readLabels'

describe('readLabels', () => {
  it('maps scores to qualitative bands without exposing numbers', () => {
    expect(useLabel(83)).toBe('HIGH')
    expect(needLabel(78)).toBe('STRONG')
    expect(worthLabel(76)).toBe('GOOD')
    expect(useLabel(50)).toBe('MODERATE')
    expect(needLabel(40)).toBe('WEAK')
    expect(worthLabel(40)).toBe('POOR')
    expect(urgeLabel('LOW')).toBe('LOW')
  })

  it('builds THE READ for any product scores', () => {
    const read = buildTheRead({
      utility: 83,
      need: 78,
      value: 76,
      impulseRisk: 'LOW',
    })
    expect(read.map((s) => `${s.name}: ${s.level}`)).toEqual([
      'USE: HIGH',
      'NEED: STRONG',
      'WORTH: GOOD',
      'URGE: LOW',
    ])
  })
})
