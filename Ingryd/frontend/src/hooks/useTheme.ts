import { useState, useEffect } from 'react'

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('ingryd-theme')
    return saved ? saved === 'dark' : true // default dark
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('ingryd-theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}
