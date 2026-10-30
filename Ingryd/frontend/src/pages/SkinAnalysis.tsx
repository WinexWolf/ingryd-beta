import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Camera, Upload } from 'lucide-react'
import { analyzeSkin, analyzeSample } from '../services/api'
import { addSkinAnalysisToHistory, getSkinHistory, getRoutine } from '../services/history'
import { computeProgress, latestPair } from '../services/progress'
import { ProgressCard } from '../components/skin/ProgressCard'
import type { SkinProfile } from '../types'
import type { SkinHistoryEntry } from '../services/history'
import { ApplyToProfile } from '../components/skin/ApplyToProfile'
import { ScanOverlay } from '../components/skin/ScanOverlay'
import { FocusAreas } from '../components/skin/FocusAreas'
import { ConcernGrid } from '../components/skin/ConcernGrid'
import { NextSteps } from '../components/skin/NextSteps'
import { PicksForYou } from '../components/recommend/PicksForYou'
import { checkPhoto, cropToFace, imageFromSrc, loadDetector, SKIPPED, type View } from '../services/photoCheck'
import { UseWhatYouHave } from '../components/skin/UseWhatYouHave'
import { UnseenAreas, unseenToConcerns, type Unseen } from '../components/skin/UnseenAreas'
import { GuidedCapture } from '../components/skin/GuidedCapture'
import { PhotoSlots, VIEWS, isBlocking, type Check } from '../components/skin/PhotoSlots'

type PageState = 'idle' | 'camera' | 'review' | 'loading' | 'result' | 'error'

const CONSENT_KEY = 'ingryd-scan-consent'
const readConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === '1' } catch { return false } }
const rememberConsent = () => { try { localStorage.setItem(CONSENT_KEY, '1') } catch { /* fine: asked again next time */ } }

const TIPS = [
  'Face a window or soft daylight — avoid harsh overhead light and strong shadows.',
  'No makeup, hair pulled back, neutral expression.',
  'Hold the camera at eye level, about an arm\'s length away, with your whole face in frame.',
  'No filters or beauty mode, and wipe the lens first.',
]

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Phone photos are often 4000px+ and several MB; the analysis only needs ~1280px, so shrink before it is
 *  checked and uploaded. Falls back to the original if the browser can't decode it. */
async function fileToBase64(file: File): Promise<string> {
  const original = await readAsDataUrl(file)
  try {
    const img = await imageFromSrc(original)
    const longest = Math.max(img.naturalWidth, img.naturalHeight)
    if (longest <= 1280 && file.size < 600_000) return original
    const scale = Math.min(1, 1280 / longest)
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)  // browsers apply EXIF rotation when drawing
    return c.toDataURL('image/jpeg', 0.85)
  } catch {
    return original
  }
}

