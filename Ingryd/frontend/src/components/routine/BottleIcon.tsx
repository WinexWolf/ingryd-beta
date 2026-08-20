type BottleShape = 'dropper' | 'pump' | 'tube' | 'jar'

function shapeFor(name: string): BottleShape {
  const n = name.toLowerCase()
  if (/serum|essence|ampoule/.test(n)) return 'dropper'
  if (/spf|sunscreen|sun screen|uv/.test(n)) return 'tube'
  if (/cream|moistur|balm|butter/.test(n)) return 'jar'
  return 'pump'
}

interface Props {
  name: string
  color: string
  size?: number
}

export function BottleIcon({ name, color, size = 46 }: Props) {
  const shape = shapeFor(name)
  const h = size * 1.56

  if (shape === 'dropper') {
    return (
      <svg width={size} height={h} viewBox="0 0 46 72">
        <rect x="14" y="14" width="18" height="52" rx="5" fill={color} />
        <rect x="18" y="4" width="10" height="12" rx="3" fill="var(--ink)" />
        <circle cx="23" cy="4" r="4" fill="var(--ink)" />
      </svg>
    )
  }

  if (shape === 'tube') {
    return (
      <svg width={size} height={h} viewBox="0 0 46 72">
        <path d="M14 66 L14 22 Q14 10 23 10 Q32 10 32 22 L32 66 Z" fill={color} />
        <rect x="19" y="2" width="8" height="10" rx="2" fill="var(--ink)" />
      </svg>
    )
  }

  if (shape === 'jar') {
    return (
      <svg width={size} height={h} viewBox="0 0 46 72">
        <rect x="8" y="30" width="30" height="32" rx="8" fill={color} />
        <rect x="8" y="30" width="30" height="8" rx="4" fill="var(--ink)" />
      </svg>
    )
  }

  // pump — default
  return (
    <svg width={size} height={h} viewBox="0 0 46 72">
      <rect x="10" y="18" width="26" height="46" rx="6" fill={color} />
      <rect x="16" y="6" width="14" height="14" rx="3" fill="var(--ink)" />
      <rect x="18" y="2" width="10" height="6" rx="2" fill="var(--ink)" />
    </svg>
  )
}
