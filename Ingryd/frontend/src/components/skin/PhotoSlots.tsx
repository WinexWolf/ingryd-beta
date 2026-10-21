import { Camera, Upload, X } from 'lucide-react'
import type { PhotoCheck, View } from '../../services/photoCheck'

// YouCam rejects any noticeably turned face (error_large_face_angle), so only the front view is offered.
export const VIEWS: View[] = ['front']
const TITLE: Record<View, string> = { front: 'Front', left: 'Left side', right: 'Right side' }
const WHY: Record<View, string> = {
  front: 'Required. Look straight at the camera.',
  left: 'Optional, recommended. Turn your head to your left (just a quarter turn).',
  right: 'Optional, recommended. Turn your head to your right (just a quarter turn).',
}

export type Check = PhotoCheck | 'running' | null | undefined

/** True when this photo should stop the scan until it is replaced, removed or overridden. */
export function isBlocking(photo: string | undefined, check: Check, override: boolean): boolean {
  if (!photo) return false
  if (check === 'running') return true
  if (!check || typeof check === 'string' || !check.blocked) return false
  return !(check.overridable && override)
}

function Status({ check, override, onOverride }: { check: Check; override: boolean; onOverride: () => void }) {
  if (check === 'running' || check == null) return <p role="status" className="text-xs" style={{ color: 'var(--muted)' }}>Checking this photo…</p>
  if (!check.checked) return null
  if (check.issues.length === 0) return <p role="status" data-stats={JSON.stringify({ ...check.stats, yaw: check.yaw })} className="text-xs" style={{ color: 'var(--ok)' }}>✓ Looks good</p>
  return (
    <div role="alert" data-stats={JSON.stringify({ ...check.stats, yaw: check.yaw })} className="flex flex-col gap-1.5">
      {check.issues.map((i) => (
        <p key={i.code} className="text-xs leading-relaxed" style={{ color: i.severity === 'warn' ? 'var(--warn)' : 'var(--danger)' }}>
          {i.severity === 'warn' ? '⚠ ' : '✕ '}{i.message}
        </p>
      ))}
      {check.blocked && check.overridable && !override && (
        <button type="button" onClick={onOverride} className="text-xs underline self-start" style={{ color: 'var(--muted)' }}>
          My face is clearly visible. Use this photo anyway
        </button>
      )}
    </div>
  )
}

interface Props {
  photos: Partial<Record<View, string>>
  checks: Partial<Record<View, Check>>
  overrides: Partial<Record<View, boolean>>
  onOverride: (v: View) => void
  onUpload: (v: View) => void
  onCamera: (v: View) => void
  onRemove: (v: View) => void
}

/** One row per angle: thumbnail, what it should show, whether the photo checks out, and how to replace it. */
export function PhotoSlots({ photos, checks, overrides, onOverride, onUpload, onCamera, onRemove }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {VIEWS.map((v) => {
        const photo = photos[v]
        return (
          <li key={v} className="p-3 flex gap-3" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }} data-view={v}>
            <div className="w-20 flex-shrink-0 aspect-[3/4] overflow-hidden flex items-center justify-center text-[10px] tracking-widest uppercase text-center"
                 style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--bg)', color: 'var(--muted)' }}>
              {photo ? <img src={photo} alt={`${TITLE[v]} photo`} className="w-full h-full object-cover" /> : 'No photo'}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div>
                <p className="text-sm" style={{ color: 'var(--fg)' }}>{TITLE[v]}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{WHY[v]}</p>
              </div>
              {photo && <Status check={checks[v]} override={!!overrides[v]} onOverride={() => onOverride(v)} />}
              <div className="flex flex-wrap gap-2 mt-auto">
                <button type="button" onClick={() => onCamera(v)} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ border: '1px solid var(--rim)', color: 'var(--fg)' }}>
                  <Camera size={12} /> {photo ? 'Retake' : 'Camera'}
                </button>
                <button type="button" onClick={() => onUpload(v)} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ border: '1px solid var(--rim)', color: 'var(--fg)' }}>
                  <Upload size={12} /> {photo ? 'Replace' : 'Upload'}
                </button>
                {photo && v !== 'front' && (
                  <button type="button" onClick={() => onRemove(v)} className="text-xs flex items-center gap-1 px-2 py-1.5" style={{ color: 'var(--muted)' }}>
                    <X size={12} /> Remove
                  </button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
