import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProductAndAssessment } from '../data/actions'
import type { DraftAssessment } from '../data/types'
import { COMMON_CURRENCIES, defaultCurrencyFromLocale } from '../lib/currency'
import { enrichFromUrlLocal, enrichProductFromUrl, type EnrichedProduct } from '../lib/enrichProduct'
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

    // New link → wipe prior answers so old selections never stick
    const blankAnswers = {
      frequency: '' as const,
      overlap: '' as const,
      reason: '' as const,
      considered: '' as const,
      affordability: '' as const,
      ownershipYears: '2',
      importance: 3,
    }

    const local = enrichFromUrlLocal(value)
    setStep('product')
    setQIndex(0)
    setError('')

    if (local) {
      setInference(local)
      setDraft((d) => ({
        ...d,
        ...blankAnswers,
        url: value,
        productName: local.name,
        category: local.category,
        price: local.price != null ? String(local.price) : '',
        currency: local.currency || d.currency,
      }))
    } else {
      setInference(null)
      setDraft((d) => ({
        ...d,
        ...blankAnswers,
        url: value,
        productName: '',
        price: '',
      }))
    }

    const controller = new AbortController()
    abortRef.current = controller
    setEnriching(true)

    try {
      const inf = await enrichProductFromUrl(value, controller.signal)
      if (controller.signal.aborted || !inf) return
      setInference(inf)
      setDraft((d) => ({
        ...d,
        ...blankAnswers,
        url: value,
        productName: inf.name,
        category: inf.category,
        price: inf.price != null ? String(inf.price) : '',
        currency: inf.currency || d.currency,
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
    // Fresh question pass — never carry stale selections into the UI
    setDraft((d) => ({
      ...d,
      frequency: '',
      overlap: '',
      reason: '',
      considered: '',
      affordability: '',
    }))
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
    // applyCategory sets suggestion defaults — clear those so options aren't pre-selected
    setDraft((d) => ({
      ...d,
      category,
      frequency: '',
      overlap: '',
      reason: '',
      considered: '',
      affordability: '',
    }))
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
        <p className="eyebrow">Vulcet experiment · Step 1 of 3</p>
        <h1>HOLD</h1>
        <p className="lede hero-line">Paste what you want to buy. We score it. You wait — then decide.</p>
        <ol className="hold-steps" aria-label="How HOLD works">
          <li className="hold-step is-current"><span>1</span> Add product</li>
          <li className="hold-step"><span>2</span> Answer 5 questions</li>
          <li className="hold-step"><span>3</span> Get your read</li>
        </ol>
      </header>

      {step === 'product' ? (
        <form className="product-panel stack-form site-card" onSubmit={goAsk}>
          <div className="card-head">
            <h2 className="section-title">What are you about to buy?</h2>
            {enriching ? <span className="pulse-dot">Reading link…</span> : null}
          </div>
          <p className="field-hint">Paste a product URL or type the name and price below.</p>

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
            Continue — answer 5 questions <span aria-hidden="true">→</span>
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
