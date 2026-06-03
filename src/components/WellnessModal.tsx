'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Athlete } from '@/types/workout'

type WellnessLog = {
  id?: number
  sleep_hours?: number | null
  sleep_quality?: number | null
  energy?: number | null
  stress?: number | null
  mood?: number | null
  muscle_sorness?: number | null
  readiness?: number | null
  body_weight_kg?: number | null
  hydration_glasses?: number | null
  resting_hr?: number | null
  cycle_phase?: string | null
  cycle_day?: number | null
  recovery_score?: number | null
  sitting_hours?: number | null
  activity_data?: {
    type?: string
    time?: string
    duration?: string
    motivation?: number
    rpe?: number
    feelingAfter?: string
    satisfaction?: number
    goal?: string
    goalComment?: string
    note?: string
  } | null
  pain_data?: {
    painDuring?: number
    menstrualPain?: number
    headache?: number
    stomachache?: number
    jointStiffness?: number
    anxiety?: number
    headacheNote?: string
    stomachacheNote?: string
    anxietySources?: string[]
    anxietyNote?: string
    mentalOverload?: number
    mentalSources?: string[]
    mentalNote?: string
    location?: string
    note?: string
  } | null
  supplements_data?: {
    counts?: Record<string, number>
    note?: string
    caffeineSources?: string[]
    caffeineOther?: string
  } | null
  concerns?: string | null
}

type Props = {
  athlete: Athlete
  onClose: () => void
  onSaved: () => void
}

const C = {
  navy: '#0D1B2A', navyLight: '#1A2E45', navyBorder: '#243652',
  gold: '#F5C842', white: '#FFFFFF', offWhite: '#F4F6F9',
  gray: '#8A9BB0', grayLight: '#E8ECF2', green: '#22C55E', red: '#EF4444',
  orange: '#F97316', blue: '#60A5FA', violet: '#A78BFA', mint: '#34D399', cyan: '#22D3EE',
}

const sans = "'Space Grotesk', sans-serif"
const mono = "'Space Mono', monospace"
const tabs = ['Basic', 'Aktywnosci', 'Bol', 'Suplementy'] as const
type Tab = typeof tabs[number]

const optionalModules = {
  Basic: [
    { id: 'bodyWeight', label: 'Masa ciala' },
    { id: 'hydration', label: 'Nawodnienie' },
    { id: 'hrv', label: 'Tetno spoczynkowe HR' },
    { id: 'cycle', label: 'Cykl menstruacyjny' },
    { id: 'recovery', label: 'Regeneracja po treningu' },
    { id: 'sitting', label: 'Czas siedzenia' },
  ],
  Bol: [
    { id: 'menstrualPain', label: 'Bol menstruacyjny' },
    { id: 'headache', label: 'Bol glowy' },
    { id: 'stomachache', label: 'Dolegliwosci zoladkowe' },
    { id: 'jointStiffness', label: 'Sztywnosc stawow' },
    { id: 'anxiety', label: 'Lek / niepokoj' },
    { id: 'mentalOverload', label: 'Przeciazenie mentalne' },
  ],
}

const activityTypes = [
  { label: 'rest', color: '#64748B', bg: '#F1F5F9' },
  { label: 'regeneracja pasywna', color: '#60A5FA', bg: '#EFF6FF' },
  { label: 'regeneracja aktywna', color: '#34D399', bg: '#F0FDF4' },
  { label: 'rozciaganie', color: '#34D399', bg: '#F0FDF4' },
  { label: 'fizjo', color: '#34D399', bg: '#F0FDF4' },
  { label: 'basen', color: '#22D3EE', bg: '#ECFEFF' },
  { label: 'choreografia', color: '#A78BFA', bg: '#F5F3FF' },
  { label: 'akrobatyka', color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'silownia', color: '#F97316', bg: '#FFF7ED' },
  { label: 'kondycyjny', color: '#F97316', bg: '#FFF7ED' },
  { label: 'zawody', color: '#EF4444', bg: '#FEF2F2' },
  { label: 'inne', color: '#8A9BB0', bg: '#F4F6F9' },
]

type SupplementItem = { id: string; name: string; dose: string; emoji?: string; info?: string }

const defaultSupplementsList: SupplementItem[] = [
  { id: 'kreatyna', name: 'Kreatyna', dose: '2,5 g', emoji: '💪', info: 'Dlaczego jest istotna: Kreatyna zwieksza zasoby fosfokreatyny w miesniach, wspierajac szybka produkcje energii podczas krotkich i intensywnych wysilkow. Regularna suplementacja moze przyczyniac sie do poprawy sily, mocy, zdolnosci sprintowych oraz regeneracji miedzy seriami treningowymi. Jest jednym z najlepiej przebadanych suplementow stosowanych w sporcie. Zalecana dawka: najczesciej 3-5 g dziennie, dobierane indywidualnie.' },
  { id: 'beta_alanine', name: 'Beta-alanina', dose: '800 mg', emoji: '🔥', info: 'Dlaczego jest istotna: Beta-alanina zwieksza stezenie karnozyny w miesniach, ktora pomaga ograniczac zakwaszenie miesni podczas intensywnego wysilku. Moze wspierac utrzymanie wysokiej wydajnosci treningowej i opozniac wystapienie zmeczenia. Zalecana dawka: najczesciej 3,2-6,4 g dziennie, dobierane indywidualnie.' },
  { id: 'magnesium', name: 'Magnez', dose: '375 mg', emoji: '🌙', info: 'Dlaczego jest istotny: Magnez uczestniczy w procesach produkcji energii, przewodnictwie nerwowo-miesniowym oraz regeneracji organizmu. Odpowiednia podaz wspiera prawidlowa prace miesni i moze pomagac ograniczac skutki zmeczenia. Zalecana dawka: najczesciej 300-400 mg dziennie, dobierane indywidualnie.' },
  { id: 'vit_d', name: 'Witamina D3', dose: '2000 IU', emoji: '☀️', info: 'Dlaczego jest istotna: Witamina D wspiera funkcjonowanie ukladu odpornosciowego, zdrowie kosci oraz prawidlowa prace miesni. Odpowiedni poziom jest szczegolnie wazny u zawodnikow regularnie obciazanych treningowo. Zalecana dawka: najczesciej 1000-4000 IU dziennie, najlepiej w oparciu o wyniki badan laboratoryjnych.' },
  { id: 'omega3', name: 'Omega-3', dose: '1000 mg', emoji: '🐟', info: 'Dlaczego sa istotne: Kwasy tluszczowe omega-3 wspieraja zdrowie ukladu sercowo-naczyniowego, funkcjonowanie ukladu nerwowego oraz procesy regeneracyjne. Moga pomagac w kontrolowaniu stanu zapalnego zwiazanego z intensywnym wysilkiem. Zalecana dawka: najczesciej 1-2 g EPA i DHA dziennie, dobierane indywidualnie.' },
  { id: 'iron', name: 'Zelazo', dose: '14 mg', emoji: '🩸', info: 'Dlaczego jest istotne: Zelazo odpowiada za transport tlenu do miesni i tkanek. Niedobor moze prowadzic do obnizenia wydolnosci, pogorszenia regeneracji oraz szybszego wystepowania zmeczenia podczas wysilku. Zalecana dawka: suplementacja powinna byc oparta na wynikach badan laboratoryjnych i indywidualnym zapotrzebowaniu.' },
  { id: 'vit_c', name: 'Witamina C', dose: '500 mg', emoji: '🍊', info: 'Dlaczego jest istotna: Witamina C wspiera odpornosc organizmu, bierze udzial w syntezie kolagenu oraz zwieksza przyswajanie zelaza. Jest waznym elementem wspomagajacym regeneracje po wysilku. Zalecana dawka: najczesciej 200-500 mg dziennie, dobierane indywidualnie.' },
  { id: 'protein', name: 'Bialko WPC', dose: '25 g', emoji: '🥤', info: 'Dlaczego jest istotne: Bialko serwatkowe dostarcza wysokiej jakosci aminokwasow niezbednych do odbudowy i rozwoju tkanki miesniowej. Jest szczegolnie przydatne po treningu oraz wtedy, gdy trudno pokryc zapotrzebowanie na bialko z diety. Zalecana dawka: zalezy od calkowitego zapotrzebowania i sposobu zywienia zawodnika.' },
  { id: 'caffeine', name: 'Kofeina', dose: '50 mg', emoji: '☕', info: 'Dlaczego jest istotna: Kofeina wplywa na osrodkowy uklad nerwowy, poprawiajac koncentracje, czujnosc oraz zdolnosc do wykonywania wysilku. Moze wspierac wydolnosc wytrzymalosciowa i treningi o wysokiej intensywnosci. Zalecana dawka: najczesciej 3-6 mg/kg masy ciala przed wysilkiem, dobierane indywidualnie. W formularzu 1 porcja = 50 mg, zeby latwiej zaznaczac mniejsze dawki.' },
  { id: 'electrolytes', name: 'Elektrolity', dose: '1 porcja', emoji: '💧', info: 'Dlaczego sa istotne: Elektrolity pomagaja utrzymac prawidlowe nawodnienie organizmu oraz wspieraja funkcjonowanie miesni i ukladu nerwowego. Ich uzupelnianie jest szczegolnie wazne podczas dlugotrwalych treningow i zawodow ze zwiekszona utrata plynow. Zalecana dawka: dostosowana do czasu wysilku, warunkow i strat potu.' },
  { id: 'collagen', name: 'Kolagen', dose: '10 g', emoji: '🦴', info: 'Dlaczego jest istotny: Kolagen dostarcza aminokwasow wspierajacych prawidlowe funkcjonowanie stawow, sciegien i wiezadel. Moze stanowic wsparcie u zawodnikow poddawanych duzym obciazeniom treningowym oraz w okresach zwiekszonego ryzyka przeciazen. Zalecana dawka: najczesciej 10-15 g dziennie, najlepiej z witamina C, dobierane indywidualnie.' },
]

