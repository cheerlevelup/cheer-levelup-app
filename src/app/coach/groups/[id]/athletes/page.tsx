export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/athletes/page.tsx
// Zakładka "Zawodniczki" grupy zorganizowanej — sam roster, bez kafelków akcji.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupAthletesClient from './GroupAthletesClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupAthletesPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const groupId = parseInt(id)

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()
  if (!group) redirect('/coach/groups')

  const { data: allGroupAthletes } = await supabase
    .from('athletes')
    .select('*')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  const athletes = (allGroupAthletes || []).filter((a: any) => !a.archived)

  return <GroupAthletesClient group={group} athletes={athletes} />
}
