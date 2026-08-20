import { useEffect, useState } from 'react'
import { Sun, Moon, X } from 'lucide-react'
import { fetchProductByBarcode, searchProducts, checkRoutine } from '../services/api'
import { getRoutine, saveRoutine } from '../services/history'
import { BottleIcon } from '../components/routine/BottleIcon'
import type { RoutineProductInput, RoutineCheckResponse } from '../types'

function ShelfCard({ product, index, onRemove }: { product: RoutineProductInput; index: number; onRemove: () => void }) {
  const color = index % 2 === 0 ? 'var(--moss)' : 'var(--secondary)'
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

function Shelf({ products, onRemove }: { products: (RoutineProductInput & { idx: number })[]; onRemove: (idx: number) => void }) {
  if (products.length === 0) {
    return (
      <div className="relative rounded-lg p-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--rim)' }}>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>No products added yet.</p>
      </div>
    )
  }
  return (
    <div className="relative rounded-lg pt-5 px-4 pb-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--rim)' }}>
      <div className="flex gap-4 items-end overflow-x-auto pb-2">
        {products.map((p, i) => (
          <ShelfCard key={p.idx} product={p} index={i} onRemove={() => onRemove(p.idx)} />
        ))}
      </div>
      <div className="h-[3px] rounded mt-1" style={{ backgroundColor: 'var(--rim)' }} />
    </div>
  )
}

export function Routine() {
  const [products, setProducts] = useState<RoutineProductInput[]>([])
  const [loaded, setLoaded] = useState(false)
  const [addSlot, setAddSlot] = useState<'am' | 'pm'>('am')
  const [addMode, setAddMode] = useState<'barcode' | 'search'>('barcode')
  const [inputValue, setInputValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [result, setResult] = useState<RoutineCheckResponse | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRoutine().then((r) => {
      if (cancelled) return
      setProducts(r)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    // Guard against saving before the initial fetch resolves — without this,
    // the empty initial state would overwrite the real saved routine on every
    // page load, before getRoutine() above has a chance to populate it.
    if (!loaded) return
    saveRoutine(products)
  }, [products, loaded])

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    setBusy(true)
    setAddError(null)
    try {
      if (addMode === 'barcode') {
        const p = await fetchProductByBarcode(inputValue.trim())
        if (!p.found) {
          setAddError('Product not found for that barcode.')
        } else {
          setProducts((prev) => [
            ...prev,
            { name: p.name ?? `Product ${p.barcode}`, brand: p.brand, slot: addSlot, ingredients_parsed: p.ingredients_parsed },
          ])
          setInputValue('')
        }
      } else {
        const res = await searchProducts(inputValue.trim())
        const first = res.results[0]
        if (!first) {
          setAddError('No products matched that search.')
        } else {
          setProducts((prev) => [
            ...prev,
            { name: first.name ?? `Product ${first.barcode}`, brand: first.brand, slot: addSlot, ingredients_parsed: first.ingredients_parsed },
          ])
          setInputValue('')
        }
      }
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const removeProduct = (idx: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx))
    setResult(null)
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

  const amProducts = products.map((p, i) => ({ ...p, idx: i })).filter((p) => p.slot === 'am')
  const pmProducts = products.map((p, i) => ({ ...p, idx: i })).filter((p) => p.slot === 'pm')

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 04</p>
        <h1 className="font-display text-5xl" style={{ color: 'var(--fg)' }}>My Routine</h1>
      </div>

      {/* Add product form */}
      <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Add a product</p>
        <div className="flex gap-2 flex-wrap">
          {(['am', 'pm'] as const).map((slot) => (
            <button
              key={slot}
              onClick={() => setAddSlot(slot)}
              className={`flex items-center gap-1.5 text-xs tracking-widest uppercase px-4 py-2 border ${addSlot === slot ? 'btn-primary' : 'btn-ghost'}`}
            >
              {slot === 'am' ? <Sun size={14} /> : <Moon size={14} />}
              {slot === 'am' ? 'Morning' : 'Evening'}
            </button>
          ))}
          <div className="flex-1" />
          {(['barcode', 'search'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setAddMode(mode); setInputValue('') }}
              className={`text-xs tracking-widest uppercase px-4 py-2 border ${addMode === mode ? 'btn-primary' : 'btn-ghost'}`}
            >
              {mode === 'barcode' ? 'By barcode' : 'By name'}
            </button>
          ))}
        </div>
        <form onSubmit={addProduct} className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={addMode === 'barcode' ? 'e.g. 3606000537750' : 'e.g. CeraVe Foaming Cleanser'}
            className="input flex-1"
          />
          <button type="submit" disabled={!inputValue.trim() || busy} className="btn-primary">
            {busy ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addError && <p className="text-xs text-red-700">{addError}</p>}
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
                  style={{ color: c.severity === 'high' ? '#b91c1c' : '#a16207' }}
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
