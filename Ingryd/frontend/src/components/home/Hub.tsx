import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRoutine, getSkinHistory } from '../../services/history'
import { getProfile } from '../../services/profile'
import { getRoutineFit } from '../../services/api'
import { computeProgress, isComparable, latestPair } from '../../services/progress'
import type { SkinHistoryEntry } from '../../services/history'
import type { RoutineFitResponse, RoutineProductInput, SkinPreferences } from '../../types'
import { ProgressCard } from '../skin/ProgressCard'
import { PicksForYou } from '../recommend/PicksForYou'
import { clearDemoData, loadDemoData } from '../../services/demoData'
import { STATUS_COLOR, STATUS_WORD } from '../skin/statusColor'

const RESCAN_AFTER_DAYS = 14

interface NextStep { title: string; body: string; to: string; cta: string }

/** The single most useful thing to do next, in the order the product is meant to be used. */
function nextStep(
  latest: SkinHistoryEntry | undefined, prefs: SkinPreferences | null, routine: RoutineProductInput[],
  fit: RoutineFitResponse | null,
): NextStep {
  if (!latest) return { title: 'Start with a skin scan', body: 'One photo gives you scores for nine concerns and personalises everything else.', to: '/skin-analysis', cta: 'Scan my skin' }
  if (!prefs?.concern_scores || Object.keys(prefs.concern_scores).length === 0)
    return { title: 'Use your scan for your Fit Scores', body: 'Apply it to your profile so every product is scored against your weak spots.', to: '/skin-analysis', cta: 'Apply my scan' }
  if (routine.length === 0)
    return { title: 'Add what you use now', body: 'See which of your weak spots your current products actually cover.', to: '/routine', cta: 'Build my routine' }
  if (fit && fit.gaps.length > 0)
    return { title: `Nothing in your routine targets ${fit.gaps[0].label.toLowerCase()}`, body: fit.gaps[0].suggestion ? `Try ${fit.gaps[0].suggestion.name}.` : 'See what could fill the gap.', to: '/routine', cta: 'See the gap' }
  const days = (Date.now() - latest.timestamp) / 86_400_000
  if (days >= RESCAN_AFTER_DAYS)
    return { title: 'Time for a re-scan', body: `It has been ${Math.round(days)} days. A new scan shows what has changed.`, to: '/skin-analysis', cta: 'Scan again' }
  return { title: 'Check a product before you buy', body: 'Scan a barcode and get your personal Fit Score.', to: '/scan', cta: 'Scan a product' }
}

/** Signed-in home: where you are, what changed, and what to do next. */
export function Hub() {
  const [history, setHistory] = useState<SkinHistoryEntry[] | null>(null)
  const [prefs, setPrefs] = useState<SkinPreferences | null>(null)
  const [routine, setRoutine] = useState<RoutineProductInput[] | null>(null)
  const [fit, setFit] = useState<RoutineFitResponse | null>(null)

  const [version, setVersion] = useState(0)
  const [demoBusy, setDemoBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSkinHistory(), getProfile(), getRoutine()]).then(async ([h, p, r]) => {
      if (cancelled) return
      setHistory(h); setPrefs(p); setRoutine(r); setFit(null)
      if (r.length > 0 && p) {
        try { const f = await getRoutineFit(r); if (!cancelled) setFit(f) } catch { /* the panel is optional */ }
      }
    })
    return () => { cancelled = true }
  }, [version])

  const toggleDemo = async (on: boolean) => {
    setDemoBusy(true)
    if (on) await loadDemoData(); else await clearDemoData()
    setDemoBusy(false)
    setVersion((v) => v + 1)
  }

  if (!history || !routine) return <div className="py-16 text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Loading your skin…</div>

  const latest = history.find(isComparable) ?? history[0]
  const pair = latestPair(history, true)
  const progress = pair ? computeProgress(pair[0], pair[1]) : null
  const step = nextStep(history[0], prefs, routine, fit)
  const focus = latest?.profile.areas?.slice(0, 3) ?? []
  const am = routine.filter((p) => p.slot === 'am').length, pm = routine.length - am
  const hasDemo = history.some((h) => h.profile.demo) || routine.some((r) => r.name.startsWith('(Demo)'))

  return (
    <section className="flex flex-col gap-8 pt-4">
      <div>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-3" style={{ color: 'var(--muted)' }}>Your skin</p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl" style={{ color: 'var(--fg)' }}>Where you are today</h1>
      </div>

      <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ border: '1px solid var(--primary)' }}>
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: 'var(--primary)' }}>Next best step</p>
          <p className="text-lg" style={{ color: 'var(--fg)' }}>{step.title}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{step.body}</p>
        </div>
        <Link to={step.to} className="btn-primary flex-shrink-0 text-center">{step.cta} →</Link>
      </div>

      {latest && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Latest scan · {new Date(latest.timestamp).toLocaleDateString()}</p>
            <div className="flex items-end gap-4">
              <span className="font-display text-6xl leading-none" style={{ color: 'var(--fg)' }}>{latest.profile.overall_score}</span>
              <span className="text-xs pb-1" style={{ color: 'var(--muted)' }}>
                {[latest.profile.skin_type && `${latest.profile.skin_type} skin`, latest.profile.skin_age && `skin age ${latest.profile.skin_age}`].filter(Boolean).join(' · ')}
              </span>
            </div>
            {focus.length > 0 && (
              <div className="flex flex-col gap-2">
                {focus.map((a) => (
                  <p key={a.key} className="text-sm flex justify-between gap-3" style={{ color: 'var(--fg)' }}>
                    <span>{a.label}</span>
                    <span className="font-mono text-xs" style={{ color: STATUS_COLOR[a.status] }}>{a.score} · {STATUS_WORD[a.status]}</span>
                  </p>
                ))}
              </div>
            )}
            <Link to="/skin-analysis" className="text-xs underline self-start" style={{ color: 'var(--primary)' }}>Scan again →</Link>
          </div>

          <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
            <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Your routine</p>
            {routine.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Nothing on your shelf yet.</p>
            ) : (
              <>
                <p className="text-sm" style={{ color: 'var(--fg)' }}>{am} morning · {pm} evening products</p>
                {fit && <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{fit.headline}</p>}
              </>
            )}
            <Link to="/routine" className="text-xs underline self-start" style={{ color: 'var(--primary)' }}>{routine.length === 0 ? 'Build your routine' : 'Open routine'} →</Link>
          </div>
        </div>
      )}

      {progress && <ProgressCard progress={progress} />}

      {latest && isComparable(latest) && <PicksForYou key={version} mode="top" title="Picked for you" />}

      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ border: '1px dashed var(--rim)' }}>
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: 'var(--muted)' }}>Demo data</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {hasDemo
              ? 'Example scans and routine products are loaded and labelled "Demo". Your real data is untouched.'
              : 'Just exploring? Load two earlier example scans and a starter routine to see progress tracking, routine gaps and recommendations right away.'}
          </p>
        </div>
        <button onClick={() => toggleDemo(!hasDemo)} disabled={demoBusy} className="btn-outline flex-shrink-0">
          {demoBusy ? '…' : hasDemo ? 'Remove demo data' : 'Load demo data'}
        </button>
      </div>
    </section>
  )
}
