import { useEffect, useId, useRef, useState } from 'react'
import { suggestProducts, type ProductSuggestion } from '../../services/api'

interface Props {
  value: string
  onChange: (v: string) => void
  /** Called when a suggestion is chosen (click, tap or Enter on a highlighted row). */
  onPick: (s: ProductSuggestion) => void
  placeholder?: string
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<strong style={{ color: 'var(--primary)' }}>{text.slice(i, i + q.length)}</strong>{text.slice(i + q.length)}</>
}

/** Text input with a live suggestion list (debounced, keyboard and touch friendly). */
export function SearchBox({ value, onChange, onPick, placeholder }: Props) {
  const [items, setItems] = useState<ProductSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const justPicked = useRef(false)
  const listId = useId()
  const q = value.trim()

  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return }
    if (q.length < 2) { setItems([]); setOpen(false); setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await suggestProducts(q, ctrl.signal)
      if (ctrl.signal.aborted) return
      setItems(res)
      setActive(-1)
      setOpen(true)
      setLoading(false)
    }, 200)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close) }
  }, [])

  const pick = (s: ProductSuggestion) => {
    const label = [s.brand, s.name].filter(Boolean).join(' ')
    // Skip the next suggestion lookup only if the text will actually change (otherwise the effect never runs).
    justPicked.current = label.trim() !== value.trim()
    setOpen(false)
    setItems([])
    onChange(label)   // show what was chosen in the box
    onPick(s)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || items.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        enterKeyHint="search"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-40 max-h-72 overflow-y-auto shadow-lg"
          style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}
        >
          {items.length === 0 && !loading && (
            <li className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>No matches yet. Press Search to look wider.</li>
          )}
          {items.map((s, i) => (
            <li
              key={`${s.barcode}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(s) }}
              onMouseEnter={() => setActive(i)}
              className="px-4 py-2.5 cursor-pointer"
              style={{ backgroundColor: i === active ? 'var(--bg)' : 'transparent', borderBottom: '1px solid var(--rim)' }}
            >
              {s.brand && <p className="text-[9px] tracking-widest uppercase truncate" style={{ color: 'var(--secondary)' }}>{s.brand}</p>}
              <p className="text-sm break-words" style={{ color: 'var(--fg)' }}><Highlight text={s.name} q={q} /></p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
