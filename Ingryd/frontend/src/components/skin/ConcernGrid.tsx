import type { ConcernArea } from '../../types'
import { STATUS_COLOR } from './statusColor'

/** All nine scanned concerns at a glance, weakest first. Tapping one shows it on the photo. */
export function ConcernGrid({ areas, selected, onSelect, hasMask }: {
  areas: ConcernArea[]
  selected: string | null
  onSelect: (key: string) => void
  hasMask: (key: string) => boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>All concerns</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {areas.map((a) => {
          const clickable = hasMask(a.key)
          return (
            <button
              key={a.key}
              disabled={!clickable}
              onClick={() => onSelect(a.key)}
              className="p-3 text-left flex flex-col gap-2"
              style={{
                border: `1px solid ${selected === a.key ? 'var(--primary)' : 'var(--rim)'}`,
                backgroundColor: 'transparent',
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{a.label}</span>
              <span className="font-display text-3xl" style={{ color: STATUS_COLOR[a.status] }}>{a.score}</span>
              <span className="block h-1 w-full" style={{ backgroundColor: 'var(--rim)' }}>
                <span className="block h-full" style={{ width: `${a.score}%`, backgroundColor: STATUS_COLOR[a.status] }} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
