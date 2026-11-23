-- =====================================================================
-- Coordinator — descrizione dei task
--
-- tasks.description: dettagli del task, anche tecnici, per tutti i progetti
-- (lavoro compresi). Mai dati sensibili: credenziali e segreti, dati personali
-- di persone reali, dati reali estratti dai sistemi dei clienti.
--
-- Le viste usano t.*: per mostrare la colonna nuova vanno ricreate.
-- =====================================================================

alter table public.tasks
  add column description text;

comment on column public.tasks.description is
  'Dettagli del task, anche tecnici. Mai dati sensibili: credenziali, chiavi, token, password; dati personali di persone reali; dati reali estratti dai sistemi dei clienti.';

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
