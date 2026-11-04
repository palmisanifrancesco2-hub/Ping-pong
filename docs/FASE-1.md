# Fase 1 — analisi e base tecnica

Rilevazione: 4 novembre 2026. Repository iniziale: commit `5110a08`.

## Analisi integrale del repository

L'albero originale contiene soltanto `README.md` (67 byte), con titolo e descrizione. Non esistono starter React, backend, endpoint, database, test o integrazioni da conservare. La chiave del provider non è configurata nell'ambiente di lavoro.

Il proprietario ha confermato **The Odds API V4** tramite il link alla documentazione. `odss-api.com` è un servizio differente: la ricerca preliminare su quel sito è stata scartata e non è usata nel codice.

## Verifica del provider e fonti ufficiali

- [Documentazione V4](https://the-odds-api.com/liveapi/guides/v4/): host `api.the-odds-api.com`; autenticazione query `apiKey`. Catalogo `sports/?all=true` ed eventi `sports/{sport}/events` non consumano crediti quota. Quote per evento: `sports/{sport}/events/{eventId}/odds`; mercati: `sports/{sport}/events/{eventId}/markets`. Quest'ultimo costa un credito; quote: mercati restituiti × regioni (gruppi di 10 bookmaker equivalgono a una regione). Header quota: `x-requests-remaining`, `x-requests-used`, `x-requests-last`. Errori 429 richiedono rallentamento. Storico quote riservato ai piani a pagamento. Risultati solo per sport selezionati, fino a tre giorni: non equivalgono a uno storico completo.
- [Catalogo sport](https://the-odds-api.com/sports-odds-data/sports-apis.html): nessuna voce tennistavolo trovata. Czech Liga Pro, TT Cup, TT Elite Series e Challenger Series **non confermate**. Il connettore scopre gli identificativi dal catalogo autenticato, senza inventarli.
- [Bookmaker](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html): elencati `codere_it` e `unibet_it`. Nessuno è abilitato automaticamente: occorre verificare dominio, operatore e concessione nel [registro ufficiale ADM](https://www.adm.gov.it/portale/monopoli/giochi/gioco_distanza/gioco_dist_concessionari), registrando fonte e scadenza della verifica. Regione EU e suffisso IT non certificano da soli un bookmaker ADM.
- [Mercati](https://the-odds-api.com/sports-odds-data/betting-markets.html): chiavi generali `h2h`, `totals`, `spreads`. I mercati per set elencati per il tennis non dimostrano copertura tennistavolo. Nessuna equivalenza automatica punti/set.
- [Piani](https://the-odds-api.com/): Starter pubblicizzato a 500 crediti/mese gratuito; primo piano a pagamento pubblicizzato 30 USD/mese per 20.000 crediti. Piano e limiti effettivi del proprietario non verificati. Nessun acquisto effettuato.
- [Condizioni](https://the-odds-api.com/terms-and-conditions.html): accuratezza e tempestività non garantite; richiesta verifica indipendente. Vietata ridistribuzione come prodotto dati autonomo. Applicazione predisposta per analisi privata, senza API pubblica di ridistribuzione.

Prova HTTP reale senza credenziali: `GET https://api.the-odds-api.com/v4/sports/?all=true` → **401**. Dimostra raggiungibilità e requisito di autenticazione, non validità chiave o copertura. Nessuna chiamata quote o storico a pagamento effettuata.

## Funzioni implementate

- React/TypeScript/Vite con sezioni richieste, responsive e senza dati fittizi. Anteprima esplicita senza dati e senza chiamate API.
- Login email/password Supabase predisposto; nessuna registrazione pubblica nell'app. Endpoint privati protetti da verifica token e lista UUID consentiti. Configurazione mancante = accesso negato.
- Node/Vercel: `GET /api/health` pubblico e `GET /api/connection` privato.
- Connettore V4: sport, eventi, mercati, quote per evento. Soltanto il test catalogo è esposto via HTTP; gli altri metodi non alimentano ancora il frontend.
- Validazione runtime, timeout anche sul corpo risposta, errori sanitizzati, gestione 429 e quota, cache/single-flight catalogo di 60 secondi per istanza.
- Chiavi soltanto server; nessun URL autenticato o payload upstream esposto al browser o nei log.
- Primitive testate: confronto quote conservativo, probabilità implicita, EV, margine per mercato completo, metriche binarie e Kelly frazionario disattivabile con tetto 2%. NON costituiscono un modello statistico validato.
- Schema PostgreSQL con RLS per utenti, giocatori, competizioni, eventi, risultati, bookmaker, mercati, storico quote, modelli, previsioni, esiti, puntate e validazioni. Nessuna migrazione applicata a Supabase remoto.

## Blocchi e funzioni mancanti

1. **Chiave**: manca `THE_ODDS_API_KEY` nel server. Non inviarla in chat e non inserirla nel repository pubblico.
2. **Supabase**: nessun progetto collegato, utente remoto configurato o migrazione remota eseguita. PostgreSQL incorporato non sostituisce la verifica sul servizio reale.
3. **Copertura**: nessuna partita o quota reale recuperata; competizioni, mercati e live non certificati. Orario di inizio trascorso non considerato prova di live.
4. **ADM**: registro applicativo vuoto: nessuna quota ammessa come ADM verificata.
5. **Fasi 2–5**: pipeline di persistenza, acquisizione e settlement non collegate. Modello non addestrato, nessuna calibrazione/validazione temporale. Nessuna previsione o opportunità; Smart Stake non operativo. Filtri frontend predisposti, senza dataset.
6. **Hosting**: configurazione Vercel preparata; nessun deploy e nessun URL applicativo pubblicato.
7. **Scalabilità**: cache e rallentamento sono per istanza, non distribuiti. Prima di esporre chiamate quote occorre un budget durevole centralizzato; prima della pubblicazione verificare protezioni antiabuso dell'hosting.
8. **Android**: breakpoint e navigazione mobile implementati. Browser QA non disponibile nell'ambiente; nessuna verifica visiva Android dichiarata. Login e deploy end-to-end richiedono configurazioni reali.

## Gate per la fase successiva

Inserire la chiave come segreto ambiente Codex o nel backend Vercel, poi eseguire il test catalogo. Se manca tennistavolo anche nel catalogo autenticato, chiedere conferma della copertura al provider prima di attivare acquisizione o valutare alternative. Nessun nuovo fornitore o piano a pagamento sarà attivato automaticamente.
