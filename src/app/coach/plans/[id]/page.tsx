// src/app/coach/plans/[id]/page.tsx
// Edytor planu — obsługuje istniejące plany
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadPlanEditorData } from '@/lib/coach/planEditorData'
import PlanEditorClient from './PlanEditorClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PlanEditorPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id } = await params
  const data = await loadPlanEditorData(supabase, parseInt(id))
  if (!data) redirect('/coach/plans')

  // Plan grupy samodzielnej otwieramy w jej zakładce Plan
  if (data.plan.group_id) redirect(`/coach/groups/${data.plan.group_id}/plan/${data.plan.id}`)

  return <PlanEditorClient {...data} />
}
