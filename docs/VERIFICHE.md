# Verifiche tecniche

Eseguite il 4 novembre 2026 in ambiente Codex.

| Controllo | Risultato | Limiti |
|---|---|---|
| Vitest | 168 test superati in 20 file | Include migrazioni transazionali, rollback, checksum, appartenenza, CA e verifica accesso in sola lettura |
| Endpoint HTTP | Health, auth, metodo, percorso e cache verificati su localhost | Token/provider sostituiti nei test HTTP; nessun login remoto certificato |
| Auth Supabase | Gate di autorizzazione e gestione errori testati | Test unitari Auth con risposte simulate; account e appartenenza verificati anche sul database remoto |
| PostgreSQL/RLS | Due migrazioni remote e 14 tabelle RLS; successivo controllo remoto READ ONLY conferma proprietario verificato/autorizzato, profilo isolato e rifiuto estranei/anonimi | Il proprietario ha confermato di riuscire a entrare dal telefono; verifica manuale riferita, non automatizzata |
| Supabase su Vercel | Integrazione e variabili Production verificate; bootstrap riuscito con CA ufficiale e flag disattivato dopo l'esecuzione | Nessun segreto copiato nelle Preview |
| TypeScript | Controllo superato | Non sostituisce prove del provider reale |
| Build Vite / Vercel | Deployment Production `e4f68ce` READY, verifica server database riuscita; HEAD URL risponde 302 verso autenticazione Vercel | Fetch autenticato dello strumento non riuscito; accesso browser confermato dal proprietario |
| Dipendenze produzione | `npm audit --omit=dev`: zero vulnerabilità segnalate | Fotografia delle segnalazioni disponibili, non garanzia generale |
| Test connessione sul server Vercel | Connessione autenticata riuscita | Catalogo senza tennistavolo; nessuna chiamata quote |
| Raggiungibilità provider | Endpoint sport ufficiale restituisce HTTP 401 senza chiave | Non prova copertura né validità chiave |
| Browser Android/PC | Chromium locale 393×851 e 1440×1000: feed reale, filtri, live, storico, intervalli, errori, demo | Auth e registrazioni storiche sintetiche solo nel test locale; login Production della nuova versione non automatizzato |
| Modello statistico | Non eseguito | Nessun modello o dataset: nessuna previsione operativa |
| Salvataggio GitHub | Riuscito dopo aggiornamento autorizzazione | Ramo `feat/phase-1-foundation` caricato; il precedente errore 403 è risolto |

I test degli endpoint richiedono apertura di socket locali. Nell'ambiente Codex è stato necessario eseguirli fuori dal vincolo di rete locale della sandbox; nessun servizio pubblico è stato avviato. La suite CI richiede Node 22 e ripete `npm run check`.

Controllo credenziali: `.env` ignorato; `.env.example` contiene solo valori vuoti. Il provider usa esclusivamente variabili server; nessuna API key reale disponibile o inserita nel repository. Il bundle frontend non importa i moduli server.

Il codice è salvato su GitHub nel ramo `feat/phase-1-foundation`. Il primo tentativo di scrittura era fallito con HTTP 403; dopo l'aggiornamento dell'autorizzazione da parte del proprietario, il push è riuscito. Chiave API configurata come Secret server `oddsapi`; nessuna copia locale o lettura del suo valore. Supabase configurato in Production; account proprietario e isolamento RLS verificati sul server.

Preview del commit `9b27cc5`: https://ping-pong-5nfa5733j-ping-pong3.vercel.app — Vercel segnala READY e i log confermano il test catalogo riuscito. Lo strumento di fetch protetto restituisce errore di risoluzione/accesso al deployment; il fallback CLI non ha credenziali disponibili. Nessuna protezione disattivata, nessuna certificazione del flusso HTTP end-to-end.

Verifica successiva dopo creazione dell'account da parte del proprietario: deployment Production `e4f68ce`, https://ping-pong-oscdwxx87-ping-pong3.vercel.app. Il controllo server ha eseguito una transazione `READ ONLY`, verificando account, email confermata, registro privato, visibilità del profilo proprietario, rifiuto di un'identità estranea e dei privilegi anonimi. Rollback finale della transazione; nessuna modifica a utenti/schema/dati. Il build conferma che il bootstrap non è richiesto: flag migrazione a `0`. Nessuna password del proprietario usata o acquisita.

Vincolo economico confermato dal proprietario: soltanto servizi gratuiti. Diagnostica OddsPapi testata con fixture sintetiche: massimo due richieste, opt-in esplicito, nessun retry, errori senza chiave, nessuna esecuzione automatica durante build. Connessione reale OddsPapi non eseguita: manca una chiave distinta del piano gratuito.

