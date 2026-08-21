import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthModal } from '../components/AuthModal'
import { HoldPressButton } from '../components/HoldPressButton'
import { ScoreBlock } from '../components/ScoreBlock'
import { createHold } from '../data/actions'
import * as auth from '../data/auth'
import * as db from '../data/db'
import type { AssessmentRecord, ProductRecord } from '../data/types'
import { formatMoney } from '../lib/currency'
import { HOLD_DAY_OPTIONS } from '../lib/options'

function scoreHint(label: string, n: number): string {
  if (label === 'Utility') {
    if (n >= 70) return 'Fits how you actually live'
    if (n >= 45) return 'Useful, but not a lock'
    return 'Use case still looks soft'
  }
  if (label === 'Need') {
    if (n >= 70) return 'There’s a real gap to fill'
    if (n >= 45) return 'Need is mixed'
    return 'More want than need'
  }
  if (label === 'Value') {
    if (n >= 70) return 'Price matches expected use'
    if (n >= 45) return 'Value is okay, not obvious'
    return 'Steep for how you’d use it'
  }
  return ''
}

function impulseHint(level: string): string {
  if (level === 'HIGH') return 'Several haste signals lined up'
  if (level === 'MEDIUM') return 'A little cooling-off helps'
  return 'Timing looks considered'
}

function impulseMeter(level: string): number {
  if (level === 'HIGH') return 88
  if (level === 'MEDIUM') return 55
  return 22
}

export function ResultPage() {
  const { productId = '', assessmentId = '' } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductRecord | null>(null)
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [holdDays, setHoldDays] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [p, a] = await Promise.all([
        db.getProduct(productId),
        db.getAssessment(assessmentId),
      ])
      if (cancelled) return
      if (!p || !a || a.productId !== p.id) {
        setError('Assessment not found.')
        return
      }
      setProduct(p)
      setAssessment(a)
      const suggested = a.result.holdDays
      setHoldDays(suggested && suggested > 0 ? suggested : 7)
    })()
    return () => {
      cancelled = true
    }
  }, [productId, assessmentId])

  const startHold = useCallback(async () => {
    if (!product || !assessment || holdDays == null) return
    setError('')
    setBusy(true)
    try {
      const user = await auth.getCurrentUser()
      if (!user) {
        setAuthOpen(true)
        setBusy(false)
        return
      }
      const hold = await createHold({
        productId: product.id,
        assessmentId: assessment.id,
        holdDays,
        recommendation: assessment.result.recommendation,
      })
      navigate(`/hold/${hold.id}`)
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH_REQUIRED') {
        setAuthOpen(true)
      } else {
        setError('Could not start hold.')
      }
    } finally {
      setBusy(false)
    }
  }, [product, assessment, holdDays, navigate])

  if (error && !product) {
    return (
      <div className="page">
        <p className="form-error">{error}</p>
        <Link to="/">Start over</Link>
      </div>
    )
  }

  if (!product || !assessment || holdDays == null) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  const r = assessment.result
  const verdictTone =
    r.recommendation === 'BUYING_NOW_SEEMS_REASONABLE'
      ? 'go'
      : r.recommendation === 'CONSIDER_LETTING_IT_GO'
        ? 'stop'
        : 'wait'

  const actionCopy =
    verdictTone === 'go'
      ? 'If you still want a pause, lock a short hold. Otherwise you’re clear.'
      : verdictTone === 'stop'
        ? 'You can still lock a HOLD if you want space before letting it go.'
        : 'Lock the waiting period. Come back with a clearer head.'

  return (
    <div className="page result-page">
      <div className="result-layout">
        <div className="result-main">
          <header className="result-hero">
            <p className="result-kicker">Assessment</p>
            <div className="product-line">
              <strong>{product.name}</strong>
              <span className="price">{formatMoney(product.price, product.currency)}</span>
            </div>
            <div className="product-meta">
              <span className="chip-quiet">{product.category}</span>
              {r.costPerUse != null ? (
                <span className="chip-quiet">
                  ~{formatMoney(r.costPerUse, product.currency)} / use
                </span>
              ) : null}
            </div>
          </header>

          <section className={`verdict-card verdict-${verdictTone}`}>
            <p className="verdict-label">Your answer</p>
            <h2 className="verdict-title">{r.recommendationLabel}</h2>
            <p className="verdict-copy">{r.recommendationBlurb}</p>
            {r.contradictions.length > 0 ? (
              <div className="verdict-flags">
                {r.contradictions.slice(0, 2).map((c) => (
                  <p key={c}>{c}</p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="result-scores-wrap" aria-labelledby="scores-heading">
            <div className="result-scores-head">
              <h2 id="scores-heading">Four signals</h2>
              <p className="result-scores-note">Independent reads — not one fake overall score</p>
            </div>
            <div className="score-grid score-grid-result">
              <ScoreBlock label="Utility" value={r.utility} hint={scoreHint('Utility', r.utility)} />
              <ScoreBlock label="Need" value={r.need} hint={scoreHint('Need', r.need)} />
              <ScoreBlock label="Value" value={r.value} hint={scoreHint('Value', r.value)} />
              <ScoreBlock
                label="Impulse risk"
                value={r.impulseRisk}
                meter={impulseMeter(r.impulseRisk)}
                hint={impulseHint(r.impulseRisk)}
              />
            </div>
          </section>

          <section className="signal-split result-signals">
            <div className="signal-card signal-sense">
              <h2>Why it makes sense</h2>
              <ul>
                {r.whyItMakesSense.map((s) => (
                  <li key={s.id}>{s.text}</li>
                ))}
              </ul>
            </div>
            <div className="signal-card signal-pause">
              <h2>What gives pause</h2>
              <ul>
                {r.whatGivesPause.map((s) => (
                  <li key={s.id}>{s.text}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <aside className="result-side">
          <div className="confidence-panel">
            <div className="confidence-row">
              <span>Confidence</span>
              <strong>{r.confidence}</strong>
            </div>
            <div className="confidence-track" aria-hidden="true">
              <div
                className="confidence-fill"
                style={{
                  width:
                    r.confidence === 'HIGH' ? '88%' : r.confidence === 'MEDIUM' ? '58%' : '28%',
                }}
              />
            </div>
            <p className="confidence-note">
              Based on how consistent your answers were with each other.
            </p>
          </div>

          <section className="result-action">
            <h2>Lock a waiting period</h2>
            <p className="result-action-copy">{actionCopy}</p>
            <div className="hold-picker">
              <label>
                <span>Waiting period</span>
                <select
                  value={holdDays}
                  onChange={(e) => setHoldDays(Number(e.target.value))}
                >
                  {HOLD_DAY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <HoldPressButton
                label="Hold to lock HOLD"
                disabled={busy}
                onComplete={startHold}
              />
            </div>
            <p className="fine-print">
              Press and hold to start the countdown. Account is only required when you lock a HOLD.
            </p>
            {error ? <p className="form-error">{error}</p> : null}
          </section>
        </aside>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignedIn={async () => {
          setAuthOpen(false)
          await startHold()
        }}
      />
    </div>
  )
}
