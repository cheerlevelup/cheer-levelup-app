// KEEP IN SYNC WITH src/app/coach/coach-theme.css (:root custom properties)
// TS mirror of the CSS tokens, for places that need literal values (jsPDF exports,
// canvas/SVG chart colors) rather than CSS custom properties.
export const coachTheme = {
  navy900: '#0b1220',
  navy800: '#111a2c',
  navy700: '#1b2740',
  navy600: '#243352',
  gold: '#e8a33d',
  goldLight: '#f6cf8e',
  green: '#2fbf82',
  bg: '#f2f3f6',
  card: '#ffffff',
  ink: '#10172a',
  muted: '#68708a',
  mutedLight: '#95a0b8',
  border: '#e7e9ef',
  radius: 14,
  shadow: '0 1px 2px rgba(16,23,42,.04), 0 6px 20px rgba(16,23,42,.06)',
} as const
