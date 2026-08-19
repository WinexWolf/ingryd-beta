import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getScanHistory, getSkinHistory } from '../services/history'
import { hasProfile } from '../services/profile'
import type { ScanHistoryEntry, SkinHistoryEntry } from '../services/history'
import type { GradeKey } from '../types'
import { GRADE_CONFIG } from '../types'

const features = [
  {
    num: '01', icon: '▣',
    title: 'Scan a Product',
    description: "Scan any barcode and instantly see what's good, bad, or harmful in the ingredient list.",
    to: '/scan', active: true,
  },
  {
    num: '02', icon: '◈',
    title: 'Skin Analysis',
    description: 'Photograph your skin for a breakdown of hydration, oiliness, redness, and texture — tracked over time.',
    to: '/skin-analysis', active: true,
  },
  {
    num: '03', icon: '◎',
    title: 'Search Products',
    description: 'Browse thousands of beauty products and filter by ingredient safety score.',
    to: '/search', active: true,
  },
  {
    num: '04', icon: '◧',
    title: 'My Routine',
    description: "Build your AM and PM routines. We'll flag conflicts and tell you what not to mix.",
    to: '/routine', active: true,
  },
]

const scoreSteps = [
  { label: '85–100', grade: 'Excellent', desc: 'Clean formula, rich in beneficial actives.',       color: 'moss' },
  { label: '70–84',  grade: 'Good',      desc: 'Minor concerns, mostly safe for regular use.',     color: 'chalk' },
  { label: '50–69',  grade: 'Fair',      desc: 'Notable concerns — use with awareness.',           color: 'amber' },
  { label: '30–49',  grade: 'Poor',      desc: 'Multiple problematic ingredients flagged.',        color: 'orange' },
  { label: '0–29',   grade: 'Avoid',     desc: 'High-concern ingredients detected.',              color: 'red' },
]

const gradeColors: Record<string, { text: string; border: string; bg: string }> = {
  moss:   { text: 'text-moss',       border: 'border-moss',       bg: 'bg-moss/10' },
  chalk:  { text: 'text-ink/70',     border: 'border-chalk',      bg: 'bg-chalk/20' },
  amber:  { text: 'text-amber-700',  border: 'border-amber-300',  bg: 'bg-amber-50' },
  orange: { text: 'text-orange-700', border: 'border-orange-300', bg: 'bg-orange-50' },
  red:    { text: 'text-red-700',    border: 'border-red-300',    bg: 'bg-red-50' },
}

