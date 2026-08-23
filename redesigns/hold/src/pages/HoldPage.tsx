import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as db from '../data/db'
import type { AssessmentRecord, HoldRecord, ProductRecord } from '../data/types'
import { formatMoney } from '../lib/currency'
import { formatRelativeRemaining } from '../lib/format'
import { buildTheRead } from '../lib/readLabels'

export function HoldPage() {
  const { holdId = '' } = useParams()
  const navigate = useNavigate()
  const [hold, setHold] = useState<HoldRecord | null>(null)
  const [product, setProduct] = useState<ProductRecord | null>(null)
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null)
  const [tick, setTick] = useState(Date.now())
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await db.syncExpiredHolds()
      const h = await db.getHold(holdId)
      if (cancelled) return
      if (!h) {
        setError('Hold not found.')
        return
      }
      const [p, a] = await Promise.all([
        db.getProduct(h.productId),
        db.getAssessment(h.assessmentId),
      ])
      if (cancelled) return
      setHold(h)
      setProduct(p ?? null)
      setAssessment(a ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [holdId])

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (error) {
    return (
      <div className="page">
        <p className="form-error">{error}</p>
        <Link to="/dashboard">History</Link>
      </div>
    )
  }

  if (!hold || !product) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  const remaining = formatRelativeRemaining(hold.endsAt, tick)
  const ended = hold.status !== 'active' || remaining.expired

  return (
    <div className="page hold-page">
      <header className="page-intro">
        <p className="eyebrow">Active hold</p>
        <h1>{product.name}</h1>
        <p className="lede">{formatMoney(product.price, product.currency)}</p>
      </header>

      <section className="glass-panel countdown-panel">
        <p className="countdown-label">{ended ? 'Hold ended' : 'Time remaining'}</p>
        <p className="countdown-value" aria-live="polite">
          {ended ? 'Ready to decide' : remaining.label}
        </p>
        <p className="muted">
          {hold.holdDays === 1 ? '24-hour' : `${hold.holdDays}-day`} hold · started{' '}
          {new Date(hold.startedAt).toLocaleString()}
        </p>
        {assessment ? (
          <p className="muted">
            The read retained —{' '}
            {buildTheRead({
              utility: assessment.result.utility,
              need: assessment.result.need,
              value: assessment.result.value,
              impulseRisk: assessment.result.impulseRisk,
            })
              .map((s) => `${s.name} ${s.level}`)
              .join(' · ')}
          </p>
        ) : null}
      </section>

      <div className="action-row">
        {ended ? (
          <button
            type="button"
            className="btn btn-solid"
            onClick={() => navigate(`/revisit/${hold.id}`)}
          >
            Revisit decision
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/revisit/${hold.id}`)}
          >
            Decide early
          </button>
        )}
        <Link className="btn btn-ghost" to="/dashboard">
          History
        </Link>
      </div>
    </div>
  )
}
