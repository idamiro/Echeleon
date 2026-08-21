import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProductAndAssessment } from '../data/actions'
import type { DraftAssessment } from '../data/types'
import { COMMON_CURRENCIES, defaultCurrencyFromLocale } from '../lib/currency'
import {
  AFFORDABILITY_OPTIONS,
  CATEGORY_OPTIONS,
  CONSIDERED_OPTIONS,
  FREQUENCY_OPTIONS,
  OVERLAP_OPTIONS,
  REASON_OPTIONS,
} from '../lib/options'
import type { AssessmentInput } from '../scoring/types'

function emptyDraft(): DraftAssessment {
  return {
    productName: '',
    category: 'tech',
    price: '',
    currency: defaultCurrencyFromLocale(),
    url: '',
    frequency: '',
    overlap: '',
    reason: '',
    considered: '',
    affordability: '',
    ownershipYears: '2',
    importance: 3,
  }
}

export function EntryPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [draft, setDraft] = useState<DraftAssessment>(emptyDraft)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const currencies = useMemo(() => {
    const set = new Set<string>([...COMMON_CURRENCIES, draft.currency])
    return [...set].sort()
  }, [draft.currency])

  function update<K extends keyof DraftAssessment>(key: K, value: DraftAssessment[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function goAssess(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!draft.productName.trim()) {
      setError('Give the product a name.')
      return
    }
    const price = Number(draft.price)
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price.')
      return
    }
    if (!/^[A-Z]{3}$/.test(draft.currency)) {
      setError('Currency must be a 3-letter code (e.g. EUR, TRY, JPY).')
      return
    }
    setStep(2)
  }

  async function submitAssessment(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (
      !draft.frequency ||
      !draft.overlap ||
      !draft.reason ||
      !draft.considered ||
      !draft.affordability
    ) {
      setError('Answer every assessment question.')
      return
    }
    const years = Number(draft.ownershipYears)
    if (!Number.isFinite(years) || years <= 0) {
      setError('Expected ownership must be a positive number of years.')
      return
    }

    const input: AssessmentInput = {
      category: draft.category,
      price: Number(draft.price),
      currency: draft.currency,
      frequency: draft.frequency,
      overlap: draft.overlap,
      reason: draft.reason,
      considered: draft.considered,
      affordability: draft.affordability,
      ownershipYears: years,
      importance: draft.importance,
    }

    setBusy(true)
    try {
      const { product, assessment } = await createProductAndAssessment({
        name: draft.productName,
        category: draft.category,
        price: input.price,
        currency: input.currency,
        url: draft.url || undefined,
        input,
      })
      navigate(`/result/${product.id}/${assessment.id}`)
    } catch {
      setError('Something went wrong scoring this. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page entry-page">
      <header className="page-intro">
        <p className="eyebrow">Purchase decision tool</p>
        <h1>HOLD</h1>
        <p className="lede">
          Cool the impulse. Score utility, need, value, and risk as separate signals — then wait on
          purpose.
        </p>
      </header>

      {step === 1 ? (
        <form className="panel stack-form" onSubmit={goAssess}>
          <h2 className="section-title">Product</h2>
          <label>
            <span>What are you considering?</span>
            <input
              value={draft.productName}
              onChange={(e) => update('productName', e.target.value)}
              placeholder="e.g. Noise-cancelling headphones"
              required
              autoFocus
            />
          </label>
          <label>
            <span>Category</span>
            <select
              value={draft.category}
              onChange={(e) => update('category', e.target.value as DraftAssessment['category'])}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="row-2">
            <label>
              <span>Price</span>
              <input
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="0"
                required
              />
            </label>
            <label>
              <span>Currency</span>
              <select
                value={draft.currency}
                onChange={(e) => update('currency', e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Link (optional)</span>
            <input
              type="url"
              value={draft.url}
              onChange={(e) => update('url', e.target.value)}
              placeholder="https://"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary">
            Continue to assessment
          </button>
        </form>
      ) : (
        <form className="panel stack-form" onSubmit={submitAssessment}>
          <button type="button" className="text-back" onClick={() => setStep(1)}>
            ← {draft.productName}
          </button>
          <h2 className="section-title">Assessment</h2>
          <p className="muted">
            Behavioral context matters more than the story you tell yourself about why.
          </p>

          <fieldset>
            <legend>How often would you use it?</legend>
            <div className="choice-grid">
              {FREQUENCY_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="frequency"
                    checked={draft.frequency === o.value}
                    onChange={() => update('frequency', o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Do you already own something that does the same job?</legend>
            <div className="choice-grid">
              {OVERLAP_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="overlap"
                    checked={draft.overlap === o.value}
                    onChange={() => update('overlap', o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Why are you considering it?</legend>
            <div className="choice-grid">
              {REASON_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="reason"
                    checked={draft.reason === o.value}
                    onChange={() => update('reason', o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>How long have you been considering this?</legend>
            <div className="choice-grid">
              {CONSIDERED_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="considered"
                    checked={draft.considered === o.value}
                    onChange={() => update('considered', o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>How would buying this affect your available money?</legend>
            <div className="choice-grid">
              {AFFORDABILITY_OPTIONS.map((o) => (
                <label key={o.value} className="choice">
                  <input
                    type="radio"
                    name="affordability"
                    checked={draft.affordability === o.value}
                    onChange={() => update('affordability', o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            <span>Expected ownership / use span (years)</span>
            <input
              inputMode="decimal"
              value={draft.ownershipYears}
              onChange={(e) => update('ownershipYears', e.target.value)}
            />
          </label>

          <label>
            <span>
              Importance if you could not buy it — {draft.importance}/5
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={draft.importance}
              onChange={(e) => update('importance', Number(e.target.value))}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Scoring…' : 'See scores'}
          </button>
        </form>
      )}
    </div>
  )
}
