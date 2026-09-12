'use client'

interface CardProps {
  title?: string
  sub?: string
  headerAction?: React.ReactNode
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function Card({ title, sub, headerAction, children, className, style }: CardProps) {
  return (
    <div className={`coach-panel ${className || ''}`} style={style}>
      {(title || headerAction) && (
        <div className="coach-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="coach-sub">{sub}</div>}
          </div>
          {headerAction}
        </div>
      )}
      {children}
    </div>
  )
}
