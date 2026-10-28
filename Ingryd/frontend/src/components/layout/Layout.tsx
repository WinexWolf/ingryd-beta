import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from './Navbar'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200" style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}>
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
        {children}
      </main>
      <footer style={{ borderTop: '1px solid var(--rim)' }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="flex items-center gap-4">
            <span className="font-display text-lg shimmer-text">ingryd</span>
            <Link to="/plans" className="text-xs tracking-widest uppercase underline hover:opacity-80" style={{ color: 'var(--muted)' }}>Plans</Link>
          </span>
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
            Ingredient data via{' '}
            <a
              href="https://world.openbeautyfacts.org"
              target="_blank"
              rel="noreferrer"
              className="underline hover:opacity-80 transition-opacity"
            >
              Open Beauty Facts
            </a>
            {' '}and community contributions
          </span>
        </div>
      </footer>
    </div>
  )
}
