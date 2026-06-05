'use client'
// src/app/athlete/wellness/WellnessClient.tsx

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
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
  existingWellness: WellnessLog | null
  dateIso: string
}

const C = {
  navy: '#0D1B2A',
  navyLight: '#1A2E45',
  navyBorder: '#243652',
  gold: '#F5C842',
  white: '#FFFFFF',
  offWhite: '#F4F6F9',
  gray: '#8A9BB0',
  grayLight: '#E8ECF2',
  green: '#22C55E',
  red: '#EF4444',
  orange: '#F97316',
  blue: '#60A5FA',
  violet: '#A78BFA',
  mint: '#34D399',
  cyan: '#22D3EE',
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
type SupplementItem = {
  id: string
  name: string
  dose: string
  emoji?: string
  info?: string
}

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

const sleepQualityComments = [
  'Brak regenerujacego snu',
  'Bardzo slaby sen',
  'Slaby sen, moze obnizac forme',
  'Sen raczej plytki',
  'Ponizej optymalnie',
  'Srednia jakosc snu',
  'Calkiem dobry sen',
  'Dobry sen',
  'Bardzo dobry sen',
  'Swietna regeneracja',
  'Maksymalnie regenerujacy sen',
]

const readinessComments = [
  'Bardzo duze zmeczenie',
  'Cialo prosi o spokojniejszy start',
  'Niska gotowosc',
  'Raczej zmeczona',
  'Lekko ponizej normy',
  'Normalnie',
  'Calkiem wypoczeta',
  'Dobra gotowosc',
  'Bardzo wypoczeta',
  'Swietna gotowosc',
  'Pelna gotowosc',
]

const energyComments = [
  'Brak energii',
  'Bardzo niska energia',
  'Trzeba oszczedzac baterie',
  'Energia ponizej normy',
  'Troche ciezki start',
  'Stabilnie',
  'Energia w porzadku',
  'Dobra energia',
  'Bardzo dobra energia',
  'Wysoka energia',
  'Pelna moc',
]

const stressComments = [
  'Pelny spokoj',
  'Bardzo niski stres',
  'Spokojna glowa',
  'Lekki stres',
  'Do ogarniecia',
  'Umiarkowanie',
  'Podwyzszone napiecie',
  'Warto obserwowac',
  'Duzo stresu',
  'Bardzo duze obciazenie',
  'Alarmowo wysoki stres',
]

const sorenessComments = [
  'Brak zakwasow',
  'Ledwo wyczuwalne',
  'Lekkie zakwasy',
  'Czuc miesnie, ale bez problemu',
  'Umiarkowane zakwasy',
  'Wyrazne zakwasy',
  'Moga wplywac na ruch',
  'Mocne zakwasy',
  'Ciezko wejsc w trening',
  'Bardzo mocne obciazenie miesni',
  'Regeneracja priorytetem',
]

const painComments = [
  'Brak bolu',
  'Minimalny sygnal',
  'Lekki dyskomfort',
  'Do obserwacji',
  'Umiarkowany bol',
  'Wyrazny bol',
  'Moze ograniczac trening',
  'Wazne dla trenera',
  'Mocno ogranicza',
  'Bardzo silny bol',
  'Alarmowo - nie ignorowac',
]

const anxietyComments = [
  'Spokoj',
  'Minimalne napiecie',
  'Lekki niepokoj',
  'Do ogarniecia',
  'Troche podwyzszone',
  'Umiarkowany niepokoj',
  'Warto obserwowac',
  'Duzo napiecia',
  'Silny lek',
  'Bardzo silny lek',
  'Potrzebny spokoj i wsparcie',
]

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
  return new Date(iso).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.white, border: `1.5px solid ${C.grayLight}`, borderRadius: 16, padding: '1rem', boxShadow: '0 12px 34px rgba(13,27,42,0.07)' }}>
      <div style={{ fontFamily: mono, fontSize: '0.68rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.875rem', fontWeight: 700 }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function SliderField({
  label,
  subtitle,
  emoji,
  scaleStart,
  scaleEnd,
  neutral = false,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  inverse = false,
  lowLabel,
  highLabel,
  valueLabel,
}: {
  label: string
  subtitle?: string
  emoji?: string
  scaleStart?: string
  scaleEnd?: string
  neutral?: boolean
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  inverse?: boolean
  lowLabel?: string
  highLabel?: string
  valueLabel?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const color = neutral ? C.gray : scaleColor(value, min, max, inverse)
  const track = `linear-gradient(90deg, ${color} 0%, ${color} ${pct}%, #343434 ${pct}%, #343434 100%)`
  const styleVars = {
    '--range-bg': track,
    '--range-color': color,
  } as CSSProperties

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
          <span>{scaleStart}</span>
          <span style={{ textAlign: 'right' }}>{scaleEnd}</span>
        </div>
      )}
      <input
        className="wellness-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(parseFloat(event.target.value))}
        style={styleVars}
      />
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

function TextInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '0.72rem', color: C.gray, marginBottom: 5, fontWeight: 700 }}>{label}</div>
      <input value={value} type={type} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.75rem', outline: 'none', fontSize: '0.9rem' }} />
    </label>
  )
}

