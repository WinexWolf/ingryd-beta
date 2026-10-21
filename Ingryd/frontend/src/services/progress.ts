import type { SkinProfile } from '../types'

/** Scans taken in different light or at a different angle move scores a few points on their own,
 *  so anything inside this band is reported as "no meaningful change", never as progress. */
export const MEANINGFUL = 5

export const CONCERN_LABEL: Record<string, string> = {
  moisture: 'Hydration', oiliness: 'Oil balance', redness: 'Redness', acne: 'Breakouts', pore: 'Pores',
  texture: 'Texture', wrinkle: 'Fine lines', age_spot: 'Dark spots', dark_circle_v2: 'Dark circles',
  eye_bag: 'Eye bags', tear_trough: 'Under-eye hollows', firmness: 'Firmness', radiance: 'Radiance',
  droopy_upper_eyelid: 'Upper eyelids', droopy_lower_eyelid: 'Lower eyelids',
}

export type Trend = 'better' | 'worse' | 'steady'

export interface ConcernDelta { key: string; label: string; from: number; to: number; delta: number; trend: Trend }

export interface Progress {
  days: number
  overall: { from: number; to: number; delta: number; trend: Trend }
  concerns: ConcernDelta[]           // biggest movers first
  steady: number                     // how many concerns stayed inside the band
  routine: { added: string[]; removed: string[] } | null
  demo: boolean
}

interface Scan { timestamp: number; profile: SkinProfile }

const trendOf = (d: number): Trend => (d >= MEANINGFUL ? 'better' : d <= -MEANINGFUL ? 'worse' : 'steady')

/** Only YouCam scans are comparable: the old heuristic scores come from a different method. */
export function isComparable(s: Scan): boolean {
  return s.profile.source === 'youcam' && !!s.profile.concerns && Object.keys(s.profile.concerns).length > 0
}

export function computeProgress(current: Scan, previous: Scan): Progress | null {
  if (!isComparable(current) || !isComparable(previous)) return null
  const cur = current.profile.concerns!, prev = previous.profile.concerns!
  const concerns: ConcernDelta[] = []
  let steady = 0
  for (const key of Object.keys(cur)) {
    if (!(key in prev) || !(key in CONCERN_LABEL)) continue
    const delta = cur[key] - prev[key]
    const trend = trendOf(delta)
    if (trend === 'steady') { steady++; continue }
    concerns.push({ key, label: CONCERN_LABEL[key], from: prev[key], to: cur[key], delta, trend })
  }
  concerns.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const names = (s: Scan) => (s.profile.routine_snapshot ?? []).map((p) => p.name)
  let routine: Progress['routine'] = null
  if (current.profile.routine_snapshot && previous.profile.routine_snapshot) {
    const a = names(current), b = names(previous)
    const added = a.filter((n) => !b.includes(n)), removed = b.filter((n) => !a.includes(n))
    routine = added.length || removed.length ? { added, removed } : null
  }

  const delta = current.profile.overall_score - previous.profile.overall_score
  return {
    days: Math.max(0, Math.round((current.timestamp - previous.timestamp) / 86_400_000)),
    overall: { from: previous.profile.overall_score, to: current.profile.overall_score, delta, trend: trendOf(delta) },
    concerns, steady, routine, demo: !!current.profile.demo,
  }
}

/** The two most recent comparable scans from a newest-first history list. Real scans are only
 *  ever compared with real scans, and demo scans with demo scans. With `fallbackToDemo`, a user
 *  whose real scans can't be compared yet (Home) is shown the demo pair instead, labelled as demo. */
export function latestPair<T extends Scan>(history: T[], fallbackToDemo = false): [T, T] | null {
  const youcam = history.filter(isComparable)
  if (youcam.length < 2) return null
  const same = youcam.filter((s) => !!s.profile.demo === !!youcam[0].profile.demo)
  if (same.length >= 2) return [same[0], same[1]]
  const demo = youcam.filter((s) => s.profile.demo)
  return fallbackToDemo && demo.length >= 2 ? [demo[0], demo[1]] : null
}
