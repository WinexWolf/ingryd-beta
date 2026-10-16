import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { checkPhoto, loadDetector, type View } from '../../services/photoCheck'

const ORDER: View[] = ['front', 'left', 'right']
const LABEL: Record<View, string> = { front: 'Front', left: 'Left side', right: 'Right side' }
const INSTRUCTION: Record<View, string> = {
  front: 'Look straight at the camera',
  left: 'Slowly turn your head to your left, about 45°',
  right: 'Now slowly turn your head to your right, about 45°',
}
const HOLD_TICKS = 4        // consecutive good frames (~1.8 s) before the photo is taken automatically
const TICK_MS = 450

/** Crops the video to the 3:4 portrait frame the person sees, mirrored like a selfie camera.
 *  What you see in the oval is exactly what is saved and analyzed. */
function frameToCanvas(v: HTMLVideoElement, maxSide = 1280): HTMLCanvasElement {
  const w = v.videoWidth, h = v.videoHeight, target = 3 / 4
  let sw = w, sh = h, sx = 0, sy = 0
  if (w / h > target) { sw = h * target; sx = (w - sw) / 2 } else { sh = w / target; sy = (h - sh) / 2 }
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const c = document.createElement('canvas')
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale)
  const ctx = c.getContext('2d')!
  ctx.translate(c.width, 0); ctx.scale(-1, 1)
  ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c
}

interface Props {
  start: View
  single?: boolean          // retake just this one angle
  onCapture: (view: View, dataUrl: string) => void
  onDone: () => void
  onCancel: () => void
}

/** Guided camera: front, then left, then right. Photos are taken automatically once the face is
 *  in position and held still, or by tapping Capture. Detection runs on the phone only. */
export function GuidedCapture({ start, single = false, onCapture, onDone, onCancel }: Props) {
  const steps = single ? [start] : ORDER.slice(ORDER.indexOf(start))
  const [idx, setIdx] = useState(0)
  const [ready, setReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hint, setHint] = useState<string>('Getting the camera ready…')
  const [good, setGood] = useState(false)
  const [progress, setProgress] = useState(0)
  const [flash, setFlash] = useState(false)
  const [pausedMsg, setPausedMsg] = useState<string | null>(null)
  const [autoOn, setAutoOn] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lock = useRef(false)
  const view = steps[idx]
  const isLast = idx === steps.length - 1

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Camera on/off with the component
  useEffect(() => {
    let cancelled = false
    void loadDetector()
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } } })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        if (v) { v.srcObject = stream; await v.play(); setReady(true) }
      } catch {
        if (!cancelled) setCameraError('Could not access your camera. Check browser permissions, or go back and upload photos instead.')
      }
    })()
    return () => { cancelled = true; stopStream() }
  }, [stopStream])

  const take = useCallback((v: View, last: boolean) => {
    const video = videoRef.current
    if (!video || !video.videoWidth || lock.current) return
    lock.current = true
    const url = frameToCanvas(video).toDataURL('image/jpeg', 0.92)
    setFlash(true); setTimeout(() => setFlash(false), 150)
    onCapture(v, url)
    if (last) { stopStream(); onDone(); return }
    setPausedMsg(`${LABEL[v]} photo saved ✓`)
    setProgress(0); setGood(false)
    setTimeout(() => { setPausedMsg(null); setIdx((i) => i + 1); lock.current = false }, 1100)
  }, [onCapture, onDone, stopStream])

  // Live guidance + auto-capture for the current step
  useEffect(() => {
    if (!ready) return
    let stop = false
    let streak = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const v = videoRef.current
      if (!stop && v && v.videoWidth > 0 && !lock.current) {
        try {
          const r = await checkPhoto(frameToCanvas(v, 640), { view, mirrored: true, fast: true })
          if (stop || lock.current) return
          if (!r.checked) {
            setHint(INSTRUCTION[view]); setGood(false); streak = 0
          } else if (r.issues.length === 0) {
            streak++
            setGood(true); setHint('Hold still…'); setProgress(Math.min(1, streak / HOLD_TICKS))
            if (autoOn && streak >= HOLD_TICKS) { take(view, isLast); return }
          } else {
            streak = 0; setGood(false); setProgress(0); setHint(r.issues[0].message)
          }
        } catch { /* hint only */ }
      }
      if (!stop) timer = setTimeout(tick, TICK_MS)
    }
    setHint(INSTRUCTION[view]); setGood(false); setProgress(0)
    timer = setTimeout(tick, 900)
    return () => { stop = true; clearTimeout(timer) }
  }, [ready, view, isLast, autoOn, take])

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex items-center justify-center gap-2 text-[10px] tracking-widest uppercase" aria-label="Photo steps">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" aria-current={i === idx}
              style={{ border: `1px solid ${i === idx ? 'var(--primary)' : 'var(--rim)'}`, color: i < idx ? 'var(--ok)' : i === idx ? 'var(--fg)' : 'var(--muted)' }}>
            {i < idx ? <Check size={11} /> : <span className="font-mono">{i + 1}</span>}{LABEL[s]}
          </li>
        ))}
      </ol>

      <div className="relative mx-auto w-full max-w-sm aspect-[3/4] overflow-hidden bg-black" style={{ border: '1px solid var(--rim)' }}>
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />

        {/* Oval guide: dims everything outside the face area. Sits above the (transformed) video. */}
        <div aria-hidden className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="h-[76%] aspect-[3/4] rounded-[50%] transition-colors"
               style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)', border: `3px ${good ? 'solid' : 'dashed'} ${good ? '#8FD18A' : 'rgba(255,255,255,0.75)'}` }} />
        </div>
        {view !== 'front' && (
          <div aria-hidden className="absolute inset-y-0 z-10 flex items-center pointer-events-none text-white/90"
               style={view === 'left' ? { left: 10 } : { right: 10 }}>
            {view === 'left' ? <ArrowLeft size={34} /> : <ArrowRight size={34} />}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pt-8 pb-3 text-center text-white"
             style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
          <p className="text-[10px] tracking-widest uppercase opacity-80">Step {idx + 1} of {steps.length} · {LABEL[view]}</p>
          <p role="status" className="text-sm mt-1 min-h-[2.5rem]">{pausedMsg ?? (cameraError ? '' : hint)}</p>
          <div className="h-1 mt-1 mx-auto max-w-[8rem] rounded-full bg-white/25 overflow-hidden"><div className="h-full" style={{ width: `${progress * 100}%`, backgroundColor: '#8FD18A', transition: 'width .3s' }} /></div>
        </div>
        {flash && <div aria-hidden className="absolute inset-0 z-20 bg-white" />}
        {!ready && !cameraError && <div className="absolute inset-0 z-20 flex items-center justify-center text-xs tracking-widest uppercase text-white/80">Starting camera…</div>}
      </div>

      {cameraError ? (
        <div className="p-5 text-center" style={{ border: '1px solid var(--danger)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{cameraError}</p>
          <button onClick={onCancel} className="btn-outline">Back</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
          <button onClick={() => take(view, isLast)} disabled={!ready} className="btn-primary">Capture {LABEL[view].toLowerCase()} now</button>
          <div className="flex items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--muted)' }}>
              <input type="checkbox" checked={autoOn} onChange={(e) => setAutoOn(e.target.checked)} /> Auto-capture when I'm in position
            </label>
            <button onClick={onCancel} className="underline" style={{ color: 'var(--muted)' }}>Cancel</button>
          </div>
          {idx > 0 && (
            <button onClick={() => { stopStream(); onDone() }} className="text-xs underline self-center" style={{ color: 'var(--muted)' }}>
              Skip the rest and review my photos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
