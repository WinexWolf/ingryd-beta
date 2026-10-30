import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRoutine } from '../../services/history'

/** After a scan: add the products you already use, and Ingryd checks them against it. */
export function UseWhatYouHave() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getRoutine().then((r) => { if (!cancelled) setCount(r.length) }).catch(() => { if (!cancelled) setCount(0) })
    return () => { cancelled = true }
  }, [])

  if (count === null) return null
  const has = count > 0
  return (
    <div className="p-5 flex flex-col gap-3" style={{ border: '1px solid var(--rim)' }}>
      <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>
        {has ? 'Your routine' : 'Already using products?'}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
        {has
          ? `You have ${count} product${count === 1 ? '' : 's'} in your routine. Check them against this scan to see what is working, what may not help, and which ones double up.`
          : 'Add the products you already use. We will check each one against this scan: what is working for you, what may not help, and what you could skip.'}
      </p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>Tap "Apply to my profile" first so the check uses this scan.</p>
      <Link to="/routine" className="btn-primary self-start">{has ? 'Check my routine' : 'Add my products'}</Link>
    </div>
  )
}
