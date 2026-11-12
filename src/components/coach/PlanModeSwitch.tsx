'use client'
// src/components/coach/PlanModeSwitch.tsx
// Przełącznik „Edytor planu ↔ Wpisywanie wyników" dla planu grupy — w tym samym
// miejscu na obu ekranach, żeby w trakcie treningu skakać między nimi jednym kliknięciem.
// Ostatnio otwarty trening do wpisywania pamiętamy per plan (localStorage).

import Link from 'next/link'
import { PencilLine, ClipboardPen } from 'lucide-react'

const lastDayKey = (planId: number) => `cheer-plan-fill-day-${planId}`

export function rememberFillDay(planId: number, dayId: number) {
  try { localStorage.setItem(lastDayKey(planId), String(dayId)) } catch {}
}

export function lastFillDay(planId: number): number | null {
  try { const v = parseInt(localStorage.getItem(lastDayKey(planId)) || ''); return isNaN(v) ? null : v } catch { return null }
}

export const fillHref = (groupId: number, planId: number, dayId: number) => `/coach/groups/${groupId}/plan/${planId}/day/${dayId}`
export const editorHref = (groupId: number, planId: number, dayId?: number) => `/coach/groups/${groupId}/plan/${planId}${dayId ? `#day-${dayId}` : ''}`

export default function PlanModeSwitch({ mode, editorLink, fillLink }: {
  mode: 'editor' | 'fill'
  editorLink: string
  fillLink: string | null          // null — plan nie ma jeszcze treningów
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
    fontFamily: 'var(--font-inter),sans-serif', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
  }
  const on: React.CSSProperties = { ...base, background: 'var(--navy-900)', color: 'var(--gold)', boxShadow: '0 1px 3px rgba(13,27,42,.2)' }
  const off: React.CSSProperties = { ...base, background: 'transparent', color: 'var(--muted)' }
  return (
    <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 11, background: '#fff', border: '1.5px solid var(--border)', flexShrink: 0 }}>
      {mode === 'editor'
        ? <span style={on}><PencilLine size={14} /> Edytor planu</span>
        : <Link href={editorLink} style={off} title="Wróć do edytora planu (do tego treningu)"><PencilLine size={14} /> Edytor planu</Link>}
      {mode === 'fill'
        ? <span style={on}><ClipboardPen size={14} /> Wpisywanie wyników</span>
        : fillLink
          ? <Link href={fillLink} style={off} title="Wpisuj wyniki zawodniczek (ostatnio otwarty trening)"><ClipboardPen size={14} /> Wpisywanie wyników</Link>
          : <span style={{ ...off, opacity: 0.4 }} title="Dodaj najpierw trening"><ClipboardPen size={14} /> Wpisywanie wyników</span>}
    </div>
  )
}
