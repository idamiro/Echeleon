interface ScoreBlockProps {
  label: string
  value: number | string
  hint?: string
}

export function ScoreBlock({ label, value, hint }: ScoreBlockProps) {
  return (
    <div className="score-block">
      <span className="score-label">{label}</span>
      <span className="score-value">{value}</span>
      {hint ? <span className="score-hint">{hint}</span> : null}
    </div>
  )
}
