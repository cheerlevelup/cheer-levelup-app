export const dynamic = 'force-dynamic'

// src/app/coach/trainings/page.tsx
// "Treningi" — przekrojowy dziennik wszystkich datowanych treningów ze wszystkich
// grup zorganizowanych, z frekwencją (Faza B2). Grupy samodzielne nie mają
// treningów z konkretną datą — realizują treningi wg planu.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import TrainingsLogClient from './TrainingsLogClient'

export default async function CoachTrainingsPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: managedGroups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('group_type', 'managed')
    .order('sort_order', { ascending: true })

  const groupIds = (managedGroups || []).map(g => g.id)

  let trainings: any[] = []
  let rosterByGroup: Record<number, number> = {}

  if (groupIds.length > 0) {
    const { data: trainingsData } = await supabase
      .from('group_trainings')
      .select('id, group_id, training_date, absent_athlete_ids')
      .in('group_id', groupIds)
      .order('training_date', { ascending: false })
    trainings = trainingsData || []

    const { data: athletes } = await supabase
      .from('athletes')
      .select('group_id, archived')
      .in('group_id', groupIds)

    for (const a of athletes || []) {
      if (a.archived) continue
      rosterByGroup[a.group_id] = (rosterByGroup[a.group_id] || 0) + 1
    }
  }

  const groupNameById: Record<number, string> = {}
  for (const g of managedGroups || []) groupNameById[g.id] = g.name

  const rows = trainings.map(t => {
    const total = rosterByGroup[t.group_id] || 0
    const absentCount = (t.absent_athlete_ids || []).length
    const present = Math.max(0, total - absentCount)
    const pct = total > 0 ? Math.round((present / total) * 100) : 0
    return {
      id: t.id,
      groupId: t.group_id,
      groupName: groupNameById[t.group_id] || '—',
      date: t.training_date,
      present,
      total,
      pct,
    }
  })

  return (
    <TrainingsLogClient rows={rows} groupNames={(managedGroups || []).map(g => g.name)} />
  )
}
