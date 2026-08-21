import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthModal } from '../components/AuthModal'
import { ScoreBlock } from '../components/ScoreBlock'
import { createHold } from '../data/actions'
import * as auth from '../data/auth'
import * as db from '../data/db'
import type { AssessmentRecord, ProductRecord } from '../data/types'
import { formatMoney } from '../lib/currency'
import { HOLD_DAY_OPTIONS } from '../lib/options'

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

  return (
    <div className="page result-page">
      <header className="page-intro">
        <p className="eyebrow">{product.category}</p>
        <h1>{product.name}</h1>
        <p className="lede">
          {formatMoney(product.price, product.currency)}
          {r.costPerUse != null
            ? ` · ~${formatMoney(r.costPerUse, product.currency)} / use`
            : ''}
        </p>
      </header>

      <section className="panel" aria-labelledby="scores-heading">
        <h2 id="scores-heading" className="section-title">
          Independent scores
        </h2>
        <p className="muted">
          No single overall purchase score — the recommendation reads these together.
        </p>
        <div className="score-grid">
          <ScoreBlock label="Utility" value={r.utility} />
          <ScoreBlock label="Need" value={r.need} />
          <ScoreBlock label="Value" value={r.value} />
          <ScoreBlock label="Impulse risk" value={r.impulseRisk} />
        </div>
        <div className="meta-row">
          <span>
            Confidence <strong>{r.confidence}</strong>
          </span>
          <span className="muted">Signal consistency, not fortune-telling</span>
        </div>
        {r.contradictions.length > 0 ? (
          <ul className="contradiction-list">
            {r.contradictions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="signal-split">
        <div className="panel signal-panel">
          <h2 className="section-title">Why it makes sense</h2>
          <ol>
            {r.whyItMakesSense.map((s) => (
              <li key={s.id}>{s.text}</li>
            ))}
          </ol>
        </div>
        <div className="panel signal-panel">
          <h2 className="section-title">What gives us pause</h2>
          <ol>
            {r.whatGivesPause.map((s) => (
              <li key={s.id}>{s.text}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="panel recommend-panel">
        <p className="eyebrow">Recommendation</p>
        <h2 className="rec-label">{r.recommendationLabel}</h2>
        <p>{r.recommendationBlurb}</p>

        {r.recommendation !== 'CONSIDER_LETTING_IT_GO' &&
        r.recommendation !== 'BUYING_NOW_SEEMS_REASONABLE' ? (
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={startHold}
              disabled={busy}
            >
              {busy ? 'Starting…' : 'Start HOLD'}
            </button>
          </div>
        ) : (
          <div className="hold-picker">
            <label>
              <span>Still want a cooling-off period?</span>
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={startHold}
              disabled={busy}
            >
              {busy ? 'Starting…' : 'Start HOLD anyway'}
            </button>
          </div>
        )}

        <p className="fine-print">
          Creating a hold is the first step that needs an account. Scores above stay available without signing in.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
      </section>

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
