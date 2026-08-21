import { Link, NavLink, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="app-shell">
      <div className="site-frame">
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
          <a className="header-ext" href="/redesigns/">
            Redesigns
          </a>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <p>HOLD · Vulcet — cool the purchase, keep the signals separate.</p>
          <a href="https://vulcet.com">vulcet.com</a>
        </footer>
      </div>
    </div>
  )
}
