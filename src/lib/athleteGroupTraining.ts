// src/lib/athleteGroupTraining.ts
// Treningi grupy (moduł „Trening grupy" trenera) w aplikacji zawodniczki —
// te same tabele co w panelu trenera (group_trainings / group_training_exercises /
// group_training_entries), więc wpisy widać po obu stronach po odświeżeniu.
// Dostęp zawodniczki: migracja 202611120002.
import { createClient } from '@/utils/supabase/server'

export type GroupSetRow = { reps?: string; tempo?: string; weight?: string; skipped?: boolean; seconds?: string }

export type GroupExercise = {
  id: number
  training_id: number
  name: string
  exercise_order: number
  block_index?: number | null
  link_url?: string | null
  coach_comment?: string | null
  sets_planned?: number | null
  reps?: string | null
  tempo?: string | null
  bodyweight?: boolean | null
  individual?: boolean | null
  athlete_id?: number | null
  iso?: boolean | null
  iso_type?: 'PIMA' | 'HIMA' | null
  iso_seconds?: number | null
  iso_intensity?: number | null
  iso_seconds_sets?: (number | null)[] | null
  iso_intensity_sets?: (number | null)[] | null
  reps_sets?: (string | null)[] | null
  tempo_sets?: (string | null)[] | null
}

export type GroupEntry = {
  id?: number
  training_id: number
  exercise_id: number
  athlete_id: number
  sets: GroupSetRow[]
  pain?: boolean | null
  pain_vas?: number | null
  pain_comment?: string | null
  comment?: string | null
  exercise_override?: string | null
  bodyweight?: boolean | null
  excluded?: boolean | null
  locked?: boolean | null
}

export type GroupTrainingInfo = {
  id: number
  group_id: number
  training_date: string
  notes?: string | null
  absent: boolean
}

export type GroupTrainingListItem = GroupTrainingInfo & { exercises: number; filled: number }

type TrainingRow = { id: number; group_id: number; training_date: string; notes?: string | null; absent_athlete_ids?: unknown; roster_athlete_ids?: unknown }

const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number) : [])
// zawodniczka należała do składu tego treningu (stare treningi bez składu — cała grupa)
const inRoster = (t: TrainingRow, athleteId: number) => { const r = ids(t.roster_athlete_ids); return r.length === 0 || r.includes(athleteId) }
const info = (t: TrainingRow, athleteId: number): GroupTrainingInfo => ({
  id: t.id, group_id: t.group_id, training_date: t.training_date, notes: t.notes ?? null,
  absent: ids(t.absent_athlete_ids).includes(athleteId),
})
// wpis ma jakąkolwiek wartość wpisaną przez zawodniczkę albo trenera
// (przy masie własnej / „max" wynikiem są powtórzenia — wtedy liczą się też powt.)
export const entryFilled = (e: GroupEntry | undefined, repsMode = false) => !!e?.sets?.some(s =>
  (s.weight ?? '').toString().trim() !== '' || (s.seconds ?? '').toString().trim() !== '' || (repsMode && (s.reps ?? '').toString().trim() !== ''))
export const isMaxReps = (reps?: string | null) => /(amrap|maks|max|upad)/i.test((reps || '').trim())

// Ostatnie treningi grupy zawodniczki (od najnowszego) z licznikiem uzupełnionych ćwiczeń
export async function getAthleteGroupTrainings(athleteId: number, groupId: number | null | undefined, limit = 8): Promise<GroupTrainingListItem[]> {
  if (!groupId) return []
  const supabase = await createClient()
  const { data: trainings, error } = await supabase
    .from('group_trainings').select('*').eq('group_id', groupId)
    .order('training_date', { ascending: false }).limit(limit * 2)
  if (error || !trainings?.length) return []
  const mine = (trainings as TrainingRow[]).filter(t => inRoster(t, athleteId)).slice(0, limit)
  if (!mine.length) return []
  const tIds = mine.map(t => t.id)
  const [{ data: exs }, { data: entries }] = await Promise.all([
    supabase.from('group_training_exercises').select('id, training_id, athlete_id, bodyweight, reps').in('training_id', tIds),
    supabase.from('group_training_entries').select('*').in('training_id', tIds).eq('athlete_id', athleteId),
  ])
  const entryByEx = new Map(((entries || []) as GroupEntry[]).map(e => [e.exercise_id, e]))
  return mine.map(t => {
    const own = ((exs || []) as { id: number; training_id: number; athlete_id: number | null; bodyweight?: boolean | null; reps?: string | null }[])
      .filter(e => e.training_id === t.id && (e.athlete_id == null || e.athlete_id === athleteId))
      .filter(e => !entryByEx.get(e.id)?.excluded)
    return { ...info(t, athleteId), exercises: own.length, filled: own.filter(e => { const en = entryByEx.get(e.id); return entryFilled(en, !!e.bodyweight || !!en?.bodyweight || isMaxReps(e.reps)) }).length }
  })
}

// Jeden trening grupy: ćwiczenia (grupowe + własne indywidualne) i wpisy zawodniczki
export async function getAthleteGroupTraining(athleteId: number, groupId: number | null | undefined, trainingId: number) {
  if (!groupId) return null
  const supabase = await createClient()
  const { data: t } = await supabase.from('group_trainings').select('*').eq('id', trainingId).eq('group_id', groupId).maybeSingle()
  if (!t || !inRoster(t as TrainingRow, athleteId)) return null
  const [{ data: group }, { data: exs }, { data: entries }] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase.from('group_training_exercises').select('*').eq('training_id', trainingId)
      .order('block_index', { ascending: true, nullsFirst: true }).order('exercise_order', { ascending: true }),
    supabase.from('group_training_entries').select('*').eq('training_id', trainingId).eq('athlete_id', athleteId),
  ])
  const exercises = ((exs || []) as GroupExercise[]).filter(e => e.athlete_id == null || e.athlete_id === athleteId)
  return {
    training: info(t as TrainingRow, athleteId),
    groupName: (group as { name?: string } | null)?.name || 'Grupa',
    exercises,
    entries: (entries || []) as GroupEntry[],
  }
}
