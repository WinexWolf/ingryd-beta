import { Link } from 'react-router-dom'
import { looksLikeRealBarcode } from '../../services/gtin'
import type { ProductResult } from '../../types'

interface Props {
  product: ProductResult
  onReset: () => void
  onPickCandidate: (barcode: string) => void
}

/** Shown when no database has ingredient data for a barcode. Offers likely matches, then the ingredient-photo route. */
export function NotFoundPanel({ product, onReset, onPickCandidate }: Props) {
  const name = product.identified_name
  const brand = product.identified_brand
  const candidates = product.candidates ?? []
  const checkBad = !looksLikeRealBarcode(product.barcode)
  const scanState = { barcode: product.barcode, name: name ?? '', brand: brand ?? '' }

  return (
    <div className="flex flex-col gap-6">
      <div className="p-6 sm:p-10 text-center flex flex-col items-center gap-4" style={{ border: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>We don't have this product yet</p>

        {(name || brand) ? (
          <div className="flex flex-col items-center gap-3">
            {product.image_url && (
              <img src={product.image_url} alt="" className="w-20 h-20 object-contain p-1.5" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }} />
            )}
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--secondary)' }}>This looks like</p>
              <p className="font-display text-2xl sm:text-3xl mt-1" style={{ color: 'var(--fg)' }}>
                {[brand, name].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        ) : (
          <p className="font-display text-3xl" style={{ color: 'var(--fg)' }}>Unknown barcode</p>
        )}

        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          <code className="px-2 py-0.5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--rim)', color: 'var(--secondary)' }}>
            {product.barcode}
          </code>
          {(name || brand) ? ' has no ingredient list in any database we check.' : " isn't in any database we check yet."}
        </p>

        {checkBad && (
          <p role="alert" className="text-xs max-w-sm" style={{ color: 'var(--warn)' }}>
            The last digit of this barcode doesn't add up, so a digit may have been misread or mistyped. Try scanning it again.
          </p>
        )}
      </div>

      {candidates.length > 0 && (
        <div className="p-5 sm:p-6 flex flex-col gap-3" style={{ border: '1px solid var(--rim)' }}>
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Is it one of these?</p>
          <div className="flex flex-col gap-2">
            {candidates.map((c) => (
              <button
                key={c.barcode}
                type="button"
                onClick={() => onPickCandidate(c.barcode)}
                className="flex items-center gap-3 p-3 text-left rounded-md"
                style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}
              >
                {c.image_url ? (
                  <img src={c.image_url} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 flex-shrink-0" style={{ border: '1px solid var(--rim)' }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--secondary)' }}>{c.brand ?? 'Unknown'}</p>
                  <p className="text-sm break-words" style={{ color: 'var(--fg)' }}>{c.name ?? 'Unnamed product'}</p>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--primary)' }}>Use this →</span>
              </button>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            These are the closest products in our catalog. Pack sizes and formulas can differ, so check the ingredient list if it matters.
          </p>
        </div>
      )}

      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ border: '1px solid var(--primary)' }}>
        <div>
          <p className="text-sm" style={{ color: 'var(--fg)' }}>
            Photograph the ingredient list on the back and we'll score it right away.
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
            After we've reviewed it, this barcode will work for everyone.
          </p>
        </div>
        <Link to="/scan-ingredients" state={scanState} className="btn-primary flex-shrink-0 text-center">
          Scan ingredient list →
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <button onClick={onReset} className="btn-outline">Try another barcode</button>
        <Link to="/search" className="text-xs underline" style={{ color: 'var(--primary)' }}>Search by name instead</Link>
      </div>
    </div>
  )
}
