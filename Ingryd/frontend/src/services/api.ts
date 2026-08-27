import type {
  ProductResult,
  ProductSearchResponse,
  SkinProfile,
  RoutineProductInput,
  RoutineCheckResponse,
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
