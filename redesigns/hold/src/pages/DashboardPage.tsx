import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../data/actions'
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getDashboard()
      if (cancelled) return
      setUser(data.user)
      setProducts(data.products)
      setHolds(data.holds)
      setMoney(data.money.byCurrency)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
        <p className="eyebrow">History</p>
        <h1>Dashboard</h1>
        <p className="lede">
          {user
            ? `Signed in as ${user.displayName}`
            : 'Browse local assessments anytime. Sign in only when you start a hold.'}
        </p>
      </header>

      <section className="panel money-panel">
        <h2 className="section-title">Money not spent</h2>
        <p className="muted">
          Increases only after an explicit Let it go. Expired or ignored holds do not count.
        </p>
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

      <section className="panel">
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
                  : h.status === 'decided'
                    ? `/revisit/${h.id}`
                    : `/revisit/${h.id}`
              return (
                <li key={h.id}>
                  <Link to={href} className="history-row">
                    <div>
                      <strong>{p?.name ?? 'Product'}</strong>
                      <span className="muted">
                        {p ? formatMoney(p.price, p.currency) : ''} · {status}
                      </span>
                    </div>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">Products assessed</h2>
        {products.length === 0 ? (
          <p className="muted">Nothing assessed in this browser yet.</p>
        ) : (
          <ul className="history-list">
            {products.map((p) => (
              <li key={p.id}>
                <div className="history-row static">
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted">
                      {formatMoney(p.price, p.currency)} · {p.category}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
