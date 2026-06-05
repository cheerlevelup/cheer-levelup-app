export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cheer-levelup-app.vercel.app'

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
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
    email_confirm: true,
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
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: athleteError.message }, { status: 400 })
  }

  // Wyślij email powitalny jeśli klucz Resend jest ustawiony
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Cheer LevelUP <noreply@cheerlevelup.pl>',
        to: email,
        subject: '🎉 Witaj w Cheer LevelUP!',
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #F4F6F9; padding: 32px 16px;">
            <div style="background: #0D1B2A; border-radius: 16px; padding: 32px; margin-bottom: 24px; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 12px;">🏆</div>
              <h1 style="color: #F5C842; font-size: 1.5rem; margin: 0 0 8px;">Cheer LevelUP</h1>
              <p style="color: #8A9BB0; margin: 0; font-size: 0.9rem;">Panel zawodniczki</p>
            </div>

            <div style="background: #fff; border-radius: 16px; padding: 28px; margin-bottom: 16px; border: 1.5px solid #E8ECF2;">
              <h2 style="color: #0D1B2A; margin: 0 0 16px; font-size: 1.2rem;">Cześć, ${full_name}! 👋</h2>
              <p style="color: #4B5563; line-height: 1.6; margin: 0 0 20px;">
                Twój trener utworzył dla Ciebie konto w aplikacji <strong>Cheer LevelUP</strong>.
                Znajdziesz tu swój plan treningowy, wellness i statystyki.
              </p>

              <div style="background: #F4F6F9; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0 0 10px; font-size: 0.8rem; color: #8A9BB0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Twoje dane do logowania</p>
                <p style="margin: 0 0 6px; color: #0D1B2A;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 0; color: #0D1B2A;"><strong>Hasło:</strong> <span style="font-family: monospace; background: #E8ECF2; padding: 2px 8px; border-radius: 6px;">${password}</span></p>
              </div>

              <a href="${APP_URL}/login" style="display: block; background: #0D1B2A; color: #F5C842; text-align: center; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 1rem;">
                Zaloguj się →
              </a>
            </div>

            <p style="text-align: center; color: #8A9BB0; font-size: 0.78rem; margin: 0;">
              Po pierwszym logowaniu możesz zmienić hasło w ustawieniach konta.<br>
              Cheer LevelUP · System treningowy dla cheerleaderek
            </p>
          </div>
        `,
      })
    } catch (emailError) {
      // Email nie jest krytyczny — konto zostało już założone
      console.error('Email send error:', emailError)
    }
  }

  return NextResponse.json({ athlete })
}
