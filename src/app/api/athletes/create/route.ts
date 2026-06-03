import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(req: NextRequest) {
  // Sprawdź czy wywołujący to trener
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'cheerlevelup@gmail.com') {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
  }

  const { email, password, full_name, birth_year, group_id } = await req.json()

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, hasło i imię są wymagane' }, { status: 400 })
  }

  // Utwórz konto Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // od razu potwierdzone — nie wymaga klikania w mail
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Utwórz rekord zawodniczki
  const { data: athlete, error: athleteError } = await supabaseAdmin
    .from('athletes')
    .insert({
      full_name: full_name.trim(),
      birth_year: birth_year ? parseInt(birth_year) : null,
      group_id: group_id ? parseInt(group_id) : null,
      user_id: authData.user.id,
    })
    .select()
    .single()

  if (athleteError) {
    // Usuń konto Auth jeśli insert się nie powiódł
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: athleteError.message }, { status: 400 })
  }

  return NextResponse.json({ athlete })
}
