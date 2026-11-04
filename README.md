# Ping Pong Analytics

Web app privata React/TypeScript per consultare quote di tennistavolo. **Feed gratuito MoviOdds collegato; modello, previsioni e stake non operativi.**

Supabase Auth e registro privato proteggono gli endpoint. Due migrazioni iniziali sono applicate in Production; 14 tabelle hanno RLS attiva. Il proprietario ha confermato l'accesso dal telefono. Nessun acquisto, dato simulato nella modalità reale o scommessa automatica.

## Quote e mercati

Dashboard e sezione **Partite e mercati** leggono tutti i campionati e mercati restituiti dal feed MoviOdds, senza una lista fissa. Filtri per giocatore, campionato, stato e nome mercato; quota minima iniziale 1,30, nessuna massima, voci sospese identificabili e paginazione a blocchi di 25. Impostando quota minima 1 si vedono tutti i prezzi disponibili.

Fonte: **bet365.com.au**, tramite un progetto indipendente da bet365. Non sono prezzi italiani verificati e non vengono trattati come quote ADM. Nessun abbinamento tra mercati ambigui, nessuna probabilità o previsione calcolata da questo feed. Il catalogo può contenere eventi oltre l'orario previsto, segnalati esplicitamente; le voci sospese/zero non sono quote giocabili.

Una richiesta per l'intero tennistavolo, aggiornamento ogni 30 secondi quando la pagina è visibile. Cache e single-flight per istanza server; cooldown dopo errori. La cache non è globale tra istanze. Non è un flusso WebSocket continuo e non offre una garanzia di latenza live. Nomi, linee, handicap, periodi, ID e timestamp originali sono conservati. La lettura recente del singolo mercato resta distinta dall'ultima modifica di prezzo.

The Odds API V4 resta disponibile soltanto come diagnostica opzionale: il suo catalogo autenticato non include tennistavolo. Nessuna sua chiave è usata con altri fornitori. MoviOdds non richiede chiavi o registrazioni per questo endpoint.

## Sviluppo e verifica cloud

Node >=22.12; deploy verificato su Node 24. Il proprietario non deve eseguire comandi sul PC.

```sh
npm ci
npm run dev
npm run check
npm run check:feed
```

Nell'ambiente Codex con proxy, Node 24 usa `NODE_USE_ENV_PROXY=1 npm run check:feed`. Il build Vercel esegue build, controllo reale MoviOdds, bootstrap solo se autorizzato dal flag e verifica database in sola lettura. **Mantenere `APP_DATABASE_SETUP=0`**: nessuna nuova migrazione è necessaria per il feed.

`check:connection` verifica il vecchio catalogo The Odds API; `check:coverage` e `check:oddspapi` sono diagnostiche di ricerca separate, non attivate nella dashboard. Configurazioni in [.env.example](.env.example). Mai inserire segreti in variabili `VITE_*`, log o commit.

## Endpoint

| Metodo | Endpoint | Accesso | Comportamento |
|---|---|---|---|
| GET | `/api/health` | Pubblico | Stato processo, nessun segreto |
| GET | `/api/board` | Token Supabase verificato + appartenenza privata | Intero feed MoviOdds validato; risposta privata, no-store |
| GET | `/api/connection` | Token Supabase verificato + appartenenza privata | Diagnostica catalogo The Odds API |

Timeout, schema, identità evento/selezione, errori, dimensione del payload e timestamp sono controllati lato server. In errore il client rimuove la vecchia risposta; nessun fallback a quote inventate. Anteprima senza dati e senza chiamate API.

## Stato e limiti

**129 test, TypeScript e build superati.** Chromium locale verificato su viewport mobile e desktop con feed reale e autenticazione sintetica isolata; questo non equivale a un nuovo login di produzione automatizzato.

[Integrazione e verifiche MoviOdds](docs/FASE-3.md), [database e ricerca fornitori](docs/FASE-2.md), [configurazione cloud](docs/CONFIGURAZIONE.md), [registro verifiche](docs/VERIFICHE.md).

Lo storico non viene ancora raccolto nel database. Risultati ufficiali, validazione temporale, calibrazione, Value Tracker operativo e Smart Stake attendono dati sufficienti e verificati. Nessuna garanzia di gratuità futura o continuità del fornitore; concessioni ADM e diritti a valle non verificati indipendentemente.
