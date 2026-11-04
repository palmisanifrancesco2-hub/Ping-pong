# Ping Pong Analytics

Web app privata React/TypeScript per consultare quote di tennistavolo. **Feed gratuito MoviOdds collegato; modello, previsioni e stake non operativi.**

Supabase Auth e registro privato proteggono gli endpoint. Le due migrazioni iniziali e la nuova migrazione delle scelte personali sono applicate in Production. Le tabelle originarie e la nuova tabella personale hanno RLS attiva. Il proprietario ha confermato l'accesso dal telefono. Nessun acquisto, dato simulato nella modalità reale o scommessa automatica.

App privata: https://ping-pong-ping-pong3.vercel.app — indirizzo fisso assegnato al deployment Production aggiornato.

## Accesso Google

Pulsante “Continua con Google” con PKCE e verifica disponibilità reale del provider. Il controllo Production conferma Google ancora disattivato (signup consentita). È necessario abilitare il proprio client OAuth in Supabase: [configurazione da telefono e stato](docs/GOOGLE-LOGIN.md). La registrazione non concede accesso ai dati senza membership; nessuna modifica al registro privato.

## Value Tracker

Schermata iniziale dedicata alle sole quote selezionate per valore statistico. Il motore matematico è predisposto; il filtro ADM è rimosso su richiesta. Il feed alimenta stime sperimentali, separate dalle opportunità validate ancora bloccate dal modello non idoneo. Nessuna opportunità inventata. [Criteri e limiti](docs/VALUE-TRACKER.md).

## Quote e mercati

Sono incluse solo partite live con lettura recente e partite con orario di inizio futuro. Ogni scheda permette di confrontare i giocatori e salvare partita o selezione nello storico personale, mantenendo quota e timestamp originali. La nuova tabella personale è attiva in Production, con quota originale non riscrivibile dal client.

Dashboard e sezione **Partite e mercati** leggono tutti i campionati e mercati restituiti dal feed MoviOdds, senza una lista fissa. Filtri per giocatore, campionato, stato e nome mercato; quota minima iniziale 1,30, nessuna massima, voci sospese identificabili e paginazione a blocchi di 25. Impostando quota minima 1 si vedono tutti i prezzi disponibili.

Fonte: **bet365.com.au**, tramite un progetto indipendente da bet365. Non sono prezzi italiani verificati e non vengono trattati come quote ADM. Nessun abbinamento tra mercati ambigui, nessuna probabilità o previsione calcolata da questo feed. Il catalogo può contenere eventi oltre l'orario previsto, segnalati esplicitamente; le voci sospese/zero non sono quote giocabili.

Una richiesta per l'intero tennistavolo, aggiornamento ogni 30 secondi quando la pagina è visibile. Cache e single-flight per istanza server; cooldown dopo errori. La cache non è globale tra istanze. Non è un flusso WebSocket continuo e non offre una garanzia di latenza live. Nomi, linee, handicap, periodi, ID e timestamp originali sono conservati. La lettura recente del singolo mercato resta distinta dall'ultima modifica di prezzo.

The Odds API V4 resta disponibile soltanto come diagnostica opzionale: il suo catalogo autenticato non include tennistavolo. Nessuna sua chiave è usata con altri fornitori. MoviOdds non richiede chiavi o registrazioni per questo endpoint.

Badge LIVE evidente con timestamp recente, punteggio se disponibile, stato non confermato se la lettura diventa vecchia e filtro rapido Solo LIVE. [Dettagli storico e live](docs/STORICO-E-LIVE.md).

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
| GET | `/api/access` | Token Supabase + appartenenza privata | Verifica accesso prima di caricare i dati |
| GET | `/api/health` | Pubblico | Stato processo, nessun segreto |
| GET | `/api/board` | Token Supabase verificato + appartenenza privata | Intero feed MoviOdds validato; risposta privata, no-store |
| GET/POST/PATCH | `/api/choices` | Token e RLS del chiamante | Scelte personali, snapshot quota e note/esiti manuali |
| POST | `/api/analysis` | Token + appartenenza privata | Statistiche giocatori e verifica requisiti pronostico |
| GET | `/api/model` | Token + appartenenza privata | Metriche effettive del modello, bloccato |
| POST | `/api/settle` | Token + appartenenza privata | Aggiornamento risultati riportati delle previsioni proprie |
| GET | `/api/history` | Token Supabase + appartenenza, JWT del chiamante e RLS | Previsioni reali proprie, intervalli, esiti e riepilogo |
| GET | `/api/connection` | Token Supabase verificato + appartenenza privata | Diagnostica catalogo The Odds API |

Timeout, schema, identità evento/selezione, errori, dimensione del payload e timestamp sono controllati lato server. In errore il client rimuove la vecchia risposta; nessun fallback a quote inventate. Anteprima senza dati e senza chiamate API.

## Stato e limiti

**169 test, TypeScript e build superati.** Chromium locale verificato su viewport mobile e desktop con feed reale e autenticazione sintetica isolata; questo non equivale a un nuovo login di produzione automatizzato.

[Integrazione e verifiche MoviOdds](docs/FASE-3.md), [database e ricerca fornitori](docs/FASE-2.md), [configurazione cloud](docs/CONFIGURAZIONE.md), [registro verifiche](docs/VERIFICHE.md).

[Giocatori, scelte personali e prova del modello](docs/GIOCATORI-E-SCELTE.md). Il primo modello Elo è stato addestrato e testato realmente ma NON supera i controlli: Brier 0,251484 e Log Loss 0,696029 su 118 casi fuori campione. Non genera previsioni operative.

Lo storico delle previsioni ora legge le tabelle esistenti con intervalli da 24 ore a 365 giorni e storico completo, filtri esito e riepilogo; resta vuoto fino a vere registrazioni. Il generatore e il settlement automatico non sono attivi. Lo storico quote non viene ancora raccolto nel database. Risultati ufficiali, validazione temporale, calibrazione, Value Tracker operativo e Smart Stake attendono dati sufficienti e verificati. Nessuna garanzia di gratuità futura o continuità del fornitore; concessioni ADM e diritti a valle non verificati indipendentemente.

### Ricerca statistica reale

Confronto di sei modelli con protocollo preregistrato: 1.000 eventi campionati,
956 orari verificati, 570 casi con storico sufficiente. Il candidato scelto
(Elo K=10) non supera il test finale: Brier 0,252164 su 146 casi, contro 0,25.
Il report è disponibile nella sezione **Statistiche modello** e in
[docs/RICERCA-MODELLI.md](docs/RICERCA-MODELLI.md). Le schede giocatore mostrano
anche l'intervallo descrittivo della frequenza storica; non è una probabilità
validata per la prossima partita. Nessuna promozione automatica dei modelli.
