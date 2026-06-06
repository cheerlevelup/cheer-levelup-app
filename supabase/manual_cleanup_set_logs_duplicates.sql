-- Safe cleanup for duplicated set_logs rows.
-- Run each section separately in Supabase SQL Editor.
-- 1) Preview first.
-- 2) Delete only after the preview looks correct.
-- 3) Add the unique index after duplicates are gone.

-- SECTION 1: Preview duplicated set logs.
-- Keeps the newest row for the same athlete/session/exercise/set/warmup flag.
with ranked as (
  select
    id,
    athlete_id,
    workout_session_id,
    block_exercise_id,
    set_number,
    coalesce(is_warmup, false) as is_warmup,
    weight,
    reps_completed,
    completed,
    created_at,
    row_number() over (
      partition by
        athlete_id,
        workout_session_id,
        block_exercise_id,
        set_number,
        coalesce(is_warmup, false)
      order by created_at desc nulls last, id desc
    ) as keep_rank,
    count(*) over (
      partition by
        athlete_id,
        workout_session_id,
        block_exercise_id,
        set_number,
        coalesce(is_warmup, false)
    ) as duplicate_count
  from public.set_logs
  where workout_session_id is not null
    and block_exercise_id is not null
    and set_number is not null
)
select *
from ranked
where duplicate_count > 1
order by workout_session_id, block_exercise_id, is_warmup, set_number, keep_rank;

-- SECTION 2: Count how many older duplicate rows would be deleted.
with ranked as (
  select
    id,
    row_number() over (
      partition by
        athlete_id,
        workout_session_id,
        block_exercise_id,
        set_number,
        coalesce(is_warmup, false)
      order by created_at desc nulls last, id desc
    ) as keep_rank
  from public.set_logs
  where workout_session_id is not null
    and block_exercise_id is not null
    and set_number is not null
)
select count(*) as rows_to_delete
from ranked
where keep_rank > 1;

-- SECTION 3: Delete older duplicates and return deleted rows.
-- This leaves one newest row per athlete/session/exercise/set/warmup flag.
with ranked as (
  select
    id,
    row_number() over (
      partition by
        athlete_id,
        workout_session_id,
        block_exercise_id,
        set_number,
        coalesce(is_warmup, false)
      order by created_at desc nulls last, id desc
    ) as keep_rank
  from public.set_logs
  where workout_session_id is not null
    and block_exercise_id is not null
    and set_number is not null
)
delete from public.set_logs as sl
using ranked as r
where sl.id = r.id
  and r.keep_rank > 1
returning sl.*;

-- SECTION 4: Prevent this duplicate pattern from coming back.
-- Run this only after SECTION 3 succeeds.
create unique index if not exists set_logs_unique_session_exercise_set
on public.set_logs (
  athlete_id,
  workout_session_id,
  block_exercise_id,
  set_number,
  coalesce(is_warmup, false)
)
where workout_session_id is not null
  and block_exercise_id is not null
  and set_number is not null;

-- SECTION 5: Preview suspicious weights.
-- This does not delete anything. Adjust 250 if needed.
select
  id,
  athlete_id,
  workout_session_id,
  block_exercise_id,
  set_number,
  is_warmup,
  weight,
  reps_completed,
  completed,
  created_at
from public.set_logs
where weight is not null
  and (weight < 0 or weight > 250)
order by created_at desc nulls last, id desc;

-- SECTION 6: Optional cleanup for suspicious weights.
-- Use only if SECTION 5 shows clearly broken values like -2 or huge numbers.
-- This keeps the training row, but clears the broken weight.
update public.set_logs
set weight = null
where weight is not null
  and (weight < 0 or weight > 250)
returning *;
