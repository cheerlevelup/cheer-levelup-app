export const dynamic = 'force-dynamic'

// src/app/coach/groups/[id]/readiness/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ReadinessKioskClient from './ReadinessKioskClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GroupReadinessPage({ params }: Props) {
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
    .select('*')
    .eq('group_id', groupId)
    .order('full_name', { ascending: true })

  // Konfiguracja arkusza gotowości dla grupy (jeśli trener ją ustawił)
  const { data: wellnessConfig } = await supabase
    .from('group_module_config')
    .select('pre_params, enabled')
    .eq('module', 'wellness')
    .eq('group_id', groupId)
    .maybeSingle()

  const defaultWellnessFields = ['sleep_hours', 'sleep_quality', 'readiness', 'energy', 'stress', 'muscle_soreness']
  const wellnessFields: string[] = wellnessConfig?.pre_params?.length ? wellnessConfig.pre_params : defaultWellnessFields

  return (
    <ReadinessKioskClient
      group={group}
      athletes={athletes || []}
      wellnessFields={wellnessFields}
    />
  )
}
