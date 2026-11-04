# Ping Pong Analytics

Web app privata per analisi statistiche del ping pong. **Base tecnica di Fase 1 implementata; dati reali e modello non operativi.**

Il repository iniziale conteneva soltanto questo README. Il provider confermato è **The Odds API V4**, diverso da odss-api.com. La verifica autenticata eseguita sul server Vercel è riuscita, ma il catalogo ricevuto **non include tennistavolo**. Nessuna copertura operativa per le competizioni richieste.

Leggi [analisi, fonti e blocchi](docs/FASE-1.md) e [configurazione cloud da Android](docs/CONFIGURAZIONE.md).

Il [riepilogo Fase 2](docs/FASE-2.md) documenta Supabase collegato a Vercel e la ricerca di fonti alternative. Lo schema remoto è in attesa di approvazione esplicita: la migrazione server è predisposta e verificata su PostgreSQL incorporato, ma non eseguita sul database reale. ODSS-API elenca pubblicamente tre competizioni richieste, ma la sua licenza per value betting richiede autorizzazione espressa: nessun provider alternativo è stato attivato.

## Implementato

- React/TypeScript/Vite, dashboard responsive, anteprima esplicita senza dati, login Supabase predisposto.
- Backend Node/Vercel: health pubblica e catalogo protetto da token Supabase e registro privato nel database.
- Connettore V4 con validazione runtime, timeout, gestione errori/quota e credenziali server.
- Primitive matematiche e confronto quote prudente con test automatici.
- Migrazione PostgreSQL/RLS e workflow GitHub Actions.

Sezioni modello/storico/stake in stato **Dati insufficienti** o non operativo. Nessuna quota, risultato o probabilità simulata. I filtri non interrogano ancora il provider.

## Sviluppo cloud (per Codex e CI)

Node >=22.12. Il proprietario non deve eseguire comandi sul PC.

```sh
npm ci
npm run dev
npm run check
npm run check:connection
npm run check:coverage
```

`check:connection` interroga solo il catalogo sport; esce con codice 1 se manca la chiave o il test fallisce. Connessione riuscita non significa copertura tennistavolo.

`check:coverage` interroga soltanto i cataloghi pubblici di ODSS-API (un servizio diverso), senza chiave o costo. Distingue presenza nel catalogo da quote autenticate, ADM, live e mercati confrontabili: questi ultimi restano non verificati.

Variabili in [.env.example](.env.example). Non committare `.env` e non usare prefisso `VITE_` per segreti. Le variabili `VITE_SUPABASE_*` sono pubblicabili e protette da RLS; mai usare service-role key.

## Endpoint

| Metodo | Endpoint | Accesso | Comportamento |
|---|---|---|---|
| GET | `/api/health` | Pubblico | Stato processo e versione; nessuna verifica servizi esterni |
| GET | `/api/connection` | Token Supabase verificato + appartenenza al registro privato | Catalogo sport; nessuna chiave restituita |

Cache catalogo di 60 secondi per istanza server, errori sanitizzati. Nessun endpoint pubblico quote o scommesse.

## Database e verifiche

[Migrazione](supabase/migrations/202611040001_initial.sql): dati sportivi in lettura ai membri; previsioni e puntate isolate per utente; scrittura modelli/dati sportivi negata al browser. L'amministratore SQL gestisce `authorized_users`. Storico quote in righe append-only per i client browser (sola lettura); futura pipeline server tenuta a rispettare l'immutabilità.

Il runner `db:bootstrap` applica le migrazioni dal server Vercel solo con opt-in Production, lock, checksum e controllo database vuoto. La [seconda migrazione](supabase/migrations/202611040002_private_membership.sql) aggiunge RPC di appartenenza e prenotazione privata dell'email proprietario senza creare account o inviare inviti. Il backend e RLS usano lo stesso registro; una whitelist UUID opzionale può restringere ulteriormente l'accesso.

`npm run check` esegue test, TypeScript e build; CI ripete i controlli. Test su errori API, assenza chiave, timeout, quota, endpoint HTTP, RLS con PostgreSQL incorporato, quote/linee/unità diverse, probabilità implicita, EV e Kelly.

Vercel ha completato un deployment Preview del ramo di sviluppo e il test autenticato del provider. Il segreto esistente `oddsapi` è supportato come alias server di `THE_ODDS_API_KEY` senza rivelarne il valore. Restano non verificati: login e migrazione Supabase remoto, browser Android e flusso HTTP end-to-end del deployment protetto. Lo strumento di accesso automatico alla Preview non è riuscito a risolvere il deployment; la protezione Vercel è stata mantenuta. Modello non addestrato/validato, pipeline dati non collegata. Nessun servizio acquistato e nessuna scommessa eseguita.
