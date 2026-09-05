import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import GamePage from './pages/GamePage'
import LoginPage from './pages/LoginPage'
import { useProfile, touchSession } from './lib/profile'

// Admin pulls in xlsx (~large); lazy-load it so the export code isn't in the
// initial bundle everyone downloads.
const Admin = lazy(() => import('./pages/Admin'))
// The License Plate Challenge pulls in a QR decoder; lazy-load it too.
const LicensePlateChallenge = lazy(() => import('./pages/LicensePlateChallenge'))

export default function App() {
  const player = useProfile()
  const isAdmin = useLocation().pathname.startsWith('/admin')

  // Keep the session alive on activity; it otherwise locks after 15 min idle.
  useEffect(() => {
    if (!player) return
    const bump = () => touchSession()
    const events = ['pointerdown', 'keydown', 'click', 'scroll', 'touchstart'] as const
    for (const e of events) window.addEventListener(e, bump, { passive: true })
    return () => {
      for (const e of events) window.removeEventListener(e, bump)
    }
  }, [player])

  // The whole player app is behind the login page. Admin has its own password
  // gate and stays reachable without a player session.
  if (!player && !isAdmin) return <LoginPage />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/license-plate"
          element={
            <Suspense
              fallback={
                <div className="rounded-2xl bg-white p-8 text-center text-seven-dark/60 shadow">
                  Loading…
                </div>
              }
            >
              <LicensePlateChallenge />
            </Suspense>
          }
        />
        <Route path="/play/:slug" element={<GamePage />} />
        <Route
          path="/admin"
          element={
            <Suspense
              fallback={
                <div className="rounded-2xl bg-white p-8 text-center text-seven-dark/60 shadow">
                  Loading…
                </div>
              }
            >
              <Admin />
            </Suspense>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  )
}
