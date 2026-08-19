import { Link, useLocation } from 'react-router-dom'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useTheme } from '../../hooks/useTheme'
import { hasProfile } from '../../services/profile'

const links = [
  { to: '/scan', label: 'Scan', active: true },
  { to: '/skin-analysis', label: 'Skin Analysis', active: true },
  { to: '/search', label: 'Products', active: true },
  { to: '/routine', label: 'Routine', active: true },
]

export function Navbar() {
  const { pathname } = useLocation()
  const { dark, toggle } = useTheme()
  const profileSet = hasProfile()

  return (
    <nav
      className="sticky top-0 z-50 transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--rim)' }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <span className="font-display text-2xl shimmer-text leading-none">ingryd</span>
          <span
            className="hidden sm:block text-[10px] tracking-[0.3em] uppercase font-sans mt-0.5"
            style={{ color: 'var(--muted)' }}
          >
            ingredient intel
          </span>
        </Link>

        {/* Nav + toggle */}
        <div className="flex items-center gap-0">
          {links.map((link) => {
            const isActive = pathname === link.to
            return (
              <div key={link.to} className="relative hidden sm:block">
                <Link
                  to={link.active ? link.to : '#'}
                  onClick={(e) => !link.active && e.preventDefault()}
                  className={[
                    'px-4 py-4 text-xs tracking-widest uppercase font-semibold transition-colors duration-150 block border-b-2',
                    isActive
                      ? 'border-[var(--primary)]'
                      : link.active
                      ? 'border-transparent hover:border-[var(--rim)]'
                      : 'border-transparent cursor-not-allowed opacity-30',
                  ].join(' ')}
                  style={{ color: isActive ? 'var(--primary)' : 'var(--fg)' }}
                >
                  {link.label}
                  {!link.active && (
                    <span className="ml-1 text-[9px]" style={{ color: 'var(--secondary)' }}>●</span>
                  )}
                </Link>
              </div>
            )
          })}

          <Link
            to="/profile"
            className="ml-2 hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-widest uppercase font-semibold rounded-full transition-colors duration-150"
            style={{
              border: `1px solid ${profileSet ? 'var(--primary)' : 'var(--rim)'}`,
              color: profileSet ? 'var(--primary)' : 'var(--muted)',
            }}
          >
            {profileSet ? 'My Profile' : 'Set Up Profile'}
          </Link>

          <div className="ml-4">
            <ThemeToggle dark={dark} onToggle={toggle} />
          </div>
        </div>
      </div>
    </nav>
  )
}
