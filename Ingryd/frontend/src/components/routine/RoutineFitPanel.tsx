import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRoutineFit } from '../../services/api'
import type { RoutineFitResponse, RoutineProductInput } from '../../types'
import { ProductPickCard } from '../recommend/ProductPickCard'

/** Your routine measured against your latest scan: what helps, what hurts, what's missing. */
export function RoutineFitPanel({ products, onAdded }: { products: RoutineProductInput[]; onAdded?: (item: RoutineProductInput) => void }) {
  const [data, setData] = useState<RoutineFitResponse | null>(null)
  const [failed, setFailed] = useState(false)
  // products change identity on every add/remove; key on what actually matters
  const key = products.map((p) => `${p.id}:${p.slot}:${p.name}`).join('|')

  useEffect(() => {
    if (products.length === 0) { setData(null); return }
    let cancelled = false
    setFailed(false)
    const t = setTimeout(() => {
      getRoutineFit(products)
        .then((r) => { if (!cancelled) setData(r) })
        .catch(() => { if (!cancelled) setFailed(true) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (products.length === 0) return null
  if (failed) return null
  if (!data) return <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Checking your routine against your skin…</p>

  const scored = data.products.filter((p) => p.fit_score != null)

  return (
    <div className="flex flex-col gap-6">
      <div className="p-6 flex flex-col gap-3" style={{ border: '1px solid var(--primary)' }}>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Your routine vs your skin</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>{data.headline}</p>
        {!data.has_scan && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            This uses the concerns on your profile. <Link to="/skin-analysis" className="underline" style={{ color: 'var(--primary)' }}>Scan your skin</Link> to
            see how severe each one actually is.
          </p>
        )}
      </div>

      {data.covered.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--moss)' }}>Working for you</p>
          {data.covered.map((c) => (
            <div key={c.concern} className="p-4" style={{ border: '1px solid var(--moss)', backgroundColor: 'rgba(143,153,81,0.05)' }}>
              <p className="text-sm" style={{ color: 'var(--fg)' }}>
                {c.label}{c.score != null && <span className="font-mono text-xs ml-2" style={{ color: 'var(--muted)' }}>scan {c.score}/100</span>}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Covered by {c.products.join(', ')}</p>
            </div>
          ))}
        </div>
      )}

      {data.gaps.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--danger)' }}>Not covered yet</p>
          {data.gaps.map((g) => (
            <div key={g.concern} className="p-4 flex flex-col gap-3" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
              <p className="text-sm" style={{ color: 'var(--fg)' }}>{g.message}</p>
              {g.suggestion && (
                <>
                  <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'var(--muted)' }}>Try adding</p>
                  <ProductPickCard pick={g.suggestion} onAdded={onAdded} />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {data.missing_basics.length > 0 && (
        <div className="p-4 flex flex-col gap-2" style={{ border: '1px solid rgba(180,83,9,0.4)' }}>
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--warn)' }}>Basics</p>
          {data.missing_basics.map((b) => <p key={b} className="text-sm" style={{ color: 'var(--fg)' }}>{b}</p>)}
        </div>
      )}

      {scored.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Each product, scored for you</p>
          {scored.map((p, i) => (
            <div key={`${p.name}-${i}`} className="p-4 flex flex-col gap-2" style={{ border: '1px solid var(--rim)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm min-w-0" style={{ color: 'var(--fg)' }}>
                  {p.brand ? `${p.brand} · ` : ''}{p.name}
                  <span className="text-[10px] uppercase tracking-widest ml-2" style={{ color: 'var(--muted)' }}>{p.slot === 'am' ? 'AM' : 'PM'}</span>
                </p>
                <p className="font-display text-xl" style={{ color: (p.fit_score ?? 0) >= 70 ? 'var(--moss)' : (p.fit_score ?? 0) >= 50 ? 'var(--warn)' : 'var(--danger)' }}>{p.fit_score}</p>
              </div>
              {p.working_for.map((w) => <p key={w} className="text-xs" style={{ color: 'var(--muted)' }}><span style={{ color: 'var(--moss)' }}>+ </span>{w}</p>)}
              {p.working_against.map((w) => <p key={w} className="text-xs" style={{ color: 'var(--warn)' }}>− {w}</p>)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