export function Home() {
  const [scans, setScans] = useState<ScanHistoryEntry[]>([])
  const [skinHistory, setSkinHistory] = useState<SkinHistoryEntry[]>([])

  useEffect(() => {
    setScans(getScanHistory())
    setSkinHistory(getSkinHistory())
  }, [])

  const hasActivity = scans.length > 0 || skinHistory.length > 0
  const latestSkin = skinHistory[0]
  const profileSet = hasProfile()

  return (
    <div className="flex flex-col gap-24">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="pt-8 pb-4">
        <p className="text-[10px] tracking-[0.4em] uppercase mb-6 font-sans" style={{ color: 'var(--muted)' }}>
          Skincare intelligence platform
        </p>

        {/* Accent bar using secondary color */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1" style={{ backgroundColor: 'var(--secondary)', opacity: 0.4 }} />
          <span className="text-[10px] tracking-widest uppercase font-semibold" style={{ color: 'var(--secondary)' }}>
            ingredient intel
          </span>
          <div className="h-px w-8" style={{ backgroundColor: 'var(--secondary)', opacity: 0.4 }} />
        </div>

        <h1 className="font-display text-7xl sm:text-8xl lg:text-9xl leading-[0.92] mb-8" style={{ color: 'var(--fg)' }}>
          Know what's
          <br />
          <span className="shimmer-text">on your skin.</span>
        </h1>
        <p className="text-lg max-w-lg leading-relaxed mb-10 font-sans" style={{ color: 'var(--muted)' }}>
          Ingryd decodes the fine print on your skincare and beauty products, and tracks your skin health over time —
          so you always know exactly what you're applying and how it's working.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link to="/scan" className="btn-primary">Scan a Product</Link>
          <Link to="/skin-analysis" className="btn-outline">Check My Skin</Link>
        </div>

        {/* Stats — alternate primary / secondary */}
        <div className="mt-16 pt-8 grid grid-cols-3 gap-0 max-w-lg" style={{ borderTop: '1px solid var(--rim)' }}>
          {[
            { val: '50K+', label: 'Ingredients tracked', accent: 'primary' },
            { val: '3M+',  label: 'Products in database', accent: 'secondary' },
            { val: '100',  label: 'Point scoring scale', accent: 'primary' },
          ].map((s, i) => (
            <div
              key={i}
              className={`pr-8 ${i > 0 ? 'pl-8' : ''}`}
              style={i > 0 ? { borderLeft: '1px solid var(--rim)' } : {}}
            >
              <p className="font-display text-3xl" style={{ color: `var(--${s.accent})` }}>{s.val}</p>
              <p className="text-[10px] tracking-widest uppercase mt-1" style={{ color: 'var(--muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Profile prompt ────────────────────────────────────── */}
      {!profileSet && (
        <section
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-lg"
          style={{ border: '1px solid var(--secondary)', backgroundColor: 'rgba(226,89,111,0.06)' }}
        >
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--fg)' }}>Get your personalized Fit Score</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Set up your skin type, concerns, and sensitivities — every scan gets scored just for you.
            </p>
          </div>
          <Link to="/profile" className="btn-secondary flex-shrink-0">Set Up Profile</Link>
        </section>
      )}

      {/* ── Your skin health tracker ─────────────────────────── */}
      {hasActivity && (
        <section>
          <div className="flex items-end justify-between mb-8 pb-4" style={{ borderBottom: '1px solid var(--rim)' }}>
            <h2 className="font-display text-4xl" style={{ color: 'var(--fg)' }}>Your Skin Tracker</h2>
            <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
              {scans.length} scans · {skinHistory.length} skin checks
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0" style={{ border: '1px solid var(--rim)' }}>
            {/* Latest skin score */}
            <div className="p-6 flex flex-col gap-4" style={{ borderBottom: '1px solid var(--rim)' }}>
              <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Latest skin score</p>
              {latestSkin ? (
                <div className="flex items-end gap-4">
                  <span className="font-display text-5xl" style={{ color: 'var(--fg)' }}>{latestSkin.profile.overall_score}</span>
                  <span className="text-xs pb-2" style={{ color: 'var(--muted)' }}>
                    {new Date(latestSkin.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <Link to="/skin-analysis" className="text-sm underline" style={{ color: 'var(--secondary)' }}>
                  Run your first skin analysis →
                </Link>
              )}
            </div>
            {/* Recent scans */}
            <div className="p-6 flex flex-col gap-4 sm:border-l" style={{ borderBottom: '1px solid var(--rim)', borderColor: 'var(--rim)' }}>
              <p className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Recently scanned</p>
              {scans.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {scans.slice(0, 3).map((s) => {
                    const grade = (s.product.score?.fit_grade ?? s.product.score?.grade) as GradeKey | undefined
                    const displayScore = s.product.score?.fit_score ?? s.product.score?.score
                    const config = grade ? GRADE_CONFIG[grade] : null
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm truncate" style={{ color: 'var(--fg)' }}>
                          {s.product.name ?? 'Unnamed product'}
                        </span>
                        {config && (
                          <span className={`text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 border flex-shrink-0 rounded-full ${config.color} ${config.bg}`}>
                            {displayScore}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <Link to="/scan" className="text-sm underline" style={{ color: 'var(--secondary)' }}>
                  Scan your first product →
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Color palette strip ────────────────────────────── */}
      <section className="grid grid-cols-4 h-2 rounded-full overflow-hidden">
        <div style={{ backgroundColor: '#241F17' }} />
        <div style={{ backgroundColor: '#E2596F' }} />
        <div style={{ backgroundColor: '#6F8F4C' }} />
        <div style={{ backgroundColor: '#D9D2BE' }} />
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="scroll-mt-16">
        <div className="flex items-end justify-between mb-8 pb-4" style={{ borderBottom: '1px solid var(--rim)' }}>
          <h2 className="font-display text-4xl" style={{ color: 'var(--fg)' }}>Features</h2>
          <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>4 modules</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '1px', backgroundColor: 'var(--rim)' }}>
          {features.map((f, idx) => (
            <div
              key={f.num}
              className="flex flex-col gap-6 p-8 transition-colors duration-200"
              style={{ backgroundColor: 'var(--bg)', opacity: f.active ? 1 : 0.5 }}
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] tracking-[0.3em] uppercase font-sans" style={{ color: 'var(--muted)' }}>
                  {f.num}
                </span>
                {f.active ? (
                  <span
                    className="text-[10px] tracking-widest uppercase px-2 py-0.5 font-semibold"
                    style={{ color: 'var(--moss)', border: '1px solid var(--moss)' }}
                  >
                    Live
                  </span>
                ) : (
                  <span
                    className="text-[10px] tracking-widest uppercase px-2 py-0.5"
                    style={{ color: 'var(--muted)', border: '1px solid var(--rim)' }}
                  >
                    Soon
                  </span>
                )}
              </div>
              <div>
                <p className="text-xl mb-3 font-sans" style={{ color: 'var(--muted)' }}>{f.icon}</p>
                <h3 className="font-display text-2xl mb-2" style={{ color: 'var(--fg)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{f.description}</p>
              </div>
              {f.active ? (
                <Link to={f.to} className="btn-primary self-start mt-auto">Open →</Link>
              ) : (
                <span className="text-[10px] tracking-widest uppercase mt-auto" style={{ color: 'var(--muted)' }}>
                  Coming soon
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── How we score ─────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-8 pb-4" style={{ borderBottom: '1px solid var(--rim)' }}>
          <h2 className="font-display text-4xl" style={{ color: 'var(--fg)' }}>How we score</h2>
          <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>0 – 100 scale</span>
        </div>

        {/* Steps — alternate primary/secondary border */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
          {[
            { step: '01', title: 'Detect', accent: 'primary',
              body: 'Every ingredient is cross-referenced against a database of carcinogens, hormone disruptors, irritants, and beneficial actives.' },
            { step: '02', title: 'Weigh', accent: 'secondary',
              body: 'High-concern ingredients score −15 each (max −45). Moderate concerns −8 (max −24). Beneficial actives add up to +30 bonus.' },
            { step: '03', title: 'Grade', accent: 'primary',
              body: 'The final score (0–100) produces a grade from Excellent to Avoid — visible at a glance on every product result.' },
          ].map((s) => (
            <div key={s.step} className="pl-6" style={{ borderLeft: `2px solid var(--${s.accent})` }}>
              <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: `var(--${s.accent})` }}>
                {s.step}
              </p>
              <h3 className="font-display text-2xl mb-3" style={{ color: 'var(--fg)' }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{s.body}</p>
            </div>
          ))}
        </div>

        {/* Grade scale table */}
        <div style={{ border: '1px solid var(--rim)' }}>
          {scoreSteps.map((s, i) => {
            const c = gradeColors[s.color]
            return (
              <div
                key={s.grade}
                className={`flex items-center justify-between px-6 py-4 ${c.bg}`}
                style={i < scoreSteps.length - 1 ? { borderBottom: '1px solid var(--rim)' } : {}}
              >
                <div className="flex items-center gap-6">
                  <span className={`text-xs font-semibold tracking-widest uppercase px-3 py-1 border ${c.text} ${c.border}`}>
                    {s.grade}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{s.desc}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{s.label}</span>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
