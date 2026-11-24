-- =====================================================================
-- Coordinator — colori di progetti e feature, ordine esplicito delle priorità
--
-- 1. projects.color: colore del progetto (etichette, testo bianco sopra).
--    features.color: colore della feature (bande e schede, testo scuro sopra).
--    Formato #rrggbb. Se manca, l'app usa una tavolozza fissa di ripiego.
-- 2. v_priorities.priority_rank: posizione 1, 2, 3… con la stessa regola dell'ordine
--    della vista. L'ordine scritto in una vista non è garantito quando la si legge
--    dall'API: l'app ordina per priority_rank e non ricalcola niente.
--    A pari merito su tutti i criteri vale l'ordine nel piano (position), poi l'id.
-- =====================================================================

alter table public.projects
  add column color text check (color ~ '^#[0-9a-fA-F]{6}$');
alter table public.features
  add column color text check (color ~ '^#[0-9a-fA-F]{6}$');

comment on column public.projects.color is 'Colore del progetto, #rrggbb, scuro: ci va sopra testo bianco (contrasto almeno 4.5:1).';
comment on column public.features.color is 'Colore della feature, #rrggbb, chiaro: ci va sopra il testo scuro #3a1f45 (contrasto almeno 4.5:1).';

-- Colori iniziali. La fonte resta quella dell'account personale, che li ha scelti.
select set_config('app.source', 'personal', true);

update public.projects p set color = v.color
from (values
  ('Nutrirea', '#a8336a'),
  ('Certificazione GAIL', '#2e6b33'),
  ('Competenze IA', '#8a4b00'),
  ('Reply - Fleet', '#2f5f93'),
  ('Reply - Leonardo', '#4a5a99'),
  ('Reply - Tool AI Bandi Gara', '#6b45a3'),
  ('Acquisto notebook', '#5b6470')
) as v(name, color)
where p.name = v.name;

-- Feature di Nutrirea: le prime tre sono i colori del pavimento della v2.
update public.features f set color = v.color
from public.projects p,
(values
  ('Fondamenta', '#c6abe3'),
  ('Pazienti', '#f4bdd1'),
  ('Accesso e sicurezza', '#a5c9ed'),
  ('Piano in PDF', '#f6cfa8'),
  ('App pazienti', '#b5e0c8'),
  ('Rilascio', '#f3e19c'),
  ('Prima visita', '#f7c4b3'),
  ('Visite di controllo', '#c9d6a3'),
  ('Privacy', '#b8d8de'),
  ('Libreria delle sezioni', '#e3c9a8'),
  ('Editor del piano', '#d4c4ee'),
  ('PDF e invio', '#f2b8c6')
) as v(name, color)
where f.project_id = p.id and p.name = 'Nutrirea' and f.name = v.name;

-- v_priorities con priority_rank in fondo (create or replace: le colonne esistenti restano uguali).
create or replace view public.v_priorities
with (security_invoker = true)
as
select
  x.*,
  row_number() over (
    order by
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
