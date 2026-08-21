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
import {
  inferProductFromUrl,
  looksLikeUrl,
  type ProductInference,
} from '../lib/productFromUrl'
import { suggestAssessmentForProduct } from '../lib/suggestAssessment'
import type { AssessmentInput, Category } from '../scoring/types'

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
  const [inference, setInference] = useState<ProductInference | null>(null)
  const [suggestBlurb, setSuggestBlurb] = useState('')
  const [hints, setHints] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const currencies = useMemo(() => {
    const set = new Set<string>([...COMMON_CURRENCIES, draft.currency])
    return [...set].sort()
  }, [draft.currency])

  function update<K extends keyof DraftAssessment>(key: K, value: DraftAssessment[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function applyInference(inf: ProductInference, current: DraftAssessment): DraftAssessment {
    const suggestion = suggestAssessmentForProduct({
      category: inf.category,
      name: inf.name,
    })
    return {
      ...current,
      productName: current.productName.trim() ? current.productName : inf.name,
      category: inf.category,
      frequency: current.frequency || suggestion.frequency,
      overlap: current.overlap || suggestion.overlap,
      reason: current.reason || suggestion.reason,
      considered: current.considered || suggestion.considered,
      affordability: current.affordability || suggestion.affordability,
      ownershipYears: current.ownershipYears || suggestion.ownershipYears,
      importance: current.importance || suggestion.importance,
    }
  }

  function onUrlChange(value: string) {
    if (!looksLikeUrl(value)) {
      setInference(null)
      setDraft((d) => ({ ...d, url: value }))
      return
    }
    const inf = inferProductFromUrl(value)
    setInference(inf)
    if (inf) {
      const suggestion = suggestAssessmentForProduct({
        category: inf.category,
        name: inf.name,
      })
      setHints(suggestion.hints as Record<string, string>)
      setSuggestBlurb(suggestion.blurb)
      setDraft((d) => applyInference(inf, { ...d, url: value }))
    } else {
      setDraft((d) => ({ ...d, url: value }))
    }
  }

  function onCategoryChange(category: Category) {
    const suggestion = suggestAssessmentForProduct({
      category,
      name: draft.productName || inference?.name || category,
    })
    setHints(suggestion.hints as Record<string, string>)
    setSuggestBlurb(suggestion.blurb)
    setDraft((d) => ({
      ...d,
      category,
      frequency: suggestion.frequency,
      overlap: suggestion.overlap,
      reason: suggestion.reason,
      considered: suggestion.considered,
      affordability: suggestion.affordability,
      ownershipYears: suggestion.ownershipYears,
      importance: suggestion.importance,
    }))
  }

  function goAssess(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!draft.productName.trim()) {
      setError('Give the product a name — or paste a link first.')
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
    // Refresh suggestions when entering assessment if still empty
    if (!draft.frequency) {
      const suggestion = suggestAssessmentForProduct({
        category: draft.category,
        name: draft.productName,
      })
      setHints(suggestion.hints as Record<string, string>)
      setSuggestBlurb(suggestion.blurb)
      setDraft((d) => ({
        ...d,
        frequency: suggestion.frequency,
        overlap: suggestion.overlap,
        reason: suggestion.reason,
        considered: suggestion.considered,
        affordability: suggestion.affordability,
        ownershipYears: suggestion.ownershipYears,
        importance: suggestion.importance,
      }))
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
        <p className="eyebrow">Cool the purchase</p>
        <h1>HOLD</h1>
        <p className="lede">
          Paste a link. We read what it is, suggest answers for that product type, then score the
          decision — not the store page hype.
        </p>
      </header>

      {step === 1 ? (
        <form className="glass-panel stack-form" onSubmit={goAssess}>
          <h2 className="section-title">Product</h2>

          <label className="url-field">
            <span>Paste product link</span>
            <input
              type="url"
              value={draft.url}
              onChange={(e) => onUrlChange(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (looksLikeUrl(text)) {
                  // let paste apply, then infer on next tick with full value
                  requestAnimationFrame(() => onUrlChange(text.trim()))
                }
              }}
              placeholder="https://…"
              autoFocus
            />
          </label>

          {inference ? (
            <div className="infer-card" data-confidence={inference.confidence}>
              <div className="infer-top">
                <span className="infer-store">{inference.storeLabel}</span>
                <span className="infer-conf">{inference.confidence} match</span>
              </div>
              <p className="infer-name">{inference.name}</p>
              <p className="infer-meta">
                Category → <strong>{inference.category}</strong>
              </p>
              <ul className="infer-notes">
                {inference.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted tip-line">
              No scrape, no AI — we parse the URL path and store. You can still type a name manually.
            </p>
          )}

          <label>
            <span>Product name</span>
            <input
              value={draft.productName}
              onChange={(e) => update('productName', e.target.value)}
              placeholder="What are you considering?"
              required
            />
          </label>

          <label>
            <span>Category</span>
            <select
              value={draft.category}
              onChange={(e) => onCategoryChange(e.target.value as Category)}
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

          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-solid">
            Continue to assessment
          </button>
        </form>
      ) : (
        <form className="glass-panel stack-form" onSubmit={submitAssessment}>
          <button type="button" className="text-back" onClick={() => setStep(1)}>
            ← {draft.productName}
          </button>
          <h2 className="section-title">Assessment</h2>
          {suggestBlurb ? <p className="suggest-blurb">{suggestBlurb}</p> : null}
          <p className="muted">
            Pre-filled from product type. Behavioral context beats the story you tell yourself.
          </p>

          <fieldset>
            <legend>How often would you use it?</legend>
            {hints.frequency ? <p className="hint">{hints.frequency}</p> : null}
            <div className="choice-grid">
              {FREQUENCY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`choice glass-choice${draft.frequency === o.value ? ' is-on' : ''}`}
                >
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
            {hints.overlap ? <p className="hint">{hints.overlap}</p> : null}
            <div className="choice-grid">
              {OVERLAP_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`choice glass-choice${draft.overlap === o.value ? ' is-on' : ''}`}
                >
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
            {hints.reason ? <p className="hint">{hints.reason}</p> : null}
            <div className="choice-grid">
              {REASON_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`choice glass-choice${draft.reason === o.value ? ' is-on' : ''}`}
                >
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
            {hints.considered ? <p className="hint">{hints.considered}</p> : null}
            <div className="choice-grid">
              {CONSIDERED_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`choice glass-choice${draft.considered === o.value ? ' is-on' : ''}`}
                >
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
            {hints.affordability ? <p className="hint">{hints.affordability}</p> : null}
            <div className="choice-grid">
              {AFFORDABILITY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`choice glass-choice${draft.affordability === o.value ? ' is-on' : ''}`}
                >
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
            {hints.ownershipYears ? <p className="hint">{hints.ownershipYears}</p> : null}
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
            {hints.importance ? <p className="hint">{hints.importance}</p> : null}
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
          <button type="submit" className="btn btn-solid" disabled={busy}>
            {busy ? 'Scoring…' : 'See scores'}
          </button>
        </form>
      )}
    </div>
  )
}
