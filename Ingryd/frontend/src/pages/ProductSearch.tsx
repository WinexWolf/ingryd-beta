import { useState, useEffect } from 'react'
import { Sun, Moon, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { searchProducts, browseProducts } from '../services/api'
import type { SortMode } from '../services/api'
import { addScanToHistory, addRoutineItem } from '../services/history'
import { SearchBox } from '../components/ui/SearchBox'
import { ScanResult } from '../components/scanner/ScanResult'
import { PersonalizeNudge } from '../components/ui/ScoreExplainer'
import type { ProductResult, GradeKey } from '../types'
import { GRADE_CONFIG } from '../types'

type PageState = 'loading' | 'browsing' | 'results' | 'detail' | 'error'
const PAGE_SIZE = 20

function AddToRoutineButtons({ product }: { product: ProductResult }) {
  const [added, setAdded] = useState<'am' | 'pm' | null>(null)
  const [failed, setFailed] = useState(false)

  const addTo = async (slot: 'am' | 'pm') => {
    setFailed(false)
    const result = await addRoutineItem({
      name: product.name ?? `Product ${product.barcode}`,
      brand: product.brand,
      slot,
      ingredients_parsed: product.ingredients_parsed,
    })
    if (!result) {
      setFailed(true)
      setTimeout(() => setFailed(false), 2000)
      return
    }
    setAdded(slot)
    setTimeout(() => setAdded(null), 1500)
  }

  return (
    <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-1">
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
      {failed && <span className="text-[9px] text-danger">couldn't add</span>}
    </div>
  )
}

function ProductThumb({ product }: { product: ProductResult }) {
  if (product.image_url) {
    return <img src={product.image_url} alt={product.name ?? ''} className="w-14 h-14 object-contain flex-shrink-0 rounded-md" style={{ border: '1px solid var(--rim)' }} />
  }
  const initial = (product.brand?.[0] ?? product.name?.[0] ?? '?').toUpperCase()
  return (
    <div
      className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-md font-display text-xl"
      style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--bg)', color: 'var(--secondary)' }}
    >
      {initial}
    </div>
  )
}

export function ProductSearch() {
  const [query, setQuery] = useState('')
  const [pageState, setPageState] = useState<PageState>('loading')
  const [results, setResults] = useState<ProductResult[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortMode>('name')
  const [selected, setSelected] = useState<ProductResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [browseFailed, setBrowseFailed] = useState(false)

  const loadPage = (targetPage: number, targetSort: SortMode, activeQuery: string) => {
    setPageState('loading')
    setError(null)
    const request = activeQuery.trim()
      ? searchProducts(activeQuery.trim(), targetPage, PAGE_SIZE, targetSort)
      : browseProducts(targetPage, PAGE_SIZE, targetSort)

    request
      .then((res) => {
        setResults(res.results)
        setTotalCount(res.total_count)
        setPage(res.page)
        setBrowseFailed(false)
        setPageState(activeQuery.trim() ? 'results' : 'browsing')
      })
      .catch((err: unknown) => {
        if (!activeQuery.trim()) {
          setBrowseFailed(true)
          setPageState('browsing')
          setResults([])
          return
        }
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setPageState('error')
      })
  }

  useEffect(() => {
    loadPage(1, sort, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadPage(1, sort, query)
  }

  const changeSort = (newSort: SortMode) => {
    setSort(newSort)
    loadPage(1, newSort, query)
  }

  const goToPage = (newPage: number) => {
    loadPage(newPage, sort, query)
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
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 03</p>
        <h1 className="font-display text-4xl sm:text-5xl" style={{ color: 'var(--fg)' }}>Product Search</h1>
      </div>

      {pageState !== 'detail' && (
        <form onSubmit={handleSearch} className="flex gap-2 sm:gap-3 items-start">
          <SearchBox
            value={query}
            onChange={setQuery}
            onPick={(sug) => { setQuery(sug.name); loadPage(1, sort, sug.name) }}
            placeholder="Search by product name or brand, e.g. CeraVe cleanser"
          />
          <button type="submit" disabled={!query.trim()} className="btn-primary !px-4 sm:!px-6">
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
          <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Loading</p>
        </div>
      )}

      {pageState === 'error' && (
        <div className="p-10 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <p className="text-[10px] tracking-widest uppercase text-danger mb-3">Search failed</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
        </div>
      )}

      {showList && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
              {pageState === 'browsing'
                ? totalCount > 0 ? `Showing ${rangeStart}–${rangeEnd} of ${totalCount.toLocaleString()} products` : 'Browsing'
                : `${totalCount} result${totalCount !== 1 ? 's' : ''} for "${query}"`}
            </p>
            <div className="flex gap-2">
              {(['name', 'score'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => changeSort(s)}
                  className={`text-[10px] tracking-widest uppercase px-3 py-1.5 border rounded-full ${sort === s ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {s === 'name' ? 'A–Z' : 'Top Rated'}
                </button>
              ))}
            </div>
          </div>

          {results.some((r) => r.score) && !results.some((r) => typeof r.score?.fit_score === 'number') && <PersonalizeNudge compact />}

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
              <div
                key={product.barcode || product.name}
                role="button"
                tabIndex={0}
                onClick={() => openProduct(product)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProduct(product) } }}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 text-left cursor-pointer transition-colors duration-150 hover:opacity-90"
                style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <ProductThumb product={product} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] tracking-widest uppercase mb-1 break-words" style={{ color: 'var(--secondary)' }}>
                      {product.brand ?? 'Unknown brand'}
                    </p>
                    <p className="font-display text-base sm:text-lg leading-snug break-words" style={{ color: 'var(--fg)' }}>
                      {product.name ?? 'Unnamed product'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
                  <AddToRoutineButtons product={product} />
                  {config ? (
                    <div className="flex flex-col items-end gap-1 min-w-0">
                      <span className={`text-[11px] sm:text-xs font-semibold tracking-wider sm:tracking-widest uppercase px-3 py-1 border rounded-full whitespace-nowrap ${config.color} ${config.bg}`}>
                        {typeof product.score?.fit_score === 'number' ? 'Fit' : 'General'} {displayScore} · {config.label}
                      </span>
                      {(product.score?.prohibited.length ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--danger)' }}>
                          ⚠ banned substance
                        </span>
                      )}
                      {(product.score?.comedogenic.length ?? 0) > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--warn)' }}>
                          ◐ {product.score!.comedogenic.length} pore-clogging
                        </span>
                      )}
                      {(product.score?.allergens.length ?? 0) > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--warn)' }}>
                          ◐ {product.score!.allergens.length} EU allergen{product.score!.allergens.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
                      No data
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-full disabled:opacity-30"
                style={{ border: '1px solid var(--rim)', color: 'var(--fg)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-full disabled:opacity-30"
                style={{ border: '1px solid var(--rim)', color: 'var(--fg)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {pageState === 'detail' && selected && (
        <ScanResult product={selected} onReset={backToResults} />
      )}
    </div>
  )
}
