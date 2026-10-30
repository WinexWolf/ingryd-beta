import { supabase } from './supabaseClient'

export type Feel = 'good' | 'ok' | 'rough'
export interface LogDay { date: string; am: boolean; pm: boolean; feel: Feel | null }

/** Local calendar date as YYYY-MM-DD (the user's own day, not UTC). */
export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}

/** Last 7 days (oldest first) with whether anything was logged. */
export function lastSeven(log: LogDay[], today: string = dayKey()): { date: string; done: boolean }[] {
  const done = new Set(log.filter((l) => l.am || l.pm).map((l) => l.date))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6)
    return { date, done: done.has(date) }
  })
}

/** Consecutive days with a check-in. Today not logged yet does not break a streak that ran through yesterday. */
export function streak(log: LogDay[], today: string = dayKey()): number {
  const done = new Set(log.filter((l) => l.am || l.pm).map((l) => l.date))
  let cursor = done.has(today) ? today : addDays(today, -1)
  let n = 0
  while (done.has(cursor)) { n += 1; cursor = addDays(cursor, -1) }
  return n
}

export async function getLog(days = 60): Promise<LogDay[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('routine_log').select('log_date, am, pm, feel')
    .eq('user_id', user.id).gte('log_date', addDays(dayKey(), -days)).order('log_date', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({ date: r.log_date as string, am: !!r.am, pm: !!r.pm, feel: (r.feel as Feel | null) ?? null }))
}

/** Saves today's check-in. Returns false if it could not be saved (for example the table is not set up yet). */
export async function saveDay(day: LogDay): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase.from('routine_log').upsert(
    { user_id: user.id, log_date: day.date, am: day.am, pm: day.pm, feel: day.feel, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,log_date' },
  )
  return !error
}
