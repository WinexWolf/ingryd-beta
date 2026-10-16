export interface IngredientFlag {
  name: string
  concern: string
  severity: 'high' | 'moderate' | 'beneficial'
  category?: string
}

export interface PersonalNote {
  ingredient: string
  reason: string
  adjustment: number
}

export interface ProductScore {
  score: number
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'avoid'
  high_concern: IngredientFlag[]
  moderate_concern: IngredientFlag[]
  beneficial: IngredientFlag[]
  comedogenic: IngredientFlag[]
  allergens: IngredientFlag[]
  prohibited: IngredientFlag[]
  total_ingredients: number
  flagged_count: number
  fit_score?: number
  fit_grade?: GradeKey
  personal_notes: PersonalNote[]
}

export type SkinType = 'dry' | 'oily' | 'combination' | 'sensitive' | 'normal'

export interface SkinPreferences {
  skin_type?: SkinType
  concerns: string[]
  sensitivities: string[]
  /** Latest scan: YouCam ui_score per concern (0-100, higher = healthier). */
  concern_scores?: Record<string, number>
  scanned_at?: string
}

export const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'dry', label: 'Dry' },
  { value: 'oily', label: 'Oily' },
  { value: 'combination', label: 'Combination' },
  { value: 'sensitive', label: 'Sensitive' },
]

export const CONCERN_OPTIONS = ['acne', 'aging', 'hyperpigmentation', 'redness', 'dryness']

export interface ProductResult {
  barcode: string
  name?: string
  brand?: string
  categories?: string
  labels?: string
  image_url?: string
  ingredients_text?: string
  ingredients_parsed: string[]
  score?: ProductScore
  found: boolean
}

export interface ProductSearchResponse {
  query: string
  count: number
  total_count: number
  page: number
  page_size: number
  results: ProductResult[]
}

export interface SkinMetric {
  score: number
  label: string
}

export interface SkinProfile {
  hydration: SkinMetric
  oiliness: SkinMetric
  redness: SkinMetric
  texture: SkinMetric
  overall_score: number
  recommended_ingredients: string[]
  notes: string[]
  // Present on YouCam-powered scans; absent on older (heuristic) scans.
  source?: 'youcam' | 'heuristic'
  skin_type?: string | null
  skin_age?: number | null
  concerns?: Record<string, number>
  skin_type_zones?: Record<string, string>
  suggested_skin_type?: string | null
  suggested_concerns?: string[]
}

export interface RoutineProductInput {
  id?: string
  name: string
  brand?: string
  slot: 'am' | 'pm'
  ingredients_parsed: string[]
}

export interface RoutineConflict {
  severity: 'high' | 'moderate'
  ingredient_a: string
  ingredient_b: string
  product_a: string
  product_b: string
  reason: string
  advice: string
}

export interface RoutineCheckResponse {
  conflicts: RoutineConflict[]
  am_count: number
  pm_count: number
  clean: boolean
}

export type GradeKey = 'excellent' | 'good' | 'fair' | 'poor' | 'avoid'

export const GRADE_CONFIG: Record<GradeKey, { label: string; color: string; bg: string; ring: string }> = {
  excellent: { label: 'Excellent', color: 'text-moss border-moss',       bg: 'bg-moss/10',      ring: '#6F8F4C' },
  good:      { label: 'Good',      color: 'text-ink/70 border-chalk',    bg: 'bg-chalk/20',     ring: '#B8AE8E' },
  fair:      { label: 'Fair',      color: 'text-amber-700 border-amber-300', bg: 'bg-amber-50', ring: '#d97706' },
  poor:      { label: 'Poor',      color: 'text-orange-700 border-orange-300', bg: 'bg-orange-50', ring: '#ea580c' },
  avoid:     { label: 'Avoid',     color: 'text-red-700 border-red-300', bg: 'bg-red-50',       ring: '#dc2626' },
}
