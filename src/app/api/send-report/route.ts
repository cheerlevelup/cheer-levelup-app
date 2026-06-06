// src/app/api/send-report/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function rpeLabel(rpe: number): string {
  if (rpe <= 3) return 'Lekki'
  if (rpe <= 5) return 'Umiarkowany'
  if (rpe <= 7) return 'Ciężki'
  if (rpe <= 9) return 'Bardzo ciężki'
  return 'Maksymalny'
}

function feelingLabel(f: string): string {
  const map: Record<string, string> = {
    swietnie: '💪 Świetnie', dobrze: '😊 Dobrze',
    srednie: '😐 Średnio', zmeczona: '😓 Zmęczona', slabo: '😞 Słabo',
  }
  return map[f] || f
}

function rpeColor(rpe: number): string {
  if (rpe <= 4) return '#22C55E'
  if (rpe <= 6) return '#F5C842'
  if (rpe <= 8) return '#F97316'
  return '#EF4444'
}

function buildEmailHtml(data: {
  athleteName: string
  dayName: string
  planName: string
  weekNumber: number | string
  rpe: number
  feeling: string
  whatWentWell: string
  generalNotes: string
  painComment: string
  setLogs: any[]
  wellness: any | null
  painLogs: any[]
  blocks: any[]
}): string {
  const {
    athleteName, dayName, planName, weekNumber,
    rpe, feeling, whatWentWell, generalNotes, painComment,
    setLogs, wellness, painLogs, blocks,
  } = data

  const date = new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
  const rpeBg = rpeColor(rpe)

  // Mapa nazw ćwiczeń
  const exerciseNameMap: Record<number, string> = {}
  for (const block of (blocks || [])) {
    for (const ex of (block.workout_block_exercises || [])) {
      const name = ex.exercise?.name || ex.exercise_code || `Ćwiczenie #${ex.id}`
      exerciseNameMap[ex.id] = name.replace(/-/g, ' ')
    }
  }

  // Pogrupuj set_logs po block_exercise_id
  const logsByExercise: Record<number, any[]> = {}
  for (const log of (setLogs || [])) {
    if (!log.block_exercise_id) continue
    if (!logsByExercise[log.block_exercise_id]) logsByExercise[log.block_exercise_id] = []
    logsByExercise[log.block_exercise_id].push(log)
  }

  // Serie HTML
  let setsHtml = ''
  for (const [exId, logs] of Object.entries(logsByExercise)) {
    const name = exerciseNameMap[parseInt(exId)] || `Ćwiczenie #${exId}`
    const sortedLogs = (logs as any[]).sort((a, b) => a.set_number - b.set_number)
    // Notatka do ćwiczenia (z pierwszej nierozgrzewkowej serii)
    const exNote = sortedLogs.find((l: any) => !l.is_warmup && l.athlete_note)?.athlete_note || null

    const rows = sortedLogs.map((l: any) => {
        const wu = l.is_warmup ? ' <span style="color:#888;font-size:11px">(WU)</span>' : ''
        const weight = l.weight ? `<strong>${l.weight} kg</strong>` : '—'
        const reps = l.reps_completed ? `${l.reps_completed} powt.` : '—'
        return `<tr>
          <td style="padding:5px 10px;color:#888;font-size:13px;border-bottom:1px solid #f0ede8">S${l.set_number}${wu}</td>
          <td style="padding:5px 10px;font-size:14px;font-weight:700;border-bottom:1px solid #f0ede8">${weight}</td>
          <td style="padding:5px 10px;font-size:13px;color:#555;border-bottom:1px solid #f0ede8">${reps}</td>
          ${l.rir != null ? `<td style="padding:5px 10px;font-size:12px;color:#888;border-bottom:1px solid #f0ede8">RIR ${l.rir}</td>` : '<td></td>'}
        </tr>`
      }).join('')

    setsHtml += `
      <div style="margin-bottom:20px">
        <div style="font-weight:700;font-size:15px;margin-bottom:8px;color:#111;border-left:3px solid #F5C842;padding-left:10px">${name}</div>
        <table style="border-collapse:collapse;width:100%;background:#fafaf8;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#f0ede8">
              <th style="padding:5px 10px;text-align:left;font-size:11px;color:#888;font-weight:600;letter-spacing:0.06em">SERIA</th>
              <th style="padding:5px 10px;text-align:left;font-size:11px;color:#888;font-weight:600;letter-spacing:0.06em">CIĘŻAR</th>
              <th style="padding:5px 10px;text-align:left;font-size:11px;color:#888;font-weight:600;letter-spacing:0.06em">POWT.</th>
              <th style="padding:5px 10px;text-align:left;font-size:11px;color:#888;font-weight:600;letter-spacing:0.06em">RIR</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${exNote ? `<div style="margin-top:6px;padding:8px 10px;background:#fffbeb;border-left:3px solid #F5C842;font-size:12px;color:#555;font-style:italic">💬 Notatka zawodniczki: ${exNote}</div>` : ''}
      </div>`
  }

  // Wellness HTML
  let wellnessHtml = ''
  if (wellness) {
    function wRow(label: string, value: any, unit = '') {
      if (value == null || value === '') return `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#aaa">${label}</td>
          <td style="padding:5px 0;font-size:12px;text-align:right;color:#ccc;font-style:italic">nie wypełnione</td>
        </tr>`
      return `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#555">${label}</td>
          <td style="padding:5px 0;font-size:14px;font-weight:700;text-align:right;color:#111">${value}${unit}</td>
        </tr>`
    }

    const wRowsHtml = [
      wRow('🌙 Sen — ilość godzin', wellness.sleep_hours, 'h'),
      wRow('💤 Jakość snu', wellness.sleep_quality != null ? `${wellness.sleep_quality}/10` : null),
      wRow(`${wellness.readiness != null && wellness.readiness <= 3 ? '😪' : wellness.readiness != null && wellness.readiness <= 5 ? '😐' : '😊'} Poziom wypoczęcia`, wellness.readiness != null ? `${wellness.readiness}/10` : null),
      wRow('⚡ Energia', wellness.energy != null ? `${wellness.energy}/10` : null),
      wRow('🧠 Stres', wellness.stress != null ? `${wellness.stress}/10` : null),
      wRow('🔥 Zakwasy', wellness.muscle_sorness != null ? `${wellness.muscle_sorness}/10` : null),
      wRow('⚖️ Masa ciała', wellness.body_weight_kg, ' kg'),
      wRow('💧 Nawodnienie', wellness.hydration_glasses != null ? `${wellness.hydration_glasses} szkl.` : null),
      wRow('❤️ Tętno spoczynkowe', wellness.resting_hr, ' bpm'),
      wRow('🌸 Faza cyklu', wellness.cycle_phase ? `${wellness.cycle_phase}${wellness.cycle_day ? ` (dzień ${wellness.cycle_day})` : ''}` : null),
      wRow('🔄 Regeneracja', wellness.recovery_score != null ? `${wellness.recovery_score}/10` : null),
    ].join('')

    const act = wellness.activity_data
    const actHtml = act?.type ? `
      <div style="margin-top:10px;padding:10px;background:#fff;border-radius:6px;border:1px solid #e8e6e0">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Aktywność dnia</div>
        <div style="font-size:13px;font-weight:700;color:#111">${act.type}</div>
        <div style="font-size:12px;color:#888;margin-top:2px">
          ${act.time ? act.time + ' · ' : ''}${act.duration ? act.duration + ' min' : ''}${act.rpe ? ' · RPE ' + act.rpe + '/10' : ''}
          ${act.motivation ? ' · Motywacja: ' + act.motivation + '/5' : ''}
        </div>
        ${act.feelingAfter ? `<div style="font-size:12px;color:#555;margin-top:4px">Po treningu: <strong>${act.feelingAfter}</strong></div>` : ''}
        ${act.satisfaction != null ? `<div style="font-size:12px;color:#555;margin-top:2px">Satysfakcja: ${act.satisfaction}/10</div>` : ''}
        ${act.goal ? `<div style="font-size:12px;color:#555;margin-top:2px">Plan zrealizowany: ${act.goal}</div>` : ''}
        ${act.note ? `<div style="font-size:12px;color:#666;margin-top:4px;font-style:italic">${act.note}</div>` : ''}
      </div>` : `
      <div style="margin-top:8px;font-size:12px;color:#ccc;font-style:italic">Aktywność: nie wypełnione</div>`

    const painD = wellness.pain_data
    const hasPain = (painD?.painDuring > 0) || painD?.location || (painD?.headache > 0) || (painD?.anxiety > 0) || (painD?.mentalOverload > 0)
    const painDHtml = hasPain ? `
      <div style="margin-top:10px;padding:10px;background:#fef2f2;border-radius:6px;border:1px solid #fca5a5">
        <div style="font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;font-weight:600">Ból i obciążenie</div>
        ${painD?.painDuring > 0 ? `<div style="font-size:13px;color:#ef4444;margin-bottom:3px">Ból podczas treningu: <strong>${painD.painDuring}/10</strong></div>` : ''}
        ${painD?.location ? `<div style="font-size:12px;color:#555;margin-bottom:2px">📍 ${painD.location}</div>` : ''}
        ${painD?.note ? `<div style="font-size:12px;color:#666;font-style:italic;margin-bottom:2px">${painD.note}</div>` : ''}
        ${painD?.headache > 0 ? `<div style="font-size:12px;color:#ef4444">Ból głowy: ${painD.headache}/10</div>` : ''}
        ${painD?.anxiety > 0 ? `<div style="font-size:12px;color:#7c3aed">Lęk/niepokój: ${painD.anxiety}/10</div>` : ''}
        ${painD?.mentalOverload > 0 ? `<div style="font-size:12px;color:#b45309">Przeciążenie mentalne: ${painD.mentalOverload}/10</div>` : ''}
      </div>` : ''

    // Suplementy
    const supp = wellness.supplements_data
    const suppHtml = (supp?.counts && Object.values(supp.counts).some((v: any) => v > 0)) ? `
      <div style="margin-top:10px;padding:10px;background:#fffbeb;border-radius:6px;border:1px solid #fde68a">
        <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;font-weight:600">💊 Suplementy</div>
        ${Object.entries(supp.counts).filter(([, v]: any) => v > 0).map(([id, count]: any) => `<div style="font-size:12px;color:#555">${id.replace(/_/g,' ')}: ${count}×</div>`).join('')}
        ${supp.note ? `<div style="font-size:12px;color:#666;font-style:italic;margin-top:4px">${supp.note}</div>` : ''}
        ${supp.caffeineSources?.length > 0 ? `<div style="font-size:12px;color:#555;margin-top:3px">Kofeina: ${supp.caffeineSources.join(', ')}</div>` : ''}
      </div>` : ''

    const concernsHtml = wellness.concerns ? `
      <div style="margin-top:10px;padding:10px;background:#fffbeb;border-radius:6px;border:1px solid #fde68a">
        <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Uwagi dla trenera</div>
        <div style="font-size:13px;color:#111;font-style:italic">"${wellness.concerns}"</div>
      </div>` : ''

    const cycleHtml = wellness.cycle_phase ? `
      <div style="margin-top:10px;display:inline-block;padding:4px 12px;background:#f5f3ff;border-radius:20px;font-size:12px;color:#6d28d9;font-weight:600">
        Cykl: ${wellness.cycle_phase}${wellness.cycle_day ? ` — dzień ${wellness.cycle_day}` : ''}
      </div>` : ''

    wellnessHtml = `
      <div style="background:#f9f8f5;border-radius:8px;padding:16px;margin-bottom:24px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;font-weight:600">🩺 Wellness przed treningiem</div>
        <table style="width:100%;border-collapse:collapse">${wRowsHtml}</table>
        ${actHtml}${painDHtml}${suppHtml}${concernsHtml}
      </div>`
  }

  // Pain logs HTML
  let painHtml = ''
  if (painLogs && painLogs.length > 0) {
    painHtml = `
      <div style="background:#fff8f0;border-left:4px solid #F5C842;padding:14px 16px;margin-bottom:24px;border-radius:0 8px 8px 0">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;font-weight:600">⚠️ Zgłoszony ból</div>
        ${painLogs.map((p: any) => `
          <div style="margin-bottom:10px;padding:8px;background:#fff;border-radius:6px">
            <span style="font-weight:700;font-size:14px;color:#111">${p.location || 'Brak lokalizacji'}</span>
            <span style="color:#ef4444;font-size:13px;font-weight:700"> VAS ${p.vas_score}/10</span>
            ${p.description ? `<div style="font-size:12px;color:#666;margin-top:3px">${p.description}</div>` : ''}
          </div>`).join('')}
      </div>`
  }

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Helvetica Neue',Arial,sans-serif;color:#111">
  <div style="max-width:620px;margin:0 auto;padding:28px 16px">

    <!-- Logo / brand -->
    <div style="margin-bottom:28px;display:flex;align-items:center;gap:10px">
      <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:#aaa;font-weight:600">CHEER LEVELUP · RAPORT TRENINGOWY</div>
    </div>

    <!-- Hero -->
    <div style="background:#0D1B2A;border-radius:12px;padding:24px;margin-bottom:24px">
      <div style="font-size:11px;color:#F5C842;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;font-weight:600">${planName || 'Plan'} · Tydzień ${weekNumber || '—'}</div>
      <div style="font-size:26px;font-weight:800;color:#fff;margin-bottom:4px;line-height:1.2">${dayName}</div>
      <div style="font-size:14px;color:#8A9BB0;margin-bottom:20px">${athleteName} · ${date}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="background:rgba(255,255,255,0.07);border-radius:10px;padding:14px 20px;flex:1;min-width:100px">
          <div style="font-size:10px;color:#8A9BB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">RPE</div>
          <div style="font-size:28px;font-weight:900;color:${rpeBg};line-height:1">${rpe}</div>
          <div style="font-size:12px;color:#8A9BB0;margin-top:4px">${rpeLabel(rpe)}</div>
        </div>
        ${feeling ? `<div style="background:rgba(255,255,255,0.07);border-radius:10px;padding:14px 20px;flex:1;min-width:100px">
          <div style="font-size:10px;color:#8A9BB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Po treningu</div>
          <div style="font-size:18px;font-weight:700;color:#fff;line-height:1.3">${feelingLabel(feeling)}</div>
        </div>` : ''}
      </div>
    </div>

    ${wellnessHtml}

    <!-- Serie -->
    ${Object.keys(logsByExercise).length > 0 ? `
    <div style="margin-bottom:24px">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;font-weight:600">🏋️ Wykonane serie</div>
      ${setsHtml}
    </div>` : '<div style="background:#f9f8f5;border-radius:8px;padding:14px;margin-bottom:24px;color:#888;font-size:13px">Brak zapisanych serii.</div>'}

    ${painHtml}

    <!-- Feedback -->
    ${whatWentWell || painComment || generalNotes ? `
    <div style="background:#f9f8f5;border-radius:8px;padding:16px;margin-bottom:24px">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;font-weight:600">💬 Feedback zawodniczki</div>
      ${whatWentWell ? `<div style="margin-bottom:12px"><div style="font-size:11px;color:#22c55e;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em">Co poszło dobrze</div><div style="font-size:14px;color:#111;line-height:1.5">${whatWentWell}</div></div>` : ''}
      ${painComment ? `<div style="margin-bottom:12px"><div style="font-size:11px;color:#ef4444;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em">Ból / dyskomfort</div><div style="font-size:14px;color:#111;line-height:1.5">${painComment}</div></div>` : ''}
      ${generalNotes ? `<div><div style="font-size:11px;color:#888;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em">Dodatkowe uwagi</div><div style="font-size:14px;color:#111;line-height:1.5">${generalNotes}</div></div>` : ''}
    </div>` : ''}

    <!-- Footer -->
    <div style="border-top:1px solid #dedad4;padding-top:16px;font-size:11px;color:#aaa;text-align:center;letter-spacing:0.06em">
      CHEER LEVELUP — Przygotowanie motoryczne
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { sessionId, athleteId } = body

    if (!sessionId || !athleteId) {
      return NextResponse.json({ error: 'Brak sessionId lub athleteId' }, { status: 400 })
    }

    // 1. Pobierz sesję z pełnymi detalami
    const { data: session } = await supabase
      .from('workout_sessions')
      .select(`
        *,
        workout_day:workout_days(
          *,
          week:workout_weeks(*, plan:workout_plans(*)),
          workout_day_blocks(
            *,
            workout_block_exercises(*, exercise:exercises(*))
          )
        )
      `)
      .eq('id', sessionId)
      .single()

    if (!session) return NextResponse.json({ error: 'Sesja nie znaleziona' }, { status: 404 })

    // 2. Pobierz zawodniczkę
    const { data: athlete } = await supabase
      .from('athletes')
      .select('full_name')
      .eq('id', athleteId)
      .single()

    // 3. Pobierz feedback (właśnie zapisany przez zawodniczkę)
    const { data: feedback } = await supabase
      .from('post_session_feedback')
      .select('*')
      .eq('workout_session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 4. Pobierz set_logs
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('*')
      .eq('workout_session_id', sessionId)
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: true })

    // 5. Pobierz wellness (po dacie dzisiejszego dnia lub session_id)
    const today = new Date().toISOString().split('T')[0]
    const { data: wellness } = await supabase
      .from('wellness_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('date', today)
      .maybeSingle()

    // 6. Pobierz pain_logs
    const { data: painLogs } = await supabase
      .from('pain_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())

    const day = session.workout_day
    const plan = day?.week?.plan
    const week = day?.week

    const emailData = {
      athleteName: athlete?.full_name || `Zawodniczka #${athleteId}`,
      dayName: day?.day_name || 'Trening',
      planName: plan?.name || '—',
      weekNumber: week?.week_number || '—',
      rpe: feedback?.session_rpe ?? body.rpe ?? 0,
      feeling: feedback?.feeling_after ?? body.feeling ?? '',
      whatWentWell: feedback?.what_went_well ?? body.whatWentWell ?? '',
      generalNotes: feedback?.general_notes ?? body.generalNotes ?? '',
      painComment: feedback?.pain_after_comment ?? body.painComment ?? '',
      setLogs: setLogs || [],
      wellness: wellness || null,
      painLogs: painLogs || [],
      blocks: day?.workout_day_blocks || [],
    }

    const html = buildEmailHtml(emailData)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cheer LevelUP <onboarding@resend.dev>',
        to: ['cheerlevelup@gmail.com'],
        subject: `📋 ${emailData.athleteName} — ${emailData.dayName} (${new Date().toLocaleDateString('pl-PL')})`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return NextResponse.json({ error: err }, { status: 500 })
    }

    // Oznacz raport jako wysłany
    await supabase
      .from('workout_sessions')
      .update({ report_sent: true })
      .eq('id', sessionId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('send-report error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
