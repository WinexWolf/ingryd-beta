/** "Where to buy" links: plain retailer searches for the product. Not affiliate links, and they never affect a score. */
const RETAILERS: { label: string; url: (q: string) => string }[] = [
  { label: 'Google Shopping', url: (q) => `https://www.google.com/search?tbm=shop&q=${q}` },
  { label: 'Amazon', url: (q) => `https://www.amazon.com/s?k=${q}` },
  { label: 'Sephora', url: (q) => `https://www.sephora.com/search?keyword=${q}` },
]

export function BuyLinks({ brand, name }: { brand?: string | null; name?: string | null }) {
  if (!name) return null
  const q = encodeURIComponent([brand, name].filter(Boolean).join(' '))
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Where to buy</span>
      {RETAILERS.map((r) => (
        <a key={r.label} href={r.url(q)} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--primary)' }}>
          {r.label}
        </a>
      ))}
    </div>
  )
}