function ColorChoiceGrid<T extends string | number>({
  options,
  value,
  onChange,
  columns = 2,
  showDot = true,
}: {
  options: { value: T; label: string; desc?: string; emoji?: string; color: string; bg: string }[]
  value: T
  onChange: (value: T) => void
  columns?: number
  showDot?: boolean
}) {
  const tight = columns >= 5
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: tight ? 6 : 8 }}>
      {options.map(option => {
        const selected = value === option.value
        return (
          <button
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            style={{
              minWidth: 0,
              minHeight: 68,
              border: `1.5px solid ${option.color}55`,
              borderRadius: 12,
              background: selected ? option.color : option.bg,
              color: selected ? C.white : option.color,
              padding: tight ? '0.62rem 0.42rem' : '0.7rem 0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: tight ? 'center' : 'flex-start',
              gap: tight ? 6 : 10,
              textAlign: tight ? 'center' : 'left',
              boxShadow: selected ? '0 10px 24px rgba(13,27,42,0.14)' : 'none',
              fontWeight: 900,
            }}
          >
            {option.emoji ? (
              <span style={{ fontSize: '1.35rem', lineHeight: 1, flexShrink: 0 }}>{option.emoji}</span>
            ) : showDot ? (
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: selected ? C.white : option.color, boxShadow: `0 2px 8px ${option.color}66`, flexShrink: 0 }} />
            ) : null}
            <span style={{
              flex: showDot || option.emoji ? 'initial' : 1,
              textAlign: showDot || option.emoji ? undefined : 'center',
            }}>
              <span style={{ display: 'block', fontSize: tight ? '0.76rem' : '0.9rem', overflowWrap: 'anywhere' }}>{option.label}</span>
              {option.desc && <span style={{ display: 'block', marginTop: 3, fontSize: '0.72rem', opacity: 0.82 }}>{option.desc}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TintedPanel({
  title,
  color,
  bg,
  children,
}: {
  title: string
  color: string
  bg: string
  children: React.ReactNode
}) {
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

function readStoredModules(key: string, fallback: string[]) {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as string[] : fallback
  } catch {
    return fallback
  }
}

function readStoredSupplements() {
  if (typeof window === 'undefined') return defaultSupplementsList
  try {
    const stored = window.localStorage.getItem('wellness-supplements-list')
    return stored ? JSON.parse(stored) as SupplementItem[] : defaultSupplementsList
  } catch {
    return defaultSupplementsList
  }
}

function ModuleDrawer({
  title,
  modules,
  activeModules,
  onToggle,
  onClose,
}: {
  title: string
  modules: { id: string; label: string }[]
  activeModules: string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(13,27,42,0.64)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 'min(86vw, 320px)', height: '100%', background: C.white, padding: '1.25rem', overflowY: 'auto' }} onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '0.64rem', color: C.gray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Dostosuj karte</div>
            <div style={{ fontWeight: 900, color: C.navy }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: C.offWhite, color: C.gray, borderRadius: 8, width: 34, height: 34, fontWeight: 900 }}>x</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modules.map(module => {
            const active = activeModules.includes(module.id)
            return (
              <button key={module.id} onClick={() => onToggle(module.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1.5px solid ${active ? C.gold : C.grayLight}`, background: active ? C.navy : C.offWhite, color: active ? C.gold : C.navy, borderRadius: 11, padding: '0.8rem', textAlign: 'left', fontWeight: 800 }}>
                <span>{module.label}</span>
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

export default function WellnessClient({ athlete, existingWellness, dateIso }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('Basic')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeBasicModules, setActiveBasicModules] = useState<string[]>(['bodyWeight', 'cycle', 'recovery'])
  const [activePainModules, setActivePainModules] = useState<string[]>([])

  const [sleepHours, setSleepHours] = useState(existingWellness?.sleep_hours ?? 7.5)
  const [sleepQuality, setSleepQuality] = useState(existingWellness?.sleep_quality ?? 5)
  const [energy, setEnergy] = useState(existingWellness?.energy ?? 5)
  const [stress, setStress] = useState(existingWellness?.stress ?? 0)
  const [soreness, setSoreness] = useState(existingWellness?.muscle_sorness ?? 0)
  const [readiness, setReadiness] = useState(existingWellness?.readiness ?? 5)
  const [concerns, setConcerns] = useState(existingWellness?.concerns ?? '')

  const [bodyWeight, setBodyWeight] = useState(existingWellness?.body_weight_kg?.toString() ?? '')
  const [hydration, setHydration] = useState(existingWellness?.hydration_glasses ?? 7.5)
  const [hrv, setHrv] = useState(existingWellness?.resting_hr ?? 60)
  const [cyclePhase, setCyclePhase] = useState(existingWellness?.cycle_phase ?? '')
  const [cycleDay, setCycleDay] = useState(existingWellness?.cycle_day?.toString() ?? '')
  const [recovery, setRecovery] = useState(existingWellness?.recovery_score ?? 5)
  const [sittingHours, setSittingHours] = useState(existingWellness?.sitting_hours ?? 0)

  const [activityType, setActivityType] = useState(existingWellness?.activity_data?.type ?? '')
  const [activityTime, setActivityTime] = useState(existingWellness?.activity_data?.time ?? '')
  const [activityDuration, setActivityDuration] = useState(existingWellness?.activity_data?.duration ?? '')
  const [activityMotivation, setActivityMotivation] = useState(existingWellness?.activity_data?.motivation ?? 3)
  const [activityRpe, setActivityRpe] = useState(existingWellness?.activity_data?.rpe ?? 0)
  const [activityFeelingAfter, setActivityFeelingAfter] = useState(existingWellness?.activity_data?.feelingAfter ?? 'ok')
  const [activitySatisfaction, setActivitySatisfaction] = useState(existingWellness?.activity_data?.satisfaction ?? 5)
  const [activityGoal, setActivityGoal] = useState(existingWellness?.activity_data?.goal ?? '')
  const [activityGoalComment, setActivityGoalComment] = useState(existingWellness?.activity_data?.goalComment ?? '')
  const [activityNote, setActivityNote] = useState(existingWellness?.activity_data?.note ?? '')

  const [painDuring, setPainDuring] = useState(existingWellness?.pain_data?.painDuring ?? 0)
  const [menstrualPain, setMenstrualPain] = useState(existingWellness?.pain_data?.menstrualPain ?? 0)
  const [headache, setHeadache] = useState(existingWellness?.pain_data?.headache ?? 0)
  const [stomachache, setStomachache] = useState(existingWellness?.pain_data?.stomachache ?? 0)
  const [jointStiffness, setJointStiffness] = useState(existingWellness?.pain_data?.jointStiffness ?? 0)
  const [anxiety, setAnxiety] = useState(existingWellness?.pain_data?.anxiety ?? 0)
  const [headacheNote, setHeadacheNote] = useState(existingWellness?.pain_data?.headacheNote ?? '')
  const [stomachacheNote, setStomachacheNote] = useState(existingWellness?.pain_data?.stomachacheNote ?? '')
  const [selectedAnxietySources, setSelectedAnxietySources] = useState<string[]>(existingWellness?.pain_data?.anxietySources ?? [])
  const [anxietyNote, setAnxietyNote] = useState(existingWellness?.pain_data?.anxietyNote ?? '')
  const [mentalOverload, setMentalOverload] = useState(existingWellness?.pain_data?.mentalOverload ?? 0)
  const [selectedMentalSources, setSelectedMentalSources] = useState<string[]>(existingWellness?.pain_data?.mentalSources ?? [])
  const [mentalNote, setMentalNote] = useState(existingWellness?.pain_data?.mentalNote ?? '')
  const [painLocation, setPainLocation] = useState(existingWellness?.pain_data?.location ?? '')
  const [painNote, setPainNote] = useState(existingWellness?.pain_data?.note ?? '')

  const [supplementsList, setSupplementsList] = useState<SupplementItem[]>(defaultSupplementsList)
  const [supplements, setSupplements] = useState<Record<string, number>>(existingWellness?.supplements_data?.counts ?? {})
  const [supplementNote, setSupplementNote] = useState(existingWellness?.supplements_data?.note ?? '')
  const [caffeineSources, setCaffeineSources] = useState<string[]>(existingWellness?.supplements_data?.caffeineSources ?? [])
  const [caffeineOther, setCaffeineOther] = useState(existingWellness?.supplements_data?.caffeineOther ?? '')
  const [suppEditOpen, setSuppEditOpen] = useState(false)
  const [newSuppName, setNewSuppName] = useState('')
  const [newSuppDose, setNewSuppDose] = useState('')
  const [newSuppUnit, setNewSuppUnit] = useState('mg')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(!!existingWellness)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActiveBasicModules(readStoredModules('wellness-basic-modules', ['bodyWeight', 'cycle', 'recovery']))
      setActivePainModules(readStoredModules('wellness-pain-modules', []))
      setSupplementsList(readStoredSupplements())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const progress = useMemo(() => {
    const values = [sleepHours, sleepQuality, energy, stress, soreness, readiness]
    return values.filter(value => value !== null && value !== undefined).length
  }, [sleepHours, sleepQuality, energy, stress, soreness, readiness])

  function supplementCount(id: string) {
    return supplements[id] || 0
  }

  function updateSupplement(id: string, delta: number) {
    setSupplements(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }))
  }

  function saveSupplementsList(nextList: SupplementItem[]) {
    setSupplementsList(nextList)
    window.localStorage.setItem('wellness-supplements-list', JSON.stringify(nextList))
  }

  function removeSupplement(id: string) {
    saveSupplementsList(supplementsList.filter(item => item.id !== id))
    setSupplements(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function addSupplement() {
    const name = newSuppName.trim()
    const dose = newSuppDose.trim()
    if (!name || !dose) return
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`
    saveSupplementsList([...supplementsList, { id, name, dose: `${dose} ${newSuppUnit}` }])
    setNewSuppName('')
    setNewSuppDose('')
    setNewSuppUnit('mg')
  }

  function toggleBasicModule(id: string) {
    setActiveBasicModules(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      window.localStorage.setItem('wellness-basic-modules', JSON.stringify(next))
      return next
    })
  }

  function togglePainModule(id: string) {
    setActivePainModules(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      window.localStorage.setItem('wellness-pain-modules', JSON.stringify(next))
      return next
    })
  }

  function toggleMentalSource(source: string) {
    setSelectedMentalSources(prev => prev.includes(source) ? prev.filter(item => item !== source) : [...prev, source])
  }

  function toggleAnxietySource(source: string) {
    setSelectedAnxietySources(prev => prev.includes(source) ? prev.filter(item => item !== source) : [...prev, source])
  }

  function toggleCaffeineSource(source: string) {
    setCaffeineSources(prev => prev.includes(source) ? prev.filter(item => item !== source) : [...prev, source])
  }

  async function saveWellness() {
    setSaving(true)
    setSaveError('')

    const basePayload = {
      athlete_id: athlete.id,
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
      energy,
      stress,
      mood: null,
      muscle_sorness: soreness,
      readiness,
      concerns: concerns.trim() || null,
      body_weight_kg: activeBasicModules.includes('bodyWeight') && bodyWeight ? parseFloat(bodyWeight) : null,
      hydration_glasses: activeBasicModules.includes('hydration') ? hydration : null,
      cycle_phase: activeBasicModules.includes('cycle') ? cyclePhase || null : null,
      activity_data: {
        type: activityType,
        time: activityTime,
        duration: activityDuration,
        motivation: activityMotivation,
        rpe: activityRpe,
        feelingAfter: activityFeelingAfter,
        satisfaction: activitySatisfaction,
        goal: activityGoal,
        goalComment: activityGoalComment,
        note: activityNote,
      },
      pain_data: {
        painDuring,
        menstrualPain: activePainModules.includes('menstrualPain') ? menstrualPain : null,
        headache: activePainModules.includes('headache') ? headache : null,
        stomachache: activePainModules.includes('stomachache') ? stomachache : null,
        jointStiffness: activePainModules.includes('jointStiffness') ? jointStiffness : null,
        anxiety: activePainModules.includes('anxiety') ? anxiety : null,
        headacheNote: activePainModules.includes('headache') ? headacheNote : '',
        stomachacheNote: activePainModules.includes('stomachache') ? stomachacheNote : '',
        anxietySources: activePainModules.includes('anxiety') ? selectedAnxietySources : [],
        anxietyNote: activePainModules.includes('anxiety') ? anxietyNote : '',
        mentalOverload: activePainModules.includes('mentalOverload') ? mentalOverload : null,
        mentalSources: activePainModules.includes('mentalOverload') ? selectedMentalSources : [],
        mentalNote: activePainModules.includes('mentalOverload') ? mentalNote : '',
        location: painLocation,
        note: painNote,
      },
    }

    // Pola opcjonalne które mogą nie istnieć w starszych wersjach schematu
    const optionalFields: Record<string, any> = {
      resting_hr: activeBasicModules.includes('hrv') ? hrv : null,
      cycle_day: activeBasicModules.includes('cycle') && cycleDay ? parseInt(cycleDay) : null,
      recovery_score: activeBasicModules.includes('recovery') ? recovery : null,
      sitting_hours: activeBasicModules.includes('sitting') ? sittingHours : null,
      supplements_data: {
        counts: supplements,
        note: supplementNote,
        caffeineSources,
        caffeineOther,
      },
    }

    async function doSave(payload: any) {
      return existingWellness?.id
        ? await supabase.from('wellness_logs').update(payload).eq('id', existingWellness.id)
        : await supabase.from('wellness_logs').insert(payload)
    }

    // Próba 1: pełny payload (base + opcjonalne)
    let result = await doSave({ ...basePayload, ...optionalFields })

    if (result.error) {
      const msg = result.error.message || ''
      // Próba 2: bez supplements_data (może nie istnieć w DB)
      if (msg.includes('supplements_data') || msg.includes('column') || msg.includes('schema')) {
        result = await doSave({ ...basePayload, resting_hr: optionalFields.resting_hr, cycle_day: optionalFields.cycle_day, recovery_score: optionalFields.recovery_score, sitting_hours: optionalFields.sitting_hours })
      }
    }

    if (result.error) {
      const msg = result.error.message || ''
      // Próba 3: tylko base (bez żadnych opcjonalnych)
      if (msg.includes('column') || msg.includes('schema') || msg.includes('resting_hr') || msg.includes('cycle_day') || msg.includes('recovery_score') || msg.includes('sitting_hours')) {
        result = await doSave(basePayload)
      }
    }

    if (result.error) {
      // Próba 4: minimalny payload — zawsze powinien zadziałać
      const minimalPayload = {
        athlete_id: athlete.id,
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
        energy, stress,
        mood: null,
        muscle_sorness: soreness,
        readiness,
        concerns: concerns.trim() || null,
      }
      result = await doSave(minimalPayload)
    }

    setSaving(false)
    if (result.error) {
      setSaveError(result.error.message)
      return
    }
    setSaved(true)
    router.push('/athlete')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
        button, input, textarea, select { font-family: inherit; }
        .wellness-range {
          width: 100%;
          height: 8px;
          border-radius: 999px;
          border: 0;
          outline: none;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          background: var(--range-bg);
        }
        .wellness-range::-webkit-slider-thumb {
          width: 19px;
          height: 19px;
          border-radius: 50%;
          border: 0;
          background: var(--range-color);
          box-shadow: 0 4px 12px rgba(13,27,42,0.22);
          appearance: none;
          -webkit-appearance: none;
        }
        .wellness-range::-moz-range-thumb {
          width: 19px;
          height: 19px;
          border-radius: 50%;
          border: 0;
          background: var(--range-color);
          box-shadow: 0 4px 12px rgba(13,27,42,0.22);
        }
        .supp-info:hover .supp-tooltip,
        .supp-info:focus .supp-tooltip {
          display: block !important;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.navy, fontFamily: sans, color: C.navy, paddingTop: '0.75rem' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', background: C.offWhite, minHeight: 'calc(100vh - 0.75rem)', borderRadius: '24px 24px 0 0', overflow: 'hidden', borderTop: `4px solid ${C.gold}`, boxShadow: '0 -18px 60px rgba(0,0,0,0.22)' }}>
        <header style={{ background: C.offWhite, padding: '1rem 1.25rem 0.95rem', position: 'sticky', top: 0, zIndex: 10, borderBottom: `1.5px solid ${C.grayLight}` }}>
          <div style={{ width: 42, height: 4, borderRadius: 2, background: '#DDE3EA', margin: '0 auto 1rem' }} />
          <div style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', marginBottom: '0.85rem' }}>
            <button onClick={() => router.push('/athlete')} style={{ border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 10, padding: '0.65rem 0.8rem', fontWeight: 800 }}>Powrot</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.navy, fontWeight: 900, fontSize: '1.12rem' }}>Dzienny wellness</div>
              <div style={{ color: C.gray, fontSize: '0.74rem', fontWeight: 700, marginTop: 2 }}>{formatLongDate(dateIso)}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: saved ? C.green : C.gold, color: saved ? C.white : C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontWeight: 900 }}>{progress}/6</div>
          </div>

          <div style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {tabs.map(tab => {
              const active = activeTab === tab
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ border: 'none', borderRadius: active ? 9 : 0, background: active ? C.navy : 'transparent', color: active ? C.gold : C.gray, padding: '0.55rem 0.25rem', fontWeight: 900, fontSize: '0.72rem', borderBottom: active ? 'none' : `2px solid ${C.grayLight}` }}>
                  {tab}
                </button>
              )
            })}
          </div>
        </header>

        {drawerOpen && activeTab === 'Basic' && (
          <ModuleDrawer
            title="Basic"
            modules={optionalModules.Basic}
            activeModules={activeBasicModules}
            onToggle={toggleBasicModule}
            onClose={() => setDrawerOpen(false)}
          />
        )}
        {drawerOpen && activeTab === 'Bol' && (
          <ModuleDrawer
            title="Bol"
            modules={optionalModules.Bol}
            activeModules={activePainModules}
            onToggle={togglePainModule}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        <main style={{ maxWidth: 620, margin: '0 auto', padding: '1rem 1rem 6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(activeTab === 'Basic' || activeTab === 'Bol') && (
            <button
              onClick={() => setDrawerOpen(true)}
              style={{ alignSelf: 'flex-end', border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 10, padding: '0.65rem 0.85rem', fontWeight: 800 }}
            >
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
                {activeBasicModules.length === 0 && (
                  <div style={{ color: C.gray, fontSize: '0.86rem' }}>Brak dodatkowych pol. Kliknij Edytuj pola, zeby wybrac co chcesz sledzic.</div>
                )}
                {activeBasicModules.includes('bodyWeight') && (
                  <div style={{ marginBottom: '1rem' }}>
                    <TextInput label="Masa ciala" value={bodyWeight} onChange={setBodyWeight} placeholder="kg" type="number" />
                  </div>
                )}
                {activeBasicModules.includes('hydration') && <SliderField label="Nawodnienie" subtitle="Ilosc szklanek wody (250ml)" value={hydration} onChange={setHydration} min={0} max={15} step={0.5} unit=" szkl." lowLabel="0 szkl." highLabel="15 szkl." valueLabel={scaleComment(hydration, 15, 'Do uzupelnienia', 'Niezle', 'Dobre nawodnienie')} />}
                {activeBasicModules.includes('hrv') && <SliderField label="Tetno spoczynkowe HR" value={hrv} onChange={setHrv} min={40} max={120} unit=" bpm" neutral />}
                {activeBasicModules.includes('recovery') && <SliderField label="Jakosc regeneracji po ostatnim treningu" subtitle="Jak dobrze czujesz, ze sie zregenerowalas?" value={recovery} onChange={setRecovery} min={0} max={10} lowLabel="Slaba regeneracja" highLabel="Pelna regeneracja" valueLabel={scaleComment(recovery, 10, 'Cialo prosi o ostroznosc', 'Regeneracja srednia', 'Gotowosc wyglada dobrze')} />}
                {activeBasicModules.includes('sitting') && <SliderField label="Czas siedzenia" value={sittingHours} onChange={setSittingHours} min={0} max={16} step={0.5} unit="h" inverse lowLabel="Malo siedzenia" highLabel="Duzo siedzenia" />}
                {activeBasicModules.includes('cycle') && (
                  <div>
                    <div style={{ fontWeight: 900, color: C.navy, marginBottom: 4 }}>Faza cyklu menstruacyjnego</div>
                    <div style={{ color: C.gray, fontSize: '0.82rem', marginBottom: '0.75rem' }}>Pomaga trenerowi lepiej planowac intensywnosc</div>
                    <ColorChoiceGrid options={cyclePhases} value={cyclePhase} onChange={setCyclePhase} columns={1} />
                    <div style={{ marginTop: '0.75rem' }}>
                      <TextInput label="Dzien cyklu" value={cycleDay} onChange={setCycleDay} placeholder="np. 12" type="number" />
                    </div>
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
                {activityTypes.map(type => (
                  <button key={type.label} onClick={() => setActivityType(type.label)} style={{ border: `1.5px solid ${activityType === type.label ? type.color : type.color + '44'}`, background: activityType === type.label ? type.color : type.bg, color: activityType === type.label ? C.white : type.color, borderRadius: 11, padding: '0.65rem', fontWeight: 800, fontSize: '0.78rem', boxShadow: activityType === type.label ? '0 8px 18px rgba(13,27,42,0.14)' : 'none' }}>{type.label}</button>
                ))}
              </div>
              <textarea value={activityNote} onChange={event => setActivityNote(event.target.value)} placeholder="Opis aktywnosci, miejsce, jak poszlo..." rows={4} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem', marginBottom: '1rem' }} />
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
                <textarea
                  value={activityGoalComment}
                  onChange={event => setActivityGoalComment(event.target.value)}
                  placeholder="Co pominelas lub zrobilas inaczej?"
                  rows={3}
                  style={{ width: '100%', border: '1.5px solid #FDBA74', background: '#FFF7ED', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem', marginBottom: '1rem' }}
                />
              )}
            </Section>
          )}

          {activeTab === 'Bol' && (
            <Section title="Bol i obciazenie">
              <SliderField label="Zakwasy" subtitle="0 = brak · 10 = bardzo mocne" value={soreness} onChange={setSoreness} min={0} max={10} inverse lowLabel="Brak zakwasow" highLabel="Bardzo mocne" valueLabel={scaleText(soreness, sorenessComments)} />
              <SliderField label="Bol podczas dnia/treningu" value={painDuring} onChange={setPainDuring} min={0} max={10} inverse scaleStart="0 = brak bolu" scaleEnd="10 = silny bol" lowLabel="Brak bolu" highLabel="Silny bol" valueLabel={scaleText(painDuring, painComments)} />
              {activePainModules.includes('menstrualPain') && (
                <TintedPanel title="🩸 Bol menstruacyjny (VAS)" color="#EF4444" bg="#FEF2F2">
                  <SliderField label="Poziom bolu" value={menstrualPain} onChange={setMenstrualPain} min={0} max={10} inverse lowLabel="0" highLabel="10" />
                </TintedPanel>
              )}
              {activePainModules.includes('headache') && (
                <TintedPanel title="Bol glowy" color="#EF4444" bg="#FEF2F2">
                  <SliderField label="Nasilenie" value={headache} onChange={setHeadache} min={0} max={10} inverse lowLabel="Brak" highLabel="Silny" valueLabel={scaleText(headache, painComments)} />
                  <textarea
                    value={headacheNote}
                    onChange={event => setHeadacheNote(event.target.value)}
                    placeholder="Z jakiego powodu? np. zmeczenie, stres, za malo wody, ekran..."
                    rows={3}
                    style={{ width: '100%', border: '1.5px solid #FCA5A5', background: '#FFF7F7', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }}
                  />
                </TintedPanel>
              )}
              {activePainModules.includes('stomachache') && (
                <TintedPanel title="Dolegliwosci zoladkowe" color="#F97316" bg="#FFF7ED">
                  <SliderField label="Nasilenie" value={stomachache} onChange={setStomachache} min={0} max={10} inverse lowLabel="Brak" highLabel="Silne" valueLabel={scaleText(stomachache, painComments)} />
                  <textarea
                    value={stomachacheNote}
                    onChange={event => setStomachacheNote(event.target.value)}
                    placeholder="Z jakiego powodu? np. jedzenie, stres, cykl, trening, nie wiem..."
                    rows={3}
                    style={{ width: '100%', border: '1.5px solid #FDBA74', background: '#FFFBEB', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }}
                  />
                </TintedPanel>
              )}
              {activePainModules.includes('jointStiffness') && (
                <TintedPanel title="🦴 Sztywnosc stawow" color="#0EA5E9" bg="#ECFEFF">
                  <SliderField label="Poziom sztywnosci" value={jointStiffness} onChange={setJointStiffness} min={0} max={10} inverse lowLabel="Brak sztywnosci" highLabel="Bardzo sztywne" />
                </TintedPanel>
              )}
              {activePainModules.includes('anxiety') && (
                <TintedPanel title="💜 Poziom leku / niepokoju" color="#7C3AED" bg="#F5F3FF">
                  <SliderField label="Nasilenie" value={anxiety} onChange={setAnxiety} min={0} max={10} inverse scaleStart="0 = spokoj" scaleEnd="10 = silny lek" lowLabel="Spokoj" highLabel="Silny lek" valueLabel={scaleText(anxiety, anxietyComments)} />
                  <div style={{ color: '#6D28D9', fontSize: '0.82rem', fontWeight: 800, marginBottom: 8 }}>Glowne zrodlo leku / niepokoju</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.9rem' }}>
                    {anxietySources.map(source => {
                      const active = selectedAnxietySources.includes(source)
                      return (
                        <button
                          key={source}
                          onClick={() => toggleAnxietySource(source)}
                          style={{
                            border: `1.5px solid ${active ? '#7C3AED' : '#C4B5FD'}`,
                            background: active ? '#7C3AED' : '#F5F3FF',
                            color: active ? C.white : '#6D28D9',
                            borderRadius: 999,
                            padding: '0.45rem 0.7rem',
                            fontWeight: 850,
                            fontSize: '0.76rem',
                          }}
                        >
                          {source}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    value={anxietyNote}
                    onChange={event => setAnxietyNote(event.target.value)}
                    placeholder="Napisz cos wiecej jesli chcesz... (tylko Ty i trener to widza)"
                    rows={3}
                    style={{ width: '100%', border: '1.5px solid #C4B5FD', background: '#FAF5FF', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }}
                  />
                </TintedPanel>
              )}
              {activePainModules.includes('mentalOverload') && (
                <TintedPanel title="🧠 Przeciazenie mentalne" color="#B45309" bg="#FFFBEB">
                  <SliderField
                    label="Poziom przeciazenia"
                    value={mentalOverload}
                    onChange={setMentalOverload}
                    min={0}
                    max={10}
                    inverse
                    lowLabel="Jasna glowa"
                    highLabel="Totalnie przytloczona"
                    valueLabel={scaleComment(mentalOverload, 10, 'Spokojnie', 'Duzo bodzcow', 'Wysokie przeciazenie')}
                  />
                  <div style={{ color: '#92400E', fontSize: '0.82rem', fontWeight: 800, marginBottom: 8 }}>Glowne zrodlo przeciazenia</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.9rem' }}>
                    {mentalSources.map(source => {
                      const active = selectedMentalSources.includes(source)
                      return (
                        <button
                          key={source}
                          onClick={() => toggleMentalSource(source)}
                          style={{
                            border: `1.5px solid ${active ? '#F59E0B' : '#FCD34D'}`,
                            background: active ? '#F59E0B' : '#FFF7ED',
                            color: active ? C.white : '#92400E',
                            borderRadius: 999,
                            padding: '0.45rem 0.7rem',
                            fontWeight: 850,
                            fontSize: '0.76rem',
                          }}
                        >
                          {source}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    value={mentalNote}
                    onChange={event => setMentalNote(event.target.value)}
                    placeholder="Napisz cos wiecej jesli chcesz... (tylko Ty i trener to widza)"
                    rows={3}
                    style={{ width: '100%', border: '1.5px solid #FCD34D', background: '#FFFBEB', color: C.navy, borderRadius: 12, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }}
                  />
                </TintedPanel>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <TextInput label="Lokalizacja bolu" value={painLocation} onChange={setPainLocation} placeholder="np. kolano, odcinek ledzwiowy" />
                <textarea value={painNote} onChange={event => setPainNote(event.target.value)} placeholder="Co boli, kiedy, czy ogranicza trening?" rows={4} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
              </div>
            </Section>
          )}

          {activeTab === 'Suplementy' && (
            <Section title="Suplementy">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.85rem' }}>
                <button
                  onClick={() => setSuppEditOpen(prev => !prev)}
                  style={{ border: 'none', background: suppEditOpen ? C.orange : C.grayLight, color: suppEditOpen ? C.white : C.navy, borderRadius: 10, padding: '0.55rem 0.75rem', fontWeight: 900 }}
                >
                  {suppEditOpen ? 'Gotowe' : 'Edytuj liste'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: '1rem' }}>
                {supplementsList.map(item => {
                  const count = supplementCount(item.id)
                  const infoText = item.info || 'Wlasny suplement dodany do listy. Dawke i sens stosowania najlepiej ustalic indywidualnie z trenerem lub specjalista.'
                  return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', border: `1.5px solid ${suppEditOpen ? '#FCA5A5' : count > 0 ? C.gold : C.grayLight}`, background: count > 0 ? C.navyLight : C.white, borderRadius: 12, padding: '0.65rem 0.75rem', boxShadow: count > 0 ? '0 8px 20px rgba(13,27,42,0.12)' : 'none', position: 'relative' }}>
                      {suppEditOpen && (
                        <button onClick={() => removeSupplement(item.id)} style={{ position: 'absolute', left: -10, top: -10, width: 28, height: 28, borderRadius: '50%', border: 'none', background: C.red, color: C.white, fontWeight: 900, boxShadow: '0 6px 14px rgba(239,68,68,0.25)' }}>
                          x
                        </button>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 9, alignItems: 'center', minWidth: 0 }}>
                        <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{item.emoji || '🧩'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: count > 0 ? C.white : C.navy, fontWeight: 800, fontSize: '0.88rem', overflowWrap: 'anywhere' }}>{item.name}</div>
                          <div style={{ color: count > 0 ? C.gold : C.gray, fontFamily: mono, fontSize: '0.68rem' }}>{item.dose} / porcja</div>
                        </div>
                        <InfoTooltip text={infoText} active={count > 0} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateSupplement(item.id, -1)} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: count > 0 ? C.navy : C.grayLight, color: count > 0 ? C.gold : C.gray, fontWeight: 900 }}>-</button>
                        <span style={{ width: 22, textAlign: 'center', fontFamily: mono, fontWeight: 900, color: count > 0 ? C.gold : C.gray }}>{count}</span>
                        <button onClick={() => updateSupplement(item.id, 1)} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: C.gold, color: C.navy, fontWeight: 900 }}>+</button>
                      </div>
                      {item.id === 'caffeine' && count > 0 && (
                        <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${count > 0 ? C.navyBorder : C.grayLight}`, marginTop: 4, paddingTop: '0.75rem' }}>
                          <div style={{ color: count > 0 ? C.gold : C.gray, fontFamily: mono, fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 800 }}>
                            Zrodlo kofeiny
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {caffeineSourceOptions.map(source => {
                              const active = caffeineSources.includes(source)
                              return (
                                <button
                                  key={source}
                                  onClick={() => toggleCaffeineSource(source)}
                                  style={{
                                    border: `1.5px solid ${active ? C.gold : count > 0 ? C.navyBorder : C.grayLight}`,
                                    background: active ? C.gold : count > 0 ? C.navy : C.offWhite,
                                    color: active ? C.navy : count > 0 ? C.white : C.navy,
                                    borderRadius: 999,
                                    padding: '0.45rem 0.7rem',
                                    fontWeight: 850,
                                    fontSize: '0.76rem',
                                  }}
                                >
                                  {source}
                                </button>
                              )
                            })}
                          </div>
                          {caffeineSources.includes('Inne') && (
                            <input
                              value={caffeineOther}
                              onChange={event => setCaffeineOther(event.target.value)}
                              placeholder="Wpisz inne zrodlo kofeiny..."
                              style={{ width: '100%', marginTop: '0.75rem', border: `1.5px solid ${C.gold}`, background: count > 0 ? C.navy : C.offWhite, color: count > 0 ? C.white : C.navy, borderRadius: 10, padding: '0.75rem', outline: 'none', fontSize: '0.9rem' }}
                            />
                          )}
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
                      <select value={newSuppUnit} onChange={event => setNewSuppUnit(event.target.value)} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.75rem', outline: 'none' }}>
                        <option value="mg">mg</option>
                        <option value="g">g</option>
                        <option value="IU">IU</option>
                        <option value="kaps.">kaps.</option>
                        <option value="porcja">porcja</option>
                      </select>
                    </label>
                  </div>
                  <button onClick={addSupplement} disabled={!newSuppName.trim() || !newSuppDose.trim()} style={{ width: '100%', border: 'none', background: !newSuppName.trim() || !newSuppDose.trim() ? C.grayLight : C.navy, color: !newSuppName.trim() || !newSuppDose.trim() ? C.gray : C.gold, borderRadius: 10, padding: '0.75rem', fontWeight: 900 }}>
                    + Dodaj do listy
                  </button>
                </div>
              )}
              <textarea value={supplementNote} onChange={event => setSupplementNote(event.target.value)} placeholder="Inne suplementy, dawki, uwagi..." rows={3} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
            </Section>
          )}

          <Section title="Uwagi dla trenera">
            <textarea value={concerns} onChange={event => setConcerns(event.target.value)} placeholder="Najwazniejsze uwagi, ktore trener powinien zobaczyc..." rows={4} style={{ width: '100%', border: `1.5px solid ${C.grayLight}`, background: C.offWhite, color: C.navy, borderRadius: 10, padding: '0.85rem', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }} />
          </Section>

          {saveError && <div style={{ border: `1.5px solid ${C.red}`, background: '#FEF2F2', color: C.red, borderRadius: 12, padding: '0.85rem', fontWeight: 800 }}>{saveError}</div>}
        </main>

        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(14px)', borderTop: `1.5px solid ${C.grayLight}`, padding: '0.875rem 1rem' }}>
          <div style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <button onClick={() => router.push('/athlete')} style={{ border: `1.5px solid ${C.grayLight}`, background: C.white, color: C.navy, borderRadius: 12, padding: '0.9rem', fontWeight: 800 }}>Anuluj</button>
            <button onClick={saveWellness} disabled={saving} style={{ border: 'none', background: saving ? C.grayLight : C.navy, color: saving ? C.gray : C.gold, borderRadius: 12, padding: '0.9rem', fontWeight: 900 }}>{saving ? 'Zapisuje...' : saved ? 'Zapisz zmiany' : 'Zapisz wellness'}</button>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