MoviOdds: chiamate pubbliche reali senza chiave riuscite via curl; payload reale validato dal parser. Anche il comando HTTP completo è riuscito usando `NODE_USE_ENV_PROXY=1` per rispettare il proxy configurato. Feed bet365.com.au, prezzi italiani e ADM non verificati. Nuovi test coprono timestamp obsoleti/futuri, schema, identità duplicate, quote di altro evento, HTTP 429 e separazione fonte estera/ADM. Nessuna attivazione nella dashboard.

Integrazione UI MoviOdds: vedere [Fase 3](FASE-3.md). Connettore completo verificato sul feed reale. Chromium locale con auth sintetica e API reale conferma mobile/desktop, quote/mercati, filtri, paginazione, logout/demo e rifiuto senza token. Nessun bypass Auth nel codice distribuito. Risultati storici delle righe precedenti non sostituiscono questa verifica più recente.

Deployment MoviOdds Production `b3de748` READY: https://ping-pong-cvsy6nrzk-ping-pong3.vercel.app. Il server Vercel conferma schema completo del feed (455 partite/10 campionati/46 nomi mercato al build), controllo database READ ONLY riuscito e bootstrap non richiesto. Root HTTP 302 verso autenticazione Vercel. Fetch protetto automatico non riuscito; login Production di questa nuova versione da provare dal proprietario. Nessun log error/fatal nella scansione iniziale di 10 minuti, con copertura limitata al traffico effettivamente presente.

Storico e badge LIVE: [dettagli implementazione e prove](STORICO-E-LIVE.md). Polling 30 secondi osservato nel browser. Intervalli da 24 ore fino a un anno, nessuna previsione retroattiva e nessuna nuova migrazione. Il nuovo storico richiede future registrazioni autentiche prima di avere esiti da mostrare.

Storico/LIVE Production `826338a`, deployment `dpl_AinxFK9ZZ1z4154Qd59KQBjK99qm` READY. Query PostgREST reale a limite zero riuscita, controllo database READ ONLY e feed riusciti, bootstrap non richiesto. Alias fisso https://ping-pong-ping-pong3.vercel.app confermato sul nuovo deployment; HEAD 302 verso login Vercel. Nessun dato fittizio o previsione retroattiva inserito.

Versione giocatori/scelte: suite 155 test superata; Chromium conferma solo live/futuri e statistiche reali, salvataggi personali e note/esiti in ambiente isolato. Il modello Elo è realmente testato ma bloccato: Brier 0,251484 e Log Loss 0,696029 su 118 casi fuori campione. Nessuna previsione retroattiva creata. Dettagli in [Giocatori e scelte](GIOCATORI-E-SCELTE.md).

Release giocatori/scelte `0704182` Production READY, alias fisso confermato. Migrazione terza applicata (1 nuova / 3 totali); flag entrambi 0 dopo riuscita. Server Vercel verifica feed solo attivo, archivio giocatori reale, RLS proprietario, accesso anonimo negato e snapshot immutabile. Query storico/scelte a limite zero riuscite. Nessuna previsione operativa: modello globale fallisce il test. Vedere [dettagli della pubblicazione](GIOCATORI-E-SCELTE.md).

Google OAuth: 162 test e build superati. Browser locale con provider/sessioni sintetici conferma PKCE, account autorizzato, non membro senza feed, annullamento e provider spento. Il login Google reale non è stato eseguito e l’attivazione del provider va verificata sul progetto; nessun nuovo utente remoto o modifica di membership. [Dettagli](GOOGLE-LOGIN.md).

Google Production `b914c81`: controllo nativo riuscito, provider Google spento e signup consentita. Codice PKCE pubblicato, attivazione OAuth ancora da eseguire nel progetto Google/Supabase dal proprietario. Nessuna modifica di credenziali o utenti.

Value Tracker: matematica e soglie testate su fixture sintetiche; HTTP privato verifica blocco reale. Nessuna opportunità o percentuale mostrata senza modello idoneo e fonte ADM verificata.

## Ricerca modelli — 4 novembre 2026, 21:54 UTC

