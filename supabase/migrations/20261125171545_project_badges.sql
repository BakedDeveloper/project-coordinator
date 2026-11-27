-- =====================================================================
-- Coordinator — badge dei progetti: clienti con logo, nome breve, logo e
-- icona del progetto, bucket privato dei loghi (issue #28, epic #32)
--
-- Il badge mostra il logo del progetto (se c'è) o quello del suo cliente,
-- poi il nome breve nel colore del progetto con un'icona disegnata (Lucide).
--
-- projects.client resta testo libero, come lo scrive la skill: il cliente
-- si collega a clients per nome, senza vincolo. Un cliente nuovo funziona
-- subito, solo senza logo finché non si aggiunge in clients.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Clienti
-- ---------------------------------------------------------------------

create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  logo_path       text check (logo_path ~ '^[a-z0-9][a-z0-9/_.-]*$' and char_length(logo_path) <= 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_changed_by text not null default 'manual'
);

comment on table public.clients is
  'Clienti dei progetti di lavoro, con il logo. Si collegano a projects.client per nome.';
comment on column public.clients.logo_path is
  'Percorso del logo nel bucket privato logos (es. clients/enel.svg). Null: nessun logo.';

-- Come le altre tabelle: fonte della modifica, updated_at e activity_log dai trigger.
create trigger clients_set_meta before insert or update on public.clients
  for each row execute function public.tg_set_meta();
create trigger clients_log after insert or update or delete on public.clients
  for each row execute function public.tg_log_activity();

alter table public.clients enable row level security;

-- Solo Simone; nessuna cancellazione (come projects).
create policy owner_select on public.clients
  for select to authenticated using (public.is_coordinator_owner());
create policy owner_insert on public.clients
  for insert to authenticated with check (public.is_coordinator_owner());
create policy owner_update on public.clients
  for update to authenticated
  using (public.is_coordinator_owner()) with check (public.is_coordinator_owner());

-- I clienti già scritti nei progetti (oggi Enel, Leonardo, CBI), ancora senza logo.
insert into public.clients (name)
select distinct client from public.projects where client is not null;


-- ---------------------------------------------------------------------
-- 2. Progetti: nome breve, logo e icona
-- ---------------------------------------------------------------------

alter table public.projects
  add column short_name text check (char_length(short_name) between 1 and 40),
  add column logo_path  text check (logo_path ~ '^[a-z0-9][a-z0-9/_.-]*$' and char_length(logo_path) <= 200),
  add column icon       text check (icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(icon) <= 64);

comment on column public.projects.short_name is
  'Nome breve per il badge (es. Fleet per Reply - Fleet). Null: si usa name.';
comment on column public.projects.logo_path is
  'Logo proprio del progetto nel bucket logos (es. projects/nutrirea.svg). Ha la precedenza sul logo del cliente.';
comment on column public.projects.icon is
  'Nome di un''icona Lucide in kebab-case (es. truck). L''app mostra solo le icone che conosce; altrimenti le iniziali.';


-- ---------------------------------------------------------------------
-- 3. Bucket privato dei loghi
-- ---------------------------------------------------------------------

-- Privato: i loghi dei clienti di lavoro non sono pubblici. Solo immagini, al massimo 512 KB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos', 'logos', false, 524288,
  array['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg']
);

-- Solo Simone legge e scrive; si può cancellare un logo per sostituirlo.
create policy logos_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'logos' and public.is_coordinator_owner());
create policy logos_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and public.is_coordinator_owner());
create policy logos_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and public.is_coordinator_owner())
  with check (bucket_id = 'logos' and public.is_coordinator_owner());
create policy logos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and public.is_coordinator_owner());
