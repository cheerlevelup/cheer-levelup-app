'use client'
// src/app/coach/exercises/ExerciseCatalogClient.tsx
// Katalog ćwiczeń — wyszukiwarka, dodawanie, edycja i usuwanie ćwiczeń z linkami.
// Ćwiczenie dodane do treningu/planu pod tą samą nazwą dostaje link automatycznie.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Pencil, Plus, Search, Trash2, Check, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { SetPageMeta } from '@/components/coach/PageMetaContext'
import { Button, Card, Field } from '@/components/coach/ui'

type Item = { id: number; name: string; link_url: string | null; trainingUses: number; planUses: number }

function normalizeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
}
function cleanName(s: string) { return s.trim().replace(/\s+/g, ' ') }
function fold(s: string) {
  return s.toLocaleLowerCase('pl').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
}
function sortPl(list: Item[]) { return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })) }
function linkLabel(url: string) {
  try { const u = new URL(url); return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname : '') } catch { return url }
}

const inputStyle: React.CSSProperties = { width: '100%' }

export default function ExerciseCatalogClient({ initialItems, missingTable }: { initialItems: Item[]; missingTable: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>(() => sortPl(initialItems))
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [newLink, setNewLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(missingTable ? 'Aby korzystać z katalogu ćwiczeń, uruchom migrację 202611060001 w Supabase.' : '')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editLink, setEditLink] = useState('')

  const filtered = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return items
    return items.filter(it => fold(it.name).includes(q) || (it.link_url && fold(it.link_url).includes(q)))
  }, [items, query])

  function isDuplicate(name: string, exceptId?: number) {
    const k = fold(name)
    return items.some(it => it.id !== exceptId && fold(it.name) === k)
  }

  function explain(msg: string) {
    if (/duplicate key|unique/i.test(msg)) return 'Takie ćwiczenie już jest w katalogu.'
    if (/exercise_catalog/.test(msg)) return 'Aby korzystać z katalogu ćwiczeń, uruchom migrację 202611060001 w Supabase.'
    return msg
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = cleanName(newName)
    if (!name) return
    if (isDuplicate(name)) { setError(`„${name}” już jest w katalogu.`); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('exercise_catalog')
      .insert({ name, link_url: normalizeUrl(newLink) })
      .select('id, name, link_url')
      .single()
    setSaving(false)
    if (err || !data) { setError(explain(err?.message || 'Nie udało się dodać ćwiczenia.')); return }
    setItems(prev => sortPl([...prev, { ...(data as any), trainingUses: 0, planUses: 0 }]))
    setNewName('')
    setNewLink('')
    router.refresh() // przelicz liczbę użyć dla nowej nazwy
  }

  function startEdit(it: Item) {
    setEditId(it.id)
    setEditName(it.name)
    setEditLink(it.link_url || '')
  }

  async function saveEdit(it: Item) {
    const name = cleanName(editName)
    if (!name) return
    if (isDuplicate(name, it.id)) { setError(`„${name}” już jest w katalogu.`); return }
    const link_url = normalizeUrl(editLink)
    setError('')
    const { error: err } = await supabase.from('exercise_catalog').update({ name, link_url }).eq('id', it.id)
    if (err) { setError(explain(err.message)); return }
    setItems(prev => sortPl(prev.map(x => x.id === it.id ? { ...x, name, link_url } : x)))
    setEditId(null)
    if (name !== it.name) router.refresh()
  }

  async function handleDelete(it: Item) {
    if (!confirm(`Usunąć „${it.name}” z katalogu? Ćwiczenia w treningach i planach zostaną bez zmian.`)) return
    const { error: err } = await supabase.from('exercise_catalog').delete().eq('id', it.id)
    if (err) { setError(explain(err.message)); return }
    setItems(prev => prev.filter(x => x.id !== it.id))
  }

  return (
    <>
      <SetPageMeta title="Katalog ćwiczeń" />
      <div className="coach-content">
        <Card style={{ padding: 16 }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
            <Field label="Nazwa ćwiczenia">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="np. Bulgarian split squat" style={inputStyle} />
            </Field>
            <Field label="Link do filmiku">
              <input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://youtube.com/..." style={inputStyle} />
            </Field>
            <div>
              <Button type="submit" variant="gold" disabled={saving || !cleanName(newName)} style={{ width: '100%', justifyContent: 'center', height: 40 }}>
                <Plus size={14} /> Dodaj do katalogu
              </Button>
            </div>
          </form>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Gdy dodasz do treningu lub planu ćwiczenie o tej samej nazwie, link do filmiku doda się automatycznie.
          </div>
        </Card>

        {error && (
          <div style={{ margin: '12px 0', padding: '10px 12px', borderRadius: 10, background: '#fdecec', color: '#a12b2b', fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ position: 'relative', margin: '14px 0 10px' }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-light)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Szukaj ćwiczenia…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 14, outline: 'none' }}
          />
        </div>

        <Card style={{ padding: '8px 16px' }}>
          {filtered.length === 0 ? (
            <div className="coach-empty-list">{items.length === 0 ? 'Katalog jest pusty — dodaj pierwsze ćwiczenie powyżej.' : 'Brak ćwiczeń pasujących do wyszukiwania.'}</div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 10, padding: '4px 4px 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: '1 1 40%' }}>Ćwiczenie</span>
                <span style={{ flex: '1 1 40%' }}>Filmik</span>
                <span style={{ width: 70, textAlign: 'center' }}>Użycia</span>
                <span style={{ width: 64 }} />
              </div>
              {filtered.map(it => {
                const total = it.trainingUses + it.planUses
                const editing = editId === it.id
                return (
                  <div key={it.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
                    {editing ? (
                      <>
                        <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(it); if (e.key === 'Escape') setEditId(null) }}
                          style={{ flex: '1 1 40%', minWidth: 140, padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--gold)', fontSize: 13 }} />
                        <input value={editLink} onChange={e => setEditLink(e.target.value)} placeholder="link do filmiku" onKeyDown={e => { if (e.key === 'Enter') saveEdit(it); if (e.key === 'Escape') setEditId(null) }}
                          style={{ flex: '1 1 40%', minWidth: 140, padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13 }} />
                      </>
                    ) : (
                      <>
                        <span style={{ flex: '1 1 40%', minWidth: 140, fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{it.name}</span>
                        <span style={{ flex: '1 1 40%', minWidth: 140, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.link_url ? (
                            <a href={it.link_url} target="_blank" rel="noopener noreferrer" title={it.link_url}
                              style={{ color: '#2c5aa3', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%' }}>
                              <ExternalLink size={13} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkLabel(it.link_url)}</span>
                            </a>
                          ) : <span style={{ color: 'var(--muted-light)' }}>brak linku</span>}
                        </span>
                      </>
                    )}
                    <span title={`Treningi grup: ${it.trainingUses} · Plany: ${it.planUses}`}
                      style={{ width: 70, textAlign: 'center', fontWeight: 800, fontSize: 14, color: total ? 'var(--ink)' : 'var(--muted-light)' }}>
                      {total}×
                    </span>
                    <span style={{ width: 64, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {editing ? (
                        <>
                          <button onClick={() => saveEdit(it)} title="Zapisz" style={iconBtn}><Check size={15} /></button>
                          <button onClick={() => setEditId(null)} title="Anuluj" style={iconBtn}><X size={15} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(it)} title="Edytuj" style={iconBtn}><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(it)} title="Usuń z katalogu" style={iconBtn}><Trash2 size={14} /></button>
                        </>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className="coach-empty-list" style={{ textAlign: 'left', padding: '12px 2px 0' }}>
          {items.length} ćwiczeń w katalogu. Liczba użyć obejmuje treningi grup i plany (najedź, by zobaczyć podział).
        </div>
      </div>
    </>
  )
}

const iconBtn: React.CSSProperties = {
  border: 'none', background: 'none', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'inline-flex', cursor: 'pointer',
}
