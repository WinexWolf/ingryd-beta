import type { SkinPreferences } from '../types'

const PROFILE_KEY = 'ingryd_skin_profile'

export function getProfile(): SkinPreferences | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as SkinPreferences) : null
  } catch {
    return null
  }
}

export function saveProfile(profile: SkinPreferences) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // non-critical for beta
  }
}

export function hasProfile(): boolean {
  const p = getProfile()
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
