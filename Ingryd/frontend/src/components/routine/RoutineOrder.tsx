import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { fetchRoutineOrder } from '../../services/api'
import type { RoutineOrderItem, RoutineOrderResponse, RoutineProductInput } from '../../types'

function Steps({ items }: { items: RoutineOrderItem[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={`${it.step}-${it.name}`} className="flex gap-3 p-3" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}>
          <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs rounded-full" style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}>{it.step}</span>
          <div className="min-w-0">
            <p className="text-sm break-words" style={{ color: 'var(--fg)' }}>{it.name}</p>
            {it.note && <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--muted)' }}>{it.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The order to apply the products on the shelves, morning and evening. */
export function RoutineOrder({ products }: { products: RoutineProductInput[] }) {
  const [data, setData] = useState<RoutineOrderResponse | null>(null)
  const key = JSON.stringify(products.map((p) => [p.name, p.slot]))

  useEffect(() => {
    if (products.length === 0) { setData(null); return }
    let live = true
    const t = setTimeout(() => {
      fetchRoutineOrder(products).then((d) => { if (live) setData(d) }).catch(() => { if (live) setData(null) })
    }, 300)
    return () => { live = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!data || (data.am.length === 0 && data.pm.length === 0)) return null
  return (
    <div className="p-5 sm:p-6 flex flex-col gap-5" style={{ border: '1px solid var(--rim)' }}>
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Order to apply</p>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
          General layering guidance: thinner products first, thicker ones after, sunscreen last in the morning. If a product's own label says otherwise, follow the label.
        </p>
      </div>
      {data.am.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--secondary)' }}><Sun size={14} /> Morning</p>
          <Steps items={data.am} />
        </div>
      )}
      {data.pm.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[10px] tracking-widest uppercase" style={{ color: 'var(--moss)' }}><Moon size={14} /> Evening</p>
          <Steps items={data.pm} />
        </div>
      )}
      {data.tips.length > 0 && (
        <ul className="flex flex-col gap-2" role="status">
          {data.tips.map((t) => (
            <li key={t} className="text-xs leading-relaxed" style={{ color: 'var(--warn)' }}>⚠ {t}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
