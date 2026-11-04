'use client'
// src/app/coach/tests/TestCellNote.tsx
// Okienko przy komórce wyniku testu: „Brak testu” (np. nieobecność) + komentarz
// (np. kontuzja). Używane w tabeli Wyników (zapis od razu) i w Edytorze
// (zapis razem z wynikami). Pozycjonowane `fixed`, żeby nie ucinał go
// przewijany kontener tabeli.
import { useEffect, useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'

export type CellNote = { missing: boolean; comment: string }

const QUICK = ['nieobecna', 'kontuzja', 'choroba', 'zwolniona z ćwiczeń']

interface Props {
  note: CellNote
  hasValue: boolean
  title: string
  onSave: (note: CellNote) => void | Promise<void>
  disabled?: boolean
}

// przycisk-dymek w komórce; podświetlony, gdy jest brak albo komentarz
export default function TestCellNote({ note, hasValue, title, onSave, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const active = note.missing || !!note.comment

  function openPanel() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const width = 260
      const left = Math.min(Math.max(8, r.left - width / 2), window.innerWidth - width - 8)
      const top = r.bottom + 230 > window.innerHeight ? Math.max(8, r.top - 236) : r.bottom + 6
      setPos({ top, left })
    }
    setOpen(true)
  }

  const tip = note.missing
    ? `Brak testu${note.comment ? ` — ${note.comment}` : ''}`
    : note.comment || 'Brak testu / komentarz'

  return (
    <>
      <button
        ref={btnRef}
        type="button" tabIndex={-1}
        className={`coach-rt-note-btn${active ? ' coach-on' : ''}`}
        title={tip}
        disabled={disabled}
        onClick={openPanel}
      >
        <MessageSquare size={11} />
      </button>
      {open && (
        <NotePanel
          note={note}
          hasValue={hasValue}
          title={title}
          top={pos.top}
          left={pos.left}
          onClose={() => setOpen(false)}
          onSave={async n => { await onSave(n); setOpen(false) }}
        />
      )}
    </>
  )
}

function NotePanel({ note, hasValue, title, top, left, onClose, onSave }: {
  note: CellNote; hasValue: boolean; title: string; top: number; left: number
  onClose: () => void; onSave: (n: CellNote) => void | Promise<void>
}) {
  const [missing, setMissing] = useState(note.missing)
  const [comment, setComment] = useState(note.comment)
  const [saving, setSaving] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { taRef.current?.focus() }, [])

  async function save() {
    setSaving(true)
    await onSave({ missing, comment: comment.trim() })
    setSaving(false)
  }

  return (
    <>
      <div className="coach-note-backdrop" onMouseDown={onClose} />
      <div
        className="coach-note-panel"
        style={{ top, left }}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
        }}
      >
        <div className="coach-note-title">{title}</div>
        <label className={`coach-note-missing${missing ? ' coach-on' : ''}`}>
          <input type="checkbox" checked={missing} onChange={e => setMissing(e.target.checked)} />
          Brak testu (nie wykonała)
        </label>
        {missing && hasValue && <div className="coach-note-warn">Wpisany wynik zostanie usunięty.</div>}
        <textarea
          ref={taRef}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Komentarz, np. kontuzja kostki"
          rows={2}
        />
        <div className="coach-note-quick">
          {QUICK.map(q => (
            <button key={q} type="button" onClick={() => setComment(c => (c ? `${c}, ${q}` : q))}>{q}</button>
          ))}
        </div>
        <div className="coach-note-actions">
          {(note.missing || note.comment) && (
            <button type="button" className="coach-note-clear" onClick={() => onSave({ missing: false, comment: '' })}>Wyczyść</button>
          )}
          <button type="button" className="coach-btn coach-btn-ghost coach-btn-small" onClick={onClose}>Anuluj</button>
          <button type="button" className="coach-btn coach-btn-gold coach-btn-small" onClick={save} disabled={saving}>{saving ? '…' : 'OK'}</button>
        </div>
      </div>
    </>
  )
}
