import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { EntryPage } from './pages/EntryPage'
import { HoldPage } from './pages/HoldPage'
import { ResultPage } from './pages/ResultPage'
import { RevisitPage } from './pages/RevisitPage'
import './hold.css'

/**
 * HashRouter: Cloudflare Workers static deploy rejects SPA _redirects that
 * rewrite /redesigns/hold/* → index.html (infinite loop). Hash routes need no redirects.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<EntryPage />} />
          <Route path="result/:productId/:assessmentId" element={<ResultPage />} />
          <Route path="hold/:holdId" element={<HoldPage />} />
          <Route path="revisit/:holdId" element={<RevisitPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
