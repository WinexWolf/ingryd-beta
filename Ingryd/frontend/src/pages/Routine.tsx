import { useEffect, useState } from 'react'
import { Sun, Moon, X, Search, ScanBarcode } from 'lucide-react'
import { SearchBox } from '../components/ui/SearchBox'
import { fetchProductByBarcode, searchProducts, checkRoutine } from '../services/api'
import { getRoutine, addRoutineItem, removeRoutineItem } from '../services/history'
import { BottleIcon } from '../components/routine/BottleIcon'
import { RoutineFitPanel } from '../components/routine/RoutineFitPanel'
import type { RoutineProductInput, RoutineCheckResponse, ProductResult } from '../types'

function ShelfCard({ product, index, onRemove }: { product: RoutineProductInput; index: number; onRemove: () => void }) {
  const color = index % 2 === 0 ? 'var(--primary)' : 'var(--secondary)'
  return (
    <div className="text-center flex-shrink-0" style={{ width: 78 }}>
      <BottleIcon name={product.name} color={color} />
      <div
        className="relative mt-2 rounded-md p-1.5"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--rim)' }}
      >
        <button
          onClick={onRemove}
          aria-label={`Remove ${product.name}`}
          className="absolute -top-1.5 -right-1.5 rounded-full p-0.5"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--rim)', color: 'var(--muted)' }}
        >
          <X size={10} />
        </button>
        {product.brand && (
          <p className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--fg)' }}>{product.brand}</p>
        )}
        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--muted)' }}>{product.name}</p>
      </div>
    </div>
  )
}

function Shelf({ products, onRemove }: { products: RoutineProductInput[]; onRemove: (id: string) => void }) {
  if (products.length === 0) {
    return (
      <div className="relative rounded-lg p-6" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--rim)' }}>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>No products added yet.</p>
      </div>
    )
  }
  return (
    <div className="relative rounded-lg pt-5 px-4 pb-4" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--rim)' }}>
      <div className="flex gap-4 items-end overflow-x-auto pb-2">
        {products.map((p, i) => (
          <ShelfCard key={p.id} product={p} index={i} onRemove={() => p.id && onRemove(p.id)} />
        ))}
      </div>
      <div className="h-[3px] rounded mt-1" style={{ backgroundColor: 'var(--rim)' }} />
    </div>
  )
}