- Protocollo preregistrato `a18faf0`, sei varianti, dati MoviOdds reali; report completo `research/report-v2.json` e metodo `docs/RICERCA-MODELLI.md`.
- 1.000 eventi campionati, 956 start verificati, 570 casi con storico; sviluppo 321, calibrazione 99, test finale 146. Elo K=10 selezionato nello sviluppo; Brier finale 0,252164, 53,42% corretti. Criteri non superati, nessuna promozione o pronostico retroattivo.
- `npm run check`: 182 test / 21 file, TypeScript e build superati.
- Browser Chromium locale: accesso sintetico isolato → endpoint privato reale `/api/model` → report reale → rendering Android 393×851 e desktop 1440×1000. Nessun errore JavaScript né overflow orizzontale. Controllato visivamente screenshot mobile.
- Intervalli Wilson descrittivi nella scheda giocatore verificati matematicamente; non sono intervalli predittivi della prossima partita.
- Nessuna chiave o cache grezza nei nuovi file; migrazioni Vercel `APP_DATABASE_SETUP=0` e `APP_CHOICES_SETUP=0` verificate tramite metadati, nessuna nuova migrazione.
- Il login reale dell'utente e l'accesso browser alla produzione dietro protezione Vercel non sono stati automatizzati. Il test locale usa una sessione fittizia, non l'account reale.

Pubblicazione della ricerca: commit applicativo `6869ee6cbc25cc5a12a5f44c93f48d849af0e5b8`, deployment Vercel `dpl_EpdXs3XpTkUTU7NpqSsMJRq7n3km` **READY**. Alias `https://ping-pong-ping-pong3.vercel.app` verificato sul nuovo deployment. Build cloud riuscita: feed reale 362 partite / 10 competizioni / 38 nomi mercato; verifiche DB in sola lettura, RLS e schema riuscite. Protezione Vercel mantenuta; navigazione locale verificata, sessione reale in produzione non automatizzata.

## Ricerca su punteggi e campione futuro — 4 novembre 2026

- Protocollo v3 preregistrato (`7cc3386`), nove configurazioni logistiche. 600 eventi nuovi rispetto agli ID noti v2, 577 orari verificabili, 385 casi finali. Brier 0,247901, 55,32% corretti; Elo sugli stessi casi 0,247380. Controlli non superati; periodo già esplorato, nessuna promozione.
- Registrate 304 osservazioni prospettiche alle 22:17:32 UTC, prima dell'inizio previsto più vicino (22:25 UTC). Modello e hash in Git (`39f93c9`) prima degli esiti; file completi e archivio in `.research-data/`, ignorati da Git. Nessun aggiornamento in background attivato.
- 189 test in 22 file, TypeScript e build superati. Controlli su causalità delle caratteristiche, simmetria, regolarizzazione, assenza di risultati futuri, quote incomplete e osservazioni obsolete.
- Chromium locale con autenticazione sintetica isolata e API reale del report: Android 393×851 e desktop 1440×1000, nove candidati e manifesto 304 eventi renderizzati, nessun errore JavaScript o overflow. Login dell'utente in produzione non automatizzato.
- API `/api/model` protetta; restituisce i riepiloghi e il manifesto, non le righe individuali dei test o del campione futuro. Nessuna modifica al database o alle credenziali.
- Audit iniziale del campione futuro eseguito realmente alle 22:20:52 UTC: hash valido, 304 in attesa, 0 valutati, metriche correttamente nulle. Il ramo di valutazione di partite realmente concluse non è ancora verificabile su questo campione; nessun esito è stato inventato.

Pubblicazione v3: commit applicativo `77658bb96d8a3cc6eddf09c63be71abe7b6a4b52`, deployment `dpl_J8DLe9Pd24dXjXwGmV4bihHwZovx` **READY**. Alias `https://ping-pong-ping-pong3.vercel.app` verificato sul nuovo deployment. Build cloud conclusa, feed reale 419 partite / 10 competizioni / 43 nomi mercato, verifiche degli accessi e dello schema in sola lettura riuscite. Il modello operativo non è stato promosso; protezione Vercel mantenuta e login reale non automatizzato.

## Classifica comune v4 — 4 novembre 2026

- Protocollo preregistrato `0ff475a`; 15 modelli, esattamente gli stessi 784 ID in ciascun test, 9 giorni e 5 finestre. Brier primario fissato prima dell'esecuzione. Primo logistica completa λ=0,001: 0,246657, 452/784 corretti; Elo K=10: 0,246808. Nessuna superiorità netta sul secondo; primo per uguale peso giornaliero Elo K=10.
- 194 test / 23 file passati; TypeScript e build passati. Test specifici su esclusione degli esiti tardivi, coorti identiche, duplicati, calibrazione e ricampionamento riproducibile per giorni, coerenza dei conteggi della classifica.
- Browser Chromium locale, API reale del report e sessione sintetica: 15 righe di classifica e dettagli dell'incertezza verificati su Android 393×851 e desktop 1440×1000, nessun errore JavaScript o overflow.
- Hash dell'audit v4 verificato. Hash del campione prospettico v3 ancora identico. Previsioni individuali e pesi per finestra esclusi da Git e dall'API; nessuna modifica DB o credenziale.
- Il controllo browser locale non equivale al login reale nella produzione protetta Vercel, che non è stato automatizzato.
