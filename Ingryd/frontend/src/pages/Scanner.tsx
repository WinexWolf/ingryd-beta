import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarcodeScanner } from '../components/scanner/BarcodeScanner'
import { ScanResult } from '../components/scanner/ScanResult'
import { fetchProductByBarcode } from '../services/api'
import { addScanToHistory } from '../services/history'
import type { ProductResult } from '../types'

type PageState = 'scanner' | 'loading' | 'result' | 'error'

export function Scanner() {
  const [pageState, setPageState] = useState<PageState>('scanner')
  const [product, setProduct] = useState<ProductResult | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')

  const handleBarcode = async (barcode: string) => {
    setApiError(null)
    setPageState('loading')
    try {
      const result = await fetchProductByBarcode(barcode)
      setProduct(result)
      addScanToHistory(result)
      setPageState('result')
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Something went wrong')
      setPageState('error')
    }
  }

  const handleReset = () => {
    setProduct(null)
    setApiError(null)
    setManualBarcode('')
    setPageState('scanner')
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const digits = manualBarcode.replace(/\D/g, '') // tolerate spaces and dashes from copy/paste
    if (![8, 12, 13, 14].includes(digits.length)) {
      setApiError(`That has ${digits.length} digit${digits.length === 1 ? '' : 's'}. Barcodes have 8, 12 or 13 digits — check for a missing digit.`)
      setPageState('error')
      return
    }
    handleBarcode(digits)
  }

  return (
    <div className="flex flex-col gap-10 max-w-2xl mx-auto">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Feature 01</p>
        <h1 className="font-display text-4xl sm:text-5xl" style={{ color: 'var(--fg)' }}>Scan a Product</h1>
      </div>

      {pageState === 'scanner' && (
        <>
          <BarcodeScanner onDetected={handleBarcode} />
          <div className="p-6" style={{ border: '1px solid var(--rim)' }}>
            <p className="text-[10px] tracking-widest uppercase mb-4" style={{ color: 'var(--muted)' }}>
              Or enter barcode manually
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2 sm:gap-3">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="e.g. 3606000537750"
                className="input flex-1 min-w-0"
                inputMode="numeric"
              />
              <button type="submit" disabled={!manualBarcode.trim()} className="btn-primary !px-4 sm:!px-6">
                Look up
              </button>
            </form>
            <p className="text-[11px] mt-3" style={{ color: 'var(--muted)' }}>
              Test with:{' '}
              <button type="button" onClick={() => setManualBarcode('3606000537750')} className="underline" style={{ color: 'var(--secondary)' }}>3606000537750</button>{' '}
              (CeraVe Foaming Cleanser)
            </p>
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
            No barcode, or not in our catalog?{' '}
            <Link to="/scan-ingredients" className="underline" style={{ color: 'var(--primary)' }}>Scan its ingredient list instead →</Link>
          </p>
        </>
      )}

      {pageState === 'loading' && (
        <div className="p-16 flex flex-col items-center gap-5" style={{ border: '1px solid var(--rim)' }}>
          <div
            className="w-8 h-8 border-2 animate-spin"
            style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }}
          />
          <div className="text-center">
            <p className="text-sm tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Looking up product</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.5 }}>Querying Open Beauty Facts</p>
          </div>
        </div>
      )}

      {pageState === 'result' && product && (
        <>
          <ScanResult product={product} onReset={handleReset} />
          {(!product.found || !product.score) && (
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ border: '1px solid var(--primary)' }}>
              <p className="text-sm" style={{ color: 'var(--fg)' }}>
                {product.found ? "We don't have this product's ingredients yet." : "We couldn't find this barcode."} You can photograph the ingredient list on the back and we'll score it.
              </p>
              <Link to="/scan-ingredients" className="btn-primary flex-shrink-0 text-center">Scan ingredient list →</Link>
            </div>
          )}
        </>
      )}

      {pageState === 'error' && (
        <div className="p-10 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <p className="text-[10px] tracking-widest uppercase text-danger mb-3">Request failed</p>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>{apiError}</p>
          <button onClick={handleReset} className="btn-outline">Try Again</button>
        </div>
      )}
    </div>
  )
}
