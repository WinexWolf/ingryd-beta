import type { ConcernArea } from '../../types'

export const STATUS_COLOR: Record<ConcernArea['status'], string> = {
  attention: '#b91c1c',
  watch: '#a16207',
  good: 'var(--moss)',
}

export const STATUS_WORD: Record<ConcernArea['status'], string> = {
  attention: 'Needs attention',
  watch: 'Keep an eye on',
  good: 'Healthy',
}
