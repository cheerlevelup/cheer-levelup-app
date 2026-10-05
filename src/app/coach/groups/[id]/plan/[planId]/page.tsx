// src/app/coach/groups/[id]/plan/[planId]/page.tsx
// Edytor planu grupy samodzielnej — ten sam edytor co w „Plany", otwierany w grupie
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadPlanEditorData } from '@/lib/coach/planEditorData'
import PlanEditorClient from '@/app/coach/plans/[id]/PlanEditorClient'

interface Props {
  params: Promise<{ id: string; planId: string }>
}

export default async function GroupPlanEditorPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { id, planId } = await params
  const data = await loadPlanEditorData(supabase, parseInt(planId))
  if (!data) redirect(`/coach/groups/${id}/plan`)

  // Plan bez grupy (np. ogólny przypisany tej grupie) — „wstecz" i tak ma wracać tutaj
  const plan = { ...data.plan, group_id: data.plan.group_id ?? parseInt(id) }
  return <PlanEditorClient {...data} plan={plan} />
}
