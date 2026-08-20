import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex justify-center pt-24">
        <div
          className="w-8 h-8 border-2 animate-spin rounded-full"
          style={{ borderColor: 'var(--rim)', borderTopColor: 'var(--primary)' }}
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}