// `higherIsWorse`: oiliness, redness and texture scores measure how much of the issue
// is present, so a LOW score is the healthy one. The bar length always shows the raw
// score; only the color is flipped so a calm face is green, not red.
function MetricBar({ label, score, tag, higherIsWorse = false }: { label: string; score: number; tag: string; higherIsWorse?: boolean }) {
  const health = higherIsWorse ? 100 - score : score
  const color = health < 40 ? 'var(--danger)' : health < 65 ? 'var(--warn)' : 'var(--moss)'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: 'var(--fg)' }}>{tag}</span>
      </div>
      <div className="h-2 w-full" style={{ backgroundColor: 'var(--rim)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function SkinAnalysis() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [photos, setPhotos] = useState<Partial<Record<View, string>>>({})
  const [checks, setChecks] = useState<Partial<Record<View, Check>>>({})
  const [overrides, setOverrides] = useState<Partial<Record<View, boolean>>>({})
  const [camera, setCamera] = useState<{ start: View; single: boolean } | null>(null)
  const [profile, setProfile] = useState<SkinProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SkinHistoryEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [consent, setConsent] = useState(readConsent)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputs = useRef<Partial<Record<View, HTMLInputElement | null>>>({})
  const [unseen, setUnseen] = useState<Unseen>({ areas: [], concerns: [] })  // user-reported areas the scan can't see
  const [sent, setSent] = useState<Partial<Record<View, string>>>({})  // the face-cropped photos actually analyzed
  const imageData = sent.front ?? photos.front ?? null   // the overlay is drawn on the photo that was analyzed

  useEffect(() => {
    let cancelled = false
    getSkinHistory().then((r) => { if (!cancelled) setHistory(r) })
    return () => { cancelled = true }
  }, [])

  // Warm up the face detector as soon as the page opens so checks feel instant.
  useEffect(() => { void loadDetector() }, [])

  /** Stores a photo and checks it (face count, size, light, sharpness, head turn) before it can be analyzed. */
  const setPhoto = useCallback((view: View, data: string, fromCamera: boolean) => {
    setPhotos((p) => ({ ...p, [view]: data }))
    setOverrides((o) => ({ ...o, [view]: false }))
    setChecks((c) => ({ ...c, [view]: 'running' }))
    imageFromSrc(data)
      .then((img) => checkPhoto(img, { view, mirrored: fromCamera }))
      .catch(() => SKIPPED)
      .then((r) => setChecks((c) => (photosRef.current[view] === data ? { ...c, [view]: r } : c)))
  }, [])
  const photosRef = useRef(photos)
  photosRef.current = photos

  const removePhoto = (view: View) => {
    setPhotos((p) => { const n = { ...p }; delete n[view]; return n })
    setChecks((c) => ({ ...c, [view]: undefined }))
  }

  const handleFile = (view: View) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhoto(view, await fileToBase64(file), false)
    setPageState('review')
  }

  const startCamera = (start: View, single = false) => { setCamera({ start, single }); setPageState('camera') }

  const runSample = async () => {
    setPageState('loading')
    setError(null)
    try {
      setProfile(await analyzeSample())
      setPhotos({}); setChecks({}); setSent({})
      setSelected(null)
      setPageState('result') // deliberately not saved to history: it isn't the user's skin
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }

  // The scan plus what the person reported about the edges of their face; this is what suggestions use.
  const scanForUse = useMemo(() => {
    if (!profile) return null
    const extra = unseenToConcerns(unseen)
    if (extra.length === 0) return profile
    return { ...profile, suggested_concerns: Array.from(new Set([...(profile.suggested_concerns ?? []), ...extra])) }
  }, [profile, unseen])

  const sideCount = (['left', 'right'] as View[]).filter((v) => photos[v]).length
  const blocked = VIEWS.some((v) => isBlocking(photos[v], checks[v], !!overrides[v]))
  const canAnalyze = consent && !!photos.front && !blocked
  const hasWarnings = VIEWS.some((v) => { const c = checks[v]; return !!photos[v] && typeof c === 'object' && c !== null && c.issues.length > 0 })

  const runAnalysis = async () => {
    if (!photos.front || !consent) return
    rememberConsent()
    setPageState('loading')
    setError(null)
    try {
      // Crop each photo to the face first: YouCam rejects photos where the face is under ~60% of the width.
      const prepared: Partial<Record<View, string>> = {}
      for (const v of VIEWS) {
        const p = photos[v], c = checks[v]
        if (p) prepared[v] = typeof c === 'object' && c?.box ? await cropToFace(p, c.box) : p
      }
      setSent(prepared)
      const result = await analyzeSkin({ front: prepared.front!, left: prepared.left, right: prepared.right })
      setProfile(result)
      // Remember what was on the shelf at scan time so later scans can be tied to routine changes.
      const routine = await getRoutine()
      await addSkinAnalysisToHistory({
        ...result,
        routine_snapshot: routine.map((p) => ({ name: p.name, brand: p.brand, slot: p.slot })),
      })
      setHistory(await getSkinHistory())
      setPageState('result')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }

  const reset = () => {
    setCamera(null)
    setPhotos({}); setChecks({}); setOverrides({}); setSent({}); setUnseen({ areas: [], concerns: [] })
    setProfile(null)
    setSelected(null)
    setError(null)
    setPageState('idle')
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 02</p>
        <h1 className="font-display text-4xl sm:text-5xl" style={{ color: 'var(--fg)' }}>Skin Analysis</h1>
        <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
          A quick image-based read on hydration, oiliness, redness, and texture — plus ingredients to look for.
          AI-assisted and not a clinical or diagnostic tool.
        </p>
      </div>

      {/* One hidden file input per angle */}
      {VIEWS.map((v) => (
        <input key={v} ref={(el) => { fileInputs.current[v] = el }} type="file" accept="image/*" onChange={handleFile(v)} className="hidden" data-testid={`file-${v}`} />
      ))}

      {pageState === 'idle' && (
        <div className="p-6 sm:p-10 flex flex-col items-center gap-6 text-center" style={{ border: '1px solid var(--rim)' }}>
          <p className="text-sm max-w-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Take one <strong style={{ color: 'var(--fg)' }}>front-facing photo</strong>. We'll guide you, and the camera takes it for you once
            you're in position: look straight at the camera, head level, face filling the oval.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => startCamera('front')} className="btn-primary flex items-center gap-2">
              <Camera size={16} /> Guided camera scan
            </button>
            <button onClick={() => fileInputs.current.front?.click()} className="btn-outline flex items-center gap-2">
              <Upload size={16} /> Upload photos
            </button>
          </div>
          <p className="text-xs max-w-sm" style={{ color: 'var(--muted)' }}>
            The skin-analysis engine only reads faces that look straight at the camera, so one good front photo is all it needs.
          </p>
          <div className="text-left w-full max-w-md pt-4" style={{ borderTop: '1px solid var(--rim)' }}>
            <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--muted)' }}>For an accurate read</p>
            <ul className="flex flex-col gap-1.5">
              {TIPS.map((t) => <li key={t} className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>• {t}</li>)}
            </ul>
          </div>
          <button onClick={runSample} className="text-xs underline" style={{ color: 'var(--primary)' }}>
            No photo handy? See a sample scan
          </button>
        </div>
      )}

      {pageState === 'camera' && camera && (
        <GuidedCapture
          start={camera.start}
          single={camera.single}
          onCapture={(view, url) => setPhoto(view, url, true)}
          onDone={() => { setCamera(null); setPageState('review') }}
          onCancel={() => { setCamera(null); setPageState(photos.front ? 'review' : 'idle') }}
        />
      )}

      {pageState === 'review' && (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Your photos</p>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              Check that your whole face is in frame, you're looking straight at the camera, and the light is even.
            </p>
          </div>
          <PhotoSlots
            photos={photos}
            checks={checks}
            overrides={overrides}
            onOverride={(v) => setOverrides((o) => ({ ...o, [v]: true }))}
            onUpload={(v) => fileInputs.current[v]?.click()}
            onCamera={(v) => startCamera(v, !!photos[v])}
            onRemove={removePhoto}
          />
          <label className="flex items-start gap-3 text-xs leading-relaxed cursor-pointer" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>
              I agree to send {sideCount > 0 ? 'these photos' : 'this photo'} to our skin-analysis partner (YouCam by Perfect Corp) to be analyzed. Ingryd doesn't keep the photos —
              they're re-encoded without location data and analyzed. Your scores are saved to your account.
              This is not a medical device or diagnosis.
            </span>
          </label>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {1 + sideCount === 1 ? 'Front photo only' : `${1 + sideCount} photos`} · each photo counts toward your daily scan limit.
          </p>
          <div className="flex gap-3">
            <button onClick={runAnalysis} disabled={!canAnalyze} className="btn-primary flex-1">
              {1 + sideCount > 1 ? `Analyze ${1 + sideCount} photos` : 'Analyze front photo'}{hasWarnings && canAnalyze ? ' anyway' : ''}
            </button>
            <button onClick={reset} className="btn-outline">Start over</button>
          </div>
        </div>
      )}

      {pageState === 'loading' && (
        <div className="p-16 flex flex-col items-center gap-5" style={{ border: '1px solid var(--rim)' }}>
          <div
            className="w-8 h-8 border-2 animate-spin"
            style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }}
          />
          <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Analyzing {1 + sideCount > 1 ? `${1 + sideCount} photos` : 'photo'}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Usually 10–25 seconds</p>
        </div>
      )}

      {pageState === 'error' && (
        <div className="p-10 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <p className="text-[10px] tracking-widest uppercase text-danger mb-3">Analysis failed</p>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>{error}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={reset} className="btn-outline">Try Again</button>
            <button onClick={runSample} className="btn-ghost">See a sample scan</button>
          </div>
        </div>
      )}

      {pageState === 'result' && profile && (() => {
        const areas = profile.areas ?? []
        const masks = profile.masks ?? {}
        const isScan = profile.source === 'youcam' && areas.length > 0
        const sample = !!profile.is_sample
        const hasMask = (k: string) => !!imageData && !!masks[k]
        const show = (k: string) => {
          setSelected(k)
          overlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return (
        <div className="flex flex-col gap-8">
          {sample && (
            <div className="p-4 text-sm leading-relaxed" style={{ border: '1px solid var(--warn)', color: 'var(--fg)', backgroundColor: 'rgba(161,98,7,0.08)' }}>
              <strong>Sample scan.</strong> This is example data, not your skin, and it isn't saved to your history. Scan your own photo for real results.
            </div>
          )}
          <div className="p-8 flex flex-col items-center gap-3" style={{ border: '1px solid var(--rim)' }}>
            <span className="font-display text-6xl" style={{ color: 'var(--fg)' }}>{profile.overall_score}</span>
            <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Overall skin score</span>
            {isScan && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>
                {[
                  profile.skin_type && `${profile.skin_type} skin`,
                  profile.skin_type_zones?.t_zone && profile.skin_type_zones?.u_zone &&
                    profile.skin_type_zones.t_zone !== profile.skin_type_zones.u_zone &&
                    `T-zone ${profile.skin_type_zones.t_zone.toLowerCase()} · cheeks ${profile.skin_type_zones.u_zone.toLowerCase()}`,
                  profile.skin_age ? `skin age ${profile.skin_age}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {!sample && ((profile.views?.length ?? 0) > 0 || (profile.view_notes?.length ?? 0) > 0) && (
            <div className="p-4 text-xs leading-relaxed flex flex-col gap-1" style={{ border: '1px solid var(--rim)', color: 'var(--muted)' }}>
              {(profile.views?.length ?? 0) > 1 && <p>Based on your {profile.views!.join(', ').replace(/, ([^,]*)$/, ' and $1')} photos. The front photo counts the most; overlays are drawn on it.</p>}
              {(profile.views?.length ?? 0) === 1 && <p>Based on your front photo.</p>}
              {(profile.view_notes ?? []).map((n) => <p key={n} style={{ color: 'var(--warn)' }}>⚠ {n}</p>)}
            </div>
          )}

          {isScan ? (
            <>
              {imageData && Object.keys(masks).length > 0 && (
                <div ref={overlayRef}>
                  <ScanOverlay photo={imageData} masks={masks} areas={areas} selected={selected} onSelect={setSelected} />
                </div>
              )}
              {(() => {
                const pair = latestPair(history)
                const progress = pair && !sample ? computeProgress(pair[0], pair[1]) : null
                return progress ? <ProgressCard progress={progress} /> : null
              })()}
              <FocusAreas areas={areas} onShow={show} hasMask={hasMask} varies={profile.varies} />
              <ConcernGrid areas={areas} selected={selected} onSelect={show} hasMask={hasMask} />
              {!sample && <UnseenAreas value={unseen} onChange={setUnseen} />}
            </>
          ) : (
            <>
              <div className="p-6 flex flex-col gap-6" style={{ border: '1px solid var(--rim)' }}>
                <MetricBar label="Hydration" score={profile.hydration.score} tag={profile.hydration.label} />
                <MetricBar label="Oiliness" score={profile.oiliness.score} tag={profile.oiliness.label} higherIsWorse />
                <MetricBar label="Redness" score={profile.redness.score} tag={profile.redness.label} higherIsWorse />
                <MetricBar label="Texture" score={profile.texture.score} tag={profile.texture.label} higherIsWorse />
              </div>

              {profile.notes.length > 0 && (
                <div className="p-6" style={{ border: '1px solid var(--rim)' }}>
                  <p className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--muted)' }}>Notes</p>
                  <div className="flex flex-col gap-2">
                    {profile.notes.map((n, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>• {n}</p>
                    ))}
                  </div>
                </div>
              )}

              {profile.recommended_ingredients.length > 0 && (
                <div className="p-6" style={{ border: '1px solid var(--moss)', backgroundColor: 'rgba(143,153,81,0.05)' }}>
                  <p className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--moss)' }}>Look for these ingredients</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.recommended_ingredients.map((ing) => (
                      <span key={ing} className="badge-beneficial">{ing}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {isScan && <PicksForYou scan={scanForUse ?? profile} title="Products for your focus areas" />}

          <ApplyToProfile scan={scanForUse ?? profile} />

          {isScan && <UseWhatYouHave />}

          <NextSteps />

          <button onClick={reset} className="btn-outline self-start">← Analyze Another Photo</button>
        </div>
        )
      })()}

      {history.filter((h) => h.profile.source === 'youcam').length > 1 && (
        <div className="pt-4" style={{ borderTop: '1px solid var(--rim)' }}>
          <p className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--muted)' }}>
            Your trend · {history.filter((h) => h.profile.source === 'youcam').length} scans
          </p>
          <div className="flex items-end gap-1 h-16">
            {history.filter((h) => h.profile.source === 'youcam').reverse().slice(-20).map((h) => (
              <div
                key={h.id}
                className="flex-1"
                style={{
                  height: `${h.profile.overall_score}%`,
                  backgroundColor: 'var(--primary)',
                  opacity: 0.7,
                }}
                title={`${h.profile.overall_score} on ${new Date(h.timestamp).toLocaleDateString()}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
