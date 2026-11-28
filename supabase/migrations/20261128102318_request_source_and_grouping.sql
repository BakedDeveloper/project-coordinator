-- =====================================================================
-- Coordinator — fonte della richiesta e raggruppamenti sommabili (issue #67)
--
-- 1. tasks: da dove arriva la richiesta. Canale (email, teams, call,
--    meeting, in_person, other), chi l'ha chiesta (testo libero, anche
--    "Cliente Reply"), quando, e una nota ("nella call del 12…"). Tutto
--    facoltativo: i task di oggi restano senza fonte.
--
-- 2. user_preferences.column_grouping: per ogni colonna delle board, i
--    livelli di raggruppamento nell'ordine scelto da Simone, tra project,
--    channel e source (la fonte specifica: canale + data + persona). Es.
--    {"todo": ["project", "channel"], "done": ["project"]}. Una colonna
--    senza chiave, o con [], è un elenco semplice. Null: la scelta di
--    base (solo Fatto per progetto), come grouped_columns.
--    Si riempie da grouped_columns: una colonna raggruppata oggi parte
--    con il livello project. grouped_columns resta finché l'app non usa
--    la colonna nuova; la toglie una migrazione successiva.
--
-- v_tasks espone t.*: per mostrare le colonne nuove va ricreata, e con
-- lei v_priorities che ne dipende. Le definizioni restano quelle di
-- 20261127164807_manual_rank.sql, senza altre modifiche.
-- =====================================================================

-- 1. Fonte della richiesta -------------------------------------------

alter table public.tasks
  add column source_channel text
    check (source_channel in ('email', 'teams', 'call', 'meeting', 'in_person', 'other')),
  add column source_person text
    check (source_person is null or char_length(btrim(source_person)) between 1 and 120),
  add column source_date date,
  add column source_note text
    check (source_note is null or char_length(btrim(source_note)) between 1 and 500);

comment on column public.tasks.source_channel is
  'Da dove è arrivata la richiesta: email, teams, call (chiamata), meeting (riunione), in_person (di persona), other. Null: non indicato.';
comment on column public.tasks.source_person is
  'Chi ha fatto la richiesta, testo libero (es. "Alfredo", "Cliente Reply"). Null: non indicato.';
comment on column public.tasks.source_date is
  'Quando è arrivata la richiesta (la data della mail, della call…). Null: non indicata.';
comment on column public.tasks.source_note is
  'Nota sulla fonte, es. "nella call del 12, insieme al report". Null: nessuna.';

-- 2. Raggruppamenti sommabili ----------------------------------------

create function public.is_valid_column_grouping(levels_by_column jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- The case expressions keep jsonb_each and jsonb_array_elements away from
  -- values of the wrong type: "or" does not promise to stop at the first true.
  select case
    when jsonb_typeof(levels_by_column) <> 'object' then false
    else not exists (
      select 1
        from jsonb_each(levels_by_column) as e(column_key, levels)
       where e.column_key not in ('todo', 'in_progress', 'blocked', 'on_hold', 'done', 'cancelled')
          or case
               when jsonb_typeof(e.levels) <> 'array' then true
               else exists (
                      select 1
                        from jsonb_array_elements(e.levels) as l(level)
                       where jsonb_typeof(l.level) <> 'string'
                          or l.level #>> '{}' not in ('project', 'channel', 'source'))
                 or jsonb_array_length(e.levels) <> (
                      select count(distinct l.level) from jsonb_array_elements(e.levels) as l(level))
             end)
  end;
$$;

comment on function public.is_valid_column_grouping(jsonb) is
  'Controllo di user_preferences.column_grouping: un oggetto colonna -> elenco di livelli distinti tra project, channel e source.';

alter table public.user_preferences
  add column column_grouping jsonb
    check (column_grouping is null or public.is_valid_column_grouping(column_grouping));

comment on column public.user_preferences.column_grouping is
  'Raggruppamento di ogni colonna delle board: {"todo": ["project", "channel"], …}, livelli in ordine tra project, channel e source (canale + data + persona). Colonna assente o []: elenco semplice. Null: la scelta di base (solo done per progetto).';

update public.user_preferences
   set column_grouping = (
         select coalesce(jsonb_object_agg(g.column_key, jsonb_build_array('project')), '{}'::jsonb)
           from unnest(grouped_columns) as g(column_key))
 where grouped_columns is not null;

-- 3. Viste ricreate con le colonne nuove -----------------------------

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
