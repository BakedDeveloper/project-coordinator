-- =====================================================================
-- Coordinator — cancellare un task per sempre (issue #43)
--
-- Finora i task non si cancellavano (CLAUDE.md, regola 7). Da qui Simone
-- può cancellare dall'app un task creato per sbaglio, quando anche
-- Annullato è troppo. Progetti e persone continuano a non cancellarsi.
--
-- - Solo Simone, e mai un task di origine GitHub: lo decide GitHub.
-- - Blocchi e attese del task spariscono con lui (on delete cascade già
--   presente su blocks e waiting_items).
-- - Un task con ore registrate non si cancella: time_entries ha
--   on delete restrict, il database rifiuta e l'app propone Annullato.
-- - La cancellazione resta in activity_log (trigger tasks_log, già
--   attivo anche sulle delete).
-- =====================================================================

create policy owner_delete on public.tasks
  for delete to authenticated
  using (public.is_coordinator_owner() and origin <> 'github');
