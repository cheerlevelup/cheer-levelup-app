alter table wellness_logs
add column if not exists body_weight_kg numeric,
add column if not exists hydration_glasses numeric,
add column if not exists resting_hr integer,
add column if not exists cycle_phase text,
add column if not exists cycle_day integer,
add column if not exists recovery_score integer,
add column if not exists sitting_hours numeric,
add column if not exists activity_data jsonb not null default '{}'::jsonb,
add column if not exists pain_data jsonb not null default '{}'::jsonb,
add column if not exists supplements_data jsonb not null default '{}'::jsonb;
