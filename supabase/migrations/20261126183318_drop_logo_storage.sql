-- =====================================================================
-- Coordinator — via i loghi nello Storage (issue #28)
--
-- I loghi stanno nel database (migrazione logos_in_database). Le colonne
-- logo_path e il bucket logos della migrazione project_badges non servono
-- più: erano vuoti, nessun file caricato e nessun percorso scritto.
--
-- Il bucket (vuoto) si cancella dal pannello: Supabase non permette di
-- cancellarlo con SQL (trigger storage.protect_delete). Senza policy
-- nessuno può usarlo.
-- =====================================================================

alter table public.clients drop column logo_path;
alter table public.projects drop column logo_path;

drop policy logos_owner_select on storage.objects;
drop policy logos_owner_insert on storage.objects;
drop policy logos_owner_update on storage.objects;
drop policy logos_owner_delete on storage.objects;
