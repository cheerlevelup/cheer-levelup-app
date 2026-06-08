// src/types/workout.ts
export interface WorkoutPlan {
  id: number
  name: string
  description?: string
  created_at: string
}

export interface WorkoutWeek {
  id: number
  plan_id: number
  week_number: number
  name?: string
  plan?: WorkoutPlan
}

export interface WorkoutDay {
  id: number
  week_id: number
  day_name: string
  day_order: number
  coach_intro?: string | null
  coach_outro?: string | null
  coach_closing?: string | null
  week?: WorkoutWeek
}

export interface WorkoutDayBlock {
  id: number
  day_id: number
  block_name: string
  block_order: number
  rounds: number
  description?: string
  exercises?: WorkoutBlockExercise[]
}

export interface WarmupSet {
  reps?: string
  weight_kg?: string
  note?: string
}

export interface WorkoutBlockExercise {
  id: number
  block_id: number
  exercise_id?: number
  exercise_code?: string
  exercise_order: number
  sets: number
  reps?: string
  tempo?: string
  weight_kg?: number
  rir?: number
  duration_sec?: number
  is_warmup: boolean
  warmup_sets?: WarmupSet[] | null
  coach_comment?: string
  exercise_url?: string | null
  accessories?: string
  exercise?: Exercise
  override?: AthleteExerciseOverride | null
}

export interface Exercise {
  id: number
  name: string
  category?: string
  movement_pattern?: string
  unilateral?: boolean
  default_tempo?: string
}

export interface AthleteWorkoutAssignment {
  id: number
  plan_id: number
  athlete_id?: number
  group_id?: number
  start_date?: string
  order_mode: 'sequential' | 'dated'
  is_active: boolean
  plan?: WorkoutPlan
}

export interface WorkoutSession {
  id: number
  athlete_id: number
  workout_day_id?: number
  assignment_id?: number
  date_started?: string
  date_completed?: string
  completed: boolean
  report_sent: boolean
  notes?: string
  workout_day?: WorkoutDay & {
    week?: WorkoutWeek & { plan?: WorkoutPlan }
  }
}

export interface AthleteExerciseOverride {
  id: number
  athlete_id: number
  block_exercise_id: number
  sets_override?: number | null
  reps_override?: string | null
  weight_override?: number | null
  tempo_override?: string | null
  coach_note_override?: string | null
  is_substitution: boolean
  skip?: boolean | null
  exercise_id_override?: number | null
  exercise_code_override?: string | null
  rir?: number | null
}

export interface SetLog {
  id: number
  block_exercise_id?: number
  workout_session_id?: number
  set_number: number
  weight?: number
  reps_completed?: number
  athlete_note?: string | null
  duration_seconds?: number
  completed: boolean
  is_warmup: boolean
  athlete_id: number
  created_at: string
}

export interface Athlete {
  id: number
  full_name: string
  birth_year?: number
  group_id?: number
  user_id: string
  created_at: string
  group?: Group
}

export interface Group {
  id: number
  name: string
  training_level?: string
  sort_order?: number
}

export interface TrainingView {
  session: WorkoutSession | null
  day: WorkoutDay
  blocks: WorkoutDayBlock[]
  plan: WorkoutPlan
  week: WorkoutWeek
}
