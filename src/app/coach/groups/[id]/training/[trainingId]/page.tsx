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

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, full_name, birth_year')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

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
