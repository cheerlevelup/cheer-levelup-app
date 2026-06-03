export const dynamic = 'force-dynamic'

// src/app/coach/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachDashboardClient from './CoachDashboardClient'

export default async function CoachPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: athletes } = await supabase
    .from('athletes')
    .select('*, group:groups(*)')
    .order('full_name', { ascending: true })

  const since = new Date()
  since.setDate(since.getDate() - 7)
  const { data: recentSessions } = await supabase
    .from('workout_sessions')
    .select('*, athlete:athletes(full_name, group_id), workout_day:workout_days(day_name)')
    .eq('completed', true)
    .gte('date_completed', since.toISOString())
    .order('date_completed', { ascending: false })
    .limit(10)

  return (
    <CoachDashboardClient
      groups={groups || []}
      athletes={athletes || []}
      recentSessions={recentSessions || []}
    />
  )
}