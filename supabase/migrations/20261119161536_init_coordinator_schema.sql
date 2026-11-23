-- =====================================================================
-- Coordinator — schema iniziale (Fase 1)
-- Progetto Supabase: coordinator (org project-coordinator), Postgres 17
--
-- Convenzioni
-- * Nomi di tabelle, colonne e valori in inglese.
-- * Ogni tabella ha: id uuid, created_at, updated_at, last_changed_by.
-- * last_changed_by NON si scrive a mano: lo imposta un trigger leggendo
--   l'impostazione di transazione app.source.
--     - Claude (skill "aggiorna il coordinatore") apre una transazione e
--       imposta la fonte:
--         begin;
--         select set_config('app.source', 'personal', true);  -- o 'work'
--         ... insert / update ...
--         commit;
--     - Chi non imposta niente (Table Editor, frontend) risulta 'manual'.
--     - La sincronizzazione GitHub userà 'github'.
-- * Ogni modifica finisce in activity_log tramite trigger.
-- * RLS attiva su tutte le tabelle, nessuna policy: per ora niente
--   accesso da anon/authenticated. Il connettore usa il ruolo postgres.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Funzioni di supporto
-- ---------------------------------------------------------------------

-- Fonte della modifica corrente. Valori ammessi: work, personal, manual, github.
create function public.app_source()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  s text := nullif(current_setting('app.source', true), '');
begin
  if s is null then
    return 'manual';
  end if;
  if s not in ('work', 'personal', 'manual', 'github') then
    raise exception 'app.source non valido: % (ammessi: work, personal, manual, github)', s;
  end if;
  return s;
end;
$$;

-- Imposta last_changed_by, updated_at e protegge created_at.
create function public.tg_set_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_changed_by := public.app_source();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Scrive ogni modifica in activity_log (salta gli update che non cambiano nulla).
-- security definer: scrive in activity_log anche quando chi modifica
-- (per esempio il frontend) non ha accesso diretto al registro.
create function public.tg_log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE'
     and (old_j - 'updated_at' - 'last_changed_by') = (new_j - 'updated_at' - 'last_changed_by') then
    return null;
  end if;

  insert into public.activity_log (table_name, record_id, operation, old_row, new_row, source)
  values (
    tg_table_name,
    coalesce((new_j ->> 'id')::uuid, (old_j ->> 'id')::uuid),
    tg_op,
    old_j,
    new_j,
    public.app_source()
  );
  return null;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Tabelle
-- ---------------------------------------------------------------------

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  scope           text not null check (scope in ('work', 'personal')),
  client          text,
  status          text not null default 'active'
                  check (status in ('active', 'paused', 'closed')),
  weekly_hours    numeric(5,2) check (weekly_hours > 0),
  start_date      date,
  github_repo     text check (github_repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual'
);
comment on table public.projects is 'Progetti di lavoro e personali. Per i progetti di lavoro solo titoli e stati, mai dettagli tecnici.';
comment on column public.projects.closed_at is
  'Impostata dal trigger quando status diventa closed. I progetti chiusi restano visibili (idea futura: la città dei palazzi finiti).';

create table public.features (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete restrict,
  name            text not null,
  position        integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual',
  unique (project_id, name),
  unique (id, project_id)            -- serve alla FK composta da tasks
);

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete restrict,
  feature_id          uuid,
  title               text not null,
  status              text not null default 'todo'
                      check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  impact              text not null default 'medium'
                      check (impact in ('high', 'medium', 'low')),
  due_date            date,
  next_action         text,
  estimated_hours     numeric(6,2) check (estimated_hours >= 0),
  kind                text,
  position            integer,
  origin              text not null default 'coordinator'
                      check (origin in ('github', 'coordinator')),
  github_issue_number integer check (github_issue_number > 0),
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_changed_by     text not null default 'manual',
  -- la feature deve essere dello stesso progetto del task
  foreign key (feature_id, project_id) references public.features (id, project_id) on delete restrict,
  -- un task di origine GitHub deve avere il numero della issue
  check (origin <> 'github' or github_issue_number is not null),
  unique (project_id, github_issue_number),
  unique (id, project_id)            -- serve alla FK composta da time_entries
);
comment on column public.tasks.origin is
  'github: la sync scrive solo title e porta closed->done / reopened->todo. Tutto il resto lo decide il coordinatore.';
