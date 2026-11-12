-- Data treningu w planie (edytor planu → pole daty przy treningu). Zawodniczka
-- widzi „Dzisiejszy trening" tylko wtedy, gdy któryś trening planu ma dzisiejszą datę.
alter table public.workout_days add column if not exists training_date date;
notify pgrst, 'reload schema';
