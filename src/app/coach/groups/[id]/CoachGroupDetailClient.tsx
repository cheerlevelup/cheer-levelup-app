'use client'
// src/app/coach/groups/[id]/CoachGroupDetailClient.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ModuleConfigPanel from '@/components/ModuleConfigPanel'

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
}
const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

const thStyle: React.CSSProperties = { padding: '0.75rem 0.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray, background: C.offWhite, borderBottom: `1.5px solid ${C.grayLight}`, whiteSpace: 'nowrap', minWidth: 44 }
function tdWs(bg: string): React.CSSProperties { return { padding: '0.4rem 0.5rem', textAlign: 'center', borderBottom: `1.5px solid ${C.grayLight}`, background: bg, verticalAlign: 'middle' } }
function statTd(bg: string): React.CSSProperties { return { padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}`, background: bg, fontFamily: mono, fontSize: '0.78rem', fontWeight: 700, color: C.navy } }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)', ...style }}>{children}</div>
}

function CellStatus({ session }: { session: any | null }) {
  if (!session) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.grayLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>○</div>
  if (session.completed && session.report_sent) return <div title="Raport wysłany" style={{ width: 28, height: 28, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>📋</div>
  if (session.completed) return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.72rem', color: C.white, fontWeight: 800 }}>✓</div>
  return <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '0.7rem', color: C.navy, fontWeight: 800 }}>◑</div>
}

function AssignPlanModal({ athletes, plans, onClose, onAssigned }: {
  athletes: any[]; plans: any[]
  onClose: () => void; onAssigned: () => void
}) {
  const supabase = createClient()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedAthletes, setSelectedAthletes] = useState<number[]>(athletes.map(a => a.id))
  const [orderMode, setOrderMode] = useState<'sequential' | 'dated'>('sequential')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleAthlete(id: number) {
    setSelectedAthletes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAssign() {
    if (!selectedPlanId || selectedAthletes.length === 0) return
    setSaving(true); setError('')
    try {
      await supabase.from('athlete_workout_assignments')
        .update({ is_active: false })
        .in('athlete_id', selectedAthletes)
        .eq('is_active', true)

      const rows = selectedAthletes.map(athleteId => ({
        athlete_id: athleteId,
        plan_id: parseInt(selectedPlanId),
        is_active: true,
        order_mode: orderMode,
        start_date: new Date().toISOString().split('T')[0],
      }))
      const { error: err } = await supabase.from('athlete_workout_assignments').insert(rows)
      if (err) throw err
      onAssigned()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: sans }}>
      <div style={{ width: '100%', maxWidth: 480, background: C.white, borderRadius: 18, border: `1.5px solid ${C.grayLight}`, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ background: C.navy, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: mono, fontSize: '0.66rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Przypisz plan</div>
          <h2 style={{ color: C.white, fontSize: '1.15rem', fontWeight: 800 }}>Wybierz plan dla zawodniczek</h2>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Plan treningowy</div>
            <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 10, background: C.offWhite, color: C.navy, fontFamily: sans, fontSize: '0.9rem', outline: 'none', appearance: 'none' }}>
              <option value="">Wybierz plan...</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Tryb realizacji</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[{ v: 'sequential', label: 'Sekwencyjny', desc: 'Treningi po kolei' }, { v: 'dated', label: 'Datowany', desc: 'Wg daty' }].map(opt => (
                <button key={opt.v} onClick={() => setOrderMode(opt.v as 'sequential' | 'dated')}
                  style={{ padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${orderMode === opt.v ? C.gold : C.grayLight}`, background: orderMode === opt.v ? C.navy : C.offWhite, color: orderMode === opt.v ? C.gold : C.navy, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.72rem', color: C.gray, marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Zawodniczki</div>
              <button onClick={() => setSelectedAthletes(selectedAthletes.length === athletes.length ? [] : athletes.map(a => a.id))}
                style={{ background: 'none', border: 'none', color: C.gold, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                {selectedAthletes.length === athletes.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {athletes.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.875rem', border: `1.5px solid ${selectedAthletes.includes(a.id) ? C.gold : C.grayLight}`, borderRadius: 10, background: selectedAthletes.includes(a.id) ? C.navyLight : C.offWhite, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedAthletes.includes(a.id)} onChange={() => toggleAthlete(a.id)} style={{ accentColor: C.gold, width: 16, height: 16 }} />
                  <span style={{ fontWeight: 600, color: selectedAthletes.includes(a.id) ? C.white : C.navy, fontSize: '0.9rem' }}>{a.full_name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div style={{ padding: '0.75rem', background: '#FEF2F2', border: `1.5px solid ${C.red}`, borderRadius: 10, color: C.red, fontWeight: 700, fontSize: '0.82rem', marginBottom: '1rem' }}>❌ {error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '0.875rem 1rem', border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, color: C.gray, fontWeight: 700 }}>Anuluj</button>
            <button onClick={handleAssign} disabled={!selectedPlanId || selectedAthletes.length === 0 || saving}
              style={{ flex: 1, padding: '0.875rem', border: 'none', borderRadius: 12, background: !selectedPlanId || selectedAthletes.length === 0 ? C.grayLight : C.navy, color: !selectedPlanId || selectedAthletes.length === 0 ? C.gray : C.gold, fontWeight: 900 }}>
              {saving ? 'Przypisuję...' : `Przypisz plan (${selectedAthletes.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type Tab = 'trening' | 'wellness' | 'diet' | 'athletes'

// ── Wellness helpers ──────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function colorBand(val: number | null, thresholds: [number, number], colors: [string, string, string]): string {
  if (val === null) return C.gray
  if (val <= thresholds[0]) return colors[0]
  if (val <= thresholds[1]) return colors[1]
  return colors[2]
}

function Dot({ color, title }: { color: string; title?: string }) {
  return <div title={title} style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function WellnessBadge({ value, label, color }: { value: string; label?: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.72rem', fontWeight: 800, color }}>{value}</div>
      {label && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: '0.5rem', color: C.gray }}>{label}</div>}
    </div>
  )
}

function getAthleteWellnessSummary(athleteId: number, logs: any[]) {
  const myLogs = logs.filter((l: any) => l.athlete_id === athleteId)
  const today = new Date().toISOString().split('T')[0]
  const hasToday = myLogs.some((l: any) => l.date === today)

  const sleepVals = myLogs.map((l: any) => l.sleep_hours).filter((v: any) => v != null) as number[]
  const stressVals = myLogs.map((l: any) => l.stress).filter((v: any) => v != null) as number[]

  // Pain: max pain_during from last 7 days
  const painVals = myLogs
    .map((l: any) => l.pain_data?.painDuring ?? null)
    .filter((v: any) => v != null) as number[]
  const maxPain = painVals.length ? Math.max(...painVals) : null

  // Activity hours
  const totalMinutes = myLogs.reduce((sum: number, l: any) => {
    const dur = parseInt(l.activity_data?.duration || '0') || 0
    return sum + dur
  }, 0)
  const activityHours = totalMinutes > 0 ? +(totalMinutes / 60).toFixed(1) : null

  // Cycle
  const latestCycle = myLogs.find((l: any) => l.cycle_phase)?.cycle_phase ?? null

  return {
    hasToday,
    sleepAvg: avg(sleepVals),
    stressAvg: avg(stressVals),
    maxPain,
    activityHours,
    latestCycle,
    entryCount: myLogs.length,
  }
}

// ── AthleteEditCard ───────────────────────────────────────────────────────────

type ProfileTab = 'profil' | 'umiejetnosci' | 'kontuzje'

const CHEER_JUMPS = ['Herkie', 'Pike', 'Toe touch', 'Hurdler', 'Spread eagle', 'Double nine', 'Around the world', 'Tuck', 'X jump']
const DANCE_JUMPS = ['Grand jeté', 'Switch leap', 'Turning jump', 'Stag', 'Cabriole']
const ACRO_SKILLS = ['Rondad', 'Flik', 'Salto przodem', 'Salto tyłem', 'Arabian', 'Full', 'Double full', 'Layout', 'Tuck salto', 'Pike salto', 'Handspring']
const DANCE_STYLES = ['Jazz', 'Hip-hop', 'Lyrical', 'Contemporary', 'Pom', 'Cheerleading', 'Balet', 'Taniec nowoczesny']

function AthleteEditCard({ athlete, onSaved }: { athlete: any; onSaved: (updated: any) => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [profileTab, setProfileTab] = useState<ProfileTab>('profil')

  // Profil
  const [fullName, setFullName]     = useState(athlete.full_name || '')
  const [birthYear, setBirthYear]   = useState(athlete.birth_year?.toString() || '')
  const [phone, setPhone]           = useState(athlete.phone || '')
  const [position, setPosition]     = useState(athlete.position || '')
  const [height, setHeight]         = useState(athlete.height_cm?.toString() || '')
  const [bodyWeight, setBodyWeight] = useState(athlete.body_weight_kg?.toString() || '')
  const [notes, setNotes]           = useState(athlete.notes || '')

  // Umiejętności (trzymane w skills jsonb)
  const initSkills = athlete.skills || {}
  const [pirCount, setPirCount]     = useState(initSkills.pirouettes?.toString() || '')
  const [pirNotes, setPirNotes]     = useState(initSkills.pirouettes_notes || '')
  const [cheerJumps, setCheerJumps] = useState<string[]>(initSkills.cheer_jumps || [])
  const [danceJumps, setDanceJumps] = useState<string[]>(initSkills.dance_jumps || [])
  const [acroSkills, setAcroSkills] = useState<string[]>(initSkills.acro_skills || [])
  const [danceStyles, setDanceStyles] = useState<string[]>(initSkills.dance_styles || [])
  const [stunts, setStunts]         = useState(initSkills.stunts || '')
  const [pyramids, setPyramids]     = useState(initSkills.pyramids || '')
  const [skillsNotes, setSkillsNotes] = useState(initSkills.notes || '')

  // Kontuzje
  const [injuries, setInjuries]     = useState<{date: string; type: string; status: string; note: string}[]>(athlete.injuries || [])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const inp: React.CSSProperties = { width: '100%', minHeight: 36, border: `1.5px solid ${C.grayLight}`, borderRadius: 8, background: C.offWhite, color: C.navy, padding: '0 0.75rem', fontFamily: sans, fontSize: '0.86rem', outline: 'none' }
  const lbl: React.CSSProperties = { fontFamily: mono, fontSize: '0.58rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function addInjury() {
    setInjuries(prev => [...prev, { date: new Date().toISOString().split('T')[0], type: '', status: 'aktywna', note: '' }])
  }

  async function handleSave() {
    setSaving(true)
    const skillsPayload = {
      pirouettes: pirCount ? parseInt(pirCount) : null,
      pirouettes_notes: pirNotes || null,
      cheer_jumps: cheerJumps, dance_jumps: danceJumps,
      acro_skills: acroSkills, dance_styles: danceStyles,
      stunts: stunts || null, pyramids: pyramids || null,
      notes: skillsNotes || null,
    }
    const { data, error } = await supabase.from('athletes').update({
      full_name: fullName.trim(),
      birth_year: birthYear ? parseInt(birthYear) : null,
      phone: phone.trim() || null,
      position: position.trim() || null,
      height_cm: height ? parseFloat(height) : null,
      body_weight_kg: bodyWeight ? parseFloat(bodyWeight) : null,
      notes: notes.trim() || null,
      skills: skillsPayload,
      injuries,
    }).eq('id', athlete.id).select().single()
    setSaving(false)
    if (!error && data) { setSaved(true); onSaved(data); setTimeout(() => setSaved(false), 2000) }
  }

  const chips = (options: string[], selected: string[], setSelected: (v: string[]) => void) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
      {options.map(o => {
        const on = selected.includes(o)
        return (
          <button key={o} onClick={() => toggleArr(selected, setSelected, o)} style={{ borderRadius: 7, border: `1.5px solid ${on ? C.gold : C.grayLight}`, background: on ? C.navy : C.offWhite, color: on ? C.gold : C.navy, padding: '3px 10px', fontFamily: mono, fontSize: '0.65rem', fontWeight: on ? 800 : 600, cursor: 'pointer' }}>
            {o}
          </button>
        )
      })}
    </div>
  )

  return (
    <div style={{ border: `1.5px solid ${C.grayLight}`, borderRadius: 12, background: C.white, overflow: 'hidden', boxShadow: '0 2px 8px rgba(13,27,42,0.04)' }}>
      {/* Header */}
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', background: 'none', border: 'none', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.navy, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
          {fullName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: C.navy }}>{fullName}</div>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {birthYear && <span>ur. {birthYear}</span>}
            {position && <span>· {position}</span>}
            {height && <span>· {height} cm</span>}
            {initSkills.pirouettes && <span style={{ color: C.gold }}>· {initSkills.pirouettes} piruety</span>}
            {injuries.filter(inj => inj.status === 'aktywna').length > 0 && (
              <span style={{ color: C.red }}>· ⚠️ {injuries.filter(inj => inj.status === 'aktywna').length} aktywna kontuzja</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {saved && <span style={{ fontFamily: mono, fontSize: '0.62rem', color: C.green }}>✓ Zapisano</span>}
          <span style={{ color: C.gray, fontSize: '1rem', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: `1.5px solid ${C.grayLight}` }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', borderBottom: `1.5px solid ${C.grayLight}` }}>
            {([{ id: 'profil', label: '👤 Profil' }, { id: 'umiejetnosci', label: '⭐ Umiejętności' }, { id: 'kontuzje', label: '🩹 Kontuzje' }] as { id: ProfileTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setProfileTab(t.id)} style={{ flex: 1, padding: '0.6rem', border: 'none', background: profileTab === t.id ? C.white : C.offWhite, color: profileTab === t.id ? C.navy : C.gray, fontWeight: profileTab === t.id ? 800 : 600, fontFamily: mono, fontSize: '0.65rem', borderBottom: profileTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
            {/* ── Profil ── */}
            {profileTab === 'profil' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Imię i nazwisko</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} />
                </div>
                <div><label style={lbl}>Rok urodzenia</label><input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="2005" style={inp} /></div>
                <div><label style={lbl}>Telefon</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 000 000 000" style={inp} /></div>
                <div><label style={lbl}>Pozycja / rola</label><input value={position} onChange={e => setPosition(e.target.value)} placeholder="flyer, baza, back spot..." style={inp} /></div>
                <div><label style={lbl}>Wzrost (cm)</label><input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="165" style={inp} /></div>
                <div><label style={lbl}>Masa ciała (kg)</label><input type="number" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} placeholder="55" style={inp} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Notatki trenerskie</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Uwagi ogólne, cele, dyspozycje..." style={{ ...inp, minHeight: 60, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                </div>
              </div>
            )}

            {/* ── Umiejętności ── */}
            {profileTab === 'umiejetnosci' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>🌀 Piruety</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: '0.55rem' }}>Ilość</label>
                      <input type="number" value={pirCount} onChange={e => setPirCount(e.target.value)} placeholder="0" min="0" max="10" style={inp} />
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: '0.55rem' }}>Uwagi</label>
                      <input value={pirNotes} onChange={e => setPirNotes(e.target.value)} placeholder="np. tylko w prawo, praca nad balansem..." style={inp} />
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>🤸 Skoki cheer</div>
                  {chips(CHEER_JUMPS, cheerJumps, setCheerJumps)}
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>💃 Skoki dance</div>
                  {chips(DANCE_JUMPS, danceJumps, setDanceJumps)}
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>🎪 Elementy akrobatyczne</div>
                  {chips(ACRO_SKILLS, acroSkills, setAcroSkills)}
                </div>
                <div>
                  <div style={{ ...lbl, marginBottom: 4 }}>🎵 Style taneczne</div>
                  {chips(DANCE_STYLES, danceStyles, setDanceStyles)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={lbl}>Stunty (opis)</label>
                    <textarea value={stunts} onChange={e => setStunts(e.target.value)} rows={2} placeholder="np. lib, scorpion, full up..." style={{ ...inp, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                  </div>
                  <div>
                    <label style={lbl}>Piramidy (opis)</label>
                    <textarea value={pyramids} onChange={e => setPyramids(e.target.value)} rows={2} placeholder="np. 2-2-1, pełne wrzuty..." style={{ ...inp, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Dodatkowe uwagi do umiejętności</label>
                  <textarea value={skillsNotes} onChange={e => setSkillsNotes(e.target.value)} rows={2} placeholder="Inne elementy, cele treningowe..." style={{ ...inp, minHeight: 56, padding: '0.5rem 0.75rem', resize: 'none', display: 'block' }} />
                </div>
              </div>
            )}

            {/* ── Kontuzje ── */}
            {profileTab === 'kontuzje' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {injuries.length === 0 && (
                  <div style={{ fontFamily: mono, fontSize: '0.72rem', color: C.gray, textAlign: 'center', padding: '1rem' }}>Brak zapisanych kontuzji</div>
                )}
                {injuries.map((inj, i) => (
                  <div key={i} style={{ border: `1.5px solid ${inj.status === 'aktywna' ? C.red : C.grayLight}`, borderRadius: 10, padding: '0.75rem', background: inj.status === 'aktywna' ? '#FFF5F5' : C.offWhite }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                      <div>
                        <label style={lbl}>Data</label>
                        <input type="date" value={inj.date} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Status</label>
                        <select value={inj.status} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, status: e.target.value } : x))} style={{ ...inp, appearance: 'none' }}>
                          <option value="aktywna">Aktywna</option>
                          <option value="w leczeniu">W leczeniu</option>
                          <option value="wyleczona">Wyleczona</option>
                          <option value="przewlekla">Przewlekła</option>
                        </select>
                      </div>
                      <button onClick={() => setInjuries(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer', fontSize: '1rem', alignSelf: 'flex-end', paddingBottom: 4 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8 }}>
                      <div>
                        <label style={lbl}>Rodzaj / lokalizacja</label>
                        <input value={inj.type} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} placeholder="np. naciągnięcie kostki, ból kolana..." style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Notatka</label>
                        <input value={inj.note} onChange={e => setInjuries(prev => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="Leczenie, ograniczenia, uwagi..." style={inp} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addInjury} style={{ border: `1.5px dashed ${C.grayLight}`, background: C.white, color: C.gray, borderRadius: 10, padding: '0.6rem', fontFamily: mono, fontSize: '0.68rem', cursor: 'pointer', fontWeight: 700 }}>
                  + Dodaj kontuzję
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '0.55rem 0.875rem', borderRadius: 8, border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, fontWeight: 700, cursor: 'pointer' }}>Zamknij</button>
              <button onClick={handleSave} disabled={saving || !fullName.trim()} style={{ padding: '0.55rem 1rem', borderRadius: 8, border: 'none', background: saved ? C.green : C.navy, color: saved ? C.white : C.gold, fontWeight: 800, cursor: 'pointer', minWidth: 90 }}>
                {saving ? 'Zapisuję...' : saved ? '✓ Zapisano' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── StatsCard — reusable styled stats table ────────────────────────────────

type StatCell = { v: string | number | null; color?: string }
type StatRow = { id: number; name: string; cells: StatCell[] }
type ColDef = { key: string; left?: boolean; emoji?: string }

function StatsCard({ title, period, onPeriodChange, cols, rows, onAthleteClick, style }: {
  title: string; period: number; onPeriodChange: (v: number) => void
  cols: ColDef[]; rows: StatRow[]; onAthleteClick: (id: number) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(13,27,42,0.06)', ...style }}>
      {/* header */}
      <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: C.offWhite }}>
        <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: C.navy }}>
              {cols.map((col, i) => (
                <th key={col.key} style={{
                  padding: i === 0 ? '0.65rem 1rem' : '0.65rem 0.75rem',
                  textAlign: col.left ? 'left' : 'center',
                  fontFamily: mono, fontSize: '0.58rem', color: C.gold,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderBottom: `1.5px solid ${C.navyBorder}`,
                  whiteSpace: 'nowrap', fontWeight: 700,
                }}>
                  {col.emoji && <span style={{ marginRight: 4 }}>{col.emoji}</span>}{col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const rowBg = ri % 2 === 0 ? C.white : '#FAFBFC'
              return (
                <tr key={row.id} style={{ background: rowBg, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                  <td style={{ padding: '0.65rem 1rem', borderBottom: `1px solid ${C.grayLight}` }}>
                    <button onClick={() => onAthleteClick(row.id)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.88rem', textAlign: 'left' }}>
                      {row.name}
                    </button>
                  </td>
                  {row.cells.map((cell, ci) => (
                    <td key={ci} style={{ padding: '0.55rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}` }}>
                      {cell.v === null || cell.v === undefined
                        ? <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.7rem' }}>—</span>
                        : <span style={{
                            display: 'inline-block',
                            background: cell.color ? cell.color + '1A' : C.offWhite,
                            color: cell.color ?? C.navy,
                            borderRadius: 6, padding: '2px 8px',
                            fontFamily: mono, fontSize: '0.75rem', fontWeight: 800,
                          }}>{cell.v}</span>
                      }
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PERIODS = [
  { label: '7 dni', days: 7 },
  { label: '14 dni', days: 14 },
  { label: '30 dni', days: 30 },
]

function PeriodSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', background: C.offWhite, border: `1.5px solid ${C.grayLight}`, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
      {PERIODS.map(p => (
        <button key={p.days} onClick={() => onChange(p.days)} style={{
          padding: '0.35rem 0.75rem', border: 'none', cursor: 'pointer',
          background: value === p.days ? C.navy : 'transparent',
          color: value === p.days ? C.gold : C.gray,
          fontFamily: mono, fontSize: '0.65rem', fontWeight: value === p.days ? 800 : 600,
          transition: 'all 0.15s',
        }}>{p.label}</button>
      ))}
    </div>
  )
}

// Value badge — colored pill
function Val({ v, color, suffix = '' }: { v: string | number | null; color?: string; suffix?: string }) {
  if (v === null || v === undefined || v === '—') {
    return <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.72rem' }}>—</span>
  }
  const c = color ?? C.navy
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: c + '18', borderRadius: 6, padding: '2px 7px' }}>
      <span style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 800, color: c }}>{v}{suffix}</span>
    </div>
  )
}

