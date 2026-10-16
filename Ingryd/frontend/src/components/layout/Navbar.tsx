import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useTheme } from '../../hooks/useTheme'
import { hasProfile } from '../../services/profile'
import { useAuth } from '../../services/AuthContext'

const links = [
  { to: '/scan', label: 'Scan', active: true },
  { to: '/skin-analysis', label: 'Skin Analysis', active: true },
  { to: '/search', label: 'Products', active: true },
  { to: '/routine', label: 'Routine', active: true },
]

export function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const { user, signOut } = useAuth()
  const [profileSet, setProfileSet] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setProfileSet(false)
      return
    }
    hasProfile().then((result) => {
      if (!cancelled) setProfileSet(result)
    })
    return () => { cancelled = true }
  }, [user, pathname])

  const handleAuthClick = async () => {
    setMenuOpen(false)
    if (user) {
      await signOut()
      navigate('/')
    } else {
      navigate('/auth')
    }
  }

  return (
    <nav
      className="sticky top-0 z-50 transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--rim)' }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
          <span className="font-display text-2xl shimmer-text leading-none">ingryd</span>
          <span
            className="hidden sm:block text-[10px] tracking-[0.3em] uppercase font-sans mt-0.5"
            style={{ color: 'var(--muted)' }}
          >
            ingredient intel
          </span>
        </Link>

        {/* Desktop nav + toggle */}
        <div className="hidden sm:flex items-center gap-0">
          {links.map((link) => {
            const isActive = pathname === link.to || (link.to === '/scan' && pathname === '/scan-ingredients')
            return (
              <div key={link.to} className="relative">
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

          {user && (
            <Link
              to="/profile"
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-widest uppercase font-semibold rounded-full transition-colors duration-150"
              style={{
                border: `1px solid ${profileSet ? 'var(--primary)' : 'var(--rim)'}`,
                color: profileSet ? 'var(--primary)' : 'var(--muted)',
              }}
            >
              {profileSet ? 'My Profile' : 'Set Up Profile'}
            </Link>
          )}

          <button
            onClick={handleAuthClick}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-widest uppercase font-semibold rounded-full transition-colors duration-150"
            style={{ border: '1px solid var(--rim)', color: 'var(--muted)' }}
          >
            {user ? 'Log Out' : 'Log In'}
          </button>

          <div className="ml-4">
            <ThemeToggle dark={dark} onToggle={toggle} />
          </div>
        </div>

        {/* Mobile controls: theme toggle + hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          <ThemeToggle dark={dark} onToggle={toggle} />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="p-2 -mr-2"
            style={{ color: 'var(--fg)' }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <div
          className="sm:hidden flex flex-col"
          style={{ backgroundColor: 'var(--bg)', borderTop: '1px solid var(--rim)' }}
        >
          {links.map((link) => {
            const isActive = pathname === link.to || (link.to === '/scan' && pathname === '/scan-ingredients')
            return (
              <Link
                key={link.to}
                to={link.active ? link.to : '#'}
                onClick={(e) => {
                  if (!link.active) e.preventDefault()
                  else setMenuOpen(false)
                }}
                className="px-6 py-4 text-sm tracking-widest uppercase font-semibold"
                style={{
                  color: isActive ? 'var(--primary)' : link.active ? 'var(--fg)' : 'var(--muted)',
                  borderBottom: '1px solid var(--rim)',
                }}
              >
                {link.label}
              </Link>
            )
          })}
          {user && (
            <Link
              to="/profile"
              onClick={() => setMenuOpen(false)}
              className="px-6 py-4 text-sm tracking-widest uppercase font-semibold"
              style={{ color: profileSet ? 'var(--primary)' : 'var(--muted)' }}
            >
              {profileSet ? 'My Profile' : 'Set Up Profile'}
            </Link>
          )}
          <button
            onClick={handleAuthClick}
            className="px-6 py-4 text-sm tracking-widest uppercase font-semibold text-left"
            style={{ color: 'var(--muted)', borderTop: '1px solid var(--rim)' }}
          >
            {user ? 'Log Out' : 'Log In'}
          </button>
        </div>
      )}
    </nav>
  )
}