comment on column public.tasks.impact is
  'Usato solo per ordinare il livello 3 della priorità. La priorità vera è calcolata in v_priorities.';

create table public.people (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  role            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual'
);

create table public.project_people (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.people (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  role            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual',
  unique (person_id, project_id)
);

-- Un task che blocca un altro task oppure una persona (esattamente uno dei due).
create table public.blocks (
  id                uuid primary key default gen_random_uuid(),
  blocking_task_id  uuid not null references public.tasks (id) on delete cascade,
  blocked_task_id   uuid references public.tasks (id) on delete cascade,
  blocked_person_id uuid references public.people (id) on delete cascade,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_changed_by   text not null default 'manual',
  check (num_nonnulls(blocked_task_id, blocked_person_id) = 1),
  check (blocked_task_id is null or blocked_task_id <> blocking_task_id)
);
create unique index blocks_task_unique   on public.blocks (blocking_task_id, blocked_task_id)   where blocked_task_id is not null;
create unique index blocks_person_unique on public.blocks (blocking_task_id, blocked_person_id) where blocked_person_id is not null;

-- Attese: cosa aspetto da qualcuno per un task.
-- received_at vuoto = attesa aperta; asked_at vuoto = domanda ancora da fare.
create table public.waiting_items (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks (id) on delete cascade,
  person_id       uuid not null references public.people (id) on delete restrict,
  description     text not null,
  kind            text not null check (kind in ('question', 'material')),
  ask_by          date,
  asked_at        timestamptz,
  received_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual'
);

create table public.checkpoints (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete restrict,
  name            text not null,
  due_date        date not null,
  kind            text not null check (kind in ('delivery', 'milestone')),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual'
);

create table public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete restrict,
  task_id         uuid,
  entry_date      date not null,
  hours           numeric(5,2) not null check (hours > 0 and hours <= 24),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual',
  -- se c'è il task, deve essere dello stesso progetto
  foreign key (task_id, project_id) references public.tasks (id, project_id) on delete restrict
);

-- Inbox: si butta dentro al volo, si smista nella revisione settimanale.
create table public.inbox_items (
  id              uuid primary key default gen_random_uuid(),
  body            text not null,
  triaged_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual'
);

-- Registro: lo riempiono solo i trigger.
create table public.activity_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid not null,
  operation   text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_row     jsonb,
  new_row     jsonb,
  source      text not null,
  changed_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. Indici sulle chiavi esterne e sui filtri usati dalle viste
-- ---------------------------------------------------------------------

create index features_project_idx        on public.features (project_id);
create index tasks_project_idx           on public.tasks (project_id);
create index tasks_feature_idx           on public.tasks (feature_id);
create index tasks_open_idx              on public.tasks (status) where status in ('todo', 'in_progress');
create index project_people_project_idx  on public.project_people (project_id);
create index blocks_blocked_task_idx     on public.blocks (blocked_task_id);
create index blocks_blocked_person_idx   on public.blocks (blocked_person_id);
create index waiting_items_task_idx      on public.waiting_items (task_id);
create index waiting_items_person_idx    on public.waiting_items (person_id);
create index waiting_items_open_idx      on public.waiting_items (task_id) where received_at is null;
create index checkpoints_project_idx     on public.checkpoints (project_id, due_date);
create index time_entries_project_idx    on public.time_entries (project_id, entry_date);
create index time_entries_task_idx       on public.time_entries (task_id);
create index inbox_items_open_idx        on public.inbox_items (created_at) where triaged_at is null;
create index activity_log_record_idx     on public.activity_log (table_name, record_id, changed_at);


-- ---------------------------------------------------------------------
-- 4. Trigger
-- ---------------------------------------------------------------------

-- completed_at segue lo stato del task
create function public.tg_tasks_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.tg_tasks_completed_at();

