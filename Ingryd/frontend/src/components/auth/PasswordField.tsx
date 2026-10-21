import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { checkPassword } from '../../services/passwordRules'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Show the live requirements checklist (sign-up and reset only; never on log-in). */
  showRules?: boolean
  autoComplete?: string
}

/** Password input with a show/hide toggle and, optionally, a checklist that ticks off as the rules are met. */
export function PasswordField({ value, onChange, placeholder = 'Password', showRules = false, autoComplete }: Props) {
  const [visible, setVisible] = useState(false)
  const [touched, setTouched] = useState(false)
  const rulesId = useId()
  const { results, valid, passed } = checkPassword(value)
  const open = showRules && (touched || value.length > 0)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setTouched(true)}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          aria-describedby={showRules ? rulesId : undefined}
          className="input pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-0 top-0 h-full px-4"
          style={{ color: 'var(--muted)' }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {showRules && (
        <div id={rulesId} aria-live="polite" className="text-xs" style={{ color: 'var(--muted)' }}>
          {!open ? (
            <p>Use 8+ characters with upper and lower case, a number and a symbol.</p>
          ) : (
            <div className="p-3 flex flex-col gap-1.5" style={{ border: '1px solid var(--rim)', backgroundColor: 'var(--surface)' }}>
              <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: valid ? 'var(--ok)' : 'var(--muted)' }}>
                {valid ? '✓ Password meets all requirements' : `Your password needs · ${passed} of ${results.length} done`}
              </p>
              {results.map((r) => (
                <p key={r.id} className="flex items-center gap-2" style={{ color: r.ok ? 'var(--ok)' : 'var(--fg)' }}>
                  <span aria-hidden className="w-4 text-center font-semibold">{r.ok ? '✓' : '○'}</span>
                  <span>{r.label}<span className="sr-only">{r.ok ? ' — met' : ' — not met yet'}</span></span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
