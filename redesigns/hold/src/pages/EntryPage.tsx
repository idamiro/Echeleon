import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProductAndAssessment } from '../data/actions'
import type { DraftAssessment } from '../data/types'
import { COMMON_CURRENCIES, defaultCurrencyFromLocale } from '../lib/currency'
import { enrichProductFromUrl, type EnrichedProduct } from '../lib/enrichProduct'
import { buildQuestionsForProduct, CATEGORY_OPTIONS } from '../lib/options'
import { looksLikeUrl } from '../lib/productFromUrl'
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
  const [inference, setInference] = useState<EnrichedProduct | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [suggestBlurb, setSuggestBlurb] = useState('')
  const [hints, setHints] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const currencies = useMemo(() => {
    const set = new Set<string>([...COMMON_CURRENCIES, draft.currency])
    return [...set].sort()
  }, [draft.currency])

  const questions = useMemo(
    () =>
      buildQuestionsForProduct({
        category: draft.category,
        name: draft.productName || 'this product',
      }),
    [draft.category, draft.productName]
  )

  useEffect(() => () => abortRef.current?.abort(), [])

  function update<K extends keyof DraftAssessment>(key: K, value: DraftAssessment[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function runEnrich(value: string) {
    abortRef.current?.abort()
    if (!looksLikeUrl(value)) {
      setInference(null)
      setEnriching(false)
      setDraft((d) => ({ ...d, url: value }))
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setEnriching(true)
    setDraft((d) => ({ ...d, url: value }))

    try {
      const inf = await enrichProductFromUrl(value, controller.signal)
      if (controller.signal.aborted) return
      setInference(inf)
      if (!inf) return

      const suggestion = suggestAssessmentForProduct({
        category: inf.category,
        name: inf.name,
      })
      setHints(suggestion.hints)
      setSuggestBlurb(
        inf.summary
          ? `${suggestion.blurb} Page note: ${inf.summary.slice(0, 140)}…`
          : suggestion.blurb
      )

      setDraft((d) => ({
        ...d,
        url: value,
        productName: d.productName.trim() ? d.productName : inf.name,
        category: inf.category,
        price:
          d.price.trim() !== ''
            ? d.price
            : inf.price != null
              ? String(inf.price)
              : d.price,
        currency: inf.currency || d.currency,
        frequency: d.frequency || suggestion.frequency,
        overlap: d.overlap || suggestion.overlap,
        reason: d.reason || suggestion.reason,
        considered: d.considered || suggestion.considered,
        affordability: d.affordability || suggestion.affordability,
        ownershipYears: d.ownershipYears || suggestion.ownershipYears,
        importance: d.importance || suggestion.importance,
      }))
    } catch {
      if (!controller.signal.aborted) setEnriching(false)
    } finally {
      if (!controller.signal.aborted) setEnriching(false)
    }
  }

  function onCategoryChange(category: Category) {
    const suggestion = suggestAssessmentForProduct({
      category,
      name: draft.productName || category,
    })
    setHints(suggestion.hints)
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
      setError('Enter a valid price (paste a link to auto-fill when possible).')
      return
    }
    if (!/^[A-Z]{3}$/.test(draft.currency)) {
      setError('Currency must be a 3-letter code.')
      return
    }
    if (!draft.frequency) {
      const suggestion = suggestAssessmentForProduct({
        category: draft.category,
        name: draft.productName,
      })
      setHints(suggestion.hints)
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
    <div className="page entry-page site-grid">
      <header className="page-intro site-intro">
        <p className="eyebrow">Vulcet experiment</p>
        <h1>HOLD</h1>
        <p className="lede">
          Paste a product link. We read what it is and the price when the page allows, then ask
          questions shaped for that product — before you spend.
        </p>
      </header>

      {step === 1 ? (
        <form className="glass-panel stack-form site-card" onSubmit={goAssess}>
          <div className="card-head">
            <h2 className="section-title">Product</h2>
            {enriching ? <span className="pulse-dot">Reading link…</span> : null}
          </div>

          <label className="url-field">
            <span>Paste product link</span>
            <input
              type="url"
              value={draft.url}
              onChange={(e) => {
                const v = e.target.value
                setDraft((d) => ({ ...d, url: v }))
                if (looksLikeUrl(v)) void runEnrich(v)
                else setInference(null)
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text').trim()
                if (looksLikeUrl(text)) {
                  requestAnimationFrame(() => void runEnrich(text))
                }
              }}
              placeholder="https://store.com/product/…"
              autoFocus
            />
          </label>

          {inference ? (
            <div className="infer-card" data-confidence={inference.confidence}>
              <div className="infer-top">
                <span className="infer-store">{inference.storeLabel}</span>
                <span className="infer-conf">{inference.confidence}</span>
              </div>
              <p className="infer-name">{inference.name}</p>
              <p className="infer-meta">
                {inference.category}
                {inference.price != null
                  ? ` · ${inference.price}${inference.currency ? ` ${inference.currency}` : ''}`
                  : ' · price not found — enter manually'}
              </p>
              <ul className="infer-notes">
                {inference.notes.slice(0, 3).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted tip-line">
              We parse the URL and try to read the live page for title + price. No account needed
              yet.
            </p>
          )}

          <div className="form-columns">
            <label>
              <span>Product name</span>
              <input
                value={draft.productName}
                onChange={(e) => update('productName', e.target.value)}
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
          </div>

          <div className="row-2">
            <label>
              <span>Price</span>
              <input
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="Auto from link when possible"
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
          <button type="submit" className="btn btn-solid btn-animated">
            Continue to assessment
          </button>
        </form>
      ) : (
        <form className="glass-panel stack-form site-card" onSubmit={submitAssessment}>
          <button type="button" className="text-back" onClick={() => setStep(1)}>
            ← {draft.productName}
          </button>
          <h2 className="section-title">Assessment</h2>
          {suggestBlurb ? <p className="suggest-blurb">{suggestBlurb}</p> : null}

          {(
            [
              ['frequency', questions.frequency],
              ['overlap', questions.overlap],
              ['reason', questions.reason],
              ['considered', questions.considered],
              ['affordability', questions.affordability],
            ] as const
          ).map(([key, block]) => (
            <fieldset key={key}>
              <legend>{block.legend}</legend>
              {hints[key] ? <p className="hint">{hints[key]}</p> : null}
              <div className="choice-grid">
                {block.options.map((o) => (
                  <label
                    key={o.value}
                    className={`choice glass-choice${draft[key] === o.value ? ' is-on' : ''}`}
                  >
                    <input
                      type="radio"
                      name={key}
                      checked={draft[key] === o.value}
                      onChange={() => update(key, o.value)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <label>
            <span>{questions.ownership.legend}</span>
            {questions.ownership.hint ? (
              <p className="hint">{questions.ownership.hint}</p>
            ) : null}
            <input
              inputMode="decimal"
              value={draft.ownershipYears}
              onChange={(e) => update('ownershipYears', e.target.value)}
            />
          </label>

          <label>
            <span>
              {questions.importance.legend} — {draft.importance}/5
            </span>
            {questions.importance.hint ? (
              <p className="hint">{questions.importance.hint}</p>
            ) : null}
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
          <button type="submit" className="btn btn-solid btn-animated" disabled={busy}>
            {busy ? 'Scoring…' : 'See scores'}
          </button>
        </form>
      )}
    </div>
  )
}
