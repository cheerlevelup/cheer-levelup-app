import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import NewAthleteClient from './NewAthleteClient'

export const dynamic = 'force-dynamic'

export default async function NewAthletePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (user.email !== 'cheerlevelup@gmail.com') redirect('/athlete')

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('sort_order', { ascending: true })

  // Grupy zorganizowane (np. Ultra) mają własne dodawanie zawodniczek z widoku grupy
  const selfGroups = (groups || []).filter((g: any) => g.group_type !== 'managed')

  return <NewAthleteClient groups={selfGroups} />
}
