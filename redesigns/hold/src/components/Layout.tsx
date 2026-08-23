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
            <NavLink to="/dashboard">Holds</NavLink>
          </nav>
          <a className="header-ext" href="https://vulcet.com/redesigns/">
            Experiments <span aria-hidden="true">↗</span>
          </a>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <p>HOLD · Vulcet</p>
          <a href="https://vulcet.com">vulcet.com</a>
        </footer>
      </div>
    </div>
  )
}
