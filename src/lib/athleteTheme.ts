// src/lib/athleteTheme.ts
// Wspólne kolory i czcionki aplikacji zawodniczki — te same co w panelu trenera
// (coach-theme.css: --navy-900, --gold, --bg, --border…, Inter + Barlow Condensed).
// Czcionki ładuje główny layout (zmienne --font-inter / --font-barlow-condensed).

export const C = {
  navy: '#0b1220',        // --navy-900
  navyLight: '#1b2740',   // --navy-700
  navyBorder: '#243352',  // --navy-600
  gold: '#e8a33d',        // --gold
  goldLight: '#f6cf8e',   // --gold-light
  white: '#FFFFFF',
  offWhite: '#f2f3f6',    // --bg
  ink: '#10172a',         // --ink
  muted: '#68708a',       // --muted
  gray: '#8b95ab',        // między --muted a --muted-light — czytelne na jasnym i na granacie
  grayLight: '#e7e9ef',   // --border
  green: '#2fbf82',       // --green
  red: '#e5484d',
  orange: '#F97316',
  blue: '#3B82F6',
  blueDark: '#1D4ED8',
  purple: '#A855F7',
  teal: '#14B8A6',
  violet: '#A78BFA',
  mint: '#34D399',
  cyan: '#22D3EE',
}

// Tekst (Inter) i etykiety / liczby (dawniej Space Mono) — Inter z cyframi o stałej szerokości
export const sans = "var(--font-inter), system-ui, -apple-system, 'Segoe UI', sans-serif"
export const mono = "var(--font-inter), system-ui, -apple-system, 'Segoe UI', sans-serif"
// Nagłówki i duże liczby — jak w panelu trenera
export const display = "var(--font-barlow-condensed), var(--font-inter), system-ui, sans-serif"

export const shadow = '0 1px 2px rgba(16,23,42,.04), 0 6px 20px rgba(16,23,42,.06)'
export const radius = 14
