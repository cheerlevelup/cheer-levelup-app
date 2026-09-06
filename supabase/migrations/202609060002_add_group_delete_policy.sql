-- Pozwala trenerowi usuwać puste grupy z panelu.
-- athletes.group_id ma ON DELETE RESTRICT (potwierdzone), więc samo DELETE
-- odmówi wykonania dopóki jakaś zawodniczka wciąż wskazuje na tę grupę —
-- aplikacja najpierw jawnie czyści group_id, dopiero potem usuwa wiersz grupy.
drop policy if exists "coach_delete_groups" on public.groups;
create policy "coach_delete_groups" on public.groups
  for delete to authenticated
  using (auth.email() = 'cheerlevelup@gmail.com');
