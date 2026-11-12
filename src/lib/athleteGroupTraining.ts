// src/lib/athleteGroupTraining.ts
// Treningi grupy (moduł „Trening grupy" trenera) w aplikacji zawodniczki —
// te same tabele co w panelu trenera (group_trainings / group_training_exercises /
// group_training_entries), więc wpisy widać po obu stronach po odświeżeniu.
// Dostęp zawodniczki: migracja 202611120002.
import { createClient } from '@/utils/supabase/server'
import { entryFilled, isMaxReps, type GroupEntry, type GroupExercise, type GroupTrainingInfo, type GroupTrainingListItem } from './athleteGroupTrainingShared'
export type { GroupSetRow, GroupExercise, GroupEntry, GroupTrainingInfo, GroupTrainingListItem } from './athleteGroupTrainingShared'


type TrainingRow = { id: number; group_id: number; training_date: string; notes?: string | null; absent_athlete_ids?: unknown; roster_athlete_ids?: unknown }

const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number) : [])
// zawodniczka należała do składu tego treningu (stare treningi bez składu — cała grupa)
const inRoster = (t: TrainingRow, athleteId: number) => { const r = ids(t.roster_athlete_ids); return r.length === 0 || r.includes(athleteId) }
const info = (t: TrainingRow, athleteId: number): GroupTrainingInfo => ({
  id: t.id, group_id: t.group_id, training_date: t.training_date, notes: t.notes ?? null,
  absent: ids(t.absent_athlete_ids).includes(athleteId),
})

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
