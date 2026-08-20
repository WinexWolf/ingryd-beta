import { useState, useEffect } from 'react'
import { Sun, Moon, Check } from 'lucide-react'
import { searchProducts, browseProducts } from '../services/api'
import { addScanToHistory, getRoutine, saveRoutine } from '../services/history'
import { ScanResult } from '../components/scanner/ScanResult'
import type { ProductResult, GradeKey } from '../types'
import { GRADE_CONFIG } from '../types'

type PageState = 'loading' | 'browsing' | 'results' | 'detail' | 'error'

function AddToRoutineButtons({ product }: { product: ProductResult }) {
  const [added, setAdded] = useState<'am' | 'pm' | null>(null)

  const addTo = async (slot: 'am' | 'pm') => {
    const current = await getRoutine()
    const already = current.some((p) => p.name === (product.name ?? product.barcode) && p.slot === slot)
    if (!already) {
      await saveRoutine([
        ...current,
        {
          name: product.name ?? `Product ${product.barcode}`,
          brand: product.brand,
          slot,
          ingredients_parsed: product.ingredients_parsed,
        },
      ])
    }
    setAdded(slot)
    setTimeout(() => setAdded(null), 1500)
  }

  return (
    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => addTo('am')}
        title="Add to Morning routine"
        className="p-1.5 rounded-full transition-colors"
        style={{ border: '1px solid var(--rim)', color: added === 'am' ? 'var(--moss)' : 'var(--muted)' }}
      >
        {added === 'am' ? <Check size={13} /> : <Sun size={13} />}
      </button>
      <button
        onClick={() => addTo('pm')}
        title="Add to Evening routine"
        className="p-1.5 rounded-full transition-colors"
        style={{ border: '1px solid var(--rim)', color: added === 'pm' ? 'var(--moss)' : 'var(--muted)' }}
      >
        {added === 'pm' ? <Check size={13} /> : <Moon size={13} />}
      </button>
    </div>
  )
}

export function ProductSearch() {
  const [query, setQuery] = useState('')
  const [pageState, setPageState] = useState<PageState>('loading')
  const [results, setResults] = useState<ProductResult[]>([])
  const [selected, setSelected] = useState<ProductResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [browseFailed, setBrowseFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    browseProducts()
      .then((res) => {
        if (cancelled) return
        setResults(res.results)
        setBrowseFailed(false)
        setPageState('browsing')
      })
      .catch(() => {
        if (cancelled) return
        setPageState('browsing')
        setResults([])
        setBrowseFailed(true)
      })
    return () => { cancelled = true }
  }, [])

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
    setPageState(query.trim() ? 'results' : 'browsing')
  }

  const showList = pageState === 'browsing' || pageState === 'results'

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 03</p>
        <h1 className="font-display text-5xl" style={{ color: 'var(--fg)' }}>Product Search</h1>
      </div>

      {pageState !== 'detail' && (
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name or brand, e.g. CeraVe cleanser"
            className="input flex-1"
          />
          <button type="submit" disabled={!query.trim()} className="btn-primary">
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

      {showList && (
        <div className="flex flex-col gap-4">
          <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            {pageState === 'browsing'
              ? `Browsing A–Z · ${results.length} products`
              : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
          </p>
          {results.length === 0 && (
            <div className="p-10 text-center" style={{ border: '1px solid var(--rim)' }}>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {pageState === 'browsing'
                  ? browseFailed
                    ? "Couldn't reach the product database right now — try searching by name instead."
                    : "No products matched this category yet. Try searching by name instead."
                  : 'No products matched that search. Try a broader term.'}
              </p>
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
                <AddToRoutineButtons product={product} />
                {config ? (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs font-semibold tracking-widest uppercase px-3 py-1 border rounded-full ${config.color} ${config.bg}`}>
                      {displayScore} · {config.label}
                    </span>
                    {(product.score?.comedogenic.length ?? 0) > 0 && (
                      <span className="text-[10px]" style={{ color: '#a16207' }}>
                        ◐ {product.score!.comedogenic.length} pore-clogging
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] tracking-widest uppercase flex-shrink-0" style={{ color: 'var(--muted)' }}>
                    No data
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
