import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './pages/Home'
import { Scanner } from './pages/Scanner'
import { SkinAnalysis } from './pages/SkinAnalysis'
import { ProductSearch } from './pages/ProductSearch'
import { Routine } from './pages/Routine'
import { Profile } from './pages/Profile'
import { Auth } from './pages/Auth'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scan" element={<Scanner />} />
            <Route path="/skin-analysis" element={<SkinAnalysis />} />
            <Route path="/search" element={<ProductSearch />} />
            <Route path="/routine" element={<Routine />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/auth" element={<Auth />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  )
}
