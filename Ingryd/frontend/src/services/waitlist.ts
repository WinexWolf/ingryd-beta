import { supabase } from './supabaseClient'

export type PriceChoice = '3_99' | '5_99' | '9_99' | 'none'

/** The person's saved answer, or null if they haven't answered (or the table isn't set up yet). */
export async function getMyPriceChoice(): Promise<PriceChoice | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.from('plus_waitlist').select('price_choice').eq('user_id', user.id).maybeSingle()
  if (error || !data) return null
  return data.price_choice as PriceChoice
}

/** Saves (or changes) the answer. Returns false if it could not be saved. Needs db/migrations/004_plus_waitlist.sql. */
export async function saveMyPriceChoice(choice: PriceChoice): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase.from('plus_waitlist').upsert(
    { user_id: user.id, email: user.email ?? null, price_choice: choice, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  return !error
}
