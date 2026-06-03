// src/app/api/send-report/route.ts
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
    swietnie: '💪 Świetnie',
    dobrze: '😊 Dobrze',
    srednie: '😐 Średnio',
    zmeczona: '😓 Zmęczona',
    slabo: '😞 Słabo',
  }
  return map[f] || f
}

function buildEmailHtml(data: any): string {
  const {
    athleteName, dayName, planName, weekNumber,
    rpe, feeling, whatWentWell, generalNotes, painComment,
    setLogs, wellness, painLogs, blocks,
  } = data

  const date = new Date().toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Zbuduj mapę: block_exercise_id → nazwa ćwiczenia
  const exerciseNameMap: Record<number, string> = {}
  for (const block of (blocks || [])) {
    for (const ex of (block.workout_block_exercises || [])) {
      exerciseNameMap[ex.id] = ex.exercise?.name || ex.exercise_code || `Ćwiczenie #${ex.id}`
    }
  }

  // Pogrupuj set_logs po block_exercise_id
  const logsByExercise: Record<number, any[]> = {}
  for (const log of (setLogs || [])) {
    if (!log.block_exercise_id) continue
    if (!logsByExercise[log.block_exercise_id]) logsByExercise[log.block_exercise_id] = []
    logsByExercise[log.block_exercise_id].push(log)
  }

  // HTML serii
  let setsHtml = ''
  for (const [exId, logs] of Object.entries(logsByExercise)) {
    const name = exerciseNameMap[parseInt(exId)] || `Ćwiczenie #${exId}`
    const rows = logs
      .sort((a, b) => a.set_number - b.set_number)
      .map(l => {
        const warmup = l.is_warmup ? ' <span style="color:#888;font-size:11px">(WU)</span>' : ''
        const weight = l.weight ? `<strong>${l.weight} kg</strong>` : '—'
        const reps = l.reps_completed ? `${l.reps_completed} powt.` : '—'
        return `<tr>
          <td style="padding:4px 8px;color:#888;font-size:13px">S${l.set_number}${warmup}</td>
          <td style="padding:4px 8px;font-size:13px">${weight}</td>
          <td style="padding:4px 8px;font-size:13px;color:#555">${reps}</td>
        </tr>`
      }).join('')

    setsHtml += `
      <div style="margin-bottom:16px">
        <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#111">${name}</div>
        <table style="border-collapse:collapse;width:100%">
          <thead>
            <tr style="background:#f5f5f0">
              <th style="padding:4px 8px;text-align:left;font-size:11px;color:#888;font-weight:500">Seria</th>
              <th style="padding:4px 8px;text-align:left;font-size:11px;color:#888;font-weight:500">Ciężar</th>
              <th style="padding:4px 8px;text-align:left;font-size:11px;color:#888;font-weight:500">Powt.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }

  // Wellness
  let wellnessHtml = ''
  if (wellness) {
    wellnessHtml = `
      <div style="background:#f9f8f5;padding:16px;margin-bottom:24px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Wellness przed treningiem</div>
        <table style="width:100%;border-collapse:collapse">
          ${wellness.sleep_hours ? `<tr><td style="padding:3px 0;font-size:13px;color:#555">Sen</td><td style="padding:3px 0;font-size:13px;font-weight:600;text-align:right">${wellness.sleep_hours}h</td></tr>` : ''}
          ${wellness.sleep_quality ? `<tr><td style="padding:3px 0;font-size:13px;color:#555">Jakość snu</td><td style="padding:3px 0;font-size:13px;font-weight:600;text-align:right">${wellness.sleep_quality}/5</td></tr>` : ''}
          ${wellness.energy ? `<tr><td style="padding:3px 0;font-size:13px;color:#555">Energia</td><td style="padding:3px 0;font-size:13px;font-weight:600;text-align:right">${wellness.energy}/5</td></tr>` : ''}
          ${wellness.stress ? `<tr><td style="padding:3px 0;font-size:13px;color:#555">Stres</td><td style="padding:3px 0;font-size:13px;font-weight:600;text-align:right">${wellness.stress}/5</td></tr>` : ''}
          ${wellness.mood ? `<tr><td style="padding:3px 0;font-size:13px;color:#555">Nastrój</td><td style="padding:3px 0;font-size:13px;font-weight:600;text-align:right">${wellness.mood}/5</td></tr>` : ''}
          ${wellness.muscle_sorness ? `<tr><td style="padding:3px 0;font-size:13px;color:#555">Zakwasy</td><td style="padding:3px 0;font-size:13px;font-weight:600;text-align:right">${wellness.muscle_sorness}/5</td></tr>` : ''}
          ${wellness.readiness ? `<tr><td style="padding:3px 0;font-size:13px;color:#555">Gotowość</td><td style="padding:3px 0;font-size:13px;font-weight:600;text-align:right">${wellness.readiness}/5</td></tr>` : ''}
          ${wellness.concerns ? `<tr><td colspan="2" style="padding:6px 0;font-size:13px;color:#555;font-style:italic">"${wellness.concerns}"</td></tr>` : ''}
        </table>
      </div>`
  }

  // Pain logs
  let painHtml = ''
  if (painLogs && painLogs.length > 0) {
    painHtml = `
      <div style="background:#fff8f0;border-left:3px solid #F5C842;padding:12px 16px;margin-bottom:24px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Zgłoszony ból</div>
        ${painLogs.map((p: any) => `
          <div style="margin-bottom:8px">
            <span style="font-weight:600;font-size:13px">${p.location || 'Brak lokalizacji'}</span>
            <span style="color:#888;font-size:13px"> · VAS ${p.vas_score}/10</span>
            ${p.description ? `<div style="font-size:12px;color:#666;margin-top:2px">${p.description}</div>` : ''}
          </div>`).join('')}
      </div>`
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f0eee9;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="margin-bottom:32px">
      <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;margin-bottom:8px">Cheer LevelUP</div>
      <h1 style="font-size:28px;font-weight:700;color:#111;margin:0 0 4px;line-height:1.1">Raport treningowy</h1>
      <div style="font-size:14px;color:#666">${athleteName} · ${date}</div>
    </div>

    <!-- Info -->
    <div style="background:#111;color:#f0eee9;padding:20px;margin-bottom:24px">
      <div style="font-size:11px;color:#F5C842;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px">
        ${planName || 'Plan'} · Tydzień ${weekNumber || '—'}
      </div>
      <div style="font-size:22px;font-weight:700;margin-bottom:12px">${dayName}</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;color:#888;margin-bottom:2px">RPE</div>
          <div style="font-size:20px;font-weight:700">${rpe}/10 <span style="font-size:13px;color:#aaa;font-weight:400">${rpeLabel(rpe)}</span></div>
        </div>
        <div>
          <div style="font-size:11px;color:#888;margin-bottom:2px">Samopoczucie</div>
          <div style="font-size:16px;font-weight:600">${feelingLabel(feeling)}</div>
        </div>
      </div>
    </div>

    ${wellnessHtml}

    <!-- Serie -->
    ${Object.keys(logsByExercise).length > 0 ? `
    <div style="margin-bottom:24px">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Wykonane serie</div>
      ${setsHtml}
    </div>` : ''}

    ${painHtml}

    <!-- Feedback -->
    ${whatWentWell || painComment || generalNotes ? `
    <div style="background:#f9f8f5;padding:16px;margin-bottom:24px">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Feedback</div>
      ${whatWentWell ? `<div style="margin-bottom:10px"><div style="font-size:11px;color:#888;margin-bottom:3px">Co poszło dobrze</div><div style="font-size:13px;color:#111">${whatWentWell}</div></div>` : ''}
      ${painComment ? `<div style="margin-bottom:10px"><div style="font-size:11px;color:#888;margin-bottom:3px">Ból / dyskomfort</div><div style="font-size:13px;color:#111">${painComment}</div></div>` : ''}
      ${generalNotes ? `<div><div style="font-size:11px;color:#888;margin-bottom:3px">Dodatkowe uwagi</div><div style="font-size:13px;color:#111">${generalNotes}</div></div>` : ''}
    </div>` : ''}

    <!-- Footer -->
    <div style="border-top:1px solid #D5D2CB;padding-top:16px;font-size:11px;color:#aaa;text-align:center">
      Cheer LevelUP — Przygotowanie motoryczne
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    // Weryfikuj że użytkownik jest zalogowany
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const html = buildEmailHtml(data)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cheer LevelUP <onboarding@resend.dev>',
        to: ['cheerlevelup@gmail.com'],
        subject: `📋 Raport: ${data.athleteName} — ${data.dayName} (${new Date().toLocaleDateString('pl-PL')})`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return NextResponse.json({ error: err }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('send-report error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
