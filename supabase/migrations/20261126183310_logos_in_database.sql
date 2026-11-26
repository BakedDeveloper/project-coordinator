-- =====================================================================
-- Coordinator — loghi nel database invece che nello Storage (issue #28)
--
-- Il badge mostra il logo del cliente (progetti di lavoro) e il logo vero
-- del progetto, tutti e due. I loghi li mandano i progetti stessi con gli
-- aggiornamenti: il connettore Supabase scrive solo nel database e non
-- carica file, quindi un logo è un data URL in una colonna di testo.
--
-- Solo aggiunte. logo_path e il bucket logos della migrazione
-- project_badges (vuoti) li toglie la migrazione drop_logo_storage.
-- =====================================================================

-- Il logo come data URL: solo immagini SVG, PNG o WebP in base64,
-- al massimo 140 000 caratteri (circa 100 KB di immagine).
alter table public.clients
  add column logo text
    check (logo ~ '^data:image/(svg\+xml|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
           and char_length(logo) <= 140000);

alter table public.projects
  add column logo text
    check (logo ~ '^data:image/(svg\+xml|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
           and char_length(logo) <= 140000);

comment on column public.clients.logo is
  'Logo del cliente come data URL (data:image/svg+xml;base64,...), al massimo circa 100 KB. Null: nessun logo.';
comment on column public.projects.logo is
  'Logo vero del progetto come data URL (data:image/svg+xml;base64,...), al massimo circa 100 KB. Lo manda il progetto con gli aggiornamenti. Null: il badge usa l''icona o le iniziali.';
