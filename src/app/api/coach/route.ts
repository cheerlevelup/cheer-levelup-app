// src/app/api/coach/route.ts
// Centralny endpoint dla operacji trenera wymagających service role (omija RLS)
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const COACH_EMAIL = 'cheerlevelup@gmail.com'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('BRAK SUPABASE_SERVICE_ROLE_KEY — dodaj do zmiennych środowiskowych')
}

async function verifyCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== COACH_EMAIL) return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await verifyCoach()
  if (!user) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  const body = await req.json()
  const { action } = body
  const db = admin()

  // ── Edycja grupy ─────────────────────────────────────────────────────────────
  if (action === 'update_group') {
    const { groupId, name, training_level } = body
    if (!groupId || !name?.trim()) {
      return NextResponse.json({ error: 'Brak wymaganych danych (groupId, name)' }, { status: 400 })
    }
    const { data, error } = await db
      .from('groups')
      .update({ name: name.trim(), training_level: training_level?.trim() || null })
      .eq('id', groupId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, group: data })
  }

  // ── Przeniesienie zawodniczki do innej grupy ──────────────────────────────────
  if (action === 'move_athlete_group') {
    const { athleteId, groupId } = body
    if (!athleteId || !groupId) {
      return NextResponse.json({ error: 'Brak athleteId lub groupId' }, { status: 400 })
    }
    const { data, error } = await db
      .from('athletes')
      .update({ group_id: groupId })
      .eq('id', athleteId)
      .select('*, group:groups(*)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, athlete: data })
  }

  // ── Zmiana planu zawodniczki ──────────────────────────────────────────────────
  if (action === 'change_plan') {
    const { athleteId, planId, orderMode, currentAssignmentId } = body
    if (!athleteId || !planId) {
      return NextResponse.json({ error: 'Brak athleteId lub planId' }, { status: 400 })
    }

    // Dezaktywuj obecny plan (jeśli istnieje)
    if (currentAssignmentId) {
      const { error: deactivateErr } = await db
        .from('athlete_workout_assignments')
        .update({ is_active: false })
        .eq('id', currentAssignmentId)
      if (deactivateErr) return NextResponse.json({ error: deactivateErr.message }, { status: 500 })
    }

    // Utwórz nowe przypisanie
    const { data, error } = await db
      .from('athlete_workout_assignments')
      .insert({
        athlete_id: athleteId,
        plan_id: planId,
        is_active: true,
        order_mode: orderMode || 'sequential',
        start_date: new Date().toISOString().split('T')[0],
      })
      .select('*, plan:workout_plans(*)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, assignment: data })
  }

  return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
}
