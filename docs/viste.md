# Le viste da costruire

Il disegno di riferimento è il canvas **"Mappa del fico — idee per la parte centrale"**: https://claude.ai/artifact/JUwj91JExMRw9gR6ex2LTP

Direzione scelta il 23/11/2026: **tutto in verticale** (tavola E), con colonne per stato e un pulsante per compattare. Le tavole A–D sono le alternative scartate: guardale solo per confronto.

## Regole comuni

- **Verticale**: il tempo scorre dall'alto in basso. Si scorre con la rotella o il dito, mai di lato.
- **Colonne per stato**: In corso, Da fare (o Prossimo), Bloccato; nella vista di un progetto con piano anche Fatto.
  - "Bloccato" = `is_blocked` vero. Un task bloccato va in quella colonna qualunque sia il suo `status`.
  - "In corso" = `status = 'in_progress'`. Se è vuota, la colonna lo dice e indica il prossimo task da iniziare.
- **Scheda di un task**: titolo, prossima azione, e etichette per "sblocca altri" (`blocks_others`), "domanda da fare" (`has_question_to_ask`, con chi: `waiting_on`), "aspetta X", "bloccato". Bordo tratteggiato o tratteggio obliquo per i bloccati.
- **Linee orizzontali** che attraversano tutto: i checkpoint (rosso, tratteggiato), oggi (viola), e nella vista proporzionale le ore fatte (verde). Lo scarto tra fatto e piano è una fascia arancio chiaro.
- **Colori dal database**: `projects.color` (scuro, testo bianco sopra) e `features.color` (chiaro, testo `#3a1f45` sopra). Le feature di Nutrirea ce l'hanno già; le prime tre sono quelle del pavimento della v2: Pazienti `#f4bdd1`, Fondamenta `#c6abe3`, Accesso e sicurezza `#a5c9ed`.
- **Colori di stato**: fatto `#2e7a22`, in corso `#a86f00`, da fare `#6a1f6e`, bloccato `#c0262b`. Testo `#3a1f45`, testo secondario `#6f5c78`, fondo `#fffdfb`. Carattere Plus Jakarta Sans.
- Testi in italiano. Date brevi all'italiana ("24 nov").

## F · Tutti i progetti (la prima da costruire)

La pagina di ogni mattina: cosa fare adesso, in tutti i progetti.

- Fonte: `v_priorities`, già ordinata.
- Gruppi per livello di priorità, con un'intestazione che dice il livello, la regola e quanti task contiene.
- Livelli 1 e 2 aperti; livello 3 chiuso in un riepilogo per progetto (Nutrirea ha decine di task futuri del piano), apribile per progetto.
- Ogni scheda ha l'etichetta del progetto, nel colore `projects.color` con testo bianco (tavolozza fissa di ripiego solo se il colore è null). A sinistra, il binario con la scadenza effettiva ("scade 24 nov"; se è passata, in rosso: "scaduto il 24 nov") e, se c'è, il nome del checkpoint.
- L'ordine è quello di `priority_rank`: l'app ordina esplicitamente per quella colonna, perché l'ordine scritto in una vista non è garantito quando la si legge dall'API.
- Filtri: Tutti, Lavoro, Personale (`project_scope`).

## E · Mappa di un progetto con piano (oggi solo Nutrirea)

- Fonte: `v_tasks` del progetto, ordinati per `position`; `checkpoints`; `features`; `projects.weekly_hours`; `projects.start_date` o il primo giorno del piano.
- **Vista proporzionale** (predefinita): 1 ora = 48 px in verticale; ogni scheda è alta quanto le sue ore e sta all'altezza in cui cade nel piano.
  - Binari a sinistra: giorni (tessere con giorno della settimana e numero, weekend in grigio, oggi bordato), mese, righello delle ore (tacca ogni ora, etichetta ogni 5), feature.
  - Il calendario del piano: 10 ore a settimana, pausa dal 21/12/2026 al 3/1/2027 (come nella v2: `START = 2026-10-25`).
  - Ore fatte = somma delle stime dei task chiusi; "oggi" = ore che il piano prevede alla data di oggi.
- **Vista compatta** (pulsante "Altezza dei task: Proporzionale alle ore | Compatta"): tutte le righe uguali, stesso ordine. I binari mostrano data di inizio nel piano e ore di ogni task; checkpoint, ore fatte e oggi si posizionano dentro la riga giusta. Va detto chiaramente che l'altezza non è più la durata.
- Pulsanti "Vai a oggi" e "Vai al prossimo checkpoint".

## G · Progetto senza stime (tutti gli altri)

- Solo vista compatta.
- Righe con una data (scadenza effettiva) in ordine di data; tra le righe le linee di oggi e dei checkpoint, in base alla data.
- Sotto, i task senza data, per priorità e impatto, con l'intestazione "Senza data · non collegati a nessun checkpoint".

## Ordine di costruzione proposto

1. Login (email e password) e guardia sulle pagine.
2. F · Tutti i progetti, in sola lettura.
3. G · Progetto senza stime.
4. E · Mappa con piano, proporzionale e compatta.
5. Modifiche a mano: stato, prossima azione, impatto, attese chiese o ricevute.
6. Pubblicazione su Netlify.
