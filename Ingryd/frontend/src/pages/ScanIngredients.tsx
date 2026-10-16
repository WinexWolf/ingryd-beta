import { useRef, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Upload } from 'lucide-react'
import { createWorker } from 'tesseract.js'
import { analyzeIngredients } from '../services/api'
import { addRoutineItem } from '../services/history'
import { supabase } from '../services/supabaseClient'
import { ScanResult } from '../components/scanner/ScanResult'
import type { ProductResult } from '../types'

type PageState = 'idle' | 'camera' | 'preview' | 'ocr' | 'review-text' | 'analyzing' | 'result' | 'error'

export function ScanIngredients() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [imageData, setImageData] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [rawText, setRawText] = useState('')
  const [productName, setProductName] = useState('')
  const [brand, setBrand] = useState('')
  const [result, setResult] = useState<ProductResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'submitted' | 'added'>('idle')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])
  useEffect(() => stopCamera, [stopCamera])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageData(reader.result as string)
      setPageState('preview')
    }
    reader.readAsDataURL(file)
  }

  const openCamera = async () => {
    setCameraError(null)
    setPageState('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
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

  const runOcr = async () => {
    if (!imageData) return
    setPageState('ocr')
    setOcrProgress(0)
    try {
      const worker = await createWorker('eng', undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100))
        },
      } as any)
      const { data: { text } } = await worker.recognize(imageData)
      await worker.terminate()
      setRawText(text.trim())
      setPageState('review-text')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OCR failed — try a clearer photo or type the ingredients manually.')
      setPageState('error')
    }
  }

  const runAnalysis = async () => {
    if (!rawText.trim()) return
    setPageState('analyzing')
    setError(null)
    try {
      const analysis = await analyzeIngredients(rawText, productName || undefined)
      const synthetic: ProductResult = {
        barcode: '',
        name: productName || 'Scanned Product',
        brand: brand || undefined,
        categories: undefined,
        labels: undefined,
        image_url: imageData || undefined,
        ingredients_text: analysis.ingredients_parsed.join(', '),
        ingredients_parsed: analysis.ingredients_parsed,
        score: analysis.score,
        found: true,
      }
      setResult(synthetic)
      setPageState('result')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setPageState('error')
    }
  }

  const addToRoutine = async (slot: 'am' | 'pm') => {
    if (!result) return
    setSubmitStatus('submitting')
    const added = await addRoutineItem({
      name: result.name ?? 'Scanned Product',
      brand: result.brand ?? undefined,
      slot,
      ingredients_parsed: result.ingredients_parsed,
    })
    setSubmitStatus(added ? 'added' : 'idle')
  }

  const submitForReview = async () => {
    if (!result) return
    setSubmitStatus('submitting')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitStatus('idle')
      return
    }
    const { error: insertError } = await supabase.from('pending_products').insert({
      submitted_by: user.id,
      raw_text: rawText,
      product_name: result.name,
      brand: result.brand,
      ingredients_parsed: result.ingredients_parsed,
    })

    if (!insertError) {
      // Best-effort — a failed notification shouldn't undo a successful submission.
      const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '/api'
      fetch(`${apiBase}/ingredients/notify-submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: result.name,
          brand: result.brand,
          ingredient_count: result.ingredients_parsed.length,
        }),
      }).catch(() => {})
    }

    setSubmitStatus(insertError ? 'idle' : 'submitted')
  }

  const reset = () => {
    stopCamera()
    setImageData(null)
    setRawText('')
    setProductName('')
    setBrand('')
    setResult(null)
    setError(null)
    setCameraError(null)
    setSubmitStatus('idle')
    setPageState('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>No barcode? No problem</p>
        <h1 className="font-display text-5xl" style={{ color: 'var(--fg)' }}>Scan Ingredients</h1>
        <Link to="/scan" className="text-xs underline inline-block mt-3" style={{ color: 'var(--primary)' }}>← Back to barcode scan</Link>
        <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
          Photograph the ingredients panel directly — works for products without a scannable barcode.
          Text extraction happens right on your device. You'll get a chance to fix any misreads before we analyze it.
        </p>
      </div>

      {pageState === 'idle' && (
        <div className="p-10 flex flex-col items-center gap-6 text-center" style={{ border: '1px solid var(--rim)' }}>
          <p className="text-sm max-w-sm" style={{ color: 'var(--muted)' }}>
            Get the ingredients panel in focus, good lighting, as flat as possible.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={openCamera} className="btn-primary flex items-center gap-2">
              <Camera size={16} /> Use Camera
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-outline flex items-center gap-2">
              <Upload size={16} /> Upload Photo
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
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
            <button onClick={runOcr} className="btn-primary flex-1">Extract Ingredients</button>
            <button onClick={reset} className="btn-outline">Retake</button>
          </div>
        </div>
      )}

      {pageState === 'ocr' && (
        <div className="p-16 flex flex-col items-center gap-5" style={{ border: '1px solid var(--rim)' }}>
          <div className="w-8 h-8 border-2 animate-spin rounded-full" style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }} />
          <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Reading label… {ocrProgress}%</p>
        </div>
      )}

      {pageState === 'review-text' && (
        <div className="flex flex-col gap-4">
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--secondary)' }}>
            Check the extraction — OCR isn't perfect, fix anything wrong before analyzing
          </p>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Product name (optional, helps with the marketing-dose check)"
            className="input"
          />
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Brand (optional)"
            className="input"
          />
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            className="input font-sans"
            placeholder="Water, Glycerin, ..."
          />
          <div className="flex gap-3">
            <button onClick={runAnalysis} disabled={!rawText.trim()} className="btn-primary flex-1">Analyze</button>
            <button onClick={reset} className="btn-outline">Start Over</button>
          </div>
        </div>
      )}

      {pageState === 'analyzing' && (
        <div className="p-16 flex flex-col items-center gap-5" style={{ border: '1px solid var(--rim)' }}>
          <div className="w-8 h-8 border-2 animate-spin rounded-full" style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }} />
          <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Scoring ingredients</p>
        </div>
      )}

      {pageState === 'error' && (
        <div className="p-10 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <p className="text-[10px] tracking-widest uppercase text-red-700 mb-3">Something went wrong</p>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>{error}</p>
          <button onClick={reset} className="btn-outline">Try Again</button>
        </div>
      )}

      {pageState === 'result' && result && (
        <div className="flex flex-col gap-6">
          <ScanResult product={result} onReset={reset} />

          <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>
              Not in our catalog yet — what next?
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => addToRoutine('am')} disabled={submitStatus === 'submitting'} className="btn-outline">
                Add to Morning Routine
              </button>
              <button onClick={() => addToRoutine('pm')} disabled={submitStatus === 'submitting'} className="btn-outline">
                Add to Evening Routine
              </button>
              <button onClick={submitForReview} disabled={submitStatus !== 'idle'} className="btn-primary">
                {submitStatus === 'submitted' ? 'Submitted ✓' : 'Submit for Catalog Review'}
              </button>
            </div>
            {submitStatus === 'added' && (
              <p className="text-xs" style={{ color: 'var(--moss)' }}>Added to your routine.</p>
            )}
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              Since this came from a photo rather than a barcode, it won't automatically join the shared
              product database — submitting sends it for review first.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
