import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Ingryd crashed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto mt-24 p-10 text-center" style={{ border: '1px solid rgba(185,28,28,0.4)' }}>
          <p className="text-[10px] tracking-widest uppercase text-danger mb-3">Something went wrong</p>
          <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
            This page hit an unexpected error. Try going back or reloading.
          </p>
          <button onClick={() => window.location.assign('/')} className="btn-outline">
            Back to Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
