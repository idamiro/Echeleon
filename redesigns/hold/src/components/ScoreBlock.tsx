interface ScoreBlockProps {
  label: string
  value: number | string
  hint?: string
  /** 0–100 for meter; omit for categorical (impulse) */
  meter?: number
}

function tone(meter?: number, value?: number | string): 'high' | 'mid' | 'low' | 'warn' {
  if (typeof value === 'string') {
    if (value === 'HIGH') return 'warn'
    if (value === 'MEDIUM') return 'mid'
    return 'high'
  }
  const m = meter ?? (typeof value === 'number' ? value : 50)
  if (m >= 70) return 'high'
  if (m >= 45) return 'mid'
  return 'low'
}

export function ScoreBlock({ label, value, hint, meter }: ScoreBlockProps) {
  const m =
    meter ??
    (typeof value === 'number'
      ? value
      : value === 'HIGH'
        ? 85
        : value === 'MEDIUM'
          ? 55
          : 25)
  const t = tone(meter, value)

  return (
    <div className={`score-block score-${t}`}>
      <span className="score-label">{label}</span>
      <span className="score-value">{value}</span>
      <span className="score-meter" aria-hidden="true">
        <i style={{ width: `${Math.max(6, Math.min(100, m))}%` }} />
      </span>
      {hint ? <span className="score-hint">{hint}</span> : null}
    </div>
  )
}
