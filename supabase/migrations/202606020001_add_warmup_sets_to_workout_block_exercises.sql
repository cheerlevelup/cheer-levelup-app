alter table workout_block_exercises
add column if not exists warmup_sets jsonb not null default '[]'::jsonb;
