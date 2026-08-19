import { useState } from 'react'
import { searchProducts } from '../services/api'
import { addScanToHistory } from '../services/history'
import { ScanResult } from '../components/scanner/ScanResult'
import type { ProductResult, GradeKey } from '../types'
import { GRADE_CONFIG } from '../types'

type PageState = 'idle' | 'loading' | 'results' | 'detail' | 'error'

export function ProductSearch() {
  const [query, setQuery] = useState('')
  const [pageState, setPageState] = useState<PageState>('idle')
  const [results, setResults] = useState<ProductResult[]>([])
  const [selected, setSelected] = useState<ProductResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setPageState('loading')
    setError(null)
    try {
      const res = await searchProducts(query.trim())
      setResults(res.results)
      setPageState('results')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }

  const openProduct = (product: ProductResult) => {
    setSelected(product)
    addScanToHistory(product)
    setPageState('detail')
  }

  const backToResults = () => {
    setSelected(null)
    setPageState(results.length ? 'results' : 'idle')
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 03</p>
        <h1 className="font-display text-5xl" style={{ color: 'var(--fg)' }}>Product Search</h1>
      </div>

      {pageState !== 'detail' && (
        <form onSubmit={handleSearch} className="flex gap-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name or brand, e.g. CeraVe cleanser"
            className="input flex-1"
          />
          <button type="submit" disabled={!query.trim()} className="btn-primary border-l-0">
            Search
          </button>
        </form>
      )}

      {pageState === 'loading' && (
        <div className="p-16 flex flex-col items-center gap-5" style={{ border: '1px solid var(--rim)' }}>
          <div
            className="w-8 h-8 border-2 animate-spin"
            style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }}
          />
          <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Searching Open Beauty Facts</p>
        </div>
      )}

      {pageState === 'error' && (
        <div className="p-10 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <p className="text-[10px] tracking-widest uppercase text-red-700 mb-3">Search failed</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
        </div>
      )}

      {pageState === 'results' && (
        <div className="flex flex-col gap-4">
          <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.length === 0 && (
            <div className="p-10 text-center" style={{ border: '1px solid var(--rim)' }}>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No products matched that search. Try a broader term.</p>
            </div>
          )}
          {results.map((product) => {
            const grade = (product.score?.fit_grade ?? product.score?.grade) as GradeKey | undefined
            const displayScore = product.score?.fit_score ?? product.score?.score
            const config = grade ? GRADE_CONFIG[grade] : null
            return (
              <button
                key={product.barcode}
                onClick={() => openProduct(product)}
                className="flex items-center gap-4 p-4 text-left transition-colors duration-150 hover:opacity-90"
                style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name ?? ''} className="w-14 h-14 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center text-xs" style={{ border: '1px solid var(--rim)', color: 'var(--muted)' }}>
                    N/A
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: 'var(--secondary)' }}>
                    {product.brand ?? 'Unknown brand'}
                  </p>
                  <p className="font-display text-lg truncate" style={{ color: 'var(--fg)' }}>
                    {product.name ?? 'Unnamed product'}
                  </p>
                </div>
                {config && (
                  <span className={`text-xs font-semibold tracking-widest uppercase px-3 py-1 border flex-shrink-0 rounded-full ${config.color} ${config.bg}`}>
                    {displayScore} · {config.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {pageState === 'detail' && selected && (
        <ScanResult product={selected} onReset={backToResults} />
      )}
    </div>
  )
}
