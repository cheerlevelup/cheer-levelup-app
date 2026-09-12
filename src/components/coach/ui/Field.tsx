'use client'

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="coach-field-grid">{children}</div>
}

export default function Field({
  label,
  full,
  className,
  children,
}: {
  label: string
  full?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`coach-field ${full ? 'coach-field-full' : ''} ${className || ''}`}>
      <label>{label}</label>
      {children}
    </div>
  )
}
