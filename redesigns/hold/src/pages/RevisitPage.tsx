import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { decideHold, holdAgain, reassessProduct } from '../data/actions'
import * as db from '../data/db'
import type { AssessmentRecord, HoldRecord, ProductRecord } from '../data/types'
import { formatMoney } from '../lib/currency'
import {
  AFFORDABILITY_OPTIONS,
  CONSIDERED_OPTIONS,
  FREQUENCY_OPTIONS,
  HOLD_DAY_OPTIONS,
  OVERLAP_OPTIONS,
  REASON_OPTIONS,
} from '../lib/options'
import type { AssessmentInput } from '../scoring/types'

type Mode = 'decide' | 'hold_again' | 'something_changed'

export function RevisitPage() {
  const { holdId = '' } = useParams()
  const navigate = useNavigate()
  const [hold, setHold] = useState<HoldRecord | null>(null)
  const [product, setProduct] = useState<ProductRecord | null>(null)
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null)
  const [mode, setMode] = useState<Mode>('decide')
  const [newDays, setNewDays] = useState(7)
  const [input, setInput] = useState<AssessmentInput | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
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
      if (a) setInput({ ...a.input })
      setNewDays(h.holdDays >= 1 ? h.holdDays : 7)
    })()
    return () => {
      cancelled = true
    }
  }, [holdId])

  async function onLetGo() {
    if (!hold) return
    setBusy(true)
    setError('')
    try {
      await decideHold({ holdId: hold.id, decision: 'let_it_go' })
      setDoneMsg('Let it go — money not spent updated.')
      navigate('/dashboard')
    } catch {
      setError('Could not save decision.')
    } finally {
      setBusy(false)
    }
  }

  async function onBought() {
    if (!hold) return
    setBusy(true)
    setError('')
    try {
      await decideHold({ holdId: hold.id, decision: 'bought' })
      navigate('/dashboard')
    } catch {
      setError('Could not save decision.')
    } finally {
      setBusy(false)
    }
  }

  async function onHoldAgain(e: FormEvent) {
    e.preventDefault()
    if (!hold) return
    setBusy(true)
    setError('')
    try {
      const next = await holdAgain({ previousHoldId: hold.id, holdDays: newDays })
      navigate(`/hold/${next.id}`)
    } catch {
      setError('Could not start a new hold.')
    } finally {
      setBusy(false)
    }
  }

  async function onReassess(e: FormEvent) {
    e.preventDefault()
    if (!hold || !product || !input) return
    setBusy(true)
    setError('')
    try {
      const a = await reassessProduct({
        productId: product.id,
        input: { ...input, price: product.price, currency: product.currency, category: product.category },
      })
      navigate(`/result/${product.id}/${a.id}`)
    } catch {
      setError('Could not reassess.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !hold) {
    return (
      <div className="page">
        <p className="form-error">{error}</p>
        <Link to="/dashboard">History</Link>
      </div>
    )
  }

  if (!hold || !product || !assessment || !input) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="page revisit-page">
      <header className="page-intro">
        <p className="eyebrow">Revisit</p>
        <h1>{product.name}</h1>
        <p className="lede">
          {formatMoney(product.price, product.currency)} · prior recommendation:{' '}
          {assessment.result.recommendationLabel}
        </p>
      </header>

      {mode === 'decide' ? (
        <section className="glass-panel stack-gap">
          <h2 className="section-title">Final decision</h2>
          <p className="muted">
            Expired or ignored holds do not change money not spent. Only an explicit Let it go does.
          </p>
          <div className="action-stack">
            <button type="button" className="btn btn-solid" disabled={busy} onClick={onBought}>
              I bought it
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={onLetGo}>
              Let it go
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setMode('hold_again')}
            >
              Hold again
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setMode('something_changed')}
            >
              Something changed
            </button>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {doneMsg ? <p>{doneMsg}</p> : null}
        </section>
      ) : null}

      {mode === 'hold_again' ? (
        <form className="glass-panel stack-form" onSubmit={onHoldAgain}>
          <button type="button" className="text-back" onClick={() => setMode('decide')}>
            ← Back
          </button>
          <h2 className="section-title">Hold again</h2>
          <p className="muted">
            Keeps your original assessment and scores. Choose a new waiting period.
          </p>
          <div className="score-grid compact">
            <div className="score-block">
              <span className="score-label">Utility</span>
              <span className="score-value">{assessment.result.utility}</span>
            </div>
            <div className="score-block">
              <span className="score-label">Need</span>
              <span className="score-value">{assessment.result.need}</span>
            </div>
            <div className="score-block">
              <span className="score-label">Value</span>
              <span className="score-value">{assessment.result.value}</span>
            </div>
            <div className="score-block">
              <span className="score-label">Impulse</span>
              <span className="score-value">{assessment.result.impulseRisk}</span>
            </div>
          </div>
          <label>
            <span>New waiting period</span>
            <select value={newDays} onChange={(e) => setNewDays(Number(e.target.value))}>
              {HOLD_DAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-solid" disabled={busy}>
            Start new hold
          </button>
        </form>
      ) : null}

      {mode === 'something_changed' ? (
        <form className="glass-panel stack-form" onSubmit={onReassess}>
          <button type="button" className="text-back" onClick={() => setMode('decide')}>
            ← Back
          </button>
          <h2 className="section-title">Something changed</h2>
          <p className="muted">Update the assessment. Scores will be recalculated.</p>

          <fieldset>
            <legend>Expected use</legend>
            <div className="choice-grid">
              {FREQUENCY_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="frequency"
                    checked={input.frequency === o.value}
                    onChange={() => setInput({ ...input, frequency: o.value })}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Ownership overlap</legend>
            <div className="choice-grid">
              {OVERLAP_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="overlap"
                    checked={input.overlap === o.value}
                    onChange={() => setInput({ ...input, overlap: o.value })}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Reason</legend>
            <div className="choice-grid">
              {REASON_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="reason"
                    checked={input.reason === o.value}
                    onChange={() => setInput({ ...input, reason: o.value })}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Consideration time</legend>
            <div className="choice-grid">
              {CONSIDERED_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="considered"
                    checked={input.considered === o.value}
                    onChange={() => setInput({ ...input, considered: o.value })}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Affordability</legend>
            <div className="choice-grid">
              {AFFORDABILITY_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="affordability"
                    checked={input.affordability === o.value}
                    onChange={() => setInput({ ...input, affordability: o.value })}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            <span>Ownership years</span>
            <input
              inputMode="decimal"
              value={input.ownershipYears}
              onChange={(e) =>
                setInput({ ...input, ownershipYears: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label>
            <span>Importance — {input.importance}/5</span>
            <input
              type="range"
              min={1}
              max={5}
              value={input.importance}
              onChange={(e) => setInput({ ...input, importance: Number(e.target.value) })}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-solid" disabled={busy}>
            Recalculate scores
          </button>
        </form>
      ) : null}
    </div>
  )
}
