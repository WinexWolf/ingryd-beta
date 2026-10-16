import { Link } from 'react-router-dom'

/** Where to go after a scan, so the result is a starting point rather than a dead end. */
export function NextSteps() {
  const steps = [
    { to: '/search', title: 'Find products that suit you', body: 'Browse the catalog ranked by your Fit Score.' },
    { to: '/routine', title: 'Check your routine', body: 'See whether what you use now matches this scan.' },
    { to: '/scan', title: 'Scan a product', body: 'Point your camera at a barcode and get your score.' },
  ]
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>What to do next</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <Link key={s.to} to={s.to} className="p-4 flex flex-col gap-1" style={{ border: '1px solid var(--rim)' }}>
            <span className="text-sm" style={{ color: 'var(--fg)' }}>{s.title} →</span>
            <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{s.body}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