function filterByDays(logs: any[], days: number, dateField = 'date') {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return logs.filter((l: any) => {
    const d = l[dateField] ? String(l[dateField]).slice(0, 10) : String(l.created_at).slice(0, 10)
    return d >= cutoffStr
  })
}

export default function CoachGroupDetailClient({ group, athletes, assignments, days, sessions, plans, wellnessLogs = [], wellnessWeek = [], feedbacks = [], dietLogs = [], assignmentsHistory = [], archivedPlans = [] }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignedMsg, setAssignedMsg] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('trening')
  const [moduleConfig, setModuleConfig] = useState<'wellness' | 'diet' | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [wellnessPeriod, setWellnessPeriod] = useState(14)
  const [dietPeriod, setDietPeriod] = useState(14)
  const [trainingPeriod, setTrainingPeriod] = useState(30)
  const [localAthletes, setLocalAthletes] = useState<any[]>(athletes)

  const sessionIndex: Record<string, any> = {}
  for (const s of sessions) {
    const key = `${s.athlete_id}_${s.workout_day_id}`
    if (!sessionIndex[key] || new Date(s.created_at) > new Date(sessionIndex[key].created_at)) sessionIndex[key] = s
  }

  const currentPlan = assignments[0]?.plan
  const activePlanId = selectedPlanId ?? currentPlan?.id ?? null
  const activePlanDays = activePlanId
    ? days.filter((d: any) => d.week?.plan_id === activePlanId)
    : days

  function getAthleteProgress(athleteId: number) {
    if (activePlanDays.length === 0) return null
    const done = activePlanDays.filter((d: any) => sessionIndex[`${athleteId}_${d.id}`]?.completed).length
    return { done, total: activePlanDays.length }
  }

  // Archive plan
  async function archivePlan(planId: number) {
    if (!confirm('Zarchiwizować ten plan? Nie będzie można go edytować. Zawodniczki zachowają dostęp do historii.')) return
    await supabase.from('workout_plans').update({ is_archived: true }).eq('id', planId)
    router.refresh()
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} body{background:${C.offWhite};} button{cursor:pointer;font-family:inherit;} ::-webkit-scrollbar{height:4px;} ::-webkit-scrollbar-thumb{background:#ccc;}`}</style>

      {showAssignModal && (
        <AssignPlanModal
          athletes={athletes} plans={plans}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setAssignedMsg('Plan przypisany!'); router.refresh() }}
        />
      )}
      {moduleConfig && (
        <ModuleConfigPanel
          groupId={group.id}
          module={moduleConfig}
          onClose={() => setModuleConfig(null)}
        />
      )}

      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
        <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push('/coach')} style={{ border: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>← Panel</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Grupa · {athletes.length} zawodniczek</div>
                <h1 style={{ color: C.white, fontSize: '1.25rem', fontWeight: 800 }}>{group.name}</h1>
                <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, marginTop: 3 }}>
                  Trener motoryczny: <span style={{ color: C.white, fontWeight: 700 }}>{group.trainer_name || 'Urszula Papka'}</span>
                  {currentPlan && <span style={{ marginLeft: 12, color: C.gold }}>📋 {currentPlan.name}</span>}
                  {assignedMsg && <span style={{ marginLeft: 12, color: C.green }}>✓ {assignedMsg}</span>}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab navigation */}
        <div style={{ background: C.navyLight, borderBottom: `1.5px solid ${C.navyBorder}` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 0 }}>
            {([
              { id: 'trening',  label: '🏋️ Trening' },
              { id: 'wellness', label: '🩺 Wellness' },
              { id: 'diet',     label: '🥗 Dieta' },
              { id: 'athletes', label: '👤 Zawodniczki' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '0.7rem 1.1rem', border: 'none', background: 'transparent', color: activeTab === t.id ? C.gold : C.gray, fontWeight: activeTab === t.id ? 800 : 600, fontFamily: mono, fontSize: '0.72rem', borderBottom: activeTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent', cursor: 'pointer', letterSpacing: '0.04em' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
          {/* ── Wellness tab ── */}
          {/* ══ WELLNESS TAB ══════════════════════════════════════════════════════ */}
          {activeTab === 'wellness' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Config + individual overrides */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Konfiguracja parametrów</div>
                  <button onClick={() => setModuleConfig('wellness')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🩺 Edytuj dla grupy
                  </button>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const ws = getAthleteWellnessSummary(athlete.id, wellnessWeek)
                  return (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1, fontWeight: 700, color: C.navy, fontSize: '0.9rem' }}>{athlete.full_name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: ws.hasToday ? C.green : ws.entryCount > 0 ? C.gold : C.red }}>{ws.hasToday ? '✅ dziś' : ws.entryCount > 0 ? `⚠️ ${ws.entryCount} wpisów` : '✗ brak'}</div>
                      <button onClick={() => router.push(`/coach/athletes/${athlete.id}?tab=wellness`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.35rem 0.65rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                        Konfiguruj →
                      </button>
                    </div>
                  )
                })}
              </Card>

              {/* ── Wellness stats table ── */}
              <StatsCard
                title="Statystyki wellness"
                period={wellnessPeriod}
                onPeriodChange={setWellnessPeriod}
                cols={[
                  { key: 'Zawodniczka', left: true },
                  { key: 'Wpisy', emoji: '📝' },
                  { key: 'Sen śr.', emoji: '🌙' },
                  { key: 'Energia', emoji: '⚡' },
                  { key: 'Stres', emoji: '🧠' },
                  { key: 'Gotowość', emoji: '💪' },
                  { key: 'Max ból', emoji: '🩹' },
                  { key: 'Akt. godz.', emoji: '🏃' },
                  { key: 'Cykl', emoji: '🌸' },
                ]}
                rows={athletes.map((athlete: any) => {
                  const logs = filterByDays(wellnessLogs.filter((l: any) => l.athlete_id === athlete.id), wellnessPeriod)
                  const sleepAvg = avg(logs.map((l: any) => l.sleep_hours).filter((v: any) => v != null))
                  const energyAvg = avg(logs.map((l: any) => l.energy).filter((v: any) => v != null))
                  const stressAvg = avg(logs.map((l: any) => l.stress).filter((v: any) => v != null))
                  const readinessAvg = avg(logs.map((l: any) => l.readiness).filter((v: any) => v != null))
                  const maxPain = logs.reduce((m: number | null, l: any) => {
                    const p = l.pain_data?.painDuring ?? null
                    return p === null ? m : m === null ? p : Math.max(m, p)
                  }, null as number | null)
                  const totalMin = logs.reduce((s: number, l: any) => s + (parseInt(l.activity_data?.duration || '0') || 0), 0)
                  const actH = totalMin > 0 ? (totalMin / 60).toFixed(1) : null
                  const latestCycle = logs.find((l: any) => l.cycle_phase)?.cycle_phase ?? null
                  const sc = (v: number | null, lo: number, hi: number) => v === null ? undefined : v < lo ? C.red : v < hi ? C.gold : C.green
                  const stressC = stressAvg === null ? undefined : stressAvg >= 8 ? C.red : stressAvg >= 5 ? C.gold : C.green

                  return {
                    id: athlete.id, name: athlete.full_name,
                    cells: [
                      { v: logs.length || null, color: logs.length === 0 ? C.red : C.green },
                      { v: sleepAvg !== null ? `${sleepAvg.toFixed(1)}h` : null, color: sc(sleepAvg, 5, 7) },
                      { v: energyAvg !== null ? energyAvg.toFixed(1) : null, color: sc(energyAvg, 4, 7) },
                      { v: stressAvg !== null ? stressAvg.toFixed(1) : null, color: stressC },
                      { v: readinessAvg !== null ? readinessAvg.toFixed(1) : null, color: sc(readinessAvg, 4, 7) },
                      { v: maxPain !== null ? maxPain : null, color: maxPain !== null ? (maxPain >= 6 ? C.red : maxPain >= 4 ? C.gold : C.green) : undefined },
                      { v: actH !== null ? `${actH}h` : null },
                      { v: latestCycle === 'menstruacja' ? '🔴 mens.' : latestCycle ? latestCycle.slice(0, 7) : null, color: latestCycle === 'menstruacja' ? C.red : C.gray },
                    ],
                  }
                })}
                onAthleteClick={id => router.push(`/coach/athletes/${id}`)}
              />
            </div>
          )}

          {/* ══ DIET TAB ══════════════════════════════════════════════════════════ */}
          {activeTab === 'diet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Config */}
              <Card>
                <div style={{ padding: '1rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Konfiguracja parametrów</div>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.navy, fontWeight: 700 }}>Indywidualne ustawienia zawodniczek</div>
                  </div>
                  <button onClick={() => setModuleConfig('diet')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    🥗 Edytuj dla grupy
                  </button>
                </div>
                {athletes.map((athlete: any, i: number) => {
                  const myDiet = filterByDays(dietLogs.filter((d: any) => d.athlete_id === athlete.id), 30)
                  return (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < athletes.length - 1 ? `1.5px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1, fontWeight: 700, color: C.navy, fontSize: '0.9rem' }}>{athlete.full_name}</div>
                      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: myDiet.length === 0 ? C.gray : C.green }}>{myDiet.length} wpisów / 30 dni</div>
                      <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.35rem 0.65rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                        Konfiguruj →
                      </button>
                    </div>
                  )
                })}
              </Card>

              {/* ── Diet stats table ── */}
              <StatsCard
                title="Statystyki diety"
                period={dietPeriod}
                onPeriodChange={setDietPeriod}
                cols={[
                  { key: 'Zawodniczka', left: true },
                  { key: 'Wpisy', emoji: '📝' },
                  { key: 'Śniadanie', emoji: '🌅' },
                  { key: 'Posiłki śr.', emoji: '🍽️' },
                  { key: 'Woda ml', emoji: '💧' },
                  { key: 'Kawa śr.', emoji: '☕' },
                  { key: 'Głód śr.', emoji: '🔢' },
                ]}
                rows={athletes.map((athlete: any) => {
                  const logs = filterByDays(dietLogs.filter((d: any) => d.athlete_id === athlete.id), dietPeriod)
                  const breakfastPct = logs.length ? Math.round((logs.filter((d: any) => d.had_breakfast).length / logs.length) * 100) : null
                  const mealAvg = avg(logs.map((d: any) => d.meal_count).filter((v: any) => v > 0))
                  const waterAvg = avg(logs.map((d: any) => d.water_ml).filter((v: any) => v != null && v > 0))
                  const coffeeAvg = avg(logs.map((d: any) => d.coffee_count).filter((v: any) => v != null))
                  const hungerAvg = avg(logs.map((d: any) => d.hunger_level).filter((v: any) => v != null))
                  return {
                    id: athlete.id, name: athlete.full_name,
                    cells: [
                      { v: logs.length || null, color: logs.length === 0 ? C.red : C.green },
                      { v: breakfastPct !== null ? `${breakfastPct}%` : null, color: breakfastPct === null ? undefined : breakfastPct >= 80 ? C.green : breakfastPct >= 50 ? C.gold : C.red },
                      { v: mealAvg !== null ? mealAvg.toFixed(1) : null },
                      { v: waterAvg !== null ? Math.round(waterAvg) : null, color: waterAvg === null ? undefined : waterAvg >= 2000 ? C.green : waterAvg >= 1500 ? C.gold : C.red },
                      { v: coffeeAvg !== null ? coffeeAvg.toFixed(1) : null },
                      { v: hungerAvg !== null ? hungerAvg.toFixed(1) : null },
                    ],
                  }
                })}
                onAthleteClick={id => router.push(`/coach/athletes/${id}`)}
              />
            </div>
          )}

          {/* ══ ATHLETES TAB ══════════════════════════════════════════════════════ */}
          {activeTab === 'athletes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: C.navy }}>Zawodniczki grupy</div>
                  <div style={{ fontFamily: mono, fontSize: '0.62rem', color: C.gray, marginTop: 2 }}>Kliknij zawodniczkę aby rozwinąć i edytować profil</div>
                </div>
                <button onClick={() => router.push('/coach/athletes/new')} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 10, padding: '0.6rem 0.9rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                  + Dodaj zawodniczkę
                </button>
              </div>

              {localAthletes.length === 0 && (
                <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak zawodniczek w grupie.</div></Card>
              )}

              {localAthletes.map(athlete => (
                <AthleteEditCard
                  key={athlete.id}
                  athlete={athlete}
                  onSaved={updated => setLocalAthletes(prev => prev.map(a => a.id === updated.id ? updated : a))}
                />
              ))}
            </div>
          )}

          {/* ══ TRENING TAB ═══════════════════════════════════════════════════════ */}
          {activeTab === 'trening' && athletes.length === 0 && (
            <Card><div style={{ padding: '2rem', textAlign: 'center', color: C.gray }}>Brak zawodniczek w tej grupie.</div></Card>
          )}
          {activeTab === 'trening' && athletes.length > 0 && (
            <>
              {/* ── Akcje planu ── */}
              <Card style={{ marginBottom: '1.25rem' }}>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Aktualny plan</div>
                    <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.95rem' }}>{currentPlan?.name ?? '— brak przypisanego planu —'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {assignments.length > 1 && (
                      <select value={selectedPlanId ?? ''} onChange={e => setSelectedPlanId(e.target.value ? parseInt(e.target.value) : null)}
                        style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 8, padding: '0.45rem 0.65rem', fontFamily: mono, fontSize: '0.7rem', outline: 'none' }}>
                        <option value="">Aktualny</option>
                        {assignments.map((a: any) => <option key={a.plan_id} value={a.plan_id}>{a.plan?.name}</option>)}
                      </select>
                    )}
                    {currentPlan && !currentPlan.is_archived && (
                      <button onClick={() => router.push(`/coach/plans/${currentPlan.id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 8, padding: '0.45rem 0.75rem', fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                        ✏️ Edytuj plan
                      </button>
                    )}
                    {currentPlan && !currentPlan.is_archived && (
                      <button onClick={() => archivePlan(currentPlan.id)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.gray, borderRadius: 8, padding: '0.45rem 0.75rem', fontFamily: mono, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                        📦 Archiwizuj
                      </button>
                    )}
                    <button onClick={() => setShowAssignModal(true)} style={{ border: 'none', background: C.navy, color: C.gold, borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                      + Przypisz plan
                    </button>
                  </div>
                </div>
              </Card>

              {assignments.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Realizacja planu</div>
                    <div style={{ fontWeight: 800, color: C.navy }}>{currentPlan?.name} · {activePlanDays.length} treningów</div>
                  </div>
                  {/* ── TABELA 1: Realizacja planu (treningi) ── */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr style={{ background: C.navy }}>
                          <th style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontFamily: mono, fontSize: '0.6rem', color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase', position: 'sticky', left: 0, zIndex: 2, background: C.navy, borderBottom: `1.5px solid ${C.navyBorder}`, whiteSpace: 'nowrap' }}>Zawodniczka</th>
                          <th style={{ ...thStyle, background: C.navy, color: C.gold, borderBottom: `1.5px solid ${C.navyBorder}` }}>Postęp</th>
                          {activePlanDays.map((day: any, i: number) => (
                            <th key={day.id} style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: C.gold, background: C.navy, borderBottom: `1.5px solid ${C.navyBorder}`, minWidth: 42 }}>
                              <div style={{ fontWeight: 800 }}>T{i + 1}</div>
                              <div style={{ fontSize: '0.52rem', marginTop: 2, color: C.gray }}>{(day.day_name || '').replace('Dzień ', '').replace('Trening ', '')}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const progress = getAthleteProgress(athlete.id)
                          const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0
                          const rowBg = rowIdx % 2 === 0 ? C.white : '#FAFBFC'
                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F0F4FF')}
                              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                              <td style={{ padding: '0.75rem 1.25rem', position: 'sticky', left: 0, zIndex: 1, background: 'inherit', borderBottom: `1px solid ${C.grayLight}`, whiteSpace: 'nowrap' }}>
                                <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}>{athlete.full_name}</button>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}` }}>
                                {progress ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                    <div style={{ fontFamily: mono, fontSize: '0.72rem', fontWeight: 800, color: pct === 100 ? C.green : C.navy }}>{pct}%</div>
                                    <div style={{ width: 44, height: 4, background: C.grayLight, borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.gold, borderRadius: 2 }} />
                                    </div>
                                    <div style={{ fontFamily: mono, fontSize: '0.52rem', color: C.gray }}>{progress.done}/{progress.total}</div>
                                  </div>
                                ) : <span style={{ color: C.grayLight, fontSize: '0.75rem' }}>—</span>}
                              </td>
                              {activePlanDays.map((day: any) => (
                                <td key={day.id} style={{ padding: '0.5rem', textAlign: 'center', borderBottom: `1px solid ${C.grayLight}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <CellStatus session={sessionIndex[`${athlete.id}_${day.id}`] || null} />
                                  </div>
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '0.65rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', borderTop: `1.5px solid ${C.grayLight}` }}>
                    {[
                      { symbol: '○', label: 'Niewykonany', bg: C.grayLight, color: C.gray },
                      { symbol: '✓', label: 'Wykonany', bg: C.green, color: C.white },
                      { symbol: '📋', label: 'Raport wysłany', bg: C.navy, color: C.white },
                      { symbol: '◑', label: 'W trakcie', bg: C.gold, color: C.navy },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem' }}>{item.symbol}</div>
                        <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── TABELA 2: Dane wellness (7 dni) ── */}
              {athletes.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Wellness — przegląd tygodniowy</div>
                      <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.navy, fontWeight: 700, marginTop: 2 }}>Dane z ostatnich 7 dni</div>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                      <thead>
                        <tr style={{ background: '#0D2D1A' }}>
                          <th style={{ padding: '0.65rem 1.25rem', textAlign: 'left', fontFamily: mono, fontSize: '0.6rem', color: '#86EFAC', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid #1A4D2E` }}>Zawodniczka</th>
                          {[
                            { label: 'Wellness', title: 'Czy uzupełniła dziś' },
                            { label: '🌙 Sen śr.', title: 'Średnia snu (h)' },
                            { label: '🧠 Stres', title: 'Średni stres (1-10)' },
                            { label: '🩹 Max ból', title: 'Maks. ból podczas treningu' },
                            { label: '🏃 Aktywność', title: 'Łączne godziny aktywności' },
                            { label: '🌸 Cykl', title: 'Ostatnia zaznaczona faza' },
                          ].map(h => (
                            <th key={h.label} title={h.title} style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontFamily: mono, fontSize: '0.6rem', color: '#86EFAC', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1.5px solid #1A4D2E`, minWidth: 80 }}>
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((athlete: any, rowIdx: number) => {
                          const ws = getAthleteWellnessSummary(athlete.id, wellnessWeek)
                          const rowBg = rowIdx % 2 === 0 ? C.white : '#F7FFF9'

                          const sleepColor = ws.sleepAvg === null ? undefined : ws.sleepAvg <= 5 ? C.red : ws.sleepAvg <= 7 ? C.gold : C.green
                          const stressColor = ws.stressAvg === null ? undefined : ws.stressAvg >= 8 ? C.red : ws.stressAvg >= 5 ? C.gold : C.green
                          const painColor = ws.maxPain === null ? undefined : ws.maxPain >= 6 ? C.red : ws.maxPain >= 5 ? C.gold : C.green

                          const pill = (val: string | number | null, color?: string) => val !== null ? (
                            <span style={{ display: 'inline-block', background: (color ?? C.navy) + '1A', color: color ?? C.navy, borderRadius: 6, padding: '2px 8px', fontFamily: mono, fontSize: '0.75rem', fontWeight: 800 }}>{val}</span>
                          ) : <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.7rem' }}>—</span>

                          return (
                            <tr key={athlete.id} style={{ background: rowBg }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#ECFDF5')}
                              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                              <td style={{ padding: '0.7rem 1.25rem', fontWeight: 700, color: C.navy, borderBottom: `1px solid #E0F2EA`, whiteSpace: 'nowrap' }}>
                                <button onClick={() => router.push(`/coach/athletes/${athlete.id}`)} style={{ background: 'none', border: 'none', color: C.navy, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}>{athlete.full_name}</button>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                <span title={ws.hasToday ? 'Uzupełniła dziś' : ws.entryCount > 0 ? 'Wpis w tym tygodniu' : 'Brak wpisów'} style={{ fontSize: '1rem' }}>
                                  {ws.hasToday ? '✅' : ws.entryCount > 0 ? '⚠️' : '❌'}
                                </span>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.sleepAvg !== null ? `${ws.sleepAvg.toFixed(1)}h` : null, sleepColor)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.stressAvg !== null ? ws.stressAvg.toFixed(1) : null, stressColor)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.maxPain !== null ? ws.maxPain : null, painColor)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {pill(ws.activityHours !== null ? `${ws.activityHours}h` : null, C.navy)}
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: `1px solid #E0F2EA` }}>
                                {ws.latestCycle === 'menstruacja'
                                  ? <span title="Menstruacja">🔴</span>
                                  : ws.latestCycle
                                    ? <span style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray }}>{ws.latestCycle.slice(0, 7)}</span>
                                    : <span style={{ color: C.grayLight, fontFamily: mono, fontSize: '0.7rem' }}>—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Training stats */}
              <StatsCard
                title="Statystyki treningowe"
                period={trainingPeriod}
                onPeriodChange={setTrainingPeriod}
                cols={[
                  { key: 'Zawodniczka', left: true },
                  { key: 'Treningi', emoji: '🏋️' },
                  { key: 'Ukończone', emoji: '✅' },
                  { key: '% planu', emoji: '📊' },
                  { key: 'Śr. RPE', emoji: '🔥' },
                  { key: 'Min RPE', emoji: '↓' },
                  { key: 'Max RPE', emoji: '↑' },
                ]}
                rows={athletes.map((athlete: any) => {
                  const athFb = filterByDays(feedbacks.filter((f: any) => f.athlete_id === athlete.id), trainingPeriod, 'created_at')
                  const rpeVals = athFb.map((f: any) => f.session_rpe).filter((v: any) => v != null) as number[]
                  const rpeAvg = avg(rpeVals)
                  const completed = filterByDays(sessions.filter((s: any) => s.athlete_id === athlete.id && s.completed), trainingPeriod, 'date_completed').length
                  const progress = getAthleteProgress(athlete.id)
                  const pct = progress ? Math.round((progress.done / progress.total) * 100) : null
                  const rpeColor = rpeAvg === null ? undefined : rpeAvg >= 8 ? C.red : rpeAvg >= 6 ? C.gold : C.green
                  return {
                    id: athlete.id, name: athlete.full_name,
                    cells: [
                      { v: athFb.length || null },
                      { v: completed || null },
                      { v: pct !== null ? `${pct}%` : null, color: pct === null ? undefined : pct >= 80 ? C.green : pct >= 50 ? C.gold : C.red },
                      { v: rpeAvg !== null ? rpeAvg.toFixed(1) : null, color: rpeColor },
                      { v: rpeVals.length ? Math.min(...rpeVals) : null },
                      { v: rpeVals.length ? Math.max(...rpeVals) : null },
                    ],
                  }
                })}
                onAthleteClick={id => router.push(`/coach/athletes/${id}`)}
                style={{ marginBottom: '1.25rem' }}
              />

              {/* Historia przypisanych planów */}
              {assignmentsHistory.length > 0 && (
                <Card style={{ marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Historia przypisanych planów</div>
                  </div>
                  {assignmentsHistory.map((a: any, i: number) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < assignmentsHistory.length - 1 ? `1px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem' }}>{a.plan?.name ?? '—'}</div>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, marginTop: 2 }}>
                          {new Date(a.created_at).toLocaleDateString('pl-PL')}
                          {a.is_active ? <span style={{ marginLeft: 8, color: C.green, fontWeight: 700 }}>● aktywny</span> : <span style={{ marginLeft: 8, color: C.gray }}>zakończony</span>}
                          {a.plan?.is_archived && <span style={{ marginLeft: 8, color: C.gray }}>📦 zarchiwizowany</span>}
                        </div>
                      </div>
                      {a.plan && !a.plan.is_archived && (
                        <button onClick={() => router.push(`/coach/plans/${a.plan_id}`)} style={{ border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 7, padding: '0.3rem 0.6rem', fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                          Edytuj →
                        </button>
                      )}
                    </div>
                  ))}
                </Card>
              )}

              {/* Archiwum planów */}
              {archivedPlans.length > 0 && (
                <Card>
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
                    <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>📦 Archiwum planów</div>
                  </div>
                  {archivedPlans.map((plan: any, i: number) => (
                    <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 1.25rem', borderBottom: i < archivedPlans.length - 1 ? `1px solid ${C.grayLight}` : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: C.gray, fontSize: '0.88rem' }}>{plan.name}</div>
                        <div style={{ fontFamily: mono, fontSize: '0.6rem', color: C.grayLight, marginTop: 2 }}>
                          Utworzony {new Date(plan.created_at).toLocaleDateString('pl-PL')}
                        </div>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: '0.6rem', color: C.gray, background: C.offWhite, border: `1px solid ${C.grayLight}`, borderRadius: 6, padding: '2px 8px' }}>zarchiwizowany</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
