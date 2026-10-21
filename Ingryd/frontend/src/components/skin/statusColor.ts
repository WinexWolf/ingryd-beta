import type { ConcernArea } from '../../types'

export const STATUS_COLOR: Record<ConcernArea['status'], string> = {
  attention: 'var(--danger)',
  watch: 'var(--warn)',
  good: 'var(--moss)',
}

export const STATUS_WORD: Record<ConcernArea['status'], string> = {
  attention: 'Needs attention',
  watch: 'Keep an eye on',
  good: 'Healthy',
}
