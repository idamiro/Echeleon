import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../data/actions'
import * as db from '../data/db'
import type { HoldRecord, ProductRecord, UserProfile } from '../data/types'
import { formatMoney } from '../lib/currency'
import { formatRelativeRemaining } from '../lib/format'

export function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [holds, setHolds] = useState<HoldRecord[]>([])
  const [money, setMoney] = useState<Record<string, number>>({})
  const [now] = useState(Date.now())

  async function reload() {
    const data = await getDashboard()
    setUser(data.user)
    setProducts(data.products)
    setHolds(data.holds)
    setMoney(data.money.byCurrency)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reload()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function removeProduct(id: string, name: string) {
    if (!window.confirm(`Delete “${name}” and related holds?`)) return
    await db.deleteProductCascade(id)
    await reload()
  }

  async function removeHold(id: string) {
    if (!window.confirm('Delete this hold?')) return
    await db.deleteHold(id)
    await reload()
  }

  const productMap = new Map(products.map((p) => [p.id, p]))
  const moneyEntries = Object.entries(money)

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="page dashboard-page">
      <header className="page-intro">
        <p className="eyebrow">Decisions</p>
        <h1>Holds</h1>
        <p className="lede">
          {user
            ? `Signed in as ${user.displayName}`
            : 'Active waits and past decisions in this browser.'}
        </p>
      </header>

      <section className="glass-panel money-panel">
        <h2 className="section-title">Money not spent</h2>
        <p className="muted">Only explicit Let it go counts.</p>
        {moneyEntries.length === 0 ? (
          <p className="money-zero">—</p>
        ) : (
          <ul className="money-list">
            {moneyEntries.map(([cur, amt]) => (
              <li key={cur}>
                <span className="money-amount">{formatMoney(amt, cur)}</span>
                <span className="muted">{cur}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel">
        <h2 className="section-title">Holds</h2>
        {holds.length === 0 ? (
          <p className="muted">
            No holds yet. <Link to="/">Assess a purchase</Link>
          </p>
        ) : (
          <ul className="history-list">
            {holds.map((h) => {
              const p = productMap.get(h.productId)
              const rem = formatRelativeRemaining(h.endsAt, now)
              const status =
                h.decision === 'let_it_go'
                  ? 'Let it go'
                  : h.decision === 'bought'
                    ? 'Bought'
                    : h.decision === 'hold_again'
                      ? 'Held again'
                      : h.status === 'active' && !rem.expired
                        ? rem.label
                        : 'Ended — decide'
              const href =
                h.status === 'active' && !rem.expired
                  ? `/hold/${h.id}`
                  : `/revisit/${h.id}`
              return (
                <li key={h.id}>
                  <div className="history-row with-actions">
                    <Link to={href} className="history-main">
                      <strong>{p?.name ?? 'Product'}</strong>
                      <span className="muted">
                        {p ? formatMoney(p.price, p.currency) : ''} · {status}
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="btn-icon"
                      aria-label="Delete hold"
                      onClick={() => void removeHold(h.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="glass-panel">
        <h2 className="section-title">Products</h2>
        {products.length === 0 ? (
          <p className="muted">Nothing assessed in this browser yet.</p>
        ) : (
          <ul className="history-list">
            {products.map((p) => (
              <li key={p.id}>
                <div className="history-row with-actions">
                  <div className="history-main">
                    <strong>{p.name}</strong>
                    <span className="muted">
                      {formatMoney(p.price, p.currency)} · {p.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => void removeProduct(p.id, p.name)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
