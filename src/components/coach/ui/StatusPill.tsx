'use client'
import { coachTheme } from '@/lib/coach-theme'

const TONES = {
  red: { bg: '#fdecec', fg: '#c23b3b' },
  amber: { bg: '#fdf1de', fg: '#c07f1e' },
  green: { bg: '#e3f8ee', fg: '#1f9d64' },
  muted: { bg: coachTheme.bg, fg: coachTheme.muted },
} as const

export default function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: keyof typeof TONES
}) {
  const c = TONES[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10.5,
        fontWeight: 700,
        fontFamily: 'var(--font-inter), sans-serif',
        padding: '3px 8px',
        borderRadius: 100,
        textTransform: 'uppercase',
        letterSpacing: '.03em',
        background: c.bg,
        color: c.fg,
      }}
    >
      {label}
    </span>
  )
}
