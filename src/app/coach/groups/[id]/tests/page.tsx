export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/tests/page.tsx
// Zakładka "Testy" grupy — testy sprawnościowe zawodniczek. Na razie placeholder,
// docelowy układ dostarczy użytkowniczka (mockup w przygotowaniu).
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import GroupTestsClient from './GroupTestsClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupTestsPage({ params }: Props) {
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
    .select('id, archived')
    .eq('group_id', groupId)

  const athletesCount = (rawAthletes || []).filter((a: any) => !a.archived).length

  return <GroupTestsClient group={group} athletesCount={athletesCount} />
}
