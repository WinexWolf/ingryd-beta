import type { SkinPreferences } from '../types'
import { supabase } from './supabaseClient'

export async function getProfile(): Promise<SkinPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('skin_type, concerns, sensitivities')
    .eq('id', user.id)
    .single()

  if (error || !data) return null

  return {
    skin_type: data.skin_type ?? undefined,
    concerns: data.concerns ?? [],
    sensitivities: data.sensitivities ?? [],
  }
}

export async function saveProfile(profile: SkinPreferences): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({
      skin_type: profile.skin_type ?? null,
      concerns: profile.concerns,
      sensitivities: profile.sensitivities,
    })
    .eq('id', user.id)
}

export async function hasProfile(): Promise<boolean> {
  const p = await getProfile()
  return !!p && (!!p.skin_type || p.concerns.length > 0 || p.sensitivities.length > 0)
}

export function profileToQueryParams(profile: SkinPreferences | null): string {
  if (!profile) return ''
  const params = new URLSearchParams()
  if (profile.skin_type) params.set('skin_type', profile.skin_type)
  if (profile.concerns.length) params.set('concerns', profile.concerns.join(','))
  if (profile.sensitivities.length) params.set('sensitivities', profile.sensitivities.join(','))
  const qs = params.toString()
  return qs ? `&${qs}` : ''
}
