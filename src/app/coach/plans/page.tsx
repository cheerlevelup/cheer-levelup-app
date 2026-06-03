// src/app/coach/plans/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachPlansClient from './CoachPlansClient'

export default async function CoachPlansPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: plans } = await supabase
    .from('workout_plans')
    .select('*')
    .order('created_at', { ascending: false })

  return <CoachPlansClient plans={plans || []} />
}
