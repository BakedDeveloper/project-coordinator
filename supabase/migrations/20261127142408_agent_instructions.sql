-- =====================================================================
-- Coordinator — istruzioni per gli account dei progetti (issue #41)
--
-- Le regole che la skill "aggiorna il coordinatore" deve seguire stanno
-- qui invece che nel testo della skill: la skill le legge all'inizio di
-- ogni aggiornamento e le segue. Si cambiano una volta sola, nel database,
-- e valgono per tutti gli account (lavoro e personale).
--
-- Una riga per argomento. Non si cancellano: un argomento che non vale
-- più va ad active = false. Ogni modifica resta in activity_log.
-- =====================================================================

create table public.agent_instructions (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique
                  check (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(key) <= 64),
  title           text not null check (char_length(title) between 1 and 120),
  body            text not null check (char_length(body) between 1 and 8000),
  position        integer not null default 100,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual'
);

comment on table public.agent_instructions is
  'Istruzioni per la skill "aggiorna il coordinatore": la skill legge le righe attive in ordine di position all''inizio di ogni aggiornamento e le segue. Hanno la precedenza sul testo della skill.';
comment on column public.agent_instructions.key is
  'Argomento in snake_case (es. task_statuses). Unico.';
comment on column public.agent_instructions.body is
  'Il testo dell''istruzione, in Markdown, scritto per l''account Claude del progetto.';
comment on column public.agent_instructions.active is
  'False: l''istruzione non vale più. Le righe non si cancellano.';

-- Come le altre tabelle: fonte della modifica, updated_at e activity_log dai trigger.
create trigger agent_instructions_set_meta before insert or update on public.agent_instructions
  for each row execute function public.tg_set_meta();
create trigger agent_instructions_log after insert or update or delete on public.agent_instructions
  for each row execute function public.tg_log_activity();

alter table public.agent_instructions enable row level security;

-- Solo Simone dall'app; nessuna cancellazione (come clients). Gli account dei
-- progetti leggono con il connettore Supabase, che lavora come postgres e
-- non passa dalle policy.
create policy owner_select on public.agent_instructions
  for select to authenticated using (public.is_coordinator_owner());
create policy owner_insert on public.agent_instructions
  for insert to authenticated with check (public.is_coordinator_owner());
create policy owner_update on public.agent_instructions
  for update to authenticated
  using (public.is_coordinator_owner()) with check (public.is_coordinator_owner());
