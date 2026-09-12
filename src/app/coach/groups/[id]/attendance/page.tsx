export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/attendance/page.tsx
// Obecność grupy zorganizowanej — wydzielona z dawnej zakładki Statystyki.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupAttendanceClient from './GroupAttendanceClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupAttendancePage({ params }: Props) {
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

  const { data: rawAthletes } = await supabase
    .from('athletes')
    .select('id, full_name, archived')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  const athletes = (rawAthletes || []).filter((a: any) => !a.archived)

  const { data: trainings } = await supabase
    .from('group_trainings')
    .select('id, group_id, training_date, absent_athlete_ids')
    .eq('group_id', groupId)
    .order('training_date', { ascending: true })

  return (
    <GroupAttendanceClient
      group={group}
      athletes={athletes || []}
      trainings={trainings || []}
    />
  )
}
