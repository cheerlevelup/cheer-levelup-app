// src/app/coach/plans/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachPlansClient from './CoachPlansClient'

export default async function CoachPlansPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  // Plany grup samodzielnych żyją w zakładce Plan swojej grupy — tu tylko ogólne
  let { data: plans, error: plansErr } = await supabase
    .from('workout_plans')
    .select('*')
    .is('group_id', null)
    .order('created_at', { ascending: false })
  if (plansErr) {
    // brak migracji 202610050001 (kolumna group_id) — pokaż wszystkie plany
    ;({ data: plans } = await supabase
      .from('workout_plans')
      .select('*')
      .order('created_at', { ascending: false }))
  }

  return <CoachPlansClient plans={plans || []} />
}
