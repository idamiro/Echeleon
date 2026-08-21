import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthModal } from '../components/AuthModal'
import { createHold } from '../data/actions'
import * as auth from '../data/auth'
import * as db from '../data/db'
import type { AssessmentRecord, ProductRecord } from '../data/types'
import { formatMoney } from '../lib/currency'
import { CATEGORY_OPTIONS, HOLD_DAY_OPTIONS } from '../lib/options'
import { buildTheRead } from '../lib/readLabels'
import type { Recommendation, SignalItem } from '../scoring/types'

function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function holdPeriodParts(days: number): { amount: string; unit: string } {
  if (days === 1) return { amount: '24', unit: 'HOURS' }
  return { amount: String(days), unit: 'DAYS' }
}

function holdCtaLabel(days: number): string {
  if (days === 1) return 'HOLD FOR 24 HOURS'
  return `HOLD FOR ${days} DAYS`
}

function recommendationHero(
  recommendation: Recommendation,
  holdDays: number,
  blurb: string
): {
  primary: string
  secondary: { amount: string; unit: string } | null
  blurb: string
} {
  if (recommendation === 'BUYING_NOW_SEEMS_REASONABLE') {
    return { primary: 'BUY', secondary: { amount: '', unit: 'NOW' }, blurb }
  }
  if (recommendation === 'CONSIDER_LETTING_IT_GO') {
    return { primary: 'LET IT GO', secondary: null, blurb }
  }
  return {
    primary: 'HOLD',
    secondary: holdPeriodParts(holdDays),
    blurb,
  }
}

function buildWhyHold(
  sense: SignalItem[],
  pause: SignalItem[],
  limit = 3
): { marker: '+' | '−'; text: string; id: string }[] {
  const combined = [
    ...sense.map((s) => ({ ...s, marker: '+' as const })),
    ...pause.map((s) => ({ ...s, marker: '−' as const })),
  ]
  return combined
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((s) => ({ marker: s.marker, text: s.text, id: s.id }))
}

export function ResultPage() {
  const { productId = '', assessmentId = '' } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductRecord | null>(null)
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [holdDays, setHoldDays] = useState<number | null>(null)
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
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

  const whyHold = useMemo(() => {
    if (!assessment) return []
    return buildWhyHold(
      assessment.result.whyItMakesSense,
      assessment.result.whatGivesPause,
      3
    )
  }, [assessment])

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
  const hero = recommendationHero(r.recommendation, holdDays, r.recommendationBlurb)
  const theRead = buildTheRead({
    utility: r.utility,
    need: r.need,
    value: r.value,
    impulseRisk: r.impulseRisk,
  })
  const isHoldRec = r.recommendation.startsWith('HOLD_')
  const cat = categoryLabel(product.category)

  return (
    <div className="page result-page">
      <article className="result-desk">
        <header className="result-top">
          <p className="result-kicker">Assessment result</p>
          <p className="result-product-line">
            <strong>{product.name}</strong>
            <span>
              {formatMoney(product.price, product.currency)} · {cat}
            </span>
          </p>
        </header>

        <section className="result-answer" aria-labelledby="result-rec-heading">
          <h2 id="result-rec-heading" className="visually-hidden">
            Recommendation
          </h2>
          <p className="result-rec-line">
            <span className="result-rec-primary">{hero.primary}</span>
            {hero.secondary ? (
              <span className="result-rec-secondary">
                {hero.secondary.amount ? (
                  <span className="result-rec-amount">{hero.secondary.amount}</span>
                ) : null}
                <span className="result-rec-unit">{hero.secondary.unit}</span>
              </span>
            ) : null}
          </p>
          <p className="result-rec-blurb">{hero.blurb}</p>
          <p className="result-confidence">
            {r.confidence} confidence
            <span
              className="result-confidence-tip"
              title="Based on how consistent your answers were."
              tabIndex={0}
              aria-label="Based on how consistent your answers were."
            >
              i
            </span>
          </p>
        </section>

        <section className="result-read" aria-labelledby="signals-heading">
          <h2 id="signals-heading" className="result-section-label">
            The read
          </h2>
          <div className="read-grid" role="list">
            {theRead.map((s) => (
              <div key={s.key} className={`read-cell tone-${s.tone}`} role="listitem">
                <span className="read-name">{s.name}</span>
                <span className="read-level">{s.level}</span>
              </div>
            ))}
          </div>
        </section>

        {whyHold.length > 0 ? (
          <section className="result-why" aria-labelledby="why-heading">
            <h2 id="why-heading" className="result-section-label">
              {isHoldRec ? 'Why hold?' : 'Why this?'}
            </h2>
            <ul className="result-why-list">
              {whyHold.map((item) => (
                <li key={item.id}>
                  <span className="result-why-marker" aria-hidden="true">
                    {item.marker}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {r.costPerUse != null ? (
          <p className="result-cpu">
            <span>Estimated cost per use</span>
            <strong>{formatMoney(r.costPerUse, product.currency)}</strong>
          </p>
        ) : null}

        <section className="result-actions" aria-label="Decision actions">
          {isHoldRec ? (
            <>
              <button
                type="button"
                className="btn btn-solid result-cta"
                disabled={busy}
                onClick={() => void startHold()}
              >
                {busy ? 'Starting…' : holdCtaLabel(holdDays)}
              </button>
              <button
                type="button"
                className="result-period-toggle"
                onClick={() => setShowPeriodPicker((v) => !v)}
                aria-expanded={showPeriodPicker}
              >
                Change waiting period
              </button>
              {showPeriodPicker ? (
                <div className="result-period-options" role="group" aria-label="Waiting period">
                  {HOLD_DAY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`result-period-option${holdDays === o.value ? ' is-on' : ''}`}
                      onClick={() => {
                        setHoldDays(o.value)
                        setShowPeriodPicker(false)
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-solid result-cta"
                onClick={() => navigate('/')}
              >
                {r.recommendation === 'CONSIDER_LETTING_IT_GO' ? 'Let it go' : 'Buy anyway'}
              </button>
              <button
                type="button"
                className="result-period-toggle"
                onClick={() => setShowPeriodPicker((v) => !v)}
                aria-expanded={showPeriodPicker}
              >
                Hold anyway
              </button>
              {showPeriodPicker ? (
                <>
                  <div className="result-period-options" role="group" aria-label="Waiting period">
                    {HOLD_DAY_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={`result-period-option${holdDays === o.value ? ' is-on' : ''}`}
                        onClick={() => setHoldDays(o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost result-cta"
                    disabled={busy}
                    onClick={() => void startHold()}
                  >
                    {busy ? 'Starting…' : holdCtaLabel(holdDays)}
                  </button>
                </>
              ) : null}
            </>
          )}

          <div className="result-secondary">
            {r.recommendation !== 'BUYING_NOW_SEEMS_REASONABLE' ? (
              <button type="button" className="result-secondary-btn" onClick={() => navigate('/')}>
                Buy anyway
              </button>
            ) : null}
            {r.recommendation !== 'CONSIDER_LETTING_IT_GO' ? (
              <button type="button" className="result-secondary-btn" onClick={() => navigate('/')}>
                Let it go
              </button>
            ) : null}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
        </section>
      </article>

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
