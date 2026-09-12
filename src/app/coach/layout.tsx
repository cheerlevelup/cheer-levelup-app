import './coach-theme.css'
import { barlowCondensed, inter } from './coach-fonts'
import CoachShell from '@/components/coach/CoachShell'

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${barlowCondensed.variable} ${inter.variable}`}>
      <CoachShell>{children}</CoachShell>
    </div>
  )
}
