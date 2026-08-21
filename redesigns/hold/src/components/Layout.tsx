import { Link, NavLink, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand" aria-label="HOLD home">
          HOLD
        </Link>
        <nav aria-label="Primary">
          <NavLink to="/" end>
            Assess
          </NavLink>
          <NavLink to="/dashboard">History</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>
          HOLD is a Vulcet experiment — cool the purchase, keep the signals separate.
        </p>
        <a href="/redesigns/">← Redesigns</a>
      </footer>
    </div>
  )
}
