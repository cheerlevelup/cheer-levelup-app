alter table public.workout_sessions
  drop constraint if exists workout_sessions_assignment_id_fkey;

alter table public.workout_sessions
  add constraint workout_sessions_assignment_id_fkey
    foreign key (assignment_id)
    references public.athlete_workout_assignments(id)
    on delete set null;
