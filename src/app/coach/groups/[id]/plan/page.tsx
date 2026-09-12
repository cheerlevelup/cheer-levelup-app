export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/plan/page.tsx
// Zakładka "Plan" grupy zorganizowanej — na razie pusty placeholder.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupPlanClient from './GroupPlanClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupPlanPage({ params }: Props) {
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

  // Grupy samodzielne mają swój widok planu na stronie głównej grupy (zakładka
  // "Treningi") — nie duplikujemy go tutaj, tylko odsyłamy z powrotem.
  if ((group as any).group_type !== 'managed') redirect(`/coach/groups/${groupId}`)

  const { data: rawAthletes } = await supabase
    .from('athletes')
    .select('id, archived')
    .eq('group_id', groupId)

  const athletesCount = (rawAthletes || []).filter((a: any) => !a.archived).length

  return <GroupPlanClient group={group} athletesCount={athletesCount} />
}
