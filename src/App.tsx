import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import GamePage from './pages/GamePage'

// Admin pulls in xlsx (~large); lazy-load it so the export code isn't in the
// initial bundle everyone downloads.
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
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
