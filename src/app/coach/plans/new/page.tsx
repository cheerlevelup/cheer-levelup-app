// src/app/coach/plans/new/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import NewPlanClient from './NewPlanClient'

export default async function NewPlanPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, category')
    .order('name', { ascending: true })

  return <NewPlanClient exercises={exercises || []} />
}
