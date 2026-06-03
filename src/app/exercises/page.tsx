import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"

async function addExercise(formData: FormData) {
  'use server'

  const name = formData.get('name')
  const category = formData.get('category')
  const movement_pattern = formData.get('movement_pattern')
  const default_tempo = formData.get('default_tempo')
  const unilateral = formData.get('unilateral') === 'on'

  await supabase.from('exercises').insert([
    { name, category, movement_pattern, default_tempo, unilateral },
  ])
}

export default async function ExercisesPage() {
  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .order('id')

  return (
    <main style={{ minHeight: '100vh', background: C.offWhite, fontFamily: sans, color: C.navy }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
      `}</style>

      <header style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Link href="/coach" style={{ display: 'inline-block', textDecoration: 'none', background: C.navyLight, color: C.gray, borderRadius: 10, padding: '0.55rem 0.75rem', fontFamily: mono, fontSize: '0.68rem', fontWeight: 700 }}>
            ← Panel
          </Link>
          <h1 style={{ color: C.white, fontSize: '1.45rem', fontWeight: 800, marginTop: '1rem' }}>Biblioteka cwiczen</h1>
          <p style={{ color: C.gray, fontSize: '0.84rem', marginTop: 4 }}>Lista cwiczen, kategorii i domyslnych temp.</p>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.25rem 1rem 5rem' }}>
        <section style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(13,27,42,0.05)' }}>
          <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem' }}>Dodaj cwiczenie</div>
          <form action={addExercise} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, alignItems: 'center' }}>
            <input name="name" placeholder="Nazwa cwiczenia" required style={inputStyle} />
            <input name="category" placeholder="Kategoria" style={inputStyle} />
            <input name="movement_pattern" placeholder="Wzorzec ruchu" style={inputStyle} />
            <input name="default_tempo" placeholder="Tempo" style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.gray, fontSize: '0.82rem', minHeight: 44 }}>
              <input name="unilateral" type="checkbox" />
              jednostronne
            </label>
            <button type="submit" style={{ gridColumn: '1 / -1', padding: '0.85rem', borderRadius: 10, border: 'none', background: C.navy, color: C.gold, fontWeight: 800 }}>
              Dodaj
            </button>
          </form>
        </section>

        <section style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(13,27,42,0.05)' }}>
          <div style={{ padding: '1rem', borderBottom: `1.5px solid ${C.grayLight}` }}>
            <div style={{ fontFamily: mono, fontSize: '0.65rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cwiczenia</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720, textAlign: 'left' }}>
              <thead>
                <tr>
                  {['ID', 'Nazwa', 'Kategoria', 'Wzorzec ruchu', 'Tempo', 'Jednostronne'].map(label => (
                    <th key={label} style={headCellStyle}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exercises?.map(exercise => (
                  <tr key={exercise.id}>
                    <td style={cellStyle}>{exercise.id}</td>
                    <td style={{ ...cellStyle, fontWeight: 800, color: C.navy }}>{exercise.name}</td>
                    <td style={cellStyle}>{exercise.category || '—'}</td>
                    <td style={cellStyle}>{exercise.movement_pattern || '—'}</td>
                    <td style={{ ...cellStyle, fontFamily: mono, color: C.gold, fontWeight: 800 }}>{exercise.default_tempo || '—'}</td>
                    <td style={cellStyle}>{exercise.unilateral ? 'Tak' : 'Nie'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

const inputStyle = {
  width: '100%',
  minHeight: 44,
  padding: '0 0.75rem',
  border: `1.5px solid ${C.grayLight}`,
  borderRadius: 10,
  background: C.offWhite,
  color: C.navy,
  fontFamily: sans,
  outline: 'none',
}

const headCellStyle = {
  padding: '0.75rem',
  fontFamily: mono,
  fontSize: '0.65rem',
  color: C.gray,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  borderBottom: `1.5px solid ${C.grayLight}`,
}

const cellStyle = {
  padding: '0.75rem',
  borderBottom: `1.5px solid ${C.grayLight}`,
  color: C.gray,
  fontSize: '0.86rem',
}
