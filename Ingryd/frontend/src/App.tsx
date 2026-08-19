import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Home } from './pages/Home'
import { Scanner } from './pages/Scanner'
import { SkinAnalysis } from './pages/SkinAnalysis'
import { ProductSearch } from './pages/ProductSearch'
import { Routine } from './pages/Routine'
import { Profile } from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/skin-analysis" element={<SkinAnalysis />} />
          <Route path="/search" element={<ProductSearch />} />
          <Route path="/routine" element={<Routine />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
