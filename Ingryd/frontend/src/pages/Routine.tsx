import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { fetchProductByBarcode, searchProducts, checkRoutine } from '../services/api'
import { getRoutine, saveRoutine } from '../services/history'
import type { RoutineProductInput, RoutineCheckResponse } from '../types'

function ProductRow({ product, onRemove }: { product: RoutineProductInput; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-4" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}>
      <span className="text-sm" style={{ color: 'var(--fg)' }}>{product.name}</span>
      <button onClick={onRemove} className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        Remove
      </button>
    </div>
  )
}

export function Routine() {
  const [products, setProducts] = useState<RoutineProductInput[]>([])
  const [addSlot, setAddSlot] = useState<'am' | 'pm'>('am')
  const [addMode, setAddMode] = useState<'barcode' | 'search'>('barcode')
  const [inputValue, setInputValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [result, setResult] = useState<RoutineCheckResponse | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setProducts(getRoutine())
  }, [])

  useEffect(() => {
    saveRoutine(products)
  }, [products])

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
            { name: p.name ?? `Product ${p.barcode}`, slot: addSlot, ingredients_parsed: p.ingredients_parsed },
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
            { name: first.name ?? `Product ${first.barcode}`, slot: addSlot, ingredients_parsed: first.ingredients_parsed },
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

      {/* AM / PM lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--secondary)' }}>
            <Sun size={14} /> Morning · {amProducts.length}
          </p>
          {amProducts.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>No products added yet.</p>
          )}
          {amProducts.map((p) => (
            <ProductRow key={p.idx} product={p} onRemove={() => removeProduct(p.idx)} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--secondary)' }}>
            <Moon size={14} /> Evening · {pmProducts.length}
          </p>
          {pmProducts.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>No products added yet.</p>
          )}
          {pmProducts.map((p) => (
            <ProductRow key={p.idx} product={p} onRemove={() => removeProduct(p.idx)} />
          ))}
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
