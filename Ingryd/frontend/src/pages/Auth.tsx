import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

type Mode = 'login' | 'signup' | 'forgot'

export function Auth() {
  const navigate = useNavigate()
  const { signIn, signUp, sendPasswordReset } = useAuth()
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

    if (mode === 'forgot') {
      const result = await sendPasswordReset(email)
      setBusy(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setError('Check your email for a password reset link.')
      return
    }

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, name)

    setBusy(false)
    if (result.error) {
      setError(result.error)
      if (mode === 'signup' && /already exists/i.test(result.error)) {
        setMode('login')
      }
      return
    }

    if (mode === 'signup') {
      setError('Check your email to confirm your account, then log in.')
      setMode('login')
      return
    }

    navigate('/')
  }

  const isNotice = error && (error.startsWith('Check your email'))

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-8 pt-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>
          {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
        </p>
        <h1 className="font-display text-4xl" style={{ color: 'var(--fg)' }}>
          {mode === 'login' ? 'Log In' : mode === 'signup' ? 'Sign Up' : 'Forgot Password'}
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
        {mode !== 'forgot' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="input"
          />
        )}

        {error && (
          <p className="text-xs" style={{ color: isNotice ? 'var(--moss)' : '#b91c1c' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
        </button>
      </form>

      {mode === 'login' && (
        <button
          onClick={() => { setMode('forgot'); setError(null) }}
          className="text-xs text-center -mt-4"
          style={{ color: 'var(--muted)' }}
        >
          Forgot your password?
        </button>
      )}

      <button
        onClick={() => { setMode(mode === 'signup' ? 'login' : mode === 'forgot' ? 'login' : 'signup'); setError(null) }}
        className="text-sm text-center"
        style={{ color: 'var(--secondary)' }}
      >
        {mode === 'signup' ? 'Already have an account? Log in'
          : mode === 'forgot' ? 'Back to log in'
          : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}
