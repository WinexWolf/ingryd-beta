import { useRef, useState, useCallback, useEffect } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library'
import { looksLikeRealBarcode } from '../services/gtin'

export type ScanState = 'idle' | 'starting' | 'scanning' | 'found' | 'error'

// Product barcodes only. Not looking for QR/Code128/etc. makes decoding faster and avoids false reads.
const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  [DecodeHintType.TRY_HARDER, true],
])

export function useBarcode() {
  const [state, setState] = useState<ScanState>('idle')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const trackOf = () => (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]

  const startScanning = useCallback(async (videoElement: HTMLVideoElement) => {
    setError(null)
    setResult(null)
    setTorchOn(false)
    setTorchSupported(false)
    setState('starting')
    videoRef.current = videoElement

    try {
      const reader = new BrowserMultiFormatReader(HINTS as Map<DecodeHintType, any>, { delayBetweenScanAttempts: 60 })
      readerRef.current = reader

      // Prefer a camera labelled back/rear. If none is labelled (common on iOS before permission),
      // ask for the environment-facing camera and let the browser choose.
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      if (devices.length === 0) throw new Error('No camera found on this device.')
      const back = devices.find((d) => /back|rear|environment/i.test(d.label))

      setState('scanning')

      // The decode callback can fire on the very first frame, before decodeFromConstraints has returned
      // the controls, so track "finished" separately and stop as soon as the controls exist.
      let controls: { stop: () => void } | null = null
      let finished = false

      controls = await reader.decodeFromConstraints(
        {
          video: {
            ...(back ? { deviceId: { exact: back.deviceId } } : { facingMode: { ideal: 'environment' } }),
            // Barcode bars are thin: a sharper picture decodes far more reliably than the default 640x480.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoElement,
        (scanResult, err) => {
          if (finished) return
          if (scanResult) {
            const text = scanResult.getText()
            // A misread has a wrong check digit: keep scanning instead of looking up garbage.
            if (!looksLikeRealBarcode(text)) return
            finished = true
            setResult(text)
            setState('found')
            controls?.stop()
          } else if (err && !(err instanceof NotFoundException)) {
            // NotFoundException fires every frame when nothing is found — suppress it
            setError(err.message)
            setState('error')
          }
        },
      )
      if (finished) controls.stop()
      controlsRef.current = controls

      // Nice-to-haves: continuous autofocus and a torch button where the phone supports them.
      const track = trackOf()
      if (track) {
        const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>
        setTorchSupported('torch' in caps)
        const focusModes = caps.focusMode as string[] | undefined
        if (focusModes?.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera error'
      setError(msg)
      setState('error')
    }
  }, [])

  const toggleTorch = useCallback(async () => {
    const track = trackOf()
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch {
      setTorchSupported(false)
    }
  }, [torchOn])

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setTorchOn(false)
    setState('idle')
  }, [])

  const reset = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setResult(null)
    setError(null)
    setTorchOn(false)
    setState('idle')
  }, [])

  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
    }
  }, [])

  return { state, result, error, torchSupported, torchOn, toggleTorch, startScanning, stopScanning, reset }
}
