import { useEffect, useState } from 'react'
import { getAlternatives } from '../../services/api'
import type { AlternativesResponse, ProductResult } from '../../types'
import { ProductPickCard } from './ProductPickCard'

/** Shown under a scanned product: same-type products that score higher for this user. */
export function BetterForYou({ product }: { product: ProductResult }) {
  const [data, setData] = useState<AlternativesResponse | null>(null)
  const personalized = product.score?.fit_score !== undefined

  useEffect(() => {
    let cancelled = false
    setData(null)
    getAlternatives(product).then((r) => { if (!cancelled) setData(r) }).catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [product])

  if (!data || (data.picks.length === 0 && !data.message)) return null

  return (
    <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--primary)' }}>
      <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>
        {personalized ? 'Better for you' : 'Higher-scoring alternatives'}
      </p>
      {data.picks.length > 0 ? (
        <>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Same type of product, scoring higher{personalized ? ' for your skin' : ''}
            {data.current_fit != null ? ` than this one (${data.current_fit}).` : '.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.picks.map((p) => <ProductPickCard key={p.barcode + p.name} pick={p} />)}
          </div>
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{data.message}</p>
      )}
    </div>
  )
}
