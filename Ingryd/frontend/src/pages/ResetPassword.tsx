import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import { PasswordField } from '../components/auth/PasswordField'
import { checkPassword } from '../services/passwordRules'

export function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!checkPassword(password).valid) {
      setError('Please choose a password that meets every requirement in the checklist.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setBusy(true)
    const result = await updatePassword(password)
    setBusy(false)

    if (result.error) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto flex flex-col gap-6 pt-10 text-center">
        <p className="font-display text-3xl" style={{ color: 'var(--fg)' }}>Password updated</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>You can now log in with your new password.</p>
        <button onClick={() => navigate('/auth')} className="btn-primary">Go to Log In</button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-8 pt-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Almost done</p>
        <h1 className="font-display text-4xl" style={{ color: 'var(--fg)' }}>Set New Password</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordField value={password} onChange={setPassword} placeholder="New password" showRules autoComplete="new-password" />
        <PasswordField value={confirm} onChange={setConfirm} placeholder="Confirm new password" autoComplete="new-password" />
        {confirm.length > 0 && (
          <p className="text-xs" style={{ color: password === confirm ? 'var(--ok)' : 'var(--danger)' }}>
            {password === confirm ? '✓ Passwords match' : "Passwords don't match yet"}
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <button type="submit" disabled={busy || !checkPassword(password).valid || password !== confirm} className="btn-primary">
          {busy ? 'Please wait…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