const cyclePhases = [
  { value: 'menstruacja', label: 'Menstruacja', desc: 'Dni 1-5', color: '#EF4444', bg: '#FEF2F2' },
  { value: 'folikularna', label: 'Folikularna', desc: 'Dni 6-13', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'owulacja', label: 'Owulacja', desc: 'Ok. dzien 14', color: '#22C55E', bg: '#F0FDF4' },
  { value: 'lutealna', label: 'Lutealna', desc: 'Dni 15-28', color: '#A78BFA', bg: '#F5F3FF' },
  { value: 'nie wiem', label: 'Nie wiem', desc: '', color: '#94A3B8', bg: '#F1F5F9' },
]

const motivationOptions = [
  { value: 1, label: 'Zerowa', emoji: '😴', color: '#60A5FA', bg: '#EFF6FF' },
  { value: 2, label: 'Niska', emoji: '🙄', color: '#F97316', bg: '#FFF7ED' },
  { value: 3, label: 'Srednia', emoji: '😐', color: '#8A9BB0', bg: '#F4F6F9' },
  { value: 4, label: 'Wysoka', emoji: '💪', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 5, label: 'Ogien!', emoji: '🔥', color: '#EF4444', bg: '#FEF2F2' },
]

const feelingAfterOptions = [
  { value: 'swietnie', label: 'Swietnie', emoji: '🤩', color: '#A78BFA', bg: '#F5F3FF' },
  { value: 'dobrze', label: 'Dobrze', emoji: '😊', color: '#22C55E', bg: '#F0FDF4' },
  { value: 'ok', label: 'OK', emoji: '😐', color: '#8A9BB0', bg: '#F4F6F9' },
  { value: 'zmeczona', label: 'Zmeczona', emoji: '😓', color: '#F97316', bg: '#FFF7ED' },
  { value: 'slabo', label: 'Slabo', emoji: '😞', color: '#EF4444', bg: '#FEF2F2' },
]

const goalOptions = [
  { value: 'tak', label: 'Tak, zrealizowalam', color: '#22C55E', bg: '#F0FDF4' },
  { value: 'czesciowo', label: 'Czesciowo', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'nie', label: 'Nie', color: '#EF4444', bg: '#FEF2F2' },
  { value: 'brak', label: 'Brak planu', color: '#94A3B8', bg: '#F1F5F9' },
]

const mentalSources = ['Szkola / egzaminy', 'Trening / zawody', 'Rodzina', 'Relacje', 'Wszystko naraz', 'Nie wiem']
const anxietySources = ['Szkoła / egzaminy', 'Trening / zawody', 'Zdrowie', 'Relacje', 'Rodzina', 'Nie wiem']
const caffeineSourceOptions = ['Kawa', 'Herbata', 'Matcha', 'Energetyk', 'Tabletka', 'Inne']

function scaleColor(value: number, min: number, max: number, inverse: boolean) {
  const pct = ((value - min) / (max - min)) * 100
  const risk = inverse ? pct : 100 - pct
  if (risk <= 30) return C.green
  if (risk <= 55) return C.gold
  if (risk <= 75) return C.orange
  return C.red
}

function scaleComment(value: number, max: number, low: string, mid: string, high: string) {
  const pct = (value / max) * 100
  if (pct <= 33) return low
  if (pct <= 66) return mid
  return high
}

const sleepQualityComments = ['Brak regenerujacego snu','Bardzo slaby sen','Slaby sen, moze obnizac forme','Sen raczej plytki','Ponizej optymalnie','Srednia jakosc snu','Calkiem dobry sen','Dobry sen','Bardzo dobry sen','Swietna regeneracja','Maksymalnie regenerujacy sen']
const readinessComments = ['Bardzo duze zmeczenie','Cialo prosi o spokojniejszy start','Niska gotowosc','Raczej zmeczona','Lekko ponizej normy','Normalnie','Calkiem wypoczeta','Dobra gotowosc','Bardzo wypoczeta','Swietna gotowosc','Pelna gotowosc']
const energyComments = ['Brak energii','Bardzo niska energia','Trzeba oszczedzac baterie','Energia ponizej normy','Troche ciezki start','Stabilnie','Energia w porzadku','Dobra energia','Bardzo dobra energia','Wysoka energia','Pelna moc']
const stressComments = ['Pelny spokoj','Bardzo niski stres','Spokojna glowa','Lekki stres','Do ogarniecia','Umiarkowanie','Podwyzszone napiecie','Warto obserwowac','Duzo stresu','Bardzo duze obciazenie','Alarmowo wysoki stres']
const sorenessComments = ['Brak zakwasow','Ledwo wyczuwalne','Lekkie zakwasy','Czuc miesnie, ale bez problemu','Umiarkowane zakwasy','Wyrazne zakwasy','Moga wplywac na ruch','Mocne zakwasy','Ciezko wejsc w trening','Bardzo mocne obciazenie miesni','Regeneracja priorytetem']
const painComments = ['Brak bolu','Minimalny sygnal','Lekki dyskomfort','Do obserwacji','Umiarkowany bol','Wyrazny bol','Moze ograniczac trening','Wazne dla trenera','Mocno ogranicza','Bardzo silny bol','Alarmowo - nie ignorowac']
const anxietyComments = ['Spokoj','Minimalne napiecie','Lekki niepokoj','Do ogarniecia','Troche podwyzszone','Umiarkowany niepokoj','Warto obserwowac','Duzo napiecia','Silny lek','Bardzo silny lek','Potrzebny spokoj i wsparcie']

