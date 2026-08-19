import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, saveProfile } from '../services/profile'
import { SKIN_TYPES, CONCERN_OPTIONS } from '../types'
import type { SkinType } from '../types'

export function Profile() {
  const navigate = useNavigate()
  const [skinType, setSkinType] = useState<SkinType | undefined>(undefined)
  const [concerns, setConcerns] = useState<string[]>([])
  const [sensitivities, setSensitivities] = useState<string[]>([])
  const [sensitivityInput, setSensitivityInput] = useState('')

  useEffect(() => {
    let cancelled = false
    getProfile().then((existing) => {
      if (cancelled || !existing) return
      setSkinType(existing.skin_type)
      setConcerns(existing.concerns)
      setSensitivities(existing.sensitivities)
    })
    return () => { cancelled = true }
  }, [])

  const toggleConcern = (c: string) => {
    setConcerns((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const addSensitivity = (e: React.FormEvent) => {
    e.preventDefault()
    const val = sensitivityInput.trim()
    if (val && !sensitivities.includes(val)) {
      setSensitivities((prev) => [...prev, val])
    }
    setSensitivityInput('')
  }

  const removeSensitivity = (s: string) => {
    setSensitivities((prev) => prev.filter((x) => x !== s))
  }

  const save = async () => {
    await saveProfile({ skin_type: skinType, concerns, sensitivities })
    navigate('/')
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-10">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Your profile</p>
        <h1 className="font-display text-5xl" style={{ color: 'var(--fg)' }}>Skin Profile</h1>
        <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
          This powers your personalized Fit Score — every product you scan or search gets scored against
          your skin type, concerns, and sensitivities, not just a generic formula.
        </p>
      </div>

      {/* Skin type */}
      <div className="card flex flex-col gap-4">
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Skin type</p>
        <div className="flex flex-wrap gap-2">
          {SKIN_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setSkinType(t.value)}
              className={`text-xs tracking-wide px-4 py-2 ${skinType === t.value ? 'btn-primary' : 'btn-ghost'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Concerns */}
      <div className="card flex flex-col gap-4">
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>Skin concerns</p>
        <div className="flex flex-wrap gap-2">
          {CONCERN_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => toggleConcern(c)}
              className={`text-xs tracking-wide px-4 py-2 capitalize ${concerns.includes(c) ? 'btn-primary' : 'btn-ghost'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Sensitivities */}
      <div className="card flex flex-col gap-4">
        <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>
          Ingredients you're sensitive to
        </p>
        <form onSubmit={addSensitivity} className="flex gap-3">
          <input
            type="text"
            value={sensitivityInput}
            onChange={(e) => setSensitivityInput(e.target.value)}
            placeholder="e.g. fragrance, essential oils"
            className="input flex-1"
          />
          <button type="submit" disabled={!sensitivityInput.trim()} className="btn-primary">Add</button>
        </form>
        {sensitivities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sensitivities.map((s) => (
              <span key={s} className="badge-neutral cursor-pointer" onClick={() => removeSensitivity(s)}>
                {s} ✕
              </span>
            ))}
          </div>
        )}
      </div>

      <button onClick={save} className="btn-primary self-start">Save Profile</button>
    </div>
  )
}
