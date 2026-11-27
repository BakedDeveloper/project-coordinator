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
- **Istruzioni per gli account dei progetti** (`agent_instructions`, migrazione `20261127142408_agent_instructions.sql`, issue #41): una riga per argomento, in Markdown. La skill le legge all'inizio di ogni aggiornamento (`select key, title, body from public.agent_instructions where active order by position`) e valgono più del suo testo. Quando una regola cambia si aggiorna la riga, dopo l'ok di Simone sul testo: niente più copia e incolla nella skill. Le righe non si cancellano (`active = false`). Il connettore Supabase lavora come `postgres` e non passa dalle policy; le policy valgono per l'app e chiudono fuori chiunque altro.

## Lo schema (migrazioni in `supabase/migrations/`)

Tabelle: `projects`, `clients`, `agent_instructions`, `features`, `tasks`, `blocks`, `waiting_items` (attese), `checkpoints`, `people`, `project_people`, `time_entries`, `inbox_items`, `activity_log`.

Preferenze dell'app: `user_preferences`, una riga per utente, una colonna per preferenza con il suo controllo (oggi `theme`: `system`, `light`, `dark`). `updated_at` lo aggiorna un trigger; niente `activity_log`; nessuna cancellazione. Ogni nuova preferenza si aggiunge come colonna, con una migrazione per issue (epic #13).

Punti da sapere per l'app:
- `tasks.status`: `todo`, `in_progress`, `done`, `cancelled`. "In attesa" e "bloccato" **non** sono stati: si ricavano da `waiting_items` e `blocks`.
- `tasks.impact`: `high`, `medium`, `low`; serve solo a ordinare il livello 3.
- `tasks.checkpoint_id`: il checkpoint dello stesso progetto a cui serve il task; se il checkpoint è aperto, la sua data vale come scadenza del task.
- `tasks.position` e `tasks.estimated_hours`: ordine e stima nel piano. Oggi li ha solo Nutrirea (50 task, 275 ore, 10 ore a settimana).
- `tasks.description`: dettagli anche tecnici, mai dati sensibili.
- `projects.status`: `active`, `paused`, `closed`; i progetti chiusi restano visibili (`closed_at`).
- `projects.color` e `features.color`: colori `#rrggbb` (progetto scuro con testo bianco, feature chiara con testo scuro), impostati dalla migrazione `20261124104220_colors_and_priority_rank.sql`.
- Badge dei progetti (migrazioni `20261125171545_project_badges.sql` e `20261126183310_logos_in_database.sql`): `projects.short_name` (nome breve, es. Fleet), `projects.logo` (logo vero del progetto), `projects.icon` (nome di un'icona Lucide, ripiego quando il logo manca; l'app mostra solo le icone del suo catalogo, `src/app/shared/project-icons.ts`). `clients` ha nome e `logo`; si collega a `projects.client` **per nome**, senza vincolo, così la skill può scrivere clienti nuovi. Il badge mostra il logo del cliente e quello del progetto, tutti e due.
- I loghi sono **data URL nel database** (`data:image/svg+xml;base64,...`, anche PNG o WebP, al massimo circa 100 KB): li mandano i progetti con gli aggiornamenti, perché il connettore Supabase scrive solo nel database e non carica file. Il bucket `logos` e le colonne `logo_path` della prima migrazione non servono più: sono vuoti e restano finché non si fa pulizia, con una migrazione nuova e la cancellazione del bucket dal pannello.

Viste (con `security_invoker`, rispettano la RLS di chi legge):
- `v_tasks`: ogni task con `project_name`, `project_scope`, `project_status`, `checkpoint_name`, `checkpoint_due_date`, `effective_due_date`, `waiting_on`, `is_waiting`, `has_question_to_ask`, `is_blocked`, `blocks_others`, `last_activity`.
- `v_priorities`: i task aperti dei progetti attivi con `priority_level` e `priority_rank` (1, 2, 3… con la stessa regola; a pari merito vale l'ordine nel piano, poi l'id). L'app ordina per `priority_rank`. Livelli:
  1. bloccano qualcuno o la scadenza effettiva è entro 7 giorni;
  2. hanno una domanda ancora da fare;
  3. il resto, per impatto.

## Limiti da ricordare

- Piano Free di Supabase: un progetto con poca attività per 7 giorni va in pausa. Prima delle funzioni notturne si decide tra un ping pianificato e il piano Pro.
- Piano Free di Netlify: 300 crediti al mese, 15 per ogni pubblicazione in produzione.
- Accesso dall'app: solo l'utente Supabase Auth di Simone, con le policy della migrazione `20261123132056_owner_policies.sql`. Il connettore Claude usa il ruolo `postgres` e non passa dalle policy.
- La protezione dalle password compromesse di Supabase richiede il piano Pro: sul Free resta spenta.
