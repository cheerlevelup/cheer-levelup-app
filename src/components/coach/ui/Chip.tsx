'use client'

export default function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`coach-chip ${active ? 'coach-active' : ''}`} onClick={onClick}>
      {children}
    </div>
  )
}
