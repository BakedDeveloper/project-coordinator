-- =====================================================================
-- Coordinator — collegamento task ↔ checkpoint e priorità solo per progetti attivi
--
-- 1. tasks.checkpoint_id: un task può servire a un checkpoint (consegna o milestone)
--    dello stesso progetto. La sua scadenza "effettiva" è la più vicina tra la sua
--    due_date e la data del checkpoint ancora aperto.
-- 2. v_priorities considera solo i task dei progetti con status = 'active':
--    un progetto in pausa o chiuso esce dalla classifica, ma i suoi dati restano.
-- =====================================================================

-- Serve alla FK composta: il checkpoint deve essere dello stesso progetto del task.
alter table public.checkpoints
  add constraint checkpoints_id_project_id_key unique (id, project_id);

alter table public.tasks
  add column checkpoint_id uuid;

-- Se il checkpoint viene cancellato si azzera solo checkpoint_id, non project_id.
alter table public.tasks
  add constraint tasks_checkpoint_id_project_id_fkey
  foreign key (checkpoint_id, project_id)
  references public.checkpoints (id, project_id)
  on delete set null (checkpoint_id);

create index tasks_checkpoint_idx on public.tasks (checkpoint_id);

comment on column public.tasks.checkpoint_id is
  'Checkpoint (consegna o milestone) dello stesso progetto a cui serve il task. Se il checkpoint è aperto, la sua data vale come scadenza del task in v_priorities.';

-- Le viste usano t.*: con una colonna nuova vanno ricreate.
drop view public.v_priorities;
drop view public.v_tasks;

create view public.v_tasks
with (security_invoker = true)
as
select
  t.*,
  p.name   as project_name,
  p.scope  as project_scope,
  p.status as project_status,
  c.name     as checkpoint_name,
  c.due_date as checkpoint_due_date,
  -- la scadenza più vicina tra quella del task e quella del checkpoint ancora aperto
  least(t.due_date, case when c.completed_at is null then c.due_date end) as effective_due_date,
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
join public.projects p on p.id = t.project_id
left join public.checkpoints c on c.id = t.checkpoint_id;

-- Task aperti dei progetti attivi, in ordine di priorità:
--   1. bloccano qualcuno o la scadenza effettiva è entro 7 giorni
--   2. hanno una domanda ancora da fare
--   3. il resto, per impatto
create view public.v_priorities
with (security_invoker = true)
as
select
  vt.*,
  case
    when vt.blocks_others
      or (vt.effective_due_date is not null and vt.effective_due_date <= current_date + 7) then 1
    when vt.has_question_to_ask then 2
    else 3
  end as priority_level
from public.v_tasks vt
where vt.status in ('todo', 'in_progress')
  and vt.project_status = 'active'
order by
  priority_level,
  vt.is_blocked,
  vt.effective_due_date nulls last,
  case vt.impact when 'high' then 1 when 'medium' then 2 else 3 end,
  vt.last_activity;
