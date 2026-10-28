import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../services/AuthContext'
import { getMyPriceChoice, saveMyPriceChoice, type PriceChoice } from '../services/waitlist'

const FREE = [
  'Barcode and ingredient-list scoring for any product',
  'Product search and your routine shelf',
  'A face scan every week',
  'Fit Scores based on your latest scan',
]
const PLUS = [
  'More face scans (a daily scan, fair use)',
  'Scan history and progress tracking',
  'Routine check against your latest scan',
  'First access to new features',
]
const PRICES: { value: PriceChoice; label: string }[] = [
  { value: '3_99', label: '$3.99 a month' },
  { value: '5_99', label: '$5.99 a month' },
  { value: '9_99', label: '$9.99 a month' },
  { value: 'none', label: "I wouldn't pay for this" },
]

function Card({ title, price, note, items, accent }: { title: string; price: string; note: string; items: string[]; accent?: boolean }) {
  return (
    <div className="p-6 flex flex-col gap-4" style={{ border: `1px solid ${accent ? 'var(--primary)' : 'var(--rim)'}` }}>
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: accent ? 'var(--primary)' : 'var(--muted)' }}>{title}</p>
        <p className="font-display text-4xl mt-2" style={{ color: 'var(--fg)' }}>{price}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{note}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug" style={{ color: 'var(--fg)' }}>
            <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--moss)' }} /> {i}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Plans() {
  const { user } = useAuth()
  const [saved, setSaved] = useState<PriceChoice | null>(null)
  const [choice, setChoice] = useState<PriceChoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getMyPriceChoice().then((c) => { if (!cancelled && c) { setSaved(c); setChoice(c) } })
    return () => { cancelled = true }
  }, [user])

  const submit = async () => {
    if (!choice) return
    setBusy(true); setError(null)
    const ok = await saveMyPriceChoice(choice)
    setBusy(false)
    if (ok) setSaved(choice)
    else setError("We couldn't save that right now. Please try again in a minute.")
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Plans</p>
        <h1 className="font-display text-4xl sm:text-5xl" style={{ color: 'var(--fg)' }}>Free now. Plus later.</h1>
        <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
          Everything in Ingryd is free while we are in beta. This is where we are headed. Face scans cost us real money
          each time, so they are what we will limit on the free plan.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="Free" price="$0" note="Always free to start" items={FREE} />
        <Card title="Ingryd Plus" price="$5.99" note="a month, planned. Annual price to be set." items={PLUS} accent />
      </div>

      <div className="p-6 flex flex-col gap-3" style={{ border: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Our promise</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
          We will never take money from brands to rank their products. Scores come from the ingredients and your scan, nothing else.
          If we ever add retailer links that earn us a commission, we will say so, and it will not change a score.
        </p>
      </div>

      <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--primary)' }}>
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Help us price Plus</p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--fg)' }}>
            What would you pay for Plus? Pick a price to join the waitlist, or tell us it is not for you. Nothing is charged, and
            there is no payment on this page.
          </p>
        </div>

        {!user ? (
          <Link to="/auth" className="btn-primary self-start">Sign in to answer</Link>
        ) : (
          <>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="What you would pay a month">
              {PRICES.map((p) => {
                const on = choice === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setChoice(p.value)}
                    className="text-left px-4 py-3 text-sm rounded-md transition-colors"
                    style={{
                      border: `1px solid ${on ? 'var(--primary)' : 'var(--rim)'}`,
                      backgroundColor: on ? 'var(--surface)' : 'transparent',
                      color: 'var(--fg)',
                    }}
                  >
                    <span style={{ color: on ? 'var(--primary)' : 'var(--muted)' }}>{on ? '● ' : '○ '}</span>{p.label}
                  </button>
                )
              })}
            </div>
            <button onClick={submit} disabled={!choice || busy || choice === saved} className="btn-primary self-start">
              {busy ? 'Saving…' : choice === 'none' ? 'Send my answer' : 'Join the waitlist'}
            </button>
            {error && <p className="text-xs text-danger">{error}</p>}
            {saved && !error && (
              <p role="status" className="text-sm" style={{ color: 'var(--moss)' }}>
                {saved === 'none' ? 'Thanks, that is useful to know.' : "You're on the Plus waitlist. We will email you when it opens."} You can change your answer any time.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