function scaleText(value: number, comments: string[]) {
  return comments[Math.max(0, Math.min(comments.length - 1, Math.round(value)))]
}

function readinessEmoji(value: number) {
  if (value <= 1) return '😴'
  if (value <= 3) return '😪'
  if (value <= 5) return '😐'
  if (value <= 8) return '😊'
  return '⚡'
}

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, padding: '1rem', boxShadow: '0 12px 34px rgba(13,27,42,0.07)' }}>
      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>{title}</div>
      {children}
    </section>
  )
}

function SliderField({ label, subtitle, emoji, scaleStart, scaleEnd, neutral = false, value, onChange, min, max, step = 1, unit = '', inverse = false, lowLabel, highLabel, valueLabel }: {
  label: string; subtitle?: string; emoji?: string; scaleStart?: string; scaleEnd?: string; neutral?: boolean
  value: number; onChange: (value: number) => void; min: number; max: number; step?: number; unit?: string
  inverse?: boolean; lowLabel?: string; highLabel?: string; valueLabel?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const color = neutral ? C.gray : scaleColor(value, min, max, inverse)
  const track = `linear-gradient(90deg, ${color} 0%, ${color} ${pct}%, #343434 ${pct}%, #343434 100%)`
  const styleVars = { '--range-bg': track, '--range-color': color } as CSSProperties
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: C.navy, fontSize: '0.95rem' }}>
            {emoji && <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{emoji}</span>}
            <span>{label}</span>
          </div>
          {subtitle && <div style={{ color: C.gray, fontSize: '0.78rem', marginTop: 3 }}>{subtitle}</div>}
        </div>
        <span style={{ fontFamily: mono, color, fontWeight: 900, fontSize: '1rem', whiteSpace: 'nowrap' }}>{value}{unit}</span>
      </div>
      {(scaleStart || scaleEnd) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: C.gray, fontSize: '0.78rem', fontWeight: 700, marginBottom: 7 }}>
          <span>{scaleStart}</span><span style={{ textAlign: 'right' }}>{scaleEnd}</span>
        </div>
      )}
      <input className="wellness-range" type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={styleVars} />
      {(lowLabel || highLabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 10 }}>
          <span style={{ fontSize: '0.72rem', color: inverse ? C.green : C.gray, fontWeight: 700 }}>{lowLabel}</span>
          <span style={{ fontSize: '0.72rem', color: inverse ? C.red : C.green, fontWeight: 700, textAlign: 'right' }}>{highLabel}</span>
        </div>
      )}
      {valueLabel && <div style={{ color, fontSize: '0.78rem', fontWeight: 900, marginTop: 6, textAlign: 'center' }}>{valueLabel}</div>}
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 5, fontWeight: 700 }}>{label}</div>
      <input value={value} type={type} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.75rem', outline: 'none', fontSize: '0.9rem' }} />
    </label>
  )
}

