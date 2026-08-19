import { useRef, useState, useCallback, useEffect } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

export type ScanState = 'idle' | 'starting' | 'scanning' | 'found' | 'error'

export function useBarcode() {
  const [state, setState] = useState<ScanState>('idle')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const startScanning = useCallback(async (videoElement: HTMLVideoElement) => {
    setError(null)
    setResult(null)
    setState('starting')
    videoRef.current = videoElement

    try {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      // Prefer rear camera on mobile
      const device =
        devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')) ||
        devices[0]

      if (!device) {
        throw new Error('No camera found on this device.')
      }

      setState('scanning')

      const controls = await reader.decodeFromVideoDevice(
        device.deviceId,
        videoElement,
        (scanResult, err) => {
          if (scanResult) {
            const text = scanResult.getText()
            setResult(text)
            setState('found')
            controls.stop()
          } else if (err && !(err instanceof NotFoundException)) {
            // NotFoundException fires every frame when nothing is found — suppress it
            setError(err.message)
            setState('error')
          }
        },
      )

      controlsRef.current = controls
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Camera error'
      setError(msg)
      setState('error')
    }
  }, [])

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setState('idle')
  }, [])

  const reset = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setResult(null)
    setError(null)
    setState('idle')
  }, [])

  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
    }
  }, [])

  return { state, result, error, startScanning, stopScanning, reset }
}