-- closed_at segue lo stato del progetto
create function public.tg_projects_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'closed' then
    if tg_op = 'INSERT' or old.status <> 'closed' then
      new.closed_at := coalesce(new.closed_at, now());
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger projects_closed_at
  before insert or update of status on public.projects
  for each row execute function public.tg_projects_closed_at();

-- meta e registro su tutte le tabelle dati
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'features', 'tasks', 'people', 'project_people',
    'blocks', 'waiting_items', 'checkpoints', 'time_entries', 'inbox_items'
  ] loop
    execute format(
      'create trigger %1$s_set_meta before insert or update on public.%1$I
         for each row execute function public.tg_set_meta()', t);
    execute format(
      'create trigger %1$s_log after insert or update or delete on public.%1$I
         for each row execute function public.tg_log_activity()', t);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Viste calcolate (security_invoker: rispettano la RLS di chi le legge)
-- ---------------------------------------------------------------------

-- Ogni task con attese, blocchi e ultima attività calcolati.
create view public.v_tasks
with (security_invoker = true)
as
select
  t.*,
  p.name  as project_name,
  p.scope as project_scope,
  (select string_agg(distinct pe.name, ', ' order by pe.name)
     from public.waiting_items w
     join public.people pe on pe.id = w.person_id
    where w.task_id = t.id and w.received_at is null)            as waiting_on,
  exists (select 1 from public.waiting_items w
           where w.task_id = t.id and w.received_at is null)      as is_waiting,
  exists (select 1 from public.waiting_items w
           where w.task_id = t.id and w.received_at is null
             and w.asked_at is null)                              as has_question_to_ask,
  exists (select 1 from public.blocks b
            join public.tasks bt on bt.id = b.blocking_task_id
           where b.blocked_task_id = t.id
             and bt.status not in ('done', 'cancelled'))          as is_blocked,
  (t.status not in ('done', 'cancelled')
   and exists (select 1 from public.blocks b
                where b.blocking_task_id = t.id))                 as blocks_others,
  greatest(
    t.updated_at,
    (select max(w.updated_at)  from public.waiting_items w where w.task_id = t.id),
    (select max(te.created_at) from public.time_entries te where te.task_id = t.id)
  )                                                               as last_activity
from public.tasks t
join public.projects p on p.id = t.project_id;

-- Task aperti in ordine di priorità, con la regola del documento:
--   1. bloccano qualcuno o scadono entro 7 giorni
--   2. hanno una domanda ancora da fare
--   3. il resto, per impatto
create view public.v_priorities
with (security_invoker = true)
as
select
  vt.*,
  case
    when vt.blocks_others
      or (vt.due_date is not null and vt.due_date <= current_date + 7) then 1
    when vt.has_question_to_ask then 2
    else 3
  end as priority_level
from public.v_tasks vt
where vt.status in ('todo', 'in_progress')
order by
  priority_level,
  vt.is_blocked,                                   -- i bloccati in fondo al loro livello
  vt.due_date nulls last,
  case vt.impact when 'high' then 1 when 'medium' then 2 else 3 end,
  vt.last_activity;


-- ---------------------------------------------------------------------
-- 6. Sicurezza: RLS attiva ovunque, nessuna policy per ora
-- ---------------------------------------------------------------------

alter table public.projects       enable row level security;
alter table public.features       enable row level security;
alter table public.tasks          enable row level security;
alter table public.people         enable row level security;
alter table public.project_people enable row level security;
alter table public.blocks         enable row level security;
alter table public.waiting_items  enable row level security;
alter table public.checkpoints    enable row level security;
alter table public.time_entries   enable row level security;
alter table public.inbox_items    enable row level security;
alter table public.activity_log   enable row level security;

-- Le funzioni dei trigger non devono essere chiamabili dall'API.
-- app_source() resta eseguibile: la chiamano i trigger con i permessi di chi scrive.
revoke execute on function public.tg_set_meta()           from public, anon, authenticated;
revoke execute on function public.tg_log_activity()       from public, anon, authenticated;
revoke execute on function public.tg_tasks_completed_at() from public, anon, authenticated;
revoke execute on function public.tg_projects_closed_at() from public, anon, authenticated;
