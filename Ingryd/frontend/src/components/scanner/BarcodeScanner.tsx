import { useEffect, useRef } from 'react'
import { useBarcode, type ScanState } from '../../hooks/useBarcode'

interface Props {
  onDetected: (barcode: string) => void
}

function ScanOverlay({ state }: { state: ScanState }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-64 h-44">
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-moss" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-moss" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-moss" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-moss" />

        {state === 'scanning' && (
          <div className="absolute left-0 right-0 h-px bg-moss/70 scan-line shadow-[0_0_12px_2px_rgba(143,153,81,0.5)]" />
        )}
        {state === 'found' && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(143,153,81,0.2)', border: '1px solid #8F9951' }}
          >
            <span className="text-moss font-semibold tracking-widest uppercase text-sm">Detected</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { state, result, error, startScanning, stopScanning, reset } = useBarcode()

  useEffect(() => {
    if (state === 'found' && result) {
      const t = setTimeout(() => onDetected(result), 500)
      return () => clearTimeout(t)
    }
  }, [state, result, onDetected])

  const handleStart = async () => {
    if (videoRef.current) await startScanning(videoRef.current)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="relative w-full max-w-lg overflow-hidden aspect-video"
        style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}
      >
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        {(state === 'scanning' || state === 'found') && <ScanOverlay state={state} />}

        {state === 'idle' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <div
              className="w-16 h-16 flex items-center justify-center text-2xl"
              style={{ border: '1px solid var(--rim)', color: 'var(--muted)' }}
            >
              ▣
            </div>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Camera ready</p>
          </div>
        )}

        {state === 'starting' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <div
              className="w-8 h-8 border-2 animate-spin"
              style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }}
            />
            <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Starting camera</p>
          </div>
        )}

        {state === 'error' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <p className="text-[10px] tracking-widest uppercase text-danger">Camera error</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{error}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {(state === 'idle' || state === 'error') && (
          <button onClick={handleStart} className="btn-primary">Start Scanning</button>
        )}
        {(state === 'scanning' || state === 'starting') && (
          <button onClick={stopScanning} className="btn-ghost">Stop</button>
        )}
        {(state === 'found' || state === 'error') && (
          <button onClick={reset} className="btn-outline">Scan Again</button>
        )}
      </div>

      <p className="text-xs tracking-wide text-center max-w-xs" style={{ color: 'var(--muted)' }}>
        Point your camera at the EAN or UPC barcode on the back of any beauty or skincare product.
      </p>
    </div>
  )
}
