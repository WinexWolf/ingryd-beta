import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../services/AuthContext'
import { authHeaders } from '../services/api'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

interface PendingProduct {
  id: string
  product_name: string | null
  brand: string | null
  category: string | null
  raw_text: string | null
  ingredients_parsed: string[]
  status: string
  created_at: string
}

export function AdminReview() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [items, setItems] = useState<PendingProduct[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [editedCategory, setEditedCategory] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('is_admin').eq('id', user.id).single().then(({ data }) => {
      setIsAdmin(!!data?.is_admin)
    })
  }, [user])

  useEffect(() => {
    if (!isAdmin) return
    loadPending()
  }, [isAdmin])

  const loadPending = async () => {
    const { data } = await supabase
      .from('pending_products')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setItems((data as PendingProduct[]) ?? [])
  }

  const approve = async (id: string) => {
    setBusy(id)
    // Category needs to be set to one of the valid CHECK-constraint values before approving.
    if (editedCategory[id]) {
      await supabase.from('pending_products').update({ category: editedCategory[id] }).eq('id', id)
    }
    await fetch(`${API_BASE}/ingredients/review/${id}/approve`, { method: 'POST', headers: await authHeaders() })
    await loadPending()
    setBusy(null)
  }

  const reject = async (id: string) => {
    setBusy(id)
    await fetch(`${API_BASE}/ingredients/review/${id}/reject`, { method: 'POST', headers: await authHeaders() })
    await loadPending()
    setBusy(null)
  }

  if (isAdmin === null) {
    return <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center" style={{ border: '1px solid var(--rim)' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>This page is only available to catalog reviewers.</p>
      </div>
    )
  }

  const CATEGORY_OPTIONS = ["cleanser", "exfoliant", "toner", "essence", "serum", "ampoule", "mask",
    "eye_cream", "moisturizer", "oil", "sunscreen", "mist", "spot_treatment", "uncategorized"]

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div className="pb-6" style={{ borderBottom: '1px solid var(--rim)' }}>
        <p className="text-[10px] tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--muted)' }}>Catalog review</p>
        <h1 className="font-display text-5xl" style={{ color: 'var(--fg)' }}>Pending Submissions</h1>
        <p className="text-sm mt-4" style={{ color: 'var(--muted)' }}>{items.length} awaiting review</p>
      </div>

      {items.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Nothing pending right now.</p>
      )}

      {items.map((item) => (
        <div key={item.id} className="p-6 flex flex-col gap-4" style={{ border: '1px solid var(--rim)' }}>
          <p className="font-display text-2xl" style={{ color: 'var(--fg)' }}>{item.product_name ?? 'Unnamed'}</p>
          <p className="text-xs" style={{ color: 'var(--secondary)' }}>{item.brand ?? 'No brand given'}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.ingredients_parsed.join(', ')}</p>

          <select
            className="input"
            value={editedCategory[item.id] ?? item.category ?? 'uncategorized'}
            onChange={(e) => setEditedCategory((prev) => ({ ...prev, [item.id]: e.target.value }))}
          >
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex gap-3">
            <button onClick={() => approve(item.id)} disabled={busy === item.id} className="btn-primary flex-1">
              Approve
            </button>
            <button onClick={() => reject(item.id)} disabled={busy === item.id} className="btn-outline flex-1">
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
