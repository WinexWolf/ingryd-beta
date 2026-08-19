import type { IngredientFlag } from '../../types'

interface Props {
  ingredient: IngredientFlag
  showConcern?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  hydrating: 'Hydrating',
  antioxidant: 'Antioxidant',
  soothing: 'Soothing',
  'anti-aging': 'Anti-aging',
  brightening: 'Brightening',
  treatment: 'Treatment',
}

export function IngredientBadge({ ingredient, showConcern = false }: Props) {
  if (ingredient.severity === 'high') {
    return (
      <div className="flex flex-col gap-1">
        <span className="badge-harmful">⚠ {ingredient.name}</span>
        {showConcern && (
          <span className="text-[11px] text-red-700/80 pl-1">{ingredient.concern}</span>
        )}
      </div>
    )
  }

  if (ingredient.severity === 'moderate') {
    return (
      <div className="flex flex-col gap-1">
        <span className="badge-moderate">
          ◐ {ingredient.name}
          {ingredient.category && (
            <span className="text-amber-700/50 font-normal normal-case tracking-normal"> · {ingredient.category}</span>
          )}
        </span>
        {showConcern && (
          <span className="text-[11px] text-amber-700/80 pl-1">{ingredient.concern}</span>
        )}
      </div>
    )
  }

  const categoryLabel = ingredient.category ? CATEGORY_LABELS[ingredient.category] ?? ingredient.category : null

  return (
    <div className="flex flex-col gap-1">
      <span className="badge-beneficial">
        + {ingredient.name}
        {categoryLabel && (
          <span className="text-moss/50 font-normal normal-case tracking-normal"> · {categoryLabel}</span>
        )}
      </span>
      {showConcern && (
        <span className="text-[11px] text-moss/60 pl-1">{ingredient.concern}</span>
      )}
    </div>
  )
}
