# Project Coordinator — istruzioni per l'agente di coding

Leggi questo file all'inizio di ogni sessione. Se una richiesta va contro una regola qui sotto, fermati e chiedi prima di procedere.

## Cos'è il progetto

Il frontend del **coordinatore dei progetti di Simone**: un solo posto dove vedere i task di tutti i progetti, di lavoro e personali, capire a cosa dare priorità e seguire l'avanzamento.

- I dati stanno in **Supabase**, progetto `coordinator` (ref `cmyocabucpfzsvqyvspc`, organizzazione `project-coordinator`, regione Francoforte, Postgres 17).
- I dati li scrivono soprattutto due account Claude (lavoro e personale) con il connettore Supabase e la skill "aggiorna il coordinatore". Questa app serve a **leggerli bene** e a modificarli a mano.
- L'unico utente dell'app è Simone.

Decisioni e motivazioni: `docs/architettura.md`. Viste da costruire: `docs/viste.md`.

## Stack e versioni (fissate a novembre 2026, le stesse di Nutrirea)

| Parte | Tecnologia | Versione |
|---|---|---|
| Runtime | Node.js LTS | 24.15+ della serie 24 |
| Package manager | pnpm | 12.16.1, fissata in `package.json` |
| App | Angular | 22.2.x, con TypeScript 6.0.x (Angular 22 non supporta TypeScript 7) |
| Client dati | `@supabase/supabase-js` | 2.x (la 3 è ancora in anteprima) |
| CLI database | Supabase CLI | 3.0.0, come dipendenza di sviluppo |
| Hosting | Netlify, piano Free | sito statico (SPA) |

Non aggiornare una versione maggiore senza chiedere.

## Struttura del repository

```
src/                 app Angular (da creare)
supabase/migrations/ lo schema del database, una migrazione per modifica
docs/                architettura e specifica delle viste
```

## Regole sui dati

1. **Lo schema esiste solo come migrazioni SQL** in `supabase/migrations/`. Mai modifiche a mano dal pannello di Supabase. Le tre migrazioni presenti sono già applicate al progetto `coordinator`: i nomi dei file hanno la stessa versione registrata in Supabase.
2. **Una migrazione già applicata non si modifica**: se serve un cambio, se ne crea una nuova (`supabase migration new <nome>`).
3. **Prima di applicare una migrazione mostra cosa farà e aspetta la conferma di Simone.** Usa prima `--dry-run`. Mai `--yes`, mai `db reset --remote`.
4. Questo repository si collega (`supabase link`) **solo** al progetto `coordinator`. Mai al progetto di Nutrirea.
5. **Le priorità le calcola il database** (vista `v_priorities`). L'app le legge e non le ricalcola: se la regola cambia, cambia in una migrazione.
6. **Le scritture dall'app risultano fatte "a mano"**: il trigger mette `last_changed_by = 'manual'` da solo. L'app non imposta mai `app.source`, `last_changed_by`, `created_at`, `updated_at`, `completed_at`, `closed_at` e non scrive in `activity_log`.
7. Progetti, task e persone **non si cancellano**: un progetto finito va a `closed`, un task che non si fa più va a `cancelled`.
8. **Task di origine GitHub** (`tasks.origin = 'github'`, oggi Nutrirea): titolo e aperto/chiuso li decide GitHub. L'app non li modifica e lo dice all'utente.

## Sicurezza

- L'app usa solo la chiave **publishable** di Supabase. La chiave **secret** non va mai nell'app né nel repository.
- Nessun segreto nei file versionati. `.env` è ignorato da Git; quando aggiungi una variabile, aggiorna `.env.example` con un valore finto.
- Registrazione pubblica disattivata: c'è un solo utente, Simone. L'accesso è regolato dalle policy RLS del database, non dal codice dell'app.
- Tutte le pagine tranne il login richiedono una sessione valida.
- Nel coordinatore ci sono dettagli tecnici di progetti di lavoro: niente dati del database nei log, né nella console del browser.

## Convenzioni

- Codice, database e messaggi di commit in inglese; testi dell'interfaccia in italiano.
- TypeScript in modalità `strict`. I tipi del database si generano (`supabase gen types typescript --project-id cmyocabucpfzsvqyvspc`), mai scritti a mano.
- **Accesso ai dati solo da servizi in `src/app/data/`**: i componenti non importano `@supabase/supabase-js`. Così un giorno si può cambiare backend riscrivendo un solo strato.
- Componenti standalone e signal; niente librerie di componenti pesanti senza chiedere. Grafica custom, come da `docs/viste.md`.
- Accessibilità: bottoni veri (`<button>`), etichette sui campi, contrasto almeno 4.5:1, la vista funziona anche alla larghezza di un telefono.
- Prima di aggiungere una dipendenza spiega perché serve; preferisci quelle ufficiali di Angular e Supabase.
- Lavora a piccoli passi: ogni passo deve compilare e passare i test prima del successivo. Commit piccoli e descrittivi.

## Organizzazione del lavoro

- Ogni lavoro parte da una issue di `BakedDeveloper/project-coordinator`. Se la issue non esiste, proponila e creala solo dopo l'ok di Simone.
- Issue, branch, messaggi di commit e pull request in inglese.
- Branch dalla issue: `feat/<numero>-<breve>`, `fix/<numero>-<breve>` o `chore/<numero>-<breve>`.
- Ogni pull request contiene `Closes #<numero>`.
- I criteri di accettazione si scrivono come caselle (`- [ ]`) e si spuntano solo con una prova (un test o una verifica descritta nella PR).

## Pubblicazione

- Netlify, piano Free, collegato al repository. Il piano ha un budget di 300 crediti al mese: ogni pubblicazione in produzione costa 15 crediti, le anteprime dei branch sono gratuite. Quindi si pubblica in produzione solo da `main`, non a ogni commit.
- Serve la regola di reindirizzamento delle SPA (`/* /index.html 200`), altrimenti ricaricando una pagina interna si ottiene un 404.
- Le variabili `SUPABASE_URL` e la chiave publishable si impostano nelle variabili d'ambiente di Netlify, non nel codice.

## Da fare prima della prima vista (non ancora fatto)

- In Supabase: registrazione pubblica disattivata e utente di Simone creato.
- Migrazione 04: policy RLS per l'utente di Simone (oggi la RLS blocca tutti tranne il connettore). La prepara la chat del coordinatore e la applica dopo l'ok di Simone.
