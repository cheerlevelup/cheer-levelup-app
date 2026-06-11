export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/feedback/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import FeedbackKioskClient from './FeedbackKioskClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupFeedbackPage({ params }: Props) {
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

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, full_name')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  return <FeedbackKioskClient group={group} athletes={athletes || []} />
}
