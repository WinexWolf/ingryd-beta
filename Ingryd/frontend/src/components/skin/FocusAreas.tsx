import type { ConcernArea } from '../../types'
import { STATUS_COLOR, STATUS_WORD } from './statusColor'

/** The three lowest-scoring areas. Always shown, even when everything is healthy,
 *  so every scan ends with something concrete to do. */
export function FocusAreas({ areas, onShow, hasMask }: {
  areas: ConcernArea[]
  onShow: (key: string) => void
  hasMask: (key: string) => boolean
}) {
  const focus = areas.slice(0, 3)
  if (focus.length === 0) return null
  const allGood = focus.every((a) => a.status === 'good')

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Your focus areas</p>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {allGood
            ? 'Everything reads healthy. These are simply your three lowest scores.'
            : 'Your three lowest-scoring areas, and what helps with each.'}
        </p>
      </div>
      {focus.map((a, i) => (
        <div key={a.key} className="p-5 flex flex-col gap-3" style={{ border: '1px solid var(--rim)', borderLeft: `3px solid ${STATUS_COLOR[a.status]}` }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm" style={{ color: 'var(--fg)' }}>
              <span className="font-mono text-xs mr-2" style={{ color: 'var(--muted)' }}>{i + 1}</span>{a.label}
            </p>
            <p className="text-xs font-mono" style={{ color: STATUS_COLOR[a.status] }}>
              {a.score}/100 · {STATUS_WORD[a.status]}
            </p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{a.tip}</p>
          {a.ingredients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {a.ingredients.map((ing) => <span key={ing} className="badge-beneficial">{ing}</span>)}
            </div>
          )}
          {hasMask(a.key) && (
            <button onClick={() => onShow(a.key)} className="text-xs self-start underline" style={{ color: 'var(--primary)' }}>
              Show on my photo
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
