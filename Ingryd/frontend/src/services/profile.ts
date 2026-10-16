import type { SkinPreferences, SkinProfile, SkinType } from '../types'
import { SKIN_TYPES } from '../types'
import { supabase } from './supabaseClient'

const LEGACY_COLS = 'skin_type, concerns, sensitivities'
// concern_scores / scanned_at need db/migrations/001_scan_profile.sql. If the
// migration has not been run yet we fall back to the legacy columns instead of
// breaking the whole profile.
const FULL_COLS = `${LEGACY_COLS}, concern_scores, scanned_at`

export async function getProfile(): Promise<SkinPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let { data, error } = await supabase.from('profiles').select(FULL_COLS).eq('id', user.id).single()
  if (error) {
    ;({ data, error } = await supabase.from('profiles').select(LEGACY_COLS).eq('id', user.id).single())
  }
  if (error || !data) return null

  const row = data as Record<string, any>
  return {
    skin_type: row.skin_type ?? undefined,
    concerns: row.concerns ?? [],
    sensitivities: row.sensitivities ?? [],
    concern_scores: row.concern_scores ?? {},
    scanned_at: row.scanned_at ?? undefined,
  }
}

export type SaveResult = 'saved' | 'saved_without_scan' | 'signed_out' | 'error'

/** concern_scores is only written when provided, so the manual Profile page can
 *  save without wiping the latest scan. */
export async function saveProfile(profile: SkinPreferences): Promise<SaveResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'signed_out'

  const legacy = {
    skin_type: profile.skin_type ?? null,
    concerns: profile.concerns,
    sensitivities: profile.sensitivities,
  }
  if (profile.concern_scores === undefined) {
    const { error } = await supabase.from('profiles').update(legacy).eq('id', user.id)
    return error ? 'error' : 'saved'
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...legacy, concern_scores: profile.concern_scores, scanned_at: profile.scanned_at ?? new Date().toISOString() })
    .eq('id', user.id)
  if (!error) return 'saved'

  // Likely the migration has not been run: still save the part that works.
  const { error: legacyError } = await supabase.from('profiles').update(legacy).eq('id', user.id)
  return legacyError ? 'error' : 'saved_without_scan'
}

export async function hasProfile(): Promise<boolean> {
  const p = await getProfile()
  return !!p && (!!p.skin_type || p.concerns.length > 0 || p.sensitivities.length > 0)
}

/** What "Apply to my profile" would produce from a scan, merged with what the
 *  user already has. Pure, so the UI can preview it before saving. */
export function mergeScanIntoPreferences(scan: SkinProfile, existing: SkinPreferences | null): SkinPreferences {
  const suggestedType = SKIN_TYPES.find((t) => t.value === scan.suggested_skin_type)?.value as SkinType | undefined
  const concerns = Array.from(new Set([...(existing?.concerns ?? []), ...(scan.suggested_concerns ?? [])]))
  return {
    skin_type: suggestedType ?? existing?.skin_type,
    concerns,
    sensitivities: existing?.sensitivities ?? [],
    concern_scores: scan.concerns ?? {},
  }
}

export async function applyScanToProfile(scan: SkinProfile): Promise<{ result: SaveResult; applied: SkinPreferences }> {
  const applied = mergeScanIntoPreferences(scan, await getProfile())
  return { result: await saveProfile(applied), applied }
}

export function profileToQueryParams(profile: SkinPreferences | null): string {
  if (!profile) return ''
  const params = new URLSearchParams()
  if (profile.skin_type) params.set('skin_type', profile.skin_type)
  if (profile.concerns.length) params.set('concerns', profile.concerns.join(','))
  if (profile.sensitivities.length) params.set('sensitivities', profile.sensitivities.join(','))
  const scores = Object.entries(profile.concern_scores ?? {})
  if (scores.length) params.set('concern_scores', scores.map(([k, v]) => `${k}:${Math.round(v)}`).join(','))
  const qs = params.toString()
  return qs ? `&${qs}` : ''
}
