// src/app/athlete/group-training/[id]/page.tsx
// Trening grupy (moduł trenera „Trening grupy") uzupełniany przez zawodniczkę —
// te same wpisy co w tabeli trenera, widoczne po obu stronach po odświeżeniu.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getAthleteByUserId } from '@/lib/training'
import { getAthleteGroupTraining } from '@/lib/athleteGroupTraining'
import GroupTrainingAthleteClient from './GroupTrainingAthleteClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AthleteGroupTrainingPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const athlete = await getAthleteByUserId(user.id)
  if (!athlete) redirect('/athlete')

  const { id } = await params
  const data = await getAthleteGroupTraining(athlete.id, athlete.group_id, parseInt(id))
  // brak dostępu albo nieobecność zaznaczona przez trenera — trening zablokowany
  if (!data || data.training.absent) redirect('/athlete')

  return (
    <GroupTrainingAthleteClient
      athleteId={athlete.id}
      training={data.training}
      groupName={data.groupName}
      exercises={data.exercises}
      initialEntries={data.entries}
    />
  )
}
