import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RequireAuth } from './components/RequireAuth'
import { Home } from './pages/Home'
import { Scanner } from './pages/Scanner'
import { SkinAnalysis } from './pages/SkinAnalysis'
import { ProductSearch } from './pages/ProductSearch'
import { Routine } from './pages/Routine'
import { Profile } from './pages/Profile'
import { Auth } from './pages/Auth'
import { ResetPassword } from './pages/ResetPassword'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/scan" element={<RequireAuth><Scanner /></RequireAuth>} />
            <Route path="/skin-analysis" element={<RequireAuth><SkinAnalysis /></RequireAuth>} />
            <Route path="/search" element={<RequireAuth><ProductSearch /></RequireAuth>} />
            <Route path="/routine" element={<RequireAuth><Routine /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  )
}
