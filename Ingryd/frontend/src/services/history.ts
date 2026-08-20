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
    .select('id, slot, product_name, brand, ingredients_parsed')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    name: row.product_name,
    brand: row.brand ?? undefined,
    slot: row.slot as 'am' | 'pm',
    ingredients_parsed: (row.ingredients_parsed as string[]) ?? [],
  }))
}

// Adds a single item and returns it with its new database id. Incremental
// add/remove (rather than "fetch whole list, save whole list") avoids a race
// condition where two quick add-clicks could read the same stale snapshot
// and silently drop one of them.
export async function addRoutineItem(item: RoutineProductInput): Promise<RoutineProductInput | null> {
  const userId = await currentUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from('routine_items')
    .insert({
      user_id: userId,
      slot: item.slot,
      product_name: item.name,
      brand: item.brand ?? null,
      ingredients_parsed: item.ingredients_parsed,
    })
    .select('id')
    .single()

  if (error || !data) return null
  return { ...item, id: data.id }
}

export async function removeRoutineItem(id: string): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  await supabase.from('routine_items').delete().eq('id', id).eq('user_id', userId)
}
