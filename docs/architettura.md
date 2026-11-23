# Architettura del coordinatore

Le decisioni prese e il loro perché. Il documento completo del progetto è "Passaggio coordinatore progetti" nel progetto claude.ai "Project Coordinator"; qui c'è quello che serve per costruire l'app.

## Il quadro

| Livello | Scelta | Perché |
|---|---|---|
| Dati | Supabase, progetto `coordinator` (ref `cmyocabucpfzsvqyvspc`), organizzazione dedicata `project-coordinator`, Francoforte, Postgres 17, piano Free | I due account Claude ci scrivono con il connettore Supabase. L'organizzazione è separata da quella di Nutrirea, così il connettore vede solo questo progetto. |
| Frontend | App Angular 22 in questo repository | Grafica completamente libera; Angular è lo stesso di Nutrirea. |
| Accesso | Supabase Auth, un solo utente (Simone), registrazione pubblica disattivata | L'app è raggiungibile da internet. |
| Hosting | Netlify, piano Free | Il piano Free ammette anche progetti commerciali: il coordinatore contiene progetti di lavoro. Vercel è stato scartato perché il suo piano gratuito è solo per uso personale non commerciale. |

URL dell'API: `https://cmyocabucpfzsvqyvspc.supabase.co` (non è un segreto).

## Chi scrive cosa

- **Account Claude personale e di lavoro**: con il connettore e la skill "aggiorna il coordinatore". Ogni scrittura dichiara la fonte (`personal` o `work`) dentro una transazione; un trigger la registra.
- **Questa app**: le scritture risultano `manual`, senza fare niente di speciale.
- **Sincronizzazione GitHub** (da costruire): fonte `github`. Per Nutrirea GitHub decide titolo e aperto/chiuso; il coordinatore decide impatto, scadenze, prossima azione, attese, blocchi e ore.
- Ogni modifica finisce in `activity_log` (lo riempiono solo i trigger).

## Lo schema (migrazioni in `supabase/migrations/`)

Tabelle: `projects`, `features`, `tasks`, `blocks`, `waiting_items` (attese), `checkpoints`, `people`, `project_people`, `time_entries`, `inbox_items`, `activity_log`.

Punti da sapere per l'app:
- `tasks.status`: `todo`, `in_progress`, `done`, `cancelled`. "In attesa" e "bloccato" **non** sono stati: si ricavano da `waiting_items` e `blocks`.
- `tasks.impact`: `high`, `medium`, `low`; serve solo a ordinare il livello 3.
- `tasks.checkpoint_id`: il checkpoint dello stesso progetto a cui serve il task; se il checkpoint è aperto, la sua data vale come scadenza del task.
- `tasks.position` e `tasks.estimated_hours`: ordine e stima nel piano. Oggi li ha solo Nutrirea (50 task, 275 ore, 10 ore a settimana).
- `tasks.description`: dettagli anche tecnici, mai dati sensibili.
- `projects.status`: `active`, `paused`, `closed`; i progetti chiusi restano visibili (`closed_at`).

Viste (con `security_invoker`, rispettano la RLS di chi legge):
- `v_tasks`: ogni task con `project_name`, `project_scope`, `project_status`, `checkpoint_name`, `checkpoint_due_date`, `effective_due_date`, `waiting_on`, `is_waiting`, `has_question_to_ask`, `is_blocked`, `blocks_others`, `last_activity`.
- `v_priorities`: i task aperti dei progetti attivi con `priority_level`:
  1. bloccano qualcuno o la scadenza effettiva è entro 7 giorni;
  2. hanno una domanda ancora da fare;
  3. il resto, per impatto.

## Limiti da ricordare

- Piano Free di Supabase: un progetto con poca attività per 7 giorni va in pausa. Prima delle funzioni notturne si decide tra un ping pianificato e il piano Pro.
- Piano Free di Netlify: 300 crediti al mese, 15 per ogni pubblicazione in produzione.
- La RLS oggi blocca tutti tranne il connettore: l'app vedrà dati solo dopo la migrazione 04 con le policy per l'utente di Simone.
