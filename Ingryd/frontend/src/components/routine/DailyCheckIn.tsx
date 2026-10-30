import { useEffect, useState } from 'react'
import { Sun, Moon, Check } from 'lucide-react'
import { dayKey, getLog, lastSeven, saveDay, streak, type Feel, type LogDay } from '../../services/routineLog'

const FEELS: { value: Feel; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'ok', label: 'Okay' },
  { value: 'rough', label: 'Rough' },
]

/** Quick daily check-in: did you do your routine, and how does your skin feel. Builds a streak. */
export function DailyCheckIn() {
  const [log, setLog] = useState<LogDay[] | null>(null)
  const [error, setError] = useState(false)
  const today = dayKey()

  useEffect(() => {
    let cancelled = false
    getLog().then((l) => { if (!cancelled) setLog(l) })
    return () => { cancelled = true }
  }, [])

  if (log === null) return null

  const todayRow: LogDay = log.find((l) => l.date === today) ?? { date: today, am: false, pm: false, feel: null }

  const update = async (patch: Partial<LogDay>) => {
    const next = { ...todayRow, ...patch }
    const prev = log
    setLog([...log.filter((l) => l.date !== today), next])   // optimistic
    setError(false)
    const ok = await saveDay(next)
    if (!ok) { setLog(prev); setError(true) }
  }

  const days = lastSeven(log, today)
  const n = streak(log, today)

  return (
    <div className="p-5 sm:p-6 flex flex-col gap-4" style={{ border: '1px solid var(--primary)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Today's check-in</p>
          <p className="text-sm mt-1" style={{ color: 'var(--fg)' }}>
            {n > 0 ? `${n}-day streak. Keep it going.` : 'Log your routine to start a streak.'}
          </p>
        </div>
        <div className="flex gap-1.5" role="img" aria-label={`Check-ins in the last 7 days: ${days.filter((d) => d.done).length} of 7`}>
          {days.map((d) => (
            <span key={d.date} title={d.date} className="w-3 h-3 rounded-full"
              style={{ backgroundColor: d.done ? 'var(--moss)' : 'transparent', border: `1px solid ${d.done ? 'var(--moss)' : 'var(--rim)'}` }} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([['am', 'Morning done', Sun], ['pm', 'Evening done', Moon]] as const).map(([k, label, Icon]) => {
          const on = todayRow[k]
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => update({ [k]: !on })}
              className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-md transition-colors"
              style={{ border: `1px solid ${on ? 'var(--moss)' : 'var(--rim)'}`, color: on ? 'var(--moss)' : 'var(--fg)', backgroundColor: on ? 'var(--surface)' : 'transparent' }}>
              {on ? <Check size={14} /> : <Icon size={14} />} {label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>My skin today:</span>
        {FEELS.map((f) => {
          const on = todayRow.feel === f.value
          return (
            <button key={f.value} type="button" aria-pressed={on} onClick={() => update({ feel: on ? null : f.value })}
              className="px-3 py-1 text-xs rounded-full"
              style={{ border: `1px solid ${on ? 'var(--primary)' : 'var(--rim)'}`, color: on ? 'var(--primary)' : 'var(--muted)' }}>
              {f.label}
            </button>
          )
        })}
      </div>

      {error && <p className="text-xs text-danger">We couldn't save that right now. Please try again in a minute.</p>}
      <p className="text-xs" style={{ color: 'var(--muted)' }}>Scan again in a couple of weeks to see how your skin changed.</p>
    </div>
  )
}
