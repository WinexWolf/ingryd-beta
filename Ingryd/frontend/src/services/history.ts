import type { ProductResult, SkinProfile, RoutineProductInput } from '../types'
import { supabase } from './supabaseClient'

export interface ScanHistoryEntry {
  id: string
  timestamp: number
  product: ProductResult
}

export interface SkinHistoryEntry {
  id: string
  timestamp: number
  profile: SkinProfile
}

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ── Scan history ────────────────────────────────────────────
export async function getScanHistory(): Promise<ScanHistoryEntry[]> {
  const userId = await currentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('scan_history')
    .select('id, created_at, product')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    product: row.product as ProductResult,
  }))
}

export async function addScanToHistory(product: ProductResult): Promise<void> {
  if (!product.found) return
  const userId = await currentUserId()
  if (!userId) return

  await supabase.from('scan_history').insert({ user_id: userId, product })
}

// ── Skin analysis history ───────────────────────────────────
export async function getSkinHistory(): Promise<SkinHistoryEntry[]> {
  const userId = await currentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('skin_analysis_history')
    .select('id, created_at, profile')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    profile: row.profile as SkinProfile,
  }))
}

export async function addSkinAnalysisToHistory(profile: SkinProfile): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  await supabase.from('skin_analysis_history').insert({ user_id: userId, profile })
}

// ── Routine (current AM/PM product list) ────────────────────
export async function getRoutine(): Promise<RoutineProductInput[]> {
  const userId = await currentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('routine_items')
    .select('slot, product_name, brand, ingredients_parsed')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    name: row.product_name,
    brand: row.brand ?? undefined,
    slot: row.slot as 'am' | 'pm',
    ingredients_parsed: (row.ingredients_parsed as string[]) ?? [],
  }))
}

// Replaces the whole routine — matches the existing call pattern used across
// Routine.tsx and ProductSearch.tsx (add/remove one item, then save the full
// list). Delete-then-insert isn't atomic, but for a beta this is an acceptable
// tradeoff against rewriting every call site to use incremental add/remove.
export async function saveRoutine(products: RoutineProductInput[]): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  await supabase.from('routine_items').delete().eq('user_id', userId)

  if (products.length === 0) return

  await supabase.from('routine_items').insert(
    products.map((p) => ({
      user_id: userId,
      slot: p.slot,
      product_name: p.name,
      brand: p.brand ?? null,
      ingredients_parsed: p.ingredients_parsed,
    }))
  )
}
