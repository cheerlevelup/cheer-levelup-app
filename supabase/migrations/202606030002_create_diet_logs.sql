create table if not exists diet_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id bigint not null references athletes(id) on delete cascade,
  date date not null default current_date,
  meal_count integer not null default 0,
  had_breakfast boolean,
  hunger_level integer,
  meals jsonb not null default '[]'::jsonb,
  water_ml integer,
  coffee_count integer not null default 0,
  coffee_empty boolean,
  coffee_times jsonb not null default '[]'::jsonb,
  other_drinks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (athlete_id, date)
);

alter table diet_logs enable row level security;

create policy "Athletes can view own diet logs"
  on diet_logs for select
  using (
    athlete_id in (
      select id from athletes where user_id = auth.uid()
    )
  );

create policy "Athletes can insert own diet logs"
  on diet_logs for insert
  with check (
    athlete_id in (
      select id from athletes where user_id = auth.uid()
    )
  );

create policy "Athletes can update own diet logs"
  on diet_logs for update
  using (
    athlete_id in (
      select id from athletes where user_id = auth.uid()
    )
  );
