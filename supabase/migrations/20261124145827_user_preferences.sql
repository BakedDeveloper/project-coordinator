-- =====================================================================
-- Coordinator — preferenze dell'utente dell'app (issue #12, epic #13)
--
-- Una riga per utente; ogni preferenza è una colonna con il suo controllo,
-- così il database rifiuta i valori sbagliati e i tipi si generano.
-- Niente activity_log: le preferenze non sono dati dei progetti.
-- Nessuna policy di delete: la riga si aggiorna, non si cancella.
-- =====================================================================

create table public.user_preferences (
  user_id    uuid primary key default auth.uid()
             references auth.users (id) on delete cascade,
  theme      text not null default 'system'
             check (theme in ('system', 'light', 'dark')),
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
  'Preferenze dell''app, una riga per utente. Una colonna per preferenza, con il suo controllo.';
comment on column public.user_preferences.theme is
  'Tema dell''app: system (segue il sistema), light, dark.';

-- updated_at lo aggiorna il database: l'app non lo scrive mai.
-- (tg_set_meta non va bene qui: scrive anche last_changed_by, che questa tabella non ha.)
create function public.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_touch_updated_at() from public, anon, authenticated;

create trigger user_preferences_touch
  before update on public.user_preferences
  for each row execute function public.tg_touch_updated_at();

alter table public.user_preferences enable row level security;

create policy owner_select on public.user_preferences
  for select to authenticated
  using (public.is_coordinator_owner() and user_id = (select auth.uid()));

create policy owner_insert on public.user_preferences
  for insert to authenticated
  with check (public.is_coordinator_owner() and user_id = (select auth.uid()));

create policy owner_update on public.user_preferences
  for update to authenticated
  using (public.is_coordinator_owner() and user_id = (select auth.uid()))
  with check (public.is_coordinator_owner() and user_id = (select auth.uid()));
