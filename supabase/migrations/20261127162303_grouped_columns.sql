-- =====================================================================
-- Coordinator — colonne raggruppate per progetto (issue #52)
--
-- Ogni colonna delle board ha un bottone "Raggruppa per progetto". Qui
-- si salva quali colonne sono raggruppate, come le colonne visibili:
-- vale su ogni dispositivo. Null: la scelta di base, solo Fatto
-- raggruppata; le altre colonne partono come elenco.
-- =====================================================================

alter table public.user_preferences
  add column grouped_columns text[]
    check (grouped_columns <@ array['todo', 'in_progress', 'blocked', 'on_hold', 'done', 'cancelled']);

comment on column public.user_preferences.grouped_columns is
  'Colonne delle board raggruppate per progetto: todo, in_progress, blocked, on_hold, done, cancelled. Vuoto: nessuna. Null: quella di base (solo done).';
