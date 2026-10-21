import { useState } from 'react'
import { Sun, Moon, Check } from 'lucide-react'
import { addRoutineItem } from '../../services/history'
import type { RecommendedProduct, RoutineProductInput } from '../../types'

const GRADE_COLOR: Record<string, string> = {
  excellent: 'var(--moss)', good: 'var(--moss)', fair: 'var(--warn)', poor: 'var(--danger)', avoid: 'var(--danger)',
}

/** One recommended product: fit score, why it suits you, any honest downside. */
export function ProductPickCard({ pick, onAdded }: { pick: RecommendedProduct; onAdded?: (item: RoutineProductInput) => void }) {
  const [added, setAdded] = useState<'am' | 'pm' | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const add = async (slot: 'am' | 'pm') => {
    if (busy || added) return
    setBusy(true)
    setFailed(false)
    const r = await addRoutineItem({
      name: pick.name ?? `Product ${pick.barcode}`, brand: pick.brand, slot, ingredients_parsed: pick.ingredients_parsed,
    })
    setBusy(false)
    if (!r) { setFailed(true); return }
    setAdded(slot)
    onAdded?.(r)
  }

  return (
    <div className="p-4 flex flex-col gap-3 min-w-0" style={{ border: '1px solid var(--rim)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'var(--secondary)' }}>{pick.brand ?? 'Unknown brand'}</p>
          <p className="text-sm leading-snug mt-1" style={{ color: 'var(--fg)' }}>{pick.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-display text-2xl leading-none" style={{ color: GRADE_COLOR[pick.fit_grade] ?? 'var(--fg)' }}>{pick.fit_score}</p>
          <p className="text-[9px] tracking-widest uppercase mt-1" style={{ color: 'var(--muted)' }}>Fit</p>
          {pick.delta != null && pick.delta > 0 && (
            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--moss)' }}>+{pick.delta} better</p>
          )}
        </div>
      </div>

      {pick.reasons.length > 0 && (
        <ul className="flex flex-col gap-1">
          {pick.reasons.map((r) => (
            <li key={r} className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              <span style={{ color: 'var(--moss)' }}>+ </span>{r}
            </li>
          ))}
        </ul>
      )}
      {pick.avoids.length > 0 && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          <span style={{ color: 'var(--moss)' }}>+ </span>Skips {pick.avoids.join(', ')}, which your current product has
        </p>
      )}
      {pick.cautions.map((c) => (
        <p key={c} className="text-xs leading-relaxed" style={{ color: 'var(--warn)' }}>− {c}</p>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => add('am')} disabled={busy || !!added} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
          {added === 'am' ? <Check size={12} /> : <Sun size={12} />} Morning
        </button>
        <button onClick={() => add('pm')} disabled={busy || !!added} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
          {added === 'pm' ? <Check size={12} /> : <Moon size={12} />} Evening
        </button>
        {added && <span className="text-xs" style={{ color: 'var(--moss)' }}>Added to your {added === 'am' ? 'morning' : 'evening'} routine</span>}
        {failed && <span className="text-[10px] text-danger">couldn't add</span>}
      </div>
    </div>
  )
}
