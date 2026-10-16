import { useState } from 'react'
import { Link } from 'react-router-dom'
import { applyScanToProfile } from '../../services/profile'
import type { SaveResult } from '../../services/profile'
import type { SkinProfile } from '../../types'

/** Turns a YouCam scan into the user's saved skin profile, so every Fit Score
 *  from here on is weighted by what the scan actually measured. */
export function ApplyToProfile({ scan }: { scan: SkinProfile }) {
  const [state, setState] = useState<'idle' | 'saving' | SaveResult>('idle')
  const [preview, setPreview] = useState<string | null>(null)

  if (scan.source !== 'youcam') return null

  const apply = async () => {
    setState('saving')
    const { result, applied } = await applyScanToProfile(scan)
    setPreview(describe(applied.skin_type, applied.concerns))
    setState(result)
  }

  const suggestion = describe(scan.suggested_skin_type ?? undefined, scan.suggested_concerns ?? [])

  return (
    <div className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--primary)' }}>
      <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Use this scan for your Fit Scores</p>

      {(state === 'idle' || state === 'saving' || state === 'error') && (
        <>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
            Save this scan to your skin profile{suggestion ? ` (${suggestion})` : ''}. Every product you scan or search will then
            be scored against how severe each concern actually is.
          </p>
          {state === 'error' && <p className="text-xs text-red-700">Could not save — please try again.</p>}
          <button onClick={apply} disabled={state === 'saving'} className="btn-primary self-start">
            {state === 'saving' ? 'Saving…' : 'Apply to my profile'}
          </button>
        </>
      )}

      {(state === 'saved' || state === 'saved_without_scan') && (
        <>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
            Saved{preview ? ` — ${preview}` : ''}.{' '}
            {state === 'saved_without_scan'
              ? 'Your skin type and concerns were saved, but scan severity needs a one-time database update before it can be used.'
              : 'Your Fit Scores now use this scan.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/search" className="btn-outline">Browse products</Link>
            <Link to="/profile" className="btn-ghost px-4 py-2 text-xs">Edit profile</Link>
          </div>
        </>
      )}

      {state === 'signed_out' && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Sign in to save this scan to your profile.</p>
      )}
    </div>
  )
}

function describe(skinType: string | undefined, concerns: string[]): string {
  const parts: string[] = []
  if (skinType) parts.push(`${skinType} skin`)
  if (concerns.length) parts.push(`concerns: ${concerns.join(', ')}`)
  return parts.join(' · ')
}
