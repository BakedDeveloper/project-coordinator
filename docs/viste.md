# Le viste da costruire

Il 25/11/2026 l'app passa dagli elenchi per priorità alle **board con colonne**, come i software di gestione task (Azure DevOps, Trello, Zistemo). Ci sono tre viste:

- **Board condivisa**: tutti i progetti, è la pagina iniziale dopo il login.
- **Board del progetto**: una per progetto, con la scheda **Cronologia** accanto.
- **Oggi**: per decidere e mettere in ordine il lavoro della giornata.

Il disegno di riferimento della prima versione, a elenchi verticali, è il canvas **"Mappa del fico — idee per la parte centrale"**: https://claude.ai/artifact/JUwj91JExMRw9gR6ex2LTP. Vale ancora per la Cronologia e per la mappa di un progetto con piano (E).

## Regole comuni

### Colonne

Le board hanno sei colonne, sempre in quest'ordine (issue #39):

| Colonna | Quali task |
|---|---|
| **Da fare** | `status = 'todo'` e non bloccati |
| **In corso** | `status = 'in_progress'` e non bloccati. Se è vuota, la colonna lo dice e indica il prossimo task da iniziare |
| **Bloccato** | `is_blocked` vero, **qualunque sia lo stato aperto** (anche `on_hold`): un blocco è la prima cosa da vedere |
| **Sospeso** | `status = 'on_hold'` e non bloccati: una modifica messa da parte. La mettono Simone o i progetti; esce dalle priorità. I task che aspettano qualcuno **non** vanno qui: restano nella loro colonna con l'etichetta "aspetta …" |
| **Fatto** | `status = 'done'` con `completed_at` negli ultimi 14 giorni, i più recenti in alto |
| **Annullato** | `status = 'cancelled'`, tutti, l'ultimo modificato in alto. Non si fa più ma resta registrato |

- Sospeso e Annullato mostrano l'ultimo task modificato in alto (`updated_at`), dei progetti attivi.
- Il menu **"Colonne"** sopra la board sceglie quali colonne vedere, con una casella per colonna; almeno una resta visibile. La scelta si salva in `user_preferences.board_columns` e vale su ogni dispositivo. Di base si vedono tutte tranne Annullato.
- Dentro Da fare, In corso e Bloccato l'ordine è **`priority_rank`**, calcolato dal database (`v_priorities`). L'app ordina esplicitamente per quella colonna, perché l'ordine scritto in una vista non è garantito quando la si legge dall'API, e non ricalcola niente.
- `v_priorities` contiene solo i task aperti dei progetti attivi: i task fatti si leggono da `v_tasks`.
- Ogni colonna mostra nell'intestazione quanti task contiene; se è vuota lo dice.

### Raggruppare per progetto