export function Routine() {
  const [products, setProducts] = useState<RoutineProductInput[]>([])
  const [addSlot, setAddSlot] = useState<'am' | 'pm'>('am')
  const [addMode, setAddMode] = useState<'barcode' | 'search'>('search')
  const [inputValue, setInputValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<ProductResult[]>([])
  const [result, setResult] = useState<RoutineCheckResponse | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRoutine().then((r) => { if (!cancelled) setProducts(r) })
    return () => { cancelled = true }
  }, [])

  const addOne = async (name: string, brand: string | undefined, ingredients: string[]) => {
    const added = await addRoutineItem({ name, brand, slot: addSlot, ingredients_parsed: ingredients })
    if (added) {
      setProducts((prev) => [...prev, added])
    } else {
      setAddError('Could not save to your routine. Try logging in again.')
    }
  }

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    setBusy(true)
    setAddError(null)
    try {
      const p = await fetchProductByBarcode(inputValue.trim())
      if (!p.found) {
        setAddError('Product not found for that barcode.')
      } else {
        await addOne(p.name ?? `Product ${p.barcode}`, p.brand, p.ingredients_parsed)
        setInputValue('')
      }
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    setBusy(true)
    setAddError(null)
    setSearchResults([])
    try {
      const res = await searchProducts(inputValue.trim())
      if (res.results.length === 0) {
        setAddError('No products matched that search.')
      } else {
        setSearchResults(res.results.slice(0, 6))
      }
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const pickSearchResult = async (p: ProductResult) => {
    await addOne(p.name ?? `Product ${p.barcode}`, p.brand, p.ingredients_parsed)
    setSearchResults([])
    setInputValue('')
  }

  const removeProduct = async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setResult(null)
    await removeRoutineItem(id)
  }

  const runCheck = async () => {
    setChecking(true)
    try {
      const res = await checkRoutine(products)
      setResult(res)
    } catch {
      setAddError('Could not check routine. Try again.')
    } finally {
      setChecking(false)
    }
  }

  const amProducts = products.filter((p) => p.slot === 'am')
  const pmProducts = products.filter((p) => p.slot === 'pm')

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 04</p>
        <h1 className="font-display text-4xl sm:text-5xl" style={{ color: 'var(--fg)' }}>My Routine</h1>
      </div>

      {/* Add product form */}
      <div className="p-5 sm:p-6 flex flex-col gap-6" style={{ border: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Add a product</p>

        {/* Step 1 — when */}
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            <span style={{ color: 'var(--secondary)' }}>1 · </span>When do you use it?
          </p>
          <div role="radiogroup" aria-label="When do you use this product" className="grid grid-cols-2 gap-2">
            {(['am', 'pm'] as const).map((slot) => {
              const on = addSlot === slot
              return (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAddSlot(slot)}
                  className={`flex items-center justify-center gap-2 text-sm py-3 px-3 border rounded-md normal-case tracking-normal font-semibold transition-colors ${on ? '' : 'btn-ghost'}`}
                  style={on ? { backgroundColor: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)' } : undefined}
                >
                  {slot === 'am' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
                  {slot === 'am' ? 'Morning' : 'Evening'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2 — how to find it */}
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            <span style={{ color: 'var(--secondary)' }}>2 · </span>Find the product
          </p>
          <div role="tablist" aria-label="How to find the product" className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--rim)' }}>
            {([
              { mode: 'search', label: 'Search by name', icon: <Search size={15} className="shrink-0" /> },
              { mode: 'barcode', label: 'Enter barcode', icon: <ScanBarcode size={15} className="shrink-0" /> },
            ] as const).map(({ mode, label, icon }) => {
              const on = addMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => { setAddMode(mode); setInputValue(''); setSearchResults([]); setAddError(null) }}
                  className="flex items-center justify-center gap-2 text-sm py-2.5 -mb-px"
                  style={{
                    color: on ? 'var(--fg)' : 'var(--muted)',
                    fontWeight: on ? 600 : 400,
                    borderBottom: on ? '2px solid var(--primary)' : '2px solid transparent',
                  }}
                >
                  {icon}{label}
                </button>
              )
            })}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {addMode === 'search'
              ? 'Start typing a brand or product name, then pick it from the list.'
              : 'Type the number printed under the barcode (8–14 digits).'}
          </p>
        </div>

        <form onSubmit={addMode === 'barcode' ? handleBarcodeSubmit : handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          {addMode === 'search' ? (
            <SearchBox
              value={inputValue}
              onChange={setInputValue}
              placeholder="e.g. CeraVe Foaming Cleanser"
              onPick={async (sug) => {
                setBusy(true); setAddError(null)
                try { await pickSearchResult(await fetchProductByBarcode(sug.barcode)) }
                catch (err: unknown) { setAddError(err instanceof Error ? err.message : 'Could not add that product') }
                finally { setBusy(false) }
              }}
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g. 3606000537750"
              className="input flex-1 min-w-0"
              inputMode="numeric"
            />
          )}
          <button type="submit" disabled={!inputValue.trim() || busy} className="btn-primary whitespace-nowrap">
            {busy ? '…' : addMode === 'barcode' ? `Add to ${addSlot === 'am' ? 'morning' : 'evening'}` : 'Search'}
          </button>
        </form>
        {addError && <p className="text-xs text-danger">{addError}</p>}

        {/* Pick which product to add — this is what was missing before */}
        {addMode === 'search' && searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((p) => (
              <button
                key={p.barcode}
                onClick={() => pickSearchResult(p)}
                className="flex items-center gap-3 p-2.5 text-left rounded-md transition-colors hover:opacity-90"
                style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-9 h-9 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 flex-shrink-0" style={{ border: '1px solid var(--rim)' }} />
                )}
                <div className="min-w-0">
                  <p className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--secondary)' }}>{p.brand ?? 'Unknown'}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--fg)' }}>{p.name ?? 'Unnamed product'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AM / PM shelves */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--secondary)' }}>
            <Sun size={14} /> Morning · {amProducts.length}
          </p>
          <Shelf products={amProducts} onRemove={removeProduct} />
        </div>
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--moss)' }}>
            <Moon size={14} /> Evening · {pmProducts.length}
          </p>
          <Shelf products={pmProducts} onRemove={removeProduct} />
        </div>
      </div>

      <RoutineFitPanel products={products} onAdded={(item) => { setResult(null); setProducts((prev) => [...prev, item]) }} />

      {products.length >= 2 && (
        <button onClick={runCheck} disabled={checking} className="btn-primary self-start">
          {checking ? 'Checking…' : 'Check for Conflicts'}
        </button>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {result.clean ? (
            <div className="p-6 text-center" style={{ border: '1px solid var(--moss)', backgroundColor: 'rgba(143,153,81,0.05)' }}>
              <p className="text-sm" style={{ color: 'var(--moss)' }}>No known conflicts detected in your routine.</p>
            </div>
          ) : (
            result.conflicts.map((c, i) => (
              <div
                key={i}
                className="p-6"
                style={{
                  border: c.severity === 'high' ? '1px solid rgba(185,28,28,0.4)' : '1px solid rgba(180,83,9,0.4)',
                }}
              >
                <p
                  className="text-[10px] tracking-widest uppercase mb-3"
                  style={{ color: c.severity === 'high' ? 'var(--danger)' : 'var(--warn)' }}
                >
                  {c.severity === 'high' ? 'High conflict' : 'Moderate conflict'} · {c.product_a} + {c.product_b}
                </p>
                <p className="text-sm mb-2" style={{ color: 'var(--fg)' }}>{c.reason}</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{c.advice}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
