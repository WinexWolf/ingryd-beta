import { useState } from 'react'
import type { ConcernArea } from '../../types'

/** The user's own photo with YouCam's mask for the selected concern drawn on top.
 *  Masks are aligned to the uploaded image, so both share one box. `screen` blending
 *  keeps the face visible whether the mask is a tinted transparent PNG or white-on-black. */
export function ScanOverlay({
  photo, masks, areas, selected, onSelect,
}: {
  photo: string
  masks: Record<string, string>
  areas: ConcernArea[]
  selected: string | null
  onSelect: (key: string | null) => void
}) {
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const withMask = areas.filter((a) => masks[a.key] && !failed[a.key])
  const active = selected && masks[selected] && !failed[selected] ? selected : null
  const area = areas.find((a) => a.key === active)

  return (
    <div className="p-4 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
      <div className="flex justify-center" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="relative inline-block leading-none">
          <img src={photo} alt="Your scan" style={{ maxHeight: '24rem', maxWidth: '100%', display: 'block', filter: active ? 'brightness(0.6)' : undefined, transition: 'filter 0.2s' }} />
          {active && (
            <img
              key={active}
              src={masks[active]}
              alt={`${area?.label ?? active} detected areas`}
              onError={() => setFailed((f) => ({ ...f, [active]: true }))}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ mixBlendMode: 'screen', opacity: 0.9 }}
            />
          )}
        </div>
      </div>

      {withMask.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>
            {active ? `Showing: ${area?.label}` : 'Tap a concern to see where it was detected'}
          </p>
          <div className="flex flex-wrap gap-2">
            {withMask.map((a) => (
              <button
                key={a.key}
                onClick={() => onSelect(active === a.key ? null : a.key)}
                className="text-xs px-3 py-1.5"
                style={{
                  border: `1px solid ${active === a.key ? 'var(--primary)' : 'var(--rim)'}`,
                  color: active === a.key ? 'var(--primary)' : 'var(--fg)',
                  backgroundColor: 'transparent',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
