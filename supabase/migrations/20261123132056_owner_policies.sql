-- =====================================================================
-- Coordinator — accesso dall'app per l'unico utente, Simone
--
-- Fino a qui la RLS bloccava tutti tranne il connettore (ruolo postgres).
-- Queste policy aprono l'accesso all'utente Supabase Auth di Simone e a nessun altro.
-- La registrazione pubblica è disattivata nel progetto: questa è la seconda difesa,
-- quella che conta anche se un giorno la registrazione venisse riaperta per sbaglio.
--
-- Cosa può fare l'app:
-- * leggere tutte le tabelle, il registro compreso (solo lettura);
-- * inserire e modificare i dati;
-- * cancellare solo righe di blocks, waiting_items, time_entries, inbox_items
--   (progetti, task e persone non si cancellano: si chiudono).
-- =====================================================================

create function public.is_coordinator_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) = '4456cb3d-f694-414a-a31c-cfc736a43931'::uuid
$$;

comment on function public.is_coordinator_owner() is
  'Vero solo per l''utente Supabase Auth di Simone, l''unico utente dell''app.';

do $$
declare
  t text;
begin
  -- lettura e scrittura
  foreach t in array array[
    'projects', 'features', 'tasks', 'people', 'project_people',
    'blocks', 'waiting_items', 'checkpoints', 'time_entries', 'inbox_items'
  ] loop
    execute format('create policy owner_select on public.%I for select to authenticated using (public.is_coordinator_owner())', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (public.is_coordinator_owner())', t);
    execute format('create policy owner_update on public.%I for update to authenticated using (public.is_coordinator_owner()) with check (public.is_coordinator_owner())', t);
  end loop;

  -- cancellazione: solo le righe che la skill permette di togliere
  foreach t in array array['blocks', 'waiting_items', 'time_entries', 'inbox_items'] loop
    execute format('create policy owner_delete on public.%I for delete to authenticated using (public.is_coordinator_owner())', t);
  end loop;
end;
$$;

-- registro: solo lettura (lo scrivono i trigger)
create policy owner_select on public.activity_log
  for select to authenticated using (public.is_coordinator_owner());
