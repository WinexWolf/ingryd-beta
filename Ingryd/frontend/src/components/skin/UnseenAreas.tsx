
export const UNSEEN_AREAS = ['Jawline', 'Temples & hairline', 'Outer cheeks', 'Neck'] as const
/** What people can tick, and the app concern each one counts toward in suggestions. */
export const UNSEEN_CONCERNS: { label: string; concern: string }[] = [
  { label: 'Breakouts', concern: 'acne' },
  { label: 'Dark spots', concern: 'hyperpigmentation' },
  { label: 'Redness', concern: 'redness' },
  { label: 'Dryness or flaking', concern: 'dryness' },
  { label: 'Rough texture', concern: 'texture' },
]

export interface Unseen { areas: string[]; concerns: string[] }   // concerns = UNSEEN_CONCERNS labels

/** App concern names for what the person reported (empty until they pick at least one area and one concern). */
export function unseenToConcerns(u: Unseen): string[] {
  if (u.areas.length === 0) return []
  return UNSEEN_CONCERNS.filter((c) => u.concerns.includes(c.label)).map((c) => c.concern)
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="px-3 py-1.5 text-xs rounded-full transition-colors"
      style={{
        border: `1px solid ${on ? 'var(--primary)' : 'var(--rim)'}`,
        backgroundColor: on ? 'var(--primary)' : 'transparent',
        color: on ? 'var(--bg)' : 'var(--fg)',
      }}
    >
      {label}
    </button>
  )
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

/** The scan reads the front of the face; the edges are foreshortened and not scored reliably.
 *  This lets people add what they know about those areas, and it counts toward suggestions. */
export function UnseenAreas({ value, onChange }: { value: Unseen; onChange: (u: Unseen) => void }) {
  const added = unseenToConcerns(value)
  return (
    <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>What the scan can't see</p>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--fg)' }}>
          The scan reads the front of your face. The edges (jawline, temples, hairline, outer cheeks) and your neck are
          at an angle and can't be scored reliably. Anything going on there?
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Where</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Areas">
          {UNSEEN_AREAS.map((a) => (
            <Chip key={a} label={a} on={value.areas.includes(a)} onClick={() => onChange({ ...value, areas: toggle(value.areas, a) })} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>What</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Concerns">
          {UNSEEN_CONCERNS.map((c) => (
            <Chip key={c.label} label={c.label} on={value.concerns.includes(c.label)} onClick={() => onChange({ ...value, concerns: toggle(value.concerns, c.label) })} />
          ))}
        </div>
      </div>

      <p role="status" className="text-xs leading-relaxed" style={{ color: added.length ? 'var(--moss)' : 'var(--muted)' }}>
        {added.length
          ? `Added to your suggestions: ${added.join(', ')} (${value.areas.join(', ').toLowerCase()}). These are your own notes, not scan scores.`
          : 'Pick an area and what you see there. It will count toward your product suggestions and profile. Skip this if there is nothing.'}
      </p>
    </div>
  )
}
