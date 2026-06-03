// src/app/coach/groups/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CoachGroupsClient from './CoachGroupsClient'

export default async function CoachGroupsPage() {
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

  return <CoachGroupsClient groups={groups || []} athletes={athletes || []} />
}
