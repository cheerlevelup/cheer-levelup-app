'use client'

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  tone?: 'amber' | 'blue' | 'green'
}

export default function StatCard({ label, value, icon, tone = 'amber' }: StatCardProps) {
  return (
    <div className="coach-stat-card">
      {icon && <div className={`coach-stat-icon coach-${tone}`}>{icon}</div>}
      <div className="coach-stat-body">
        <div className="coach-num">{value}</div>
        <div className="coach-stat-label">{label}</div>
      </div>
    </div>
  )
}
