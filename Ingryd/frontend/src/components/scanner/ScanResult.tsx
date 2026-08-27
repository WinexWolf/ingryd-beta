import { ScoreGauge } from '../ui/ScoreGauge'
import { IngredientBadge } from '../ui/IngredientBadge'
import type { ProductResult, GradeKey } from '../../types'

interface Props {
  product: ProductResult
  onReset: () => void
}

function SectionHeader({ label, count, accent }: { label: string; count?: number; accent?: string }) {
  return (
    <div
      className="flex items-center justify-between pb-3 mb-4"
      style={{ borderBottom: `1px solid var(--rim)` }}
    >
      <span
        className="text-[10px] tracking-[0.3em] uppercase font-sans font-semibold"
        style={{ color: accent ?? 'var(--muted)' }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{count}</span>
      )}
    </div>
  )
}

export function ScanResult({ product, onReset }: Props) {
  if (!product.found) {
    return (
      <div className="p-12 text-center" style={{ border: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-widest uppercase mb-4" style={{ color: 'var(--muted)' }}>Product not found</p>
        <p className="font-display text-3xl mb-3" style={{ color: 'var(--fg)' }}>Unknown barcode</p>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          <code
            className="px-2 py-0.5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--rim)', color: 'var(--secondary)' }}
          >
            {product.barcode}
          </code>
          {' '}is not in the Open Beauty Facts database yet.
        </p>
        <button onClick={onReset} className="btn-outline">Try Another</button>
      </div>
    )
  }

  const { score } = product

  return (
    <div className="flex flex-col gap-8">

      {/* Product header */}
      <div className="p-6 flex flex-col sm:flex-row gap-6 items-start" style={{ border: '1px solid var(--rim)' }}>
        {product.image_url && (
          <div className="p-2 flex-shrink-0" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}>
            <img src={product.image_url} alt={product.name ?? 'Product'} className="w-24 h-24 object-contain" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'var(--secondary)' }}>
            {product.brand ?? 'Unknown Brand'}
          </p>
          <h2 className="font-display text-3xl leading-snug mb-3" style={{ color: 'var(--fg)' }}>
            {product.name ?? 'Unnamed Product'}
          </h2>
          {product.labels && (
            <div className="flex flex-wrap gap-2 mt-2">
              {product.labels.split(',').slice(0, 5).map((label) => (
                <span key={label.trim()} className="badge-neutral">{label.trim()}</span>
              ))}
            </div>
          )}
        </div>
        {score && (
          <div className="flex-shrink-0 sm:self-center">
            <ScoreGauge score={score.score} grade={score.grade as GradeKey} fitScore={score.fit_score} fitGrade={score.fit_grade} />
          </div>
        )}
      </div>

      {/* No ingredient data available — OBF has the product but not its ingredients */}
      {!score && (
        <div className="p-8 text-center" style={{ border: '1px solid var(--rim)' }}>
          <p className="text-[10px] tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>No ingredient data yet</p>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
            Open Beauty Facts has this product listed, but nobody's logged its ingredient list yet —
            so we can't score it. Try searching for a similar product, or check back later.
          </p>
        </div>
      )}

      {/* Score summary */}
      {score && (
        <div style={{ border: '1px solid var(--rim)' }}>
          <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--rim)', borderRight: 'none' }}>
            {[
              { val: score.high_concern.length,    label: 'High concern', color: '#b91c1c' },
              { val: score.moderate_concern.length, label: 'Moderate',     color: '#a16207' },
              { val: score.beneficial.length,       label: 'Beneficial',   color: 'var(--moss)' },
            ].map((s, i) => (
              <div
                key={s.label}
                className="p-5 text-center"
                style={i > 0 ? { borderLeft: '1px solid var(--rim)' } : {}}
              >
                <p className="font-display text-3xl" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[10px] tracking-widest uppercase mt-1" style={{ color: 'var(--muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-2 text-center">
            <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
              {score.total_ingredients} total ingredients · {score.flagged_count} flagged
            </span>
          </div>
        </div>
      )}

      {/* Personalized notes */}
      {score && score.personal_notes.length > 0 && (
        <div className="p-6" style={{ border: '1px solid var(--secondary)', backgroundColor: 'rgba(226,89,111,0.05)' }}>
          <SectionHeader label="Why your Fit Score differs" count={score.personal_notes.length} accent="var(--secondary)" />
          <div className="flex flex-col gap-3">
            {score.personal_notes.map((n, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{n.ingredient}</span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{n.reason}</p>
                </div>
                <span
                  className="text-xs font-mono flex-shrink-0"
                  style={{ color: n.adjustment > 0 ? 'var(--moss)' : '#b91c1c' }}
                >
                  {n.adjustment > 0 ? '+' : ''}{n.adjustment}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High concern */}
      {score && score.high_concern.length > 0 && (
        <div className="p-6" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <SectionHeader label="High Concern Ingredients" count={score.high_concern.length} accent="#b91c1c" />
          <div className="flex flex-col gap-4">
            {score.high_concern.map((ing) => (
              <IngredientBadge key={ing.name} ingredient={ing} showConcern />
            ))}
          </div>
        </div>
      )}

      {/* Moderate concern */}
      {score && score.moderate_concern.length > 0 && (
        <div className="p-6" style={{ border: '1px solid rgba(180,83,9,0.4)' }}>
          <SectionHeader label="Moderate Concern" count={score.moderate_concern.length} accent="#a16207" />
          <div className="flex flex-wrap gap-3">
            {score.moderate_concern.map((ing) => (
              <IngredientBadge key={ing.name} ingredient={ing} showConcern />
            ))}
          </div>
        </div>
      )}

      {/* Comedogenic — informational, shown to everyone regardless of skin type */}
      {score && score.comedogenic.length > 0 && (
        <div className="p-6" style={{ border: '1px solid rgba(180,83,9,0.4)' }}>
          <SectionHeader label="May Clog Pores (Comedogenic)" count={score.comedogenic.length} accent="#a16207" />
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Rated on the standard 0–5 comedogenicity scale. Matters most if you're acne-prone or oily —
            set up your profile for a personalized read on this.
          </p>
          <div className="flex flex-wrap gap-3">
            {score.comedogenic.map((ing) => (
              <IngredientBadge key={ing.name} ingredient={ing} showConcern />
            ))}
          </div>
        </div>
      )}

      {/* Beneficial — moss accent border */}
      {score && score.beneficial.length > 0 && (
        <div className="p-6" style={{ border: '1px solid var(--moss)', backgroundColor: 'rgba(143,153,81,0.05)' }}>
          <SectionHeader label="Beneficial Ingredients" count={score.beneficial.length} accent="var(--moss)" />
          <div className="flex flex-wrap gap-3">
            {score.beneficial.map((ing) => (
              <IngredientBadge key={ing.name} ingredient={ing} showConcern />
            ))}
          </div>
        </div>
      )}

      {/* Full ingredient list */}
      {product.ingredients_text && (
        <div className="p-6" style={{ border: '1px solid var(--rim)' }}>
          <SectionHeader label="Full Ingredient List" />
          <p className="text-sm leading-relaxed font-sans" style={{ color: 'var(--muted)' }}>
            {product.ingredients_text}
          </p>
        </div>
      )}

      <div className="flex justify-start pt-2">
        <button onClick={onReset} className="btn-outline">← Scan Another Product</button>
      </div>
    </div>
  )
}
