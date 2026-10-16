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

export const CONCERN_OPTIONS = ['acne', 'texture', 'dark circles', 'aging', 'hyperpigmentation', 'redness', 'dryness']

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

export interface RecommendedProduct {
  barcode: string
  name?: string
  brand?: string
  category?: string
  score: number
  fit_score: number
  fit_grade: GradeKey
  reasons: string[]
  cautions: string[]
  delta?: number | null
  avoids: string[]
  ingredients_parsed: string[]
}

export interface RecommendGroup {
  category: string
  label: string
  picks: RecommendedProduct[]
}

export interface RecommendResponse {
  personalized: boolean
  top: RecommendedProduct[]
  groups: RecommendGroup[]
  catalog_size: number
}

export interface AlternativesResponse {
  category?: string | null
  current_fit?: number | null
  picks: RecommendedProduct[]
  message?: string | null
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

export interface ConcernArea {
  key: string
  label: string
  score: number // 0-100, higher = healthier
  status: 'attention' | 'watch' | 'good'
  tip: string
  ingredients: string[]
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
  areas?: ConcernArea[]
  is_sample?: boolean // canned example scan, not the user's skin
  // Multi-angle scans: photos analyzed, per-photo concern scores, concerns where photos disagree, notes.
  views?: ('front' | 'left' | 'right')[]
  view_scores?: Record<string, Record<string, number>>
  varies?: string[]
  view_notes?: string[]
  demo?: boolean // seeded by "Load demo data"
  // What was on the user's shelf when this scan was taken (saved with the scan, no ingredients).
  routine_snapshot?: { name: string; brand?: string; slot: 'am' | 'pm' }[]
  // Signed overlay URLs that expire in ~24h. Display-only: never saved to history.
  masks?: Record<string, string>
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

export interface RoutineProductFit {
  name: string
  brand?: string | null
  slot: 'am' | 'pm'
  category: string
  fit_score?: number | null
  fit_grade?: GradeKey | null
  working_for: string[]
  working_against: string[]
}

export interface RoutineGap {
  concern: string
  label: string
  score?: number | null
  message: string
  suggestion?: RecommendedProduct | null
}

export interface RoutineCovered {
  concern: string
  label: string
  score?: number | null
  products: string[]
}

export interface RoutineFitResponse {
  headline: string
  has_scan: boolean
  products: RoutineProductFit[]
  covered: RoutineCovered[]
  gaps: RoutineGap[]
  missing_basics: string[]
}

export type GradeKey = 'excellent' | 'good' | 'fair' | 'poor' | 'avoid'

export const GRADE_CONFIG: Record<GradeKey, { label: string; color: string; bg: string; ring: string }> = {
  // colors come from CSS variables (index.css) so they stay readable in light and dark mode
  excellent: { label: 'Excellent', color: 'grade-excellent', bg: '', ring: 'var(--g-excellent-bd)' },
  good:      { label: 'Good',      color: 'grade-good',      bg: '', ring: 'var(--g-good-bd)' },
  fair:      { label: 'Fair',      color: 'grade-fair',      bg: '', ring: 'var(--g-fair-bd)' },
  poor:      { label: 'Poor',      color: 'grade-poor',      bg: '', ring: 'var(--g-poor-bd)' },
  avoid:     { label: 'Avoid',     color: 'grade-avoid',     bg: '', ring: 'var(--g-avoid-bd)' },
}
