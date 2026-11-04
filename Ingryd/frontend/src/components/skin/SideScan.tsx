import { useRef, useState } from 'react'
import { Camera, Upload } from 'lucide-react'
import { analyzeSkin, pixelsFromImage, type Kind, type SkinResult } from '../../services/skinPixels'
import { checkPhoto, imageFromSrc } from '../../services/photoCheck'
import { skinRegionMask } from '../../services/faceRegions'

type Side = 'left' | 'right'
const KIND_LABEL: Record<Kind, string> = { redness: 'Redness', blemishes: 'Possible blemishes', dark_spots: 'Dark spots' }
const KIND_COLOR: Record<Kind, string> = { redness: '#E2596F', blemishes: '#F4EFE6', dark_spots: '#E0B15A' }
const LEVEL_TEXT = { none: 'none seen', mild: 'a little', noticeable: 'noticeable' }

interface Item { src: string; result: SkinResult }

/** Side-angle photos, analysed on the device with simple colour analysis. Nothing is uploaded or saved.
 *  The skin-analysis engine can't read turned faces, so this is a separate, clearly labelled extra. */
export function SideScan() {
  const [items, setItems] = useState<Partial<Record<Side, Item>>>({})
  const [busy, setBusy] = useState<Side | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = { left: useRef<HTMLInputElement>(null), right: useRef<HTMLInputElement>(null) }

  const onFile = async (side: Side, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null); setBusy(side)
    try {
      const src = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
      })
      const img = await imageFromSrc(src)
      const { data, w, h } = pixelsFromImage(img)
      // Preferred: the face mesh gives exact skin areas (eyes, brows and lips cut out). If it can't load,
      // fall back to the simpler face detector. If neither can confirm a face, warn.
      const NO_FACE = 'We could not find a face in this photo, so we have not analysed it. Turn your head just a little (so one cheek faces the camera) and keep your whole face in the frame.'
      let result: SkinResult
      const region = await skinRegionMask(img, w, h)
      if (region.status === 'ok') {
        result = analyzeSkin(data, w, h, undefined, region.mask)
      } else if (region.status === 'no-face') {
        result = analyzeSkin(new Uint8ClampedArray(4), 1, 1); result.warnings = [NO_FACE]
      } else {
        const check = await checkPhoto(img, { view: side }).catch(() => null)
        if (check?.checked && check.faces === 0) {
          result = analyzeSkin(new Uint8ClampedArray(4), 1, 1); result.warnings = [NO_FACE]
        } else {
          result = analyzeSkin(data, w, h, check?.checked ? check.box : undefined)
          if (!check?.checked) result.warnings = [...result.warnings, 'We could not confirm a face in this photo, so treat the result with care.']
        }
      }
      setItems((p) => ({ ...p, [side]: { src, result } }))
    } catch {
      setError('We could not read that photo. Try another one.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Side check (beta)</p>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--fg)' }}>
          The main scan can only read a front-facing photo. Add a photo of each side and we'll look for redness, possible
          blemishes and dark spots along your cheeks and jaw.
        </p>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
          This is a simple colour check done on your device. Photos aren't uploaded or saved. It is not a diagnosis, and
          lighting changes the result, so use daylight and no filters. It can't judge clogged pores or fine texture.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(['left', 'right'] as Side[]).map((side) => {
          const it = items[side]
          return (
            <div key={side} className="flex flex-col gap-2" data-side={side}>
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{side} side</p>
              <div className="relative aspect-[3/4] overflow-hidden" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--bg)' }}>
                {it ? (
                  <>
                    <img src={it.src} alt={`${side} side`} className="absolute inset-0 w-full h-full object-cover" />
                    {it.result.findings.map((f, i) => (
                      <span
                        key={i}
                        title={`${KIND_LABEL[f.kind]}, ${f.place}`}
                        className="absolute rounded-sm pointer-events-none"
                        style={{
                          left: `${f.box.x * 100}%`, top: `${f.box.y * 100}%`, width: `${f.box.w * 100}%`, height: `${f.box.h * 100}%`,
                          border: `2px solid ${KIND_COLOR[f.kind]}`, boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
                    {busy === side ? 'Reading…' : 'No photo'}
                  </span>
                )}
              </div>
              <input ref={fileRefs[side]} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onFile(side, e)} />
              <button type="button" onClick={() => fileRefs[side].current?.click()} className="text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full" style={{ border: '1px solid var(--rim)', color: 'var(--fg)' }}>
                {it ? <Upload size={12} /> : <Camera size={12} />} {it ? 'Replace' : 'Add photo'}
              </button>
              {it && <Summary result={it.result} />}
            </div>
          )
        })}
      </div>

      {error && <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {Object.keys(items).length > 0 && (
        <div className="flex flex-wrap gap-4 text-[11px]" style={{ color: 'var(--muted)' }}>
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3" style={{ border: `2px solid ${KIND_COLOR[k]}` }} /> {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Summary({ result }: { result: SkinResult }) {
  if (!result.skinFound) return <p role="alert" className="text-xs leading-relaxed" style={{ color: 'var(--warn)' }}>{result.warnings[0]}</p>
  return (
    <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--fg)' }}>
      {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
        <p key={k}>{KIND_LABEL[k]}: <span style={{ color: result.summary[k].level === 'none' ? 'var(--muted)' : 'var(--fg)' }}>{LEVEL_TEXT[result.summary[k].level]}</span></p>
      ))}
      {result.warnings.map((w) => <p key={w} className="leading-relaxed" style={{ color: 'var(--warn)' }}>⚠ {w}</p>)}
    </div>
  )
}
