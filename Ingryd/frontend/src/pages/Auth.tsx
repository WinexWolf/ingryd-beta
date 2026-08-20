import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

type Mode = 'login' | 'signup'

export function Auth() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, name)

    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === 'signup') {
      setError('Check your email to confirm your account, then log in.')
      setMode('login')
      return
    }

    navigate('/')
  }

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-8 pt-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </p>
        <h1 className="font-display text-4xl" style={{ color: 'var(--fg)' }}>
          {mode === 'login' ? 'Log In' : 'Sign Up'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            className="input"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          className="input"
        />

        {error && (
          <p className="text-xs" style={{ color: error.startsWith('Check your email') ? 'var(--moss)' : '#b91c1c' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
        className="text-sm text-center"
        style={{ color: 'var(--secondary)' }}
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </div>
  )
}
