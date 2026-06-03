-- workout_sessions: zachowaj historię, ale pozwól usunąć dzień planu
alter table workout_sessions
  drop constraint if exists workout_sessions_workout_day_id_fkey;
alter table workout_sessions
  add constraint workout_sessions_workout_day_id_fkey
    foreign key (workout_day_id) references workout_days(id) on delete set null;

-- workout_day_blocks: kaskada przy usunięciu dnia
alter table workout_day_blocks
  drop constraint if exists workout_day_blocks_day_id_fkey;
alter table workout_day_blocks
  add constraint workout_day_blocks_day_id_fkey
    foreign key (day_id) references workout_days(id) on delete cascade;

-- workout_block_exercises: kaskada przy usunięciu bloku
alter table workout_block_exercises
  drop constraint if exists workout_block_exercises_block_id_fkey;
alter table workout_block_exercises
  add constraint workout_block_exercises_block_id_fkey
    foreign key (block_id) references workout_day_blocks(id) on delete cascade;
