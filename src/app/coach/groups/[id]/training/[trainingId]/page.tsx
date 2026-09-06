export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/training/[trainingId]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupTrainingClient from './GroupTrainingClient'

interface Props {
  params: Promise<{ id: string; trainingId: string }>
}

export default async function GroupTrainingPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id, trainingId } = await params
  const groupId = parseInt(id)
  const tId = parseInt(trainingId)

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()
  if (!group) redirect('/coach/groups')

  const { data: training } = await supabase
    .from('group_trainings')
    .select('*')
    .eq('id', tId)
    .eq('group_id', groupId)
    .single()
  if (!training) redirect(`/coach/groups/${groupId}`)

  // Zawodniczki widoczne w tym treningu: skład zamrożony w momencie JEGO utworzenia
  // (roster_athlete_ids) + każda, kto ma już zapisane dane w TYM treningu (na wypadek
  // gdyby migawka nie objęła kogoś, np. dopisanej ręcznie). Zawodniczka dodana do grupy
  // PO tym treningu nie pojawia się tu tylko dlatego, że jest teraz "aktualna" — liczy
  // się skład z dnia treningu, nie dzisiejszy. Zarchiwizowane nigdy się nie pokazują.
  const roster: number[] = Array.isArray((training as any).roster_athlete_ids) ? (training as any).roster_athlete_ids : []

  const { data: entryAthleteRows } = await supabase
    .from('group_training_entries')
    .select('athlete_id')
    .eq('training_id', tId)
  const entryAthleteIds = [...new Set((entryAthleteRows || []).map((r: any) => r.athlete_id))]

  // Starsze treningi (sprzed migawki składu) nie mają roster_athlete_ids —
  // jedyne dostępne przybliżenie to wtedy aktualni członkowie grupy.
  let baseIds = roster
  if (baseIds.length === 0) {
    const { data: currentMembers } = await supabase.from('athletes').select('id').eq('group_id', groupId)
    baseIds = (currentMembers || []).map((a: any) => a.id)
  }

  const allIds = [...new Set([...baseIds, ...entryAthleteIds])]

  const { data: rawAthletes } = allIds.length > 0
    ? await supabase.from('athletes').select('id, full_name, birth_year, archived').in('id', allIds)
    : { data: [] }

  const athletes = (rawAthletes || [])
    .filter((a: any) => !a.archived)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'pl'))

  const { data: exercises } = await supabase
    .from('group_training_exercises')
    .select('*')
    .eq('training_id', tId)
    .order('exercise_order', { ascending: true })

  const { data: entries } = await supabase
    .from('group_training_entries')
    .select('*')
    .eq('training_id', tId)

  return (
    <GroupTrainingClient
      group={group}
      training={training}
      athletes={athletes || []}
      initialExercises={exercises || []}
      initialEntries={entries || []}
    />
  )
}
