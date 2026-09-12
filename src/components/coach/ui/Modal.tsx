'use client'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  sub?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

// Sama powłoka modala (overlay + box + nagłówek + stopka) — logika/formularz
// zostają w komponencie, który z niej korzysta (np. MoveToGroupModal).
export default function Modal({ open, onClose, title, eyebrow, sub, children, footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="coach-modal-overlay" onClick={onClose}>
      <div className="coach-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="coach-modal-head">
          {eyebrow && <div className="coach-eyebrow">{eyebrow}</div>}
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
          <button className="coach-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="coach-modal-body">{children}</div>
        {footer && <div className="coach-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
