# Project Coordinator

Frontend del coordinatore dei progetti di Simone: task di tutti i progetti, di lavoro e personali, con priorità, blocchi, attese e la mappa dell'avanzamento.

- Dati: Supabase, progetto `coordinator` (schema in `supabase/migrations/`).
- App: Angular 22, pubblicata su Netlify.
- Regole per chi ci lavora, persone o agenti: [`CLAUDE.md`](CLAUDE.md).
- Decisioni: [`docs/architettura.md`](docs/architettura.md). Viste: [`docs/viste.md`](docs/viste.md).

## Avvio in locale

Serve Node.js 24 (24.15 o successiva) e pnpm 12.16.1 (`corepack enable` lo prende da `package.json`).

1. Installa le dipendenze:

   ```sh
   pnpm install
   ```

2. Copia `.env.example` in `.env` e metti i valori veri: l'URL del progetto `coordinator` e la sua chiave **publishable** (`sb_publishable_...`, dal pannello di Supabase, *Project Settings → API Keys*). Mai la chiave secret: lo script di configurazione la rifiuta. `.env` è ignorato da Git.

3. Avvia l'app su http://localhost:4200:

   ```sh
   pnpm start
   ```

## Comandi

| Comando | Cosa fa |
|---|---|
| `pnpm start` | genera la configurazione e avvia il server di sviluppo |
| `pnpm build` | genera la configurazione e compila in `dist/` |
| `pnpm test` | test unitari (Vitest), sempre con valori di configurazione finti |
| `pnpm lint` | ESLint, comprese le regole di accessibilità dei template |
| `pnpm gen:config` | rigenera solo `src/app/data/supabase-config.generated.ts` |
| `pnpm gen:types` | rigenera `src/app/data/database.types.ts` dallo schema del progetto |

`start` e `build` leggono `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` prima dall'ambiente (così su Netlify) e poi da `.env`; se mancano si fermano con un messaggio chiaro.

## Tipi del database

Dopo ogni nuova migrazione rigenera i tipi e committali:

```sh
pnpm exec supabase login   # solo la prima volta: serve per leggere lo schema del progetto
pnpm gen:types
```

`pnpm gen:types` richiede di aver fatto prima `supabase login`: senza accesso la CLI non può leggere lo schema del progetto `coordinator`.
