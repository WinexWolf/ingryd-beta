import { useEffect, useState } from 'react'
import { getProfile, mergeScanIntoPreferences } from '../../services/profile'
import { getRecommendations } from '../../services/api'
import type { RecommendResponse, SkinProfile } from '../../types'
import { ProductPickCard } from './ProductPickCard'

/** Catalog products ranked for this user, by product type. Pass `scan` to rank against a
 *  scan the user hasn't applied to their profile yet. */
export function PicksForYou({ scan, groups = 3, perGroup = 2, title = 'Picked for you', mode = 'groups' }: {
  scan?: SkinProfile
  /** 'top' shows the best three overall (for Home); 'groups' shows the best by product type. */
  mode?: 'groups' | 'top'
  groups?: number
  perGroup?: number
  title?: string
}) {
  const [data, setData] = useState<RecommendResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const prefs = scan ? mergeScanIntoPreferences(scan, await getProfile()) : undefined
        const r = await getRecommendations(prefs, groups, perGroup)
        if (!cancelled) { setData(r); setState('ready') }
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [scan, groups, perGroup])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>{title}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Ranked by Fit Score against {scan ? 'this scan' : 'your profile'}, best match first.
        </p>
      </div>

      {state === 'loading' && <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Finding matches…</p>}
      {state === 'error' && <p className="text-sm" style={{ color: 'var(--muted)' }}>Couldn't load recommendations right now.</p>}
      {state === 'ready' && data && mode === 'top' && (
        data.top.length > 0
          ? <div className="grid gap-2 sm:grid-cols-3">{data.top.map((p) => <ProductPickCard key={p.barcode + p.name} pick={p} />)}</div>
          : <p className="text-sm" style={{ color: 'var(--muted)' }}>No strong matches in the catalog yet.</p>
      )}
      {state === 'ready' && data && mode === 'groups' && data.groups.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>No strong matches in the catalog yet.</p>
      )}
      {state === 'ready' && mode === 'groups' && data?.groups.map((g) => (
        <div key={g.category} className="flex flex-col gap-2">
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>{g.label}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.picks.map((p) => <ProductPickCard key={p.barcode + p.name} pick={p} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
