import type {
  ProductResult,
  ProductSearchResponse,
  SkinProfile,
  RoutineProductInput,
  RoutineCheckResponse,
  ProductScore,
  RecommendResponse,
  AlternativesResponse,
  SkinPreferences,
  RoutineFitResponse,
} from '../types'
import { getProfile, profileToQueryParams } from './profile'

const BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchProductByBarcode(barcode: string): Promise<ProductResult> {
  const profileQs = profileToQueryParams(await getProfile())
  const res = await fetch(`${BASE}/products/barcode/${barcode}?${profileQs.replace(/^&/, '')}`)
  return handle<ProductResult>(res)
}

export type SortMode = 'name' | 'score'

export async function searchProducts(query: string, page = 1, pageSize = 12, sort: SortMode = 'name'): Promise<ProductSearchResponse> {
  const profileQs = profileToQueryParams(await getProfile())
  const res = await fetch(`${BASE}/products/search?q=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}&sort=${sort}${profileQs}`)
  return handle<ProductSearchResponse>(res)
}

export async function browseProducts(page = 1, pageSize = 30, sort: SortMode = 'name'): Promise<ProductSearchResponse> {
  const profileQs = profileToQueryParams(await getProfile())
  const res = await fetch(`${BASE}/products/browse?page=${page}&page_size=${pageSize}&sort=${sort}${profileQs}`)
  return handle<ProductSearchResponse>(res)
}

/** Best catalog picks for the user. Pass `prefs` to rank against a profile that is not saved yet
 *  (e.g. a scan the user hasn't applied), otherwise the saved profile is used. */
export async function getRecommendations(prefs?: SkinPreferences | null, groups = 4, perGroup = 3): Promise<RecommendResponse> {
  const profile = prefs === undefined ? await getProfile() : prefs
  const res = await fetch(`${BASE}/products/recommend?groups=${groups}&per_group=${perGroup}${profileToQueryParams(profile)}`)
  return handle<RecommendResponse>(res)
}

/** "Better for you": same-type products that score higher than `product` for this user. */
export async function getAlternatives(product: ProductResult, limit = 3): Promise<AlternativesResponse> {
  const profile = await getProfile()
  const res = await fetch(`${BASE}/products/alternatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: product.barcode || undefined,
      category: product.categories || undefined,
      ingredients: product.ingredients_parsed,
      current_fit: product.score?.fit_score ?? product.score?.score,
      limit,
      profile: profile
        ? { skin_type: profile.skin_type, concerns: profile.concerns, sensitivities: profile.sensitivities, concern_scores: profile.concern_scores ?? {} }
        : undefined,
    }),
  })
  return handle<AlternativesResponse>(res)
}

export async function analyzeSkin(imageBase64: string): Promise<SkinProfile> {
  const res = await fetch(`${BASE}/skin/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64 }),
  })
  const data = await handle<{ profile: SkinProfile }>(res)
  return data.profile
}

export async function checkRoutine(products: RoutineProductInput[]): Promise<RoutineCheckResponse> {
  const res = await fetch(`${BASE}/routine/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products }),
  })
  return handle<RoutineCheckResponse>(res)
}

/** Routine vs. the user's latest scan: what's working, what's working against them, what's missing. */
export async function getRoutineFit(products: RoutineProductInput[]): Promise<RoutineFitResponse> {
  const profile = await getProfile()
  const res = await fetch(`${BASE}/routine/fit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: products.map((p) => ({ name: p.name, brand: p.brand, slot: p.slot, ingredients_parsed: p.ingredients_parsed })),
      profile: profile
        ? { skin_type: profile.skin_type, concerns: profile.concerns, sensitivities: profile.sensitivities, concern_scores: profile.concern_scores ?? {} }
        : undefined,
    }),
  })
  return handle<RoutineFitResponse>(res)
}

export interface IngredientAnalysisResult {
  ingredients_parsed: string[]
  score: ProductScore
}

export async function analyzeIngredients(rawText: string, productName?: string): Promise<IngredientAnalysisResult> {
  const profile = await getProfile()
  const res = await fetch(`${BASE}/ingredients/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raw_text: rawText,
      product_name: productName,
      skin_type: profile?.skin_type,
      concerns: profile?.concerns ?? [],
      sensitivities: profile?.sensitivities ?? [],
      concern_scores: profile?.concern_scores ?? {},
    }),
  })
  return handle<IngredientAnalysisResult>(res)
}
