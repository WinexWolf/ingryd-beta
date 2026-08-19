interface Props {
  dark: boolean
  onToggle: () => void
}

export function ThemeToggle({ dark, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      className="flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-widest uppercase font-semibold transition-colors duration-150"
      style={{
        border: '1px solid var(--rim)',
        color: 'var(--muted)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--rim)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'
      }}
    >
      <span>{dark ? '◑' : '◐'}</span>
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
