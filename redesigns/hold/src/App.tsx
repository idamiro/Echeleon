import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { EntryPage } from './pages/EntryPage'
import { HoldPage } from './pages/HoldPage'
import { ResultPage } from './pages/ResultPage'
import { RevisitPage } from './pages/RevisitPage'
import './hold.css'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
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
    </BrowserRouter>
  )
}
