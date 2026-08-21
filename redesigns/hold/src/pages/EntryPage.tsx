import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProductAndAssessment } from '../data/actions'
import type { DraftAssessment } from '../data/types'
import { COMMON_CURRENCIES, defaultCurrencyFromLocale, formatMoney } from '../lib/currency'
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

type QKey = 'frequency' | 'overlap' | 'reason' | 'considered' | 'affordability'
type AskStep = { kind: 'category' } | { kind: 'field'; key: QKey }

const FIELD_ORDER: QKey[] = [
  'frequency',
  'overlap',
  'reason',
  'considered',
  'affordability',
]

const ASK_STEPS: AskStep[] = [{ kind: 'category' }, ...FIELD_ORDER.map((key) => ({ kind: 'field' as const, key }))]

export function EntryPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'product' | 'ask' | 'meta'>('product')
  const [qIndex, setQIndex] = useState(0)
  const [draft, setDraft] = useState<DraftAssessment>(emptyDraft)
  const [inference, setInference] = useState<EnrichedProduct | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [anim, setAnim] = useState<'in' | 'out'>('in')
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

  const examplePrice = useMemo(() => {
    try {
      return formatMoney(240, draft.currency || defaultCurrencyFromLocale())
    } catch {
      return '€240'
    }
  }, [draft.currency])

  useEffect(() => () => abortRef.current?.abort(), [])

  function update<K extends keyof DraftAssessment>(key: K, value: DraftAssessment[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function applyCategory(category: Category, name = draft.productName) {
    const suggestion = suggestAssessmentForProduct({
      category,
      name: name || category,
    })
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
      if (controller.signal.aborted || !inf) return
      setInference(inf)
      const suggestion = suggestAssessmentForProduct({
        category: inf.category,
        name: inf.name,
      })
      setDraft((d) => ({
        ...d,
        url: value,
        productName: inf.name,
        category: inf.category,
        price: inf.price != null ? String(inf.price) : d.price,
        currency: inf.currency || d.currency,
        frequency: suggestion.frequency,
        overlap: suggestion.overlap,
        reason: suggestion.reason,
        considered: suggestion.considered,
        affordability: suggestion.affordability,
        ownershipYears: suggestion.ownershipYears,
        importance: suggestion.importance,
      }))
    } finally {
      if (!controller.signal.aborted) setEnriching(false)
    }
  }

  function goAsk(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!draft.productName.trim()) {
      setError('Product name required.')
      return
    }
    const price = Number(draft.price)
    if (!Number.isFinite(price) || price < 0) {
      setError('Add the price to continue.')
      return
    }
    // Skip category step if we already inferred with confidence
    const startAt =
      inference && inference.confidence !== 'low' && inference.category === draft.category
        ? 1
        : 0
    setQIndex(startAt)
    setAnim('in')
    setStep('ask')
  }

  function advanceFrom(index: number) {
    setAnim('out')
    window.setTimeout(() => {
      if (index >= ASK_STEPS.length - 1) {
        setStep('meta')
        setAnim('in')
        return
      }
      setQIndex(index + 1)
      setAnim('in')
    }, 220)
  }

  function pickCategory(category: Category) {
    applyCategory(category)
    advanceFrom(qIndex)
  }

  function pickAnswer(key: QKey, value: string) {
    update(key, value as never)
    advanceFrom(qIndex)
  }

  async function submitMeta(e: FormEvent) {
    e.preventDefault()
    setError('')
    const years = Number(draft.ownershipYears)
    if (!Number.isFinite(years) || years <= 0) {
      setError('Ownership years must be positive.')
      return
    }
    if (
      !draft.frequency ||
      !draft.overlap ||
      !draft.reason ||
      !draft.considered ||
      !draft.affordability
    ) {
      setError('Finish the questions first.')
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
      setError('Scoring failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const askStep = ASK_STEPS[qIndex]!

  return (
    <div className="page entry-page site-grid">
      <header className="page-intro site-intro">
        <p className="eyebrow">Vulcet experiment</p>
        <h1>HOLD</h1>
        <p className="lede hero-line">Before you buy it, hold it.</p>
        <p className="lede">See how useful it really is — then decide.</p>
        <div className="live-example" aria-hidden="true">
          <span>{examplePrice}</span>
          <span className="live-arrow">→</span>
          <span>HOLD 7 DAYS</span>
        </div>
      </header>

      {step === 'product' ? (
        <form className="product-panel stack-form site-card" onSubmit={goAsk}>
          <div className="card-head">
            <h2 className="section-title">What are you about to buy?</h2>
            {enriching ? <span className="pulse-dot">Reading…</span> : null}
          </div>

          <label className="url-field">
            <span>Product link</span>
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
                if (looksLikeUrl(text)) requestAnimationFrame(() => void runEnrich(text))
              }}
              placeholder="Paste a product URL (optional)"
              autoFocus
            />
          </label>

          {inference ? (
            <div className="infer-card">
              <div className="infer-top">
                <span className="infer-store">{inference.storeLabel}</span>
                {inference.price != null ? (
                  <span className="infer-conf">
                    {inference.price} {inference.currency || draft.currency}
                  </span>
                ) : (
                  <span className="infer-conf">price?</span>
                )}
              </div>
              <p className="infer-name">{inference.name}</p>
            </div>
          ) : null}

          <label>
            <span>Name</span>
            <input
              value={draft.productName}
              onChange={(e) => update('productName', e.target.value)}
              placeholder="Product name"
              required
            />
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
          <button type="submit" className="btn btn-solid btn-animated btn-cta">
            Should I buy this? <span aria-hidden="true">→</span>
          </button>
        </form>
      ) : null}

      {step === 'ask' ? (
        <div className="product-panel site-card ask-stage">
          <div className="ask-progress">
            <div
              className="ask-progress-bar"
              style={{ width: `${((qIndex + 1) / ASK_STEPS.length) * 100}%` }}
            />
          </div>
          <p className="ask-count">
            {qIndex + 1} / {ASK_STEPS.length}
          </p>

          <div className={`ask-card ask-${anim}`} key={`${askStep.kind}-${qIndex}`}>
            {askStep.kind === 'category' ? (
              <>
                <h2 className="ask-legend">What kind of purchase is this?</h2>
                <div className="ask-options ask-options-grid">
                  {CATEGORY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`ask-option${draft.category === o.value ? ' is-on' : ''}`}
                      onClick={() => pickCategory(o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="ask-legend">{questions[askStep.key].legend}</h2>
                <div className="ask-options">
                  {questions[askStep.key].options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`ask-option${draft[askStep.key] === o.value ? ' is-on' : ''}`}
                      onClick={() => pickAnswer(askStep.key, o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className="text-back"
            onClick={() => {
              if (qIndex === 0) setStep('product')
              else {
                setAnim('out')
                window.setTimeout(() => {
                  setQIndex((i) => i - 1)
                  setAnim('in')
                }, 180)
              }
            }}
          >
            ← Back
          </button>
        </div>
      ) : null}

      {step === 'meta' ? (
        <form className="product-panel stack-form site-card" onSubmit={submitMeta}>
          <button type="button" className="text-back" onClick={() => setStep('ask')}>
            ← Questions
          </button>
          <h2 className="section-title">Almost there</h2>
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
            <input
              type="range"
              min={1}
              max={5}
              value={draft.importance}
              onChange={(e) => update('importance', Number(e.target.value))}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-solid btn-animated" disabled={busy}>
            {busy ? 'Scoring…' : 'See scores'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
