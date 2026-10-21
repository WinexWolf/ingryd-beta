import type { Progress } from '../../services/progress'
import { MEANINGFUL } from '../../services/progress'

const COLOR = { better: 'var(--moss)', worse: 'var(--danger)', steady: 'var(--muted)' }
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** What changed since the previous scan, with small wobbles reported as "no meaningful change". */
export function ProgressCard({ progress }: { progress: Progress }) {
  const { overall, concerns, steady, routine, days } = progress
  const when = days === 0 ? 'earlier today' : days === 1 ? 'yesterday' : `${days} days ago`
  const better = concerns.filter((c) => c.trend === 'better')
  const worse = concerns.filter((c) => c.trend === 'worse')

  return (
    <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Since your last scan · {when}{progress.demo ? ' · demo data' : ''}</p>
        <p className="font-display text-2xl" style={{ color: COLOR[overall.trend] }}>
          {overall.trend === 'steady' ? '≈' : sign(overall.delta)}
          <span className="text-xs font-sans ml-2" style={{ color: 'var(--muted)' }}>{overall.from} → {overall.to}</span>
        </p>
      </div>

      {concerns.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--fg)' }}>
          No meaningful change in any concern. Scores within {MEANINGFUL} points are normal scan-to-scan variation.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...better, ...worse].map((c) => (
            <p key={c.key} className="text-sm flex justify-between gap-3" style={{ color: 'var(--fg)' }}>
              <span>{c.label} <span style={{ color: 'var(--muted)' }}>{c.trend === 'better' ? 'improved' : 'slipped'}</span></span>
              <span className="font-mono text-xs" style={{ color: COLOR[c.trend] }}>{c.from} → {c.to} ({sign(c.delta)})</span>
            </p>
          ))}
          {steady > 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>{steady} other concern{steady === 1 ? '' : 's'}: no meaningful change.</p>}
        </div>
      )}

      {routine && (
        <p className="text-xs leading-relaxed pt-3" style={{ color: 'var(--muted)', borderTop: '1px solid var(--rim)' }}>
          Your routine changed in between
          {routine.added.length > 0 && <> — added <span style={{ color: 'var(--fg)' }}>{routine.added.join(', ')}</span></>}
          {routine.removed.length > 0 && <>{routine.added.length > 0 ? ';' : ' —'} removed <span style={{ color: 'var(--fg)' }}>{routine.removed.join(', ')}</span></>}.
        </p>
      )}
    </div>
  )
}
