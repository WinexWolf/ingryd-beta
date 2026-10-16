import { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, Upload } from 'lucide-react'
import { analyzeSkin } from '../services/api'
import { addSkinAnalysisToHistory, getSkinHistory } from '../services/history'
import type { SkinProfile } from '../types'
import type { SkinHistoryEntry } from '../services/history'

type PageState = 'idle' | 'camera' | 'preview' | 'loading' | 'result' | 'error'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// `higherIsWorse`: oiliness, redness and texture scores measure how much of the issue
// is present, so a LOW score is the healthy one. The bar length always shows the raw
// score; only the color is flipped so a calm face is green, not red.
function MetricBar({ label, score, tag, higherIsWorse = false }: { label: string; score: number; tag: string; higherIsWorse?: boolean }) {
  const health = higherIsWorse ? 100 - score : score
  const color = health < 40 ? '#b91c1c' : health < 65 ? '#a16207' : 'var(--moss)'
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
  const [imageData, setImageData] = useState<string | null>(null)
  const [profile, setProfile] = useState<SkinProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [history, setHistory] = useState<SkinHistoryEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false
    getSkinHistory().then((r) => { if (!cancelled) setHistory(r) })
    return () => { cancelled = true }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    setImageData(base64)
    setPageState('preview')
  }

  const openCamera = async () => {
    setCameraError(null)
    setPageState('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError('Could not access your camera. Check browser permissions, or upload a photo instead.')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setImageData(canvas.toDataURL('image/jpeg', 0.92))
    stopCamera()
    setPageState('preview')
  }

  const runAnalysis = async () => {
    if (!imageData) return
    setPageState('loading')
    setError(null)
    try {
      const result = await analyzeSkin(imageData)
      setProfile(result)
      await addSkinAnalysisToHistory(result)
      setHistory(await getSkinHistory())
      setPageState('result')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }

  const reset = () => {
    stopCamera()
    setImageData(null)
    setProfile(null)
    setError(null)
    setCameraError(null)
    setPageState('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 02</p>
        <h1 className="font-display text-5xl" style={{ color: 'var(--fg)' }}>Skin Analysis</h1>
        <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
          A quick image-based read on hydration, oiliness, redness, and texture — plus ingredients to look for.
          AI-assisted and not a clinical or diagnostic tool.
        </p>
      </div>

      {pageState === 'idle' && (
        <div className="p-10 flex flex-col items-center gap-6 text-center" style={{ border: '1px solid var(--rim)' }}>
          <p className="text-sm max-w-sm" style={{ color: 'var(--muted)' }}>
            Take a clear, well-lit, makeup-free photo of your face — or upload one from your camera roll.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={openCamera} className="btn-primary flex items-center gap-2">
              <Camera size={16} /> Use Camera
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-outline flex items-center gap-2">
              <Upload size={16} /> Upload Photo
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}

      {pageState === 'camera' && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-center" style={{ border: '1px solid var(--rim)', backgroundColor: '#000' }}>
            <video ref={videoRef} playsInline muted className="max-h-96 w-full object-contain" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {cameraError ? (
            <div className="p-6 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{cameraError}</p>
              <button onClick={() => fileInputRef.current?.click()} className="btn-outline">Upload Photo Instead</button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={capturePhoto} className="btn-primary flex-1">Capture</button>
              <button onClick={reset} className="btn-outline">Cancel</button>
            </div>
          )}
        </div>
      )}

      {pageState === 'preview' && imageData && (
        <div className="flex flex-col gap-6">
          <div className="p-2 flex justify-center" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}>
            <img src={imageData} alt="Preview" className="max-h-96 object-contain" />
          </div>
          <div className="flex gap-3">
            <button onClick={runAnalysis} className="btn-primary flex-1">Analyze Skin</button>
            <button onClick={reset} className="btn-outline">Retake</button>
          </div>
        </div>
      )}

      {pageState === 'loading' && (
        <div className="p-16 flex flex-col items-center gap-5" style={{ border: '1px solid var(--rim)' }}>
          <div
            className="w-8 h-8 border-2 animate-spin"
            style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }}
          />
          <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Analyzing photo</p>
        </div>
      )}

      {pageState === 'error' && (
        <div className="p-10 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <p className="text-[10px] tracking-widest uppercase text-red-700 mb-3">Analysis failed</p>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>{error}</p>
          <button onClick={reset} className="btn-outline">Try Again</button>
        </div>
      )}

      {pageState === 'result' && profile && (
        <div className="flex flex-col gap-8">
          <div className="p-8 flex flex-col items-center gap-4" style={{ border: '1px solid var(--rim)' }}>
            <span className="font-display text-6xl" style={{ color: 'var(--fg)' }}>{profile.overall_score}</span>
            <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Overall skin score</span>
          </div>

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

          <button onClick={reset} className="btn-outline self-start">← Analyze Another Photo</button>
        </div>
      )}

      {history.length > 1 && (
        <div className="pt-4" style={{ borderTop: '1px solid var(--rim)' }}>
          <p className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--muted)' }}>
            Your trend · {history.length} scans
          </p>
          <div className="flex items-end gap-1 h-16">
            {[...history].reverse().slice(-20).map((h) => (
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
