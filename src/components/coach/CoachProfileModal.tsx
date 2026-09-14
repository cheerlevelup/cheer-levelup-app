'use client'
// src/components/coach/CoachProfileModal.tsx
// Modal "Profil trenera" otwierany z karty w lewym dolnym rogu sidebara.
// Luźna ewidencja: lista własnych funkcji (chipy) + przypisanie grup do
// wybranej funkcji. Każda zmiana zapisuje się od razu (bez osobnego etapu
// "wersji roboczej") — przycisk "Zapisz" tylko zamyka okno.
import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/coach/ui'

type CoachFunction = { id: number; name: string; sort_order: number }
type GroupRole = { id: number; group_id: number; function_id: number }
type GroupOption = { id: number; name: string }

export default function CoachProfileModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [groups, setGroups] = useState<GroupOption[] | null>(null)
  const [functions, setFunctions] = useState<CoachFunction[] | null>(null)
  const [roles, setRoles] = useState<GroupRole[] | null>(null)

  const [newFunctionName, setNewFunctionName] = useState('')
  const [addingFunction, setAddingFunction] = useState(false)

  const [newRoleGroupId, setNewRoleGroupId] = useState('')
  const [newRoleFunctionId, setNewRoleFunctionId] = useState('')
  const [addingRole, setAddingRole] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: groupsData }, { data: functionsData }, { data: rolesData }] = await Promise.all([
        supabase.from('groups').select('id, name').order('sort_order', { ascending: true }),
        supabase.from('coach_functions').select('*').order('sort_order', { ascending: true }),
        supabase.from('coach_group_roles').select('*'),
      ])
      setGroups((groupsData || []) as GroupOption[])
      setFunctions((functionsData || []) as CoachFunction[])
      setRoles((rolesData || []) as GroupRole[])
    }
    load()
  }, [])

  async function addFunction() {
    const name = newFunctionName.trim()
    if (!name || addingFunction) return
    setAddingFunction(true)
    const nextOrder = (functions || []).reduce((m, f) => Math.max(m, f.sort_order), 0) + 1
    const { data } = await supabase.from('coach_functions').insert({ name, sort_order: nextOrder }).select().single()
    if (data) setFunctions(prev => [...(prev || []), data as CoachFunction])
    setNewFunctionName('')
    setAddingFunction(false)
  }

  async function removeFunction(fn: CoachFunction) {
    const usedCount = (roles || []).filter(r => r.function_id === fn.id).length
    if (usedCount > 0 && !window.confirm(`Usunąć funkcję „${fn.name}”? Zniknie też z ${usedCount} przypisanej ${usedCount === 1 ? 'grupy' : 'grup'}.`)) return
    await supabase.from('coach_functions').delete().eq('id', fn.id)
    setFunctions(prev => (prev || []).filter(f => f.id !== fn.id))
    setRoles(prev => (prev || []).filter(r => r.function_id !== fn.id))
  }

  async function addRole() {
    if (!newRoleGroupId || !newRoleFunctionId || addingRole) return
    const groupId = parseInt(newRoleGroupId)
    const functionId = parseInt(newRoleFunctionId)
    if ((roles || []).some(r => r.group_id === groupId && r.function_id === functionId)) {
      setNewRoleGroupId(''); setNewRoleFunctionId('')
      return
    }
    setAddingRole(true)
    const { data } = await supabase.from('coach_group_roles').insert({ group_id: groupId, function_id: functionId }).select().single()
    if (data) setRoles(prev => [...(prev || []), data as GroupRole])
    setNewRoleGroupId(''); setNewRoleFunctionId('')
    setAddingRole(false)
  }

  async function removeRole(id: number) {
    await supabase.from('coach_group_roles').delete().eq('id', id)
    setRoles(prev => (prev || []).filter(r => r.id !== id))
  }

  const loading = groups === null || functions === null || roles === null

  return (
    <div className="coach-modal-overlay" onClick={onClose}>
      <div className="coach-modal-box coach-profile-modal" onClick={e => e.stopPropagation()}>
        <div className="coach-profile-modal-head">
          <div className="coach-eyebrow">Profil trenera</div>
          <button className="coach-modal-close" onClick={onClose}><X size={16} /></button>
          <div className="coach-profile-modal-id">
            <div className="coach-comp-avatar-lg">UP</div>
            <h3>Urszula Papka</h3>
          </div>
        </div>

        <div className="coach-modal-body">
          {loading ? (
            <div className="coach-injury-empty">Wczytuję...</div>
          ) : (
            <>
              <div className="coach-section-label" style={{ padding: '0 0 8px' }}>Funkcje</div>
              <div className="coach-profile-chip-row">
                {(functions || []).length === 0 && <span className="coach-profile-empty-hint">Brak zdefiniowanych funkcji.</span>}
                {(functions || []).map(fn => (
                  <span key={fn.id} className="coach-profile-chip">
                    {fn.name}
                    <button onClick={() => removeFunction(fn)}><X size={11} /></button>
                  </span>
                ))}
              </div>
              <div className="coach-profile-add-row">
                <input
                  value={newFunctionName}
                  onChange={e => setNewFunctionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addFunction() }}
                  placeholder="np. Trener przygotowania motorycznego"
                />
                <Button variant="dark" size="small" onClick={addFunction} disabled={addingFunction || !newFunctionName.trim()}>+ Dodaj</Button>
              </div>

              <div className="coach-section-label" style={{ padding: '16px 0 8px' }}>Przypisane grupy</div>
              <div className="coach-profile-role-list">
                {(roles || []).length === 0 && <span className="coach-profile-empty-hint">Brak przypisanych grup.</span>}
                {(roles || []).map(role => {
                  const group = (groups || []).find(g => g.id === role.group_id)
                  const fn = (functions || []).find(f => f.id === role.function_id)
                  return (
                    <div key={role.id} className="coach-profile-role-row">
                      <b>{group?.name || '—'}</b>
                      <span className="coach-profile-role-sep">—</span>
                      <span className="coach-profile-role-fn">{fn?.name || '—'}</span>
                      <button className="coach-injury-remove" style={{ position: 'static', marginLeft: 'auto' }} onClick={() => removeRole(role.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="coach-profile-add-row">
                <select value={newRoleGroupId} onChange={e => setNewRoleGroupId(e.target.value)}>
                  <option value="">Grupa...</option>
                  {(groups || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <select value={newRoleFunctionId} onChange={e => setNewRoleFunctionId(e.target.value)}>
                  <option value="">Funkcja...</option>
                  {(functions || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <Button variant="dark" size="small" onClick={addRole} disabled={addingRole || !newRoleGroupId || !newRoleFunctionId}>+ Dodaj</Button>
              </div>
            </>
          )}
        </div>

        <div className="coach-modal-foot" style={{ justifyContent: 'flex-end' }}>
          <Button variant="gold" onClick={onClose}>Zapisz</Button>
        </div>
      </div>
    </div>
  )
}
