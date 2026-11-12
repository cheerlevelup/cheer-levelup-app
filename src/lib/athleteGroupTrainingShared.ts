// src/lib/athleteGroupTrainingShared.ts
// Typy i funkcje pomocnicze treningu grupy w aplikacji zawodniczki — bez kodu
// serwerowego, więc mogą je importować komponenty działające w przeglądarce.

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

// wpis ma jakąkolwiek wartość wpisaną przez zawodniczkę albo trenera
// (przy masie własnej / „max" wynikiem są powtórzenia — wtedy liczą się też powt.)
export const entryFilled = (e: GroupEntry | undefined, repsMode = false) => !!e?.sets?.some(s =>
  (s.weight ?? '').toString().trim() !== '' || (s.seconds ?? '').toString().trim() !== '' || (repsMode && (s.reps ?? '').toString().trim() !== ''))
export const isMaxReps = (reps?: string | null) => /(amrap|maks|max|upad)/i.test((reps || '').trim())
