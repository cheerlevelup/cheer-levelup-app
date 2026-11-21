export const dynamic = 'force-dynamic'

// src/app/coach/calendar/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { normalizeCountdown, normalizeEvent } from '@/lib/coach/calendar'
import CalendarClient from './CalendarClient'

export default async function CoachCalendarPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const [{ data: groups }, { data: events, error: evErr }, { data: countdowns }] = await Promise.all([
    supabase.from('groups').select('id, name, sort_order').order('sort_order', { ascending: true }),
    supabase.from('calendar_events').select('*').order('start_date', { ascending: true }),
    supabase.from('calendar_countdowns').select('*').order('sort_order', { ascending: true }),
  ])

  return (
    <CalendarClient
      groups={(groups || []).map((g) => ({ id: Number(g.id), name: g.name, sort_order: g.sort_order }))}
      initialEvents={(events || []).map(normalizeEvent)}
      initialCountdowns={(countdowns || []).map(normalizeCountdown)}
      loadError={evErr ? evErr.message : null}
    />
  )
}