function ColorChoiceGrid<T extends string | number>({ options, value, onChange, columns = 2, showDot = true }: {
  options: { value: T; label: string; desc?: string; emoji?: string; color: string; bg: string }[]
  value: T; onChange: (v: T) => void; columns?: number; showDot?: boolean
}) {
  const tight = columns >= 5
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: tight ? 6 : 8 }}>
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <button key={String(opt.value)} onClick={() => onChange(opt.value)} style={{ minWidth: 0, minHeight: 68, border: `1.5px solid ${opt.color}55`, borderRadius: 12, background: selected ? opt.color : opt.bg, color: selected ? C.white : opt.color, padding: tight ? '0.62rem 0.42rem' : '0.7rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: tight ? 'center' : 'flex-start', gap: tight ? 6 : 10, textAlign: tight ? 'center' : 'left', boxShadow: selected ? '0 10px 24px rgba(13,27,42,0.14)' : 'none', fontWeight: 900 }}>
            {opt.emoji ? <span style={{ fontSize: '1.35rem', lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</span> : showDot ? <span style={{ width: 18, height: 18, borderRadius: '50%', background: selected ? C.white : opt.color, boxShadow: `0 2px 8px ${opt.color}66`, flexShrink: 0 }} /> : null}
            <span style={{ flex: showDot || opt.emoji ? 'initial' : 1, textAlign: showDot || opt.emoji ? undefined : 'center' }}>
              <span style={{ display: 'block', fontSize: tight ? '0.76rem' : '0.9rem', overflowWrap: 'anywhere' }}>{opt.label}</span>
              {opt.desc && <span style={{ display: 'block', marginTop: 3, fontSize: '0.72rem', opacity: 0.82 }}>{opt.desc}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TintedPanel({ title, color, bg, children }: { title: string; color: string; bg: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1.5px solid ${color}55`, background: bg, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ color, fontWeight: 900, marginBottom: '0.75rem' }}>{title}</div>
      {children}
    </div>
  )
}

function InfoTooltip({ text, active = false }: { text: string; active?: boolean }) {
  return (
    <span className="supp-info" tabIndex={0} title={text} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${active ? C.gold : C.grayLight}`, background: active ? C.navy : C.offWhite, color: active ? C.gold : C.gray, fontFamily: mono, fontSize: '0.72rem', fontWeight: 900, flexShrink: 0, cursor: 'help' }}>
      i
      <span className="supp-tooltip" style={{ position: 'absolute', left: '50%', bottom: 'calc(100% + 10px)', transform: 'translateX(-50%)', width: 260, maxWidth: '70vw', background: C.navy, color: C.white, border: `1.5px solid ${C.gold}`, borderRadius: 12, padding: '0.75rem', fontFamily: sans, fontSize: '0.76rem', lineHeight: 1.35, fontWeight: 700, boxShadow: '0 14px 36px rgba(13,27,42,0.24)', zIndex: 20, display: 'none', pointerEvents: 'none' }}>
        {text}
      </span>
    </span>
  )
}

function readStored(key: string, fallback: string[]) {
  if (typeof window === 'undefined') return fallback
  try { const s = window.localStorage.getItem(key); return s ? JSON.parse(s) as string[] : fallback } catch { return fallback }
}

function readStoredSupplements() {
  if (typeof window === 'undefined') return defaultSupplementsList
  try { const s = window.localStorage.getItem('wellness-supplements-list'); return s ? JSON.parse(s) as SupplementItem[] : defaultSupplementsList } catch { return defaultSupplementsList }
}

function ModuleDrawer({ title, modules, activeModules, onToggle, onClose }: { title: string; modules: { id: string; label: string }[]; activeModules: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(13,27,42,0.64)', display: 'flex', justifyContent: 'flex-end', borderRadius: 'inherit' }} onClick={onClose}>
      <div style={{ width: 'min(86vw, 320px)', height: '100%', background: C.white, padding: '1.25rem', overflowY: 'auto', borderRadius: '0 20px 0 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Dostosuj karte</div>
            <div style={{ fontWeight: 900, color: C.navy }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: C.offWhite, color: C.gray, borderRadius: 8, width: 34, height: 34, fontWeight: 900 }}>x</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modules.map(m => {
            const active = activeModules.includes(m.id)
            return (
              <button key={m.id} onClick={() => onToggle(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1.5px solid ${active ? C.gold : C.grayLight}`, background: active ? C.navy : C.offWhite, color: active ? C.gold : C.navy, borderRadius: 11, padding: '0.8rem', textAlign: 'left', fontWeight: 800 }}>
                <span>{m.label}</span>
                <span style={{ width: 42, height: 24, borderRadius: 12, background: active ? C.gold : C.grayLight, position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: active ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: C.white, transition: 'left 0.2s' }} />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function WellnessModal({ athlete, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [existingWellness, setExistingWellness] = useState<WellnessLog | null>(null)
  const dateIso = new Date().toISOString().split('T')[0]

  const [activeTab, setActiveTab] = useState<Tab>('Basic')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeBasicModules, setActiveBasicModules] = useState<string[]>(['bodyWeight', 'cycle', 'recovery'])
  const [activePainModules, setActivePainModules] = useState<string[]>([])

  const [sleepHours, setSleepHours] = useState(7.5)
  const [sleepQuality, setSleepQuality] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [stress, setStress] = useState(0)
  const [soreness, setSoreness] = useState(0)
  const [readiness, setReadiness] = useState(5)
  const [concerns, setConcerns] = useState('')

  const [bodyWeight, setBodyWeight] = useState('')
  const [hydration, setHydration] = useState(7.5)
  const [hrv, setHrv] = useState(60)
  const [cyclePhase, setCyclePhase] = useState('')
  const [cycleDay, setCycleDay] = useState('')
  const [recovery, setRecovery] = useState(5)
  const [sittingHours, setSittingHours] = useState(0)

  const [activityType, setActivityType] = useState('')
  const [activityTime, setActivityTime] = useState('')
  const [activityDuration, setActivityDuration] = useState('')
  const [activityMotivation, setActivityMotivation] = useState(3)
  const [activityRpe, setActivityRpe] = useState(0)
  const [activityFeelingAfter, setActivityFeelingAfter] = useState('ok')
  const [activitySatisfaction, setActivitySatisfaction] = useState(5)
  const [activityGoal, setActivityGoal] = useState('')
  const [activityGoalComment, setActivityGoalComment] = useState('')
  const [activityNote, setActivityNote] = useState('')

  const [painDuring, setPainDuring] = useState(0)
  const [menstrualPain, setMenstrualPain] = useState(0)
  const [headache, setHeadache] = useState(0)
  const [stomachache, setStomachache] = useState(0)
  const [jointStiffness, setJointStiffness] = useState(0)
  const [anxiety, setAnxiety] = useState(0)
  const [headacheNote, setHeadacheNote] = useState('')
  const [stomachacheNote, setStomachacheNote] = useState('')
  const [selectedAnxietySources, setSelectedAnxietySources] = useState<string[]>([])
  const [anxietyNote, setAnxietyNote] = useState('')
  const [mentalOverload, setMentalOverload] = useState(0)
  const [selectedMentalSources, setSelectedMentalSources] = useState<string[]>([])
  const [mentalNote, setMentalNote] = useState('')
  const [painLocation, setPainLocation] = useState('')
  const [painNote, setPainNote] = useState('')

  const [supplementsList, setSupplementsList] = useState<SupplementItem[]>(defaultSupplementsList)
  const [supplements, setSupplements] = useState<Record<string, number>>({})
  const [supplementNote, setSupplementNote] = useState('')
  const [caffeineSources, setCaffeineSources] = useState<string[]>([])
  const [caffeineOther, setCaffeineOther] = useState('')
  const [suppEditOpen, setSuppEditOpen] = useState(false)
  const [newSuppName, setNewSuppName] = useState('')
  const [newSuppDose, setNewSuppDose] = useState('')
  const [newSuppUnit, setNewSuppUnit] = useState('mg')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setActiveBasicModules(readStored('wellness-basic-modules', ['bodyWeight', 'cycle', 'recovery']))
    setActivePainModules(readStored('wellness-pain-modules', []))
    setSupplementsList(readStoredSupplements())

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    supabase.from('wellness_logs').select('*')
      .eq('athlete_id', athlete.id)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingWellness(data)
          setSleepHours(data.sleep_hours ?? 7.5)
          setSleepQuality(data.sleep_quality ?? 5)
          setEnergy(data.energy ?? 5)
          setStress(data.stress ?? 0)
          setSoreness(data.muscle_sorness ?? 0)
          setReadiness(data.readiness ?? 5)
          setBodyWeight(data.body_weight_kg?.toString() ?? '')
          setHydration(data.hydration_glasses ?? 7.5)
          setHrv(data.resting_hr ?? 60)
          setCyclePhase(data.cycle_phase ?? '')
          setCycleDay(data.cycle_day?.toString() ?? '')
          setRecovery(data.recovery_score ?? 5)
          setSittingHours(data.sitting_hours ?? 0)
          if (data.activity_data) {
            setActivityType(data.activity_data.type ?? '')
            setActivityTime(data.activity_data.time ?? '')
            setActivityDuration(data.activity_data.duration ?? '')
            setActivityMotivation(data.activity_data.motivation ?? 3)
            setActivityRpe(data.activity_data.rpe ?? 0)
            setActivityFeelingAfter(data.activity_data.feelingAfter ?? 'ok')
            setActivitySatisfaction(data.activity_data.satisfaction ?? 5)
            setActivityGoal(data.activity_data.goal ?? '')
            setActivityGoalComment(data.activity_data.goalComment ?? '')
            setActivityNote(data.activity_data.note ?? '')
          }
          if (data.pain_data) {
            setPainDuring(data.pain_data.painDuring ?? 0)
            setMenstrualPain(data.pain_data.menstrualPain ?? 0)
            setHeadache(data.pain_data.headache ?? 0)
            setStomachache(data.pain_data.stomachache ?? 0)
            setJointStiffness(data.pain_data.jointStiffness ?? 0)
            setAnxiety(data.pain_data.anxiety ?? 0)
            setHeadacheNote(data.pain_data.headacheNote ?? '')
            setStomachacheNote(data.pain_data.stomachacheNote ?? '')
            setSelectedAnxietySources(data.pain_data.anxietySources ?? [])
            setAnxietyNote(data.pain_data.anxietyNote ?? '')
            setMentalOverload(data.pain_data.mentalOverload ?? 0)
            setSelectedMentalSources(data.pain_data.mentalSources ?? [])
            setMentalNote(data.pain_data.mentalNote ?? '')
            setPainLocation(data.pain_data.location ?? '')
            setPainNote(data.pain_data.note ?? '')
          }
          if (data.supplements_data) {
            setSupplements(data.supplements_data.counts ?? {})
            setSupplementNote(data.supplements_data.note ?? '')
            setCaffeineSources(data.supplements_data.caffeineSources ?? [])
            setCaffeineOther(data.supplements_data.caffeineOther ?? '')
          }

          // Auto-włącz moduły Basic jeśli mają dane w bazie
          const basicToEnable: string[] = []
          if (data.body_weight_kg != null) basicToEnable.push('bodyWeight')
          if (data.hydration_glasses != null) basicToEnable.push('hydration')
          if (data.resting_hr != null) basicToEnable.push('hrv')
          if (data.cycle_phase != null) basicToEnable.push('cycle')
          if (data.recovery_score != null) basicToEnable.push('recovery')
          if (data.sitting_hours != null) basicToEnable.push('sitting')
          if (basicToEnable.length > 0) {
            setActiveBasicModules(prev => [...new Set([...prev, ...basicToEnable])])
          }

          // Auto-włącz moduły Ból jeśli mają dane
          const painToEnable: string[] = []
          const pd = data.pain_data
          if (pd?.menstrualPain != null) painToEnable.push('menstrualPain')
          if (pd?.headache != null) painToEnable.push('headache')
          if (pd?.stomachache != null) painToEnable.push('stomachache')
          if (pd?.jointStiffness != null) painToEnable.push('jointStiffness')
          if (pd?.anxiety != null) painToEnable.push('anxiety')
          if (pd?.mentalOverload != null) painToEnable.push('mentalOverload')
          if (painToEnable.length > 0) {
            setActivePainModules(prev => [...new Set([...prev, ...painToEnable])])
          }

          // Jeśli concerns wygląda jak stary text-dump (stary format), nie pokazuj go w polu
          const rawConcerns = data.concerns ?? ''
          const isOldDump = rawConcerns.includes('Aktywnosc:') || rawConcerns.includes('Basic dodatkowe:') || rawConcerns.includes('Suplementy:')
          setConcerns(isOldDump ? '' : rawConcerns)

          setSaved(true)
        }
        setLoading(false)
      })
  }, [])

  const progress = useMemo(() => {
    return [sleepHours, sleepQuality, energy, stress, soreness, readiness].filter(v => v !== null && v !== undefined).length
  }, [sleepHours, sleepQuality, energy, stress, soreness, readiness])

  function supplementCount(id: string) { return supplements[id] || 0 }
  function updateSupplement(id: string, delta: number) { setSupplements(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) })) }
  function saveSupplementsList(next: SupplementItem[]) { setSupplementsList(next); window.localStorage.setItem('wellness-supplements-list', JSON.stringify(next)) }
  function removeSupplement(id: string) { saveSupplementsList(supplementsList.filter(i => i.id !== id)); setSupplements(prev => { const n = { ...prev }; delete n[id]; return n }) }
  function addSupplement() {
    const name = newSuppName.trim(); const dose = newSuppDose.trim()
    if (!name || !dose) return
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`
    saveSupplementsList([...supplementsList, { id, name, dose: `${dose} ${newSuppUnit}` }])
    setNewSuppName(''); setNewSuppDose(''); setNewSuppUnit('mg')
  }
  function toggleBasicModule(id: string) { setActiveBasicModules(prev => { const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]; window.localStorage.setItem('wellness-basic-modules', JSON.stringify(next)); return next }) }
  function togglePainModule(id: string) { setActivePainModules(prev => { const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]; window.localStorage.setItem('wellness-pain-modules', JSON.stringify(next)); return next }) }
  function toggleMentalSource(s: string) { setSelectedMentalSources(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]) }
  function toggleAnxietySource(s: string) { setSelectedAnxietySources(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]) }
  function toggleCaffeineSource(s: string) { setCaffeineSources(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]) }

  async function saveWellness() {
    setSaving(true); setSaveError('')
    const extendedPayload = {
      athlete_id: athlete.id, sleep_hours: sleepHours, sleep_quality: sleepQuality, energy, stress, mood: null, muscle_sorness: soreness, readiness, concerns: concerns.trim() || null,
      body_weight_kg: activeBasicModules.includes('bodyWeight') && bodyWeight ? parseFloat(bodyWeight) : null,
      hydration_glasses: activeBasicModules.includes('hydration') ? hydration : null,
      resting_hr: activeBasicModules.includes('hrv') ? hrv : null,
      cycle_phase: activeBasicModules.includes('cycle') ? cyclePhase || null : null,
      cycle_day: activeBasicModules.includes('cycle') && cycleDay ? parseInt(cycleDay) : null,
      recovery_score: activeBasicModules.includes('recovery') ? recovery : null,
      sitting_hours: activeBasicModules.includes('sitting') ? sittingHours : null,
      activity_data: { type: activityType, time: activityTime, duration: activityDuration, motivation: activityMotivation, rpe: activityRpe, feelingAfter: activityFeelingAfter, satisfaction: activitySatisfaction, goal: activityGoal, goalComment: activityGoalComment, note: activityNote },
      pain_data: { painDuring, menstrualPain: activePainModules.includes('menstrualPain') ? menstrualPain : null, headache: activePainModules.includes('headache') ? headache : null, stomachache: activePainModules.includes('stomachache') ? stomachache : null, jointStiffness: activePainModules.includes('jointStiffness') ? jointStiffness : null, anxiety: activePainModules.includes('anxiety') ? anxiety : null, headacheNote: activePainModules.includes('headache') ? headacheNote : '', stomachacheNote: activePainModules.includes('stomachache') ? stomachacheNote : '', anxietySources: activePainModules.includes('anxiety') ? selectedAnxietySources : [], anxietyNote: activePainModules.includes('anxiety') ? anxietyNote : '', mentalOverload: activePainModules.includes('mentalOverload') ? mentalOverload : null, mentalSources: activePainModules.includes('mentalOverload') ? selectedMentalSources : [], mentalNote: activePainModules.includes('mentalOverload') ? mentalNote : '', location: painLocation, note: painNote },
      supplements_data: { counts: supplements, note: supplementNote, caffeineSources, caffeineOther },
    }
    const { error } = existingWellness?.id
      ? await supabase.from('wellness_logs').update(extendedPayload).eq('id', existingWellness.id)
      : await supabase.from('wellness_logs').insert(extendedPayload)
    if (error && (error.message.includes('body_weight_kg') || error.message.includes('activity_data') || error.message.includes('pain_data') || error.message.includes('supplements_data'))) {
      const fallback = { athlete_id: athlete.id, sleep_hours: sleepHours, sleep_quality: sleepQuality, energy, stress, mood: null, muscle_sorness: soreness, readiness, concerns: concerns.trim() || null }
      const { error: fe } = existingWellness?.id ? await supabase.from('wellness_logs').update(fallback).eq('id', existingWellness.id) : await supabase.from('wellness_logs').insert(fallback)
      setSaving(false)
      if (fe) { setSaveError(fe.message); return }
      setSaved(true); onSaved(); onClose(); return
    }
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setSaved(true); onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,27,42,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: sans }} onClick={onClose}>
      <style>{`
        .wellness-range { width: 100%; height: 8px; border-radius: 999px; border: 0; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; background: var(--range-bg); }
        .wellness-range::-webkit-slider-thumb { width: 19px; height: 19px; border-radius: 50%; border: 0; background: var(--range-color); box-shadow: 0 4px 12px rgba(13,27,42,0.22); appearance: none; -webkit-appearance: none; }
        .wellness-range::-moz-range-thumb { width: 19px; height: 19px; border-radius: 50%; border: 0; background: var(--range-color); box-shadow: 0 4px 12px rgba(13,27,42,0.22); }
        .supp-info:hover .supp-tooltip, .supp-info:focus .supp-tooltip { display: block !important; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 680, background: C.offWhite, borderRadius: '20px 20px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderTop: `4px solid ${C.gold}`, position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: C.offWhite, padding: '1rem 1.25rem 0', flexShrink: 0, borderBottom: `1.5px solid ${C.grayLight}`, paddingBottom: '0.95rem' }}>
          <div style={{ width: 42, height: 4, borderRadius: 2, background: '#DDE3EA', margin: '0 auto 1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', marginBottom: '0.85rem' }}>
            <button onClick={onClose} style={{ border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 10, padding: '0.65rem 0.8rem', fontWeight: 800, fontFamily: sans }}>← Wstecz</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.navy, fontWeight: 900, fontSize: '1.12rem' }}>Dzienny wellness</div>
              <div style={{ color: C.gray, fontSize: '0.74rem', fontWeight: 700, marginTop: 2 }}>{formatLongDate(dateIso)}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: saved ? C.green : C.gold, color: saved ? C.white : C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 900 }}>{progress}/6</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {tabs.map(tab => {
              const active = activeTab === tab
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ border: 'none', borderRadius: active ? 9 : 0, background: active ? C.navy : 'transparent', color: active ? C.gold : C.gray, padding: '0.55rem 0.25rem', fontWeight: 900, fontSize: '0.72rem', borderBottom: active ? 'none' : `2px solid ${C.grayLight}`, fontFamily: sans }}>
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        {drawerOpen && (activeTab === 'Basic' || activeTab === 'Bol') && (
          <ModuleDrawer
            title={activeTab}
            modules={activeTab === 'Basic' ? optionalModules.Basic : optionalModules.Bol}
            activeModules={activeTab === 'Basic' ? activeBasicModules : activePainModules}
            onToggle={activeTab === 'Basic' ? toggleBasicModule : togglePainModule}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1rem 0' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.gray, fontWeight: 700 }}>Ładowanie...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>

              {(activeTab === 'Basic' || activeTab === 'Bol') && (
                <button onClick={() => setDrawerOpen(true)} style={{ alignSelf: 'flex-end', border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 10, padding: '0.65rem 0.85rem', fontWeight: 800, fontFamily: sans }}>
                  Edytuj pola
                </button>
              )}

              {activeTab === 'Basic' && (
                <>
                  <Section title="Basic - najwazniejsze">
                    <SliderField label="Sen - ilosc godzin" subtitle="Ile godzin spalas ostatniej nocy?" value={sleepHours} onChange={setSleepHours} min={0} max={12} step={0.5} unit="h" lowLabel="Za malo snu" highLabel="Dobry zapas regeneracji" valueLabel={scaleComment(sleepHours, 12, 'Organizm moze potrzebowac lzej', 'W porzadku', 'Bardzo dobra baza')} />
                    <SliderField label="Jakosc snu" value={sleepQuality} onChange={setSleepQuality} min={0} max={10} scaleStart="0 = bardzo slabo" scaleEnd="10 = swietnie" lowLabel="Slaby sen" highLabel="Swietny sen" valueLabel={scaleText(sleepQuality, sleepQualityComments)} />
                    <SliderField label="Poziom wypoczecia" subtitle="Jak bardzo czujesz sie wypoczeta po nocy?" emoji={readinessEmoji(readiness)} value={readiness} onChange={setReadiness} min={0} max={10} lowLabel="Bardzo zmeczona" highLabel="Bardzo wypoczeta" valueLabel={scaleText(readiness, readinessComments)} />
                    <SliderField label="Energia" subtitle="Ile masz dzisiaj energii do dzialania?" value={energy} onChange={setEnergy} min={0} max={10} lowLabel="Niska" highLabel="Wysoka" valueLabel={scaleText(energy, energyComments)} />
                    <SliderField label="Obciazenie stresem" value={stress} onChange={setStress} min={0} max={10} inverse scaleStart="0 = spokojnie" scaleEnd="10 = bardzo duzo stresu" lowLabel="Spokojnie" highLabel="Duzo stresu" valueLabel={scaleText(stress, stressComments)} />
                  </Section>
                  <Section title="Dodatkowe obserwacje">
                    {activeBasicModules.length === 0 && <div style={{ color: C.gray, fontSize: '0.86rem' }}>Brak dodatkowych pol. Kliknij Edytuj pola, zeby wybrac co chcesz sledzic.</div>}
                    {activeBasicModules.includes('bodyWeight') && <div style={{ marginBottom: '1rem' }}><TextInput label="Masa ciala" value={bodyWeight} onChange={setBodyWeight} placeholder="kg" type="number" /></div>}
                    {activeBasicModules.includes('hydration') && <SliderField label="Nawodnienie" subtitle="Ilosc szklanek wody (250ml)" value={hydration} onChange={setHydration} min={0} max={15} step={0.5} unit=" szkl." lowLabel="0 szkl." highLabel="15 szkl." valueLabel={scaleComment(hydration, 15, 'Do uzupelnienia', 'Niezle', 'Dobre nawodnienie')} />}
                    {activeBasicModules.includes('hrv') && <SliderField label="Tetno spoczynkowe HR" value={hrv} onChange={setHrv} min={40} max={120} unit=" bpm" neutral />}
                    {activeBasicModules.includes('recovery') && <SliderField label="Jakosc regeneracji po ostatnim treningu" subtitle="Jak dobrze czujesz, ze sie zregenerowalas?" value={recovery} onChange={setRecovery} min={0} max={10} lowLabel="Slaba regeneracja" highLabel="Pelna regeneracja" valueLabel={scaleComment(recovery, 10, 'Cialo prosi o ostroznosc', 'Regeneracja srednia', 'Gotowosc wyglada dobrze')} />}
                    {activeBasicModules.includes('sitting') && <SliderField label="Czas siedzenia" value={sittingHours} onChange={setSittingHours} min={0} max={16} step={0.5} unit="h" inverse lowLabel="Malo siedzenia" highLabel="Duzo siedzenia" />}
                    {activeBasicModules.includes('cycle') && (
                      <div>
                        <div style={{ fontWeight: 900, color: C.navy, marginBottom: 4 }}>Faza cyklu menstruacyjnego</div>
                        <div style={{ color: C.gray, fontSize: '0.82rem', marginBottom: '0.75rem' }}>Pomaga trenerowi lepiej planowac intensywnosc</div>
                        <ColorChoiceGrid options={cyclePhases} value={cyclePhase} onChange={setCyclePhase} columns={1} />
                        <div style={{ marginTop: '0.75rem' }}><TextInput label="Dzien cyklu" value={cycleDay} onChange={setCycleDay} placeholder="np. 12" type="number" /></div>
                      </div>
                    )}
                  </Section>
                </>
              )}

              {activeTab === 'Aktywnosci' && (
                <Section title="Aktywnosc dnia">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                    <TextInput label="Godzina" value={activityTime} onChange={setActivityTime} type="time" />
                    <TextInput label="Czas" value={activityDuration} onChange={setActivityDuration} placeholder="min" type="number" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: '1rem' }}>
                    {activityTypes.map(t => (
                      <button key={t.label} onClick={() => setActivityType(t.label)} style={{ border: `1.5px solid ${activityType === t.label ? t.color : t.color + '44'}`, background: activityType === t.label ? t.color : t.bg, color: activityType === t.label ? C.white : t.color, borderRadius: 11, padding: '0.65rem', fontWeight: 800, fontSize: '0.78rem', boxShadow: activityType === t.label ? '0 8px 18px rgba(13,27,42,0.14)' : 'none', fontFamily: sans }}>{t.label}</button>
                    ))}
                  </div>
                  <textarea value={activityNote} onChange={e => setActivityNote(e.target.value)} placeholder="Opis aktywnosci, miejsce, jak poszlo..." rows={4} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem', marginBottom: '1rem' }} />
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: C.gray, fontSize: '0.82rem', marginBottom: 8 }}>Motywacja do treningu</div>
                    <ColorChoiceGrid options={motivationOptions} value={activityMotivation} onChange={setActivityMotivation} columns={5} />
                  </div>
                  <SliderField label="RPE - subiektywna ciezkosc wysilku" value={activityRpe} onChange={setActivityRpe} min={0} max={10} inverse scaleStart="0 = brak wysilku" scaleEnd="10 = maksimum" lowLabel="0" highLabel="10" valueLabel={scaleComment(activityRpe, 10, 'Lekko', 'Umiarkowanie', 'Bardzo ciezko')} />
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: C.gray, fontSize: '0.82rem', marginBottom: 2 }}>Samopoczucie po aktywnosci</div>
                    <div style={{ color: '#7C8FFB', fontSize: '0.78rem', fontStyle: 'italic', marginBottom: 8 }}>fizyczne / energetyczne - jak czuje sie cialo?</div>
                    <ColorChoiceGrid options={feelingAfterOptions} value={activityFeelingAfter} onChange={setActivityFeelingAfter} columns={5} />
                  </div>
                  <SliderField label="Ocena satysfakcji" subtitle="emocjonalna / mentalna - jak oceniasz jakosc tego treningu?" value={activitySatisfaction} onChange={setActivitySatisfaction} min={0} max={10} lowLabel="0" highLabel="10" valueLabel={scaleComment(activitySatisfaction, 10, 'Slabo', 'OK', 'Bardzo dobrze')} />
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: C.gray, fontSize: '0.82rem', marginBottom: 8 }}>Czy zrealizowalas plan?</div>
                    <ColorChoiceGrid options={goalOptions} value={activityGoal} onChange={setActivityGoal} columns={4} showDot={false} />
                  </div>
                  {(activityGoal === 'czesciowo' || activityGoal === 'nie') && (
                    <textarea value={activityGoalComment} onChange={e => setActivityGoalComment(e.target.value)} placeholder="Co pominelas lub zrobilas inaczej?" rows={3} style={{ width: '100%', border: '1.5px solid #FDBA74', background: '#FFF7ED', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem', marginBottom: '1rem' }} />
                  )}
                </Section>
              )}

              {activeTab === 'Bol' && (
                <Section title="Bol i obciazenie">
                  <SliderField label="Zakwasy" subtitle="0 = brak · 10 = bardzo mocne" value={soreness} onChange={setSoreness} min={0} max={10} inverse lowLabel="Brak zakwasow" highLabel="Bardzo mocne" valueLabel={scaleText(soreness, sorenessComments)} />
                  <SliderField label="Bol podczas dnia/treningu" value={painDuring} onChange={setPainDuring} min={0} max={10} inverse scaleStart="0 = brak bolu" scaleEnd="10 = silny bol" lowLabel="Brak bolu" highLabel="Silny bol" valueLabel={scaleText(painDuring, painComments)} />
                  {activePainModules.includes('menstrualPain') && <TintedPanel title="🩸 Bol menstruacyjny (VAS)" color="#EF4444" bg="#FEF2F2"><SliderField label="Poziom bolu" value={menstrualPain} onChange={setMenstrualPain} min={0} max={10} inverse lowLabel="0" highLabel="10" /></TintedPanel>}
                  {activePainModules.includes('headache') && <TintedPanel title="Bol glowy" color="#EF4444" bg="#FEF2F2"><SliderField label="Nasilenie" value={headache} onChange={setHeadache} min={0} max={10} inverse lowLabel="Brak" highLabel="Silny" valueLabel={scaleText(headache, painComments)} /><textarea value={headacheNote} onChange={e => setHeadacheNote(e.target.value)} placeholder="Z jakiego powodu? np. zmeczenie, stres, za malo wody, ekran..." rows={3} style={{ width: '100%', border: '1.5px solid #FCA5A5', background: '#FFF7F7', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} /></TintedPanel>}
                  {activePainModules.includes('stomachache') && <TintedPanel title="Dolegliwosci zoladkowe" color="#F97316" bg="#FFF7ED"><SliderField label="Nasilenie" value={stomachache} onChange={setStomachache} min={0} max={10} inverse lowLabel="Brak" highLabel="Silne" valueLabel={scaleText(stomachache, painComments)} /><textarea value={stomachacheNote} onChange={e => setStomachacheNote(e.target.value)} placeholder="Z jakiego powodu?" rows={3} style={{ width: '100%', border: '1.5px solid #FDBA74', background: '#FFFBEB', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} /></TintedPanel>}
                  {activePainModules.includes('jointStiffness') && <TintedPanel title="🦴 Sztywnosc stawow" color="#0EA5E9" bg="#ECFEFF"><SliderField label="Poziom sztywnosci" value={jointStiffness} onChange={setJointStiffness} min={0} max={10} inverse lowLabel="Brak sztywnosci" highLabel="Bardzo sztywne" /></TintedPanel>}
                  {activePainModules.includes('anxiety') && (
                    <TintedPanel title="💜 Poziom leku / niepokoju" color="#7C3AED" bg="#F5F3FF">
                      <SliderField label="Nasilenie" value={anxiety} onChange={setAnxiety} min={0} max={10} inverse scaleStart="0 = spokoj" scaleEnd="10 = silny lek" lowLabel="Spokoj" highLabel="Silny lek" valueLabel={scaleText(anxiety, anxietyComments)} />
                      <div style={{ color: '#6D28D9', fontSize: '0.82rem', fontWeight: 800, marginBottom: 8 }}>Glowne zrodlo leku / niepokoju</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.9rem' }}>
                        {anxietySources.map(s => { const a = selectedAnxietySources.includes(s); return <button key={s} onClick={() => toggleAnxietySource(s)} style={{ border: `1.5px solid ${a ? '#7C3AED' : '#C4B5FD'}`, background: a ? '#7C3AED' : '#F5F3FF', color: a ? C.white : '#6D28D9', borderRadius: 999, padding: '0.45rem 0.7rem', fontWeight: 850, fontSize: '0.76rem', fontFamily: sans }}>{s}</button> })}
                      </div>
                      <textarea value={anxietyNote} onChange={e => setAnxietyNote(e.target.value)} placeholder="Napisz cos wiecej jesli chcesz... (tylko Ty i trener to widza)" rows={3} style={{ width: '100%', border: '1.5px solid #C4B5FD', background: '#FAF5FF', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
                    </TintedPanel>
                  )}
                  {activePainModules.includes('mentalOverload') && (
                    <TintedPanel title="🧠 Przeciazenie mentalne" color="#B45309" bg="#FFFBEB">
                      <SliderField label="Poziom przeciazenia" value={mentalOverload} onChange={setMentalOverload} min={0} max={10} inverse lowLabel="Jasna glowa" highLabel="Totalnie przytloczona" valueLabel={scaleComment(mentalOverload, 10, 'Spokojnie', 'Duzo bodzcow', 'Wysokie przeciazenie')} />
                      <div style={{ color: '#92400E', fontSize: '0.82rem', fontWeight: 800, marginBottom: 8 }}>Glowne zrodlo przeciazenia</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.9rem' }}>
                        {mentalSources.map(s => { const a = selectedMentalSources.includes(s); return <button key={s} onClick={() => toggleMentalSource(s)} style={{ border: `1.5px solid ${a ? '#F59E0B' : '#FCD34D'}`, background: a ? '#F59E0B' : '#FFF7ED', color: a ? C.white : '#92400E', borderRadius: 999, padding: '0.45rem 0.7rem', fontWeight: 850, fontSize: '0.76rem', fontFamily: sans }}>{s}</button> })}
                      </div>
                      <textarea value={mentalNote} onChange={e => setMentalNote(e.target.value)} placeholder="Napisz cos wiecej jesli chcesz..." rows={3} style={{ width: '100%', border: '1.5px solid #FCD34D', background: '#FFFBEB', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
                    </TintedPanel>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    <TextInput label="Lokalizacja bolu" value={painLocation} onChange={setPainLocation} placeholder="np. kolano, odcinek ledzwiowy" />
                    <textarea value={painNote} onChange={e => setPainNote(e.target.value)} placeholder="Co boli, kiedy, czy ogranicza trening?" rows={4} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
                  </div>
                </Section>
              )}

              {activeTab === 'Suplementy' && (
                <Section title="Suplementy">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.85rem' }}>
                    <button onClick={() => setSuppEditOpen(p => !p)} style={{ border: 'none', background: suppEditOpen ? C.orange : C.grayLight, color: suppEditOpen ? C.white : C.navy, borderRadius: 10, padding: '0.55rem 0.75rem', fontWeight: 900, fontFamily: sans }}>
                      {suppEditOpen ? 'Gotowe' : 'Edytuj liste'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: '1rem' }}>
                    {supplementsList.map(item => {
                      const count = supplementCount(item.id)
                      const infoText = item.info || 'Wlasny suplement. Dawke ustalic indywidualnie z trenerem.'
                      return (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', border: `1.5px solid ${suppEditOpen ? '#FCA5A5' : count > 0 ? C.gold : C.grayLight}`, background: count > 0 ? C.navyLight : C.white, borderRadius: 12, padding: '0.65rem 0.75rem', boxShadow: count > 0 ? '0 8px 20px rgba(13,27,42,0.12)' : 'none', position: 'relative' }}>
                          {suppEditOpen && <button onClick={() => removeSupplement(item.id)} style={{ position: 'absolute', left: -10, top: -10, width: 28, height: 28, borderRadius: '50%', border: 'none', background: C.red, color: C.white, fontWeight: 900, boxShadow: '0 6px 14px rgba(239,68,68,0.25)' }}>x</button>}
                          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 9, alignItems: 'center', minWidth: 0 }}>
                            <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{item.emoji || '🧩'}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: count > 0 ? C.white : C.navy, fontWeight: 800, fontSize: '0.88rem', overflowWrap: 'anywhere' }}>{item.name}</div>
                              <div style={{ color: count > 0 ? C.gold : C.gray, fontFamily: mono, fontSize: '0.68rem' }}>{item.dose} / porcja</div>
                            </div>
                            <InfoTooltip text={infoText} active={count > 0} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => updateSupplement(item.id, -1)} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: count > 0 ? C.navy : C.grayLight, color: count > 0 ? C.gold : C.gray, fontWeight: 900, fontFamily: sans }}>-</button>
                            <span style={{ width: 22, textAlign: 'center', fontFamily: mono, fontWeight: 900, color: count > 0 ? C.gold : C.gray }}>{count}</span>
                            <button onClick={() => updateSupplement(item.id, 1)} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: C.gold, color: C.navy, fontWeight: 900, fontFamily: sans }}>+</button>
                          </div>
                          {item.id === 'caffeine' && count > 0 && (
                            <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${C.navyBorder}`, marginTop: 4, paddingTop: '0.75rem' }}>
                              <div style={{ color: C.gold, fontFamily: mono, fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 800 }}>Zrodlo kofeiny</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {caffeineSourceOptions.map(s => { const a = caffeineSources.includes(s); return <button key={s} onClick={() => toggleCaffeineSource(s)} style={{ border: `1.5px solid ${a ? C.gold : C.navyBorder}`, background: a ? C.gold : C.navy, color: a ? C.navy : C.white, borderRadius: 999, padding: '0.45rem 0.7rem', fontWeight: 850, fontSize: '0.76rem', fontFamily: sans }}>{s}</button> })}
                              </div>
                              {caffeineSources.includes('Inne') && <input value={caffeineOther} onChange={e => setCaffeineOther(e.target.value)} placeholder="Wpisz inne zrodlo kofeiny..." style={{ width: '100%', marginTop: '0.75rem', border: `1.5px solid ${C.gold}`, background: C.navy, color: C.white, borderRadius: 10, padding: '0.75rem', outline: 'none', fontSize: '0.9rem' }} />}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {suppEditOpen && (
                    <div style={{ border: `1.5px solid ${C.grayLight}`, background: C.white, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 900, color: C.navy, marginBottom: '0.85rem' }}>Dodaj suplement</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px', gap: 8, marginBottom: '0.75rem' }}>
                        <TextInput label="Nazwa" value={newSuppName} onChange={setNewSuppName} placeholder="np. Biotyna" />
                        <TextInput label="Dawka" value={newSuppDose} onChange={setNewSuppDose} placeholder="500" type="number" />
                        <label>
                          <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 5, fontWeight: 700 }}>Jednostka</div>
                          <select value={newSuppUnit} onChange={e => setNewSuppUnit(e.target.value)} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.75rem', outline: 'none' }}>
                            <option value="mg">mg</option><option value="g">g</option><option value="IU">IU</option><option value="kaps.">kaps.</option><option value="porcja">porcja</option>
                          </select>
                        </label>
                      </div>
                      <button onClick={addSupplement} disabled={!newSuppName.trim() || !newSuppDose.trim()} style={{ width: '100%', border: 'none', background: !newSuppName.trim() || !newSuppDose.trim() ? C.grayLight : C.navy, color: !newSuppName.trim() || !newSuppDose.trim() ? C.gray : C.gold, borderRadius: 10, padding: '0.75rem', fontWeight: 900, fontFamily: sans }}>+ Dodaj do listy</button>
                    </div>
                  )}
                  <textarea value={supplementNote} onChange={e => setSupplementNote(e.target.value)} placeholder="Inne suplementy, dawki, uwagi..." rows={3} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
                </Section>
              )}

              <Section title="Uwagi dla trenera">
                <textarea value={concerns} onChange={e => setConcerns(e.target.value)} placeholder="Najwazniejsze uwagi, ktore trener powinien zobaczyc..." rows={4} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
              </Section>

              {saveError && <div style={{ border: `1.5px solid ${C.red}`, background: '#FEF2F2', color: C.red, borderRadius: 12, padding: '0.85rem', fontWeight: 800 }}>{saveError}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1rem', borderTop: `1.5px solid ${C.grayLight}`, flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <button onClick={onClose} style={{ border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 12, padding: '0.9rem', fontWeight: 800, fontFamily: sans }}>Anuluj</button>
          <button onClick={saveWellness} disabled={saving} style={{ border: 'none', background: saving ? C.grayLight : C.navy, color: saving ? C.gray : C.gold, borderRadius: 12, padding: '0.9rem', fontWeight: 900, fontFamily: sans }}>
            {saving ? 'Zapisuje...' : saved ? 'Zapisz zmiany' : 'Zapisz wellness'}
          </button>
        </div>
      </div>
    </div>
  )
}
