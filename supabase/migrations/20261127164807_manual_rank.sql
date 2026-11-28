-- =====================================================================
-- Coordinator — ordine a mano dei task (issue #55)
--
-- Simone può trascinare un task in alto o in basso nella sua colonna per
-- cambiarne la priorità. La posizione scelta si salva in
-- tasks.manual_rank e vince sulla regola automatica: in v_priorities
-- vengono prima i task con un ordine a mano, in quell'ordine, poi gli
-- altri con la regola di sempre (livello, blocco, scadenza, impatto,
-- attività, piano, id). Null: ordine automatico.
--
-- L'app continua a leggere solo priority_rank (CLAUDE.md, regola 5): la
-- regola cambia qui. Gli account dei progetti non scrivono manual_rank.
--
-- v_tasks espone t.*: per mostrare la colonna nuova va ricreata, e con
-- lei v_priorities che ne dipende. Le definizioni restano quelle di
-- 20261120150930_add_task_description.sql e
-- 20261124104220_colors_and_priority_rank.sql, a parte manual_rank.
-- =====================================================================

alter table public.tasks
  add column manual_rank integer check (manual_rank > 0);

comment on column public.tasks.manual_rank is
  'Posizione data a mano da Simone trascinando il task (1 = in alto). Vince sulla regola automatica di v_priorities. Null: ordine automatico. La scrive solo l''app.';

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
  x.*,
  row_number() over (
    order by
      x.manual_rank nulls last,
      x.priority_level,
      x.is_blocked,
      x.effective_due_date nulls last,
      case x.impact when 'high' then 1 when 'medium' then 2 else 3 end,
      x.last_activity,
      x.position nulls last,
      x.id
  ) as priority_rank
from (
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
) x
order by priority_rank;
