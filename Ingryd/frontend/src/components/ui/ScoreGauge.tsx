import type { GradeKey } from '../../types'
import { GRADE_CONFIG } from '../../types'

interface Props {
  score: number
  grade: GradeKey
  fitScore?: number
  fitGrade?: GradeKey
}

export function ScoreGauge({ score, grade, fitScore, fitGrade }: Props) {
  const personalized = fitScore !== undefined && fitGrade !== undefined
  const displayScore = personalized ? fitScore! : score
  const displayGrade = personalized ? fitGrade! : grade
  const config = GRADE_CONFIG[displayGrade]
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayScore / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--rim)" strokeWidth="6" />
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={config.ring}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-ring"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl leading-none" style={{ color: 'var(--fg)' }}>{displayScore}</span>
          <span className="text-[10px] tracking-widest uppercase mt-1" style={{ color: 'var(--muted)' }}>
            {personalized ? 'Fit Score' : 'Score'}
          </span>
        </div>
      </div>
      <span className={`text-xs font-semibold tracking-widest uppercase px-4 py-1.5 border ${config.color} ${config.bg}`}>
        {config.label}
      </span>
      {personalized && score !== fitScore && (
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Generic score: {score}</span>
      )}
    </div>
  )
}
