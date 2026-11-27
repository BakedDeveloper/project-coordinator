-- =====================================================================
-- Coordinator — stato "sospeso" dei task e colonne visibili della board
-- (issue #39)
--
-- on_hold: un task messo da parte di proposito, senza dipendere da
-- nessuno. Resta aperto ma esce dalle priorità: v_priorities prende solo
-- i task in todo e in_progress, quindi non serve cambiare le viste.
-- Un task sospeso che blocca altri continua a bloccarli (is_blocked
-- guarda solo done e cancelled).
--
-- board_columns: le colonne che Simone vuole vedere sulle board.
-- =====================================================================

alter table public.tasks drop constraint tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
    check (status in ('todo', 'in_progress', 'on_hold', 'done', 'cancelled'));

comment on column public.tasks.status is
  'todo, in_progress, on_hold (sospeso: messo da parte, fuori dalle priorità finché non torna in todo o in_progress), done, cancelled (annullato: non si fa più, resta registrato).';

-- Le colonne visibili, nell'ordine fisso della board. Null: quelle di
-- base (tutte tranne Annullato).
alter table public.user_preferences
  add column board_columns text[]
    check (board_columns <@ array['todo', 'in_progress', 'blocked', 'on_hold', 'done', 'cancelled']
           and cardinality(board_columns) between 1 and 6);

comment on column public.user_preferences.board_columns is
  'Colonne visibili delle board: todo, in_progress, blocked, on_hold, done, cancelled. Null: tutte tranne cancelled.';