- Ogni colonna della board condivisa ha il bottone **"Raggruppa per progetto"** (`aria-pressed`, issue #52). Raggruppata, la colonna mostra **una scheda per progetto** (badge e numero di task), chiusa: si apre con un clic o da tastiera e mostra i task di quel progetto.
- Le schede seguono l'ordine della colonna: in Fatto prima il progetto con il task finito più di recente, nelle colonne aperte prima quello con la priorità più alta.
- Di base è raggruppata solo **Fatto**; le altre colonne partono con le card una per una. La scelta si salva in `user_preferences.grouped_columns` e vale su ogni dispositivo; le schede aperte no.
- Sulla board di un progetto non c'è niente da raggruppare: il bottone non compare.

### Spostare i task

- Si cambia stato trascinando una card fra Da fare, In corso, Sospeso, Fatto e Annullato (`@angular/cdk`), oppure con il bottone **"Sposta in…"** della card, che funziona da tastiera e su telefono. Il menu offre anche le colonne nascoste.
- **Bloccato non si raggiunge trascinando**: un blocco ha bisogno di sapere da cosa dipende (`blocks`). Si blocca e si sblocca dal pannello di dettaglio.
- Un task bloccato si sposta solo in Fatto o in Annullato: altrove resterebbe comunque in Bloccato.
- Se il salvataggio non riesce, la card torna al suo posto e un messaggio lo dice.
- I task **di origine GitHub** (`origin = 'github'`, oggi Nutrirea) non si spostano: stato e titolo li decide GitHub. La card mostra un lucchetto e lo spiega.
- Dopo uno spostamento l'ordine torna a essere quello di `priority_rank`, riletto dal database.

### Sospendere un progetto

- Il bottone **"Sospendi progetto"** nella pagina del progetto mette `projects.status = 'paused'` (issue #46); **"Riprendi progetto"** lo rimette `active`. Gli stati dei task non cambiano: alla ripresa ogni task torna dov'era.
- I task di un progetto sospeso escono da tutte le colonne della board condivisa e dalle priorità (le letture prendono solo i progetti attivi).
- In cima alla colonna **Sospeso** c'è una voce per ogni progetto sospeso: badge con il link al progetto, numero di task aperti, bottone **"Riprendi"**. Segue i filtri di ambito e progetto.
- Nella pagina di un progetto sospeso un avviso lo dice; i task restano visibili sulla sua board, in ordine di creazione. Un progetto chiuso non si sospende né si riprende.

### Creare un task

- Il bottone **"Nuovo task"** sopra la board apre un modulo (issue #42): progetto (solo sulla board condivisa, fra i progetti attivi), titolo, colonna di partenza (Da fare, In corso, Sospeso), importanza (di base Media), scadenza e prossima azione facoltative. Ogni campo ha la sua etichetta; Esc chiude il modulo.
- L'app scrive solo questi campi: `origin = 'coordinator'`, le date e `last_changed_by = 'manual'` li mette il database. Dopo il salvataggio la board si rilegge.
- Se il salvataggio non riesce, il modulo resta compilato e un messaggio lo dice.
- I progetti lavorano questi task come gli altri (istruzione `manual_tasks` in `agent_instructions`).

### Eliminare un task

- Il bottone **"Elimina"** della card apre una conferma (`<dialog>` modale) che nomina il task e ricorda che non si torna indietro; di base il focus è su Annulla, Esc chiude (issue #43).
- Il task sparisce per sempre con i suoi blocchi e le sue attese; la cancellazione resta in `activity_log`.
- **Un task con ore registrate non si elimina**: il database lo rifiuta (`time_entries`), la conferma lo dice e offre "Sposta in Annullato".
- I task di origine GitHub non hanno il bottone, e la policy del database li esclude comunque.

### Scheda di un task

- Sulla board la scheda è **compatta** e tutte hanno la stessa altezza (issue #57): badge del progetto (solo sulla board condivisa), titolo su due righe al massimo, data ("scade 24 nov", in rosso "scaduto il 24 nov"; in Fatto "fatto il 24 nov") e piccole icone per "sblocca altri", "aspetta qualcuno", "domanda da fare" e "bloccato", con il testo per i lettori di schermo.
- La scheda ha una striscia del colore del progetto a sinistra e una sua tinta chiara (al massimo 10%, issue #54). I task bloccati hanno il bordo tratteggiato.
- Tutta la scheda è un bottone: apre il **popup di dettaglio**. Il trascinamento resta sulla scheda.
- L'elenco per priorità e la Cronologia usano ancora la card estesa, con prossima azione e checkpoint.

### Popup di dettaglio

- Una finestra `<dialog>` modale al centro, a tutto schermo sul telefono; Chiudi o Esc la chiudono e il focus torna alla scheda.
- Mostra stato, checkpoint, attese aperte, blocchi (cosa aspetta e cosa blocca) e ore registrate.
- **Si modificano** titolo, prossima azione, descrizione, scadenza e importanza, con "Salva": l'app scrive solo questi campi. Il titolo di un task GitHub non si cambia, e il popup dice perché.
- In fondo "Sposta in" (le colonne permesse) ed "Elimina", con le stesse regole di prima.

### Icona del progetto

- Ogni progetto ha un'**icona disegnata** presa da una libreria (proposta: Lucide, da confermare nella sua issue). Nel database se ne salva il nome (`projects.icon`).
- Se l'icona manca o il nome è sconosciuto, al suo posto c'è un'**icona generica** (una cartella): mai le iniziali (issue #50).
- L'icona è decorativa: il testo per i lettori di schermo resta il nome del progetto.

### Sfondo

- Dietro le board si può scegliere uno **sfondo**: prima una serie di sfondi predefiniti, poi anche un'immagine propria (serve Supabase Storage).
- La scelta sta in `user_preferences`: uno sfondo generale, eventualmente uno per progetto.
- Le colonne restano su un fondo pieno, così il testo mantiene il contrasto di almeno 4.5:1 con qualsiasi sfondo, in entrambi i temi.

### Telefono

- Le board non scorrono di lato: su un telefono si vede **una colonna alla volta**, con le schede delle colonne in alto (con il numero di task di ognuna).
- Le altre viste restano verticali: il tempo scorre dall'alto in basso, si scorre con la rotella o il dito, mai di lato.

### Colori e testi

- **Colori dal database**: `projects.color` (scuro, testo bianco sopra) e `features.color` (chiaro, testo `#3a1f45` sopra). Le feature di Nutrirea ce l'hanno già; le prime tre sono quelle del pavimento della v2: Pazienti `#f4bdd1`, Fondamenta `#c6abe3`, Accesso e sicurezza `#a5c9ed`.
- **Colori di stato**: fatto `#2e7a22`, in corso `#a86f00`, da fare `#6a1f6e`, bloccato `#c0262b`. Testo `#3a1f45`, testo secondario `#6f5c78`, fondo `#fffdfb`. Carattere Plus Jakarta Sans. Il tema scuro ha le sue varianti, con il contrasto verificato da `pnpm lint`.
- Testi in italiano. Date brevi all'italiana ("24 nov").

## Board condivisa (pagina iniziale)

La pagina di ogni mattina: tutti i task aperti di tutti i progetti, divisi per stato.

- Le quattro colonne delle regole comuni, con i task di tutti i progetti attivi.
- Filtri: Tutti, Lavoro, Personale (`project_scope`) e per progetto.
- In seguito, come opzione: righe per progetto (swimlane), che si possono chiudere.

## Board del progetto

- `/progetti/:id` si apre sulla scheda **Board**: le stesse colonne, solo con i task del progetto.
- La seconda scheda è **Cronologia** (sotto). La scheda scelta sta nell'indirizzo, così ricaricando la pagina resta quella.
- Le schede sono veri link o bottoni, con quella attiva segnalata ai lettori di schermo.

## Cronologia di un progetto senza stime (ex vista G)

- Solo vista compatta.
- Righe con una data (scadenza effettiva) in ordine di data; tra le righe le linee di oggi e dei checkpoint, in base alla data.
- Sotto, i task senza data, per priorità e impatto, con l'intestazione "Senza data · non collegati a nessun checkpoint".
- Linee orizzontali che attraversano tutto: i checkpoint (rosso, tratteggiato) e oggi (viola).

## Mappa di un progetto con piano (E, oggi solo Nutrirea)

Prende il posto della Cronologia nei progetti con un piano (`projects.weekly_hours` impostato).

- Fonte: `v_tasks` del progetto, ordinati per `position`; `checkpoints`; `features`; `projects.weekly_hours`; `projects.start_date` o il primo giorno del piano.
- **Pause del piano nel database** (per esempio le feste dal 21/12/2026 al 3/1/2027), non scritte nel codice dell'app: si aggiungono con una migrazione quando si costruisce la mappa.
- **Vista proporzionale** (predefinita): 1 ora = 48 px in verticale; ogni scheda è alta quanto le sue ore e sta all'altezza in cui cade nel piano.
  - Binari a sinistra: giorni (tessere con giorno della settimana e numero, weekend in grigio, oggi bordato), mese, righello delle ore (tacca ogni ora, etichetta ogni 5), feature.
  - Il calendario del piano: 10 ore a settimana a partire dal 25/10/2026 (come nella v2), saltando le pause.
  - Ore fatte = somma delle stime dei task chiusi; "oggi" = ore che il piano prevede alla data di oggi.
  - Linee: checkpoint (rosso, tratteggiato), oggi (viola), ore fatte (verde). Lo scarto tra fatto e piano è una fascia arancio chiaro.
- **Vista compatta** (pulsante "Altezza dei task: Proporzionale alle ore | Compatta"): tutte le righe uguali, stesso ordine. I binari mostrano data di inizio nel piano e ore di ogni task; checkpoint, ore fatte e oggi si posizionano dentro la riga giusta. Va detto chiaramente che l'altezza non è più la durata.
- Pulsanti "Vai a oggi" e "Vai al prossimo checkpoint".

## Oggi

Per decidere cosa fare oggi in tutti i progetti e in che ordine. Prende il posto dell'elenco per priorità (ex vista F), che diventa la sua prima colonna.

- **Suggeriti** (a sinistra): i task di livello 1 e 2 di `v_priorities`, ordinati per `priority_rank`, raggruppati per livello con un'intestazione che dice il livello, la regola e quanti task contiene. Non mostra i task già nel piano di oggi.
- **Piano di oggi** (a destra): i task scelti per oggi, nell'ordine deciso a mano, ognuno con il suo stato.
- Si aggiunge, si toglie e si riordina trascinando, con un'alternativa da tastiera.
- Il piano del giorno sta nel database (una tabella con task, data e posizione). L'ordine scelto a mano è una decisione per la giornata, non una priorità: l'unica regola di priorità resta `v_priorities`.

## Ordine di costruzione

Fatto:

1. Login (email e password) e guardia sulle pagine.
2. Elenco per priorità di tutti i progetti (ex vista F), in sola lettura.
3. Vista di un progetto senza stime (ex vista G), in sola lettura, e menu dei progetti.

Epic #32, board:

4. Board condivisa in sola lettura, pagina iniziale (#30).
5. Board del progetto con la scheda Cronologia (#27).
6. Icona disegnata per ogni progetto (#28).
7. Spostare i task tra le colonne: la prima scrittura dall'app (#29).
8. Oggi, che sostituisce l'elenco per priorità (#31).
9. Sfondo personalizzato (#25).

Dopo:

10. Mappa di un progetto con piano (E), proporzionale e compatta, con le pause nel database.
11. Altre modifiche a mano dal pannello di dettaglio: prossima azione, impatto, blocchi, attese chieste o ricevute.
12. Pubblicazione su Netlify.
