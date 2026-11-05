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

Pubblicazione classifica v4: commit applicativo `1071fbe58ace80d47021da2bf0d619b45651d715`, deployment `dpl_6vwdDRuaBa1TuZPmQUKKK4FVnKa8` **READY**. Alias `https://ping-pong-ping-pong3.vercel.app` verificato sul nuovo deployment. Build cloud completata, feed reale 590 partite / 10 competizioni / 40 nomi mercato; controlli DB e accessi in sola lettura riusciti. Protezione Vercel mantenuta; nessuna promozione del modello e nessuna modifica al campione futuro.

## Confronto completato su 3.000 — 5 novembre 2026

- Nuova richiesta esplicita del proprietario: riduzione da 5.000 a 3.000. Processo precedente fermato verificando comando e identità di avvio; cache preservata, stato precedente `superseded_by_3000`.
- Protocollo v6 nel commit `264a809` prima del confronto. Esattamente 3.000 casi selezionati nella stessa sequenza; zero nuove richieste di rete nella preparazione.
- Cinque finestre, 11 giorni, 15 modelli sugli stessi ID. Primo modello completo λ=0,001: Brier 0,247647, Log Loss 0,688382, ECE 0,016377, 1.613/3.000 esiti corretti (53,77%). Nessuna superiorità robusta sul secondo. Nessuna promozione del modello operativo.
- Audit e campione prospettico originale verificati tramite hash; le 304 osservazioni future rimangono immutate. Stato locale 3.000 `completed`; non si dichiara completato il test da 5.000.
- 199 test in 24 file, TypeScript e build passati. Test di integrità del report controllano esattamente 3.000 casi e coerenza di tutti i modelli e delle finestre; API privata verificata sul nuovo campione.
- Browser locale Chromium con sessione sintetica e report reale: Android 393×851 e desktop 1440×1000, 15 modelli renderizzati senza errori JavaScript né overflow. Non equivale al login reale dell'utente nella produzione protetta.

Pubblicazione 3.000: commit applicativo `1fd3c0189d50db653750abb7a74074c1990b3d18`, deployment `dpl_GBRyxhbRpZVxn4wdDvzo7T2mkpfQ` **READY**. Alias `https://ping-pong-ping-pong3.vercel.app` verificato sul nuovo deployment. Build cloud riuscita, feed 616 partite / 11 competizioni / 44 nomi mercato; controlli DB, RLS e schema in sola lettura riusciti. Il controllo server Supabase conferma ora `googleEnabled=true`, distinto dal login manuale già confermato dall'utente. Nessuna migrazione o promozione del modello.

## Flussi di tutte le sezioni — 5 novembre 2026

- Nuovo runtime del modello completo, 1.777 casi di training e 386 di calibrazione, con `validated=false`. Dati giocatore correnti e almeno 30 risultati per lato; solo vincente partita prematch con coppia di quote coerente e fresca. Quote, modello e percentuale mostrata sono ricontrollati prima della registrazione.
- Previsioni sperimentali registrabili esplicitamente, con prima probabilità e quota conservate e data effettiva di disponibilità delle caratteristiche. Statistiche separate per esiti confermati e risultati provvisori della fonte. Storico caricato senza attendere la sincronizzazione degli esiti.
- Diario `manual_bets` con JWT del chiamante, RLS, date non future, validazione e profitti calcolati server-side. Simulatore manuale Kelly con incertezza e limite massimo 2%, completamente disattivabile. Nessuna puntata automatica.
- Test della classe di persistenza reale contro PostgreSQL locale con le migrazioni originali: FK, data, modello non validato, primo valore immutabile, isolamento di due utenti e divieto di collegare puntate alla previsione altrui.
- 211 test / 27 file, TypeScript e build superati. Nuovi controlli HTTP contro campi proprietario, probabilità e profitti falsificati, quote/modelli/percentuali cambiati, filtri non validi e accessi anonimi.
- Browser Chromium locale: tutte le otto sezioni, Android 393×851 e desktop 1440×1000. Feed, archivio e modello reali; caso analizzato con 70 risultati per giocatore e probabilità 0,4875353 / 0,5124647. Registrazione, storico, scelta, diario, modifica esito e rilettura dopo reload riusciti; zero errori JS o overflow.
- Nel browser account sintetico, scritture isolate in memoria e indicatore dello stato dei servizi simulato. Nessuna scrittura remota, puntata reale o impersonificazione del JWT del proprietario. La conferma automatica delle nuove scritture in produzione con l'account reale non è stata eseguita.
- Un'unica funzione catch-all per le API, cache pubbliche condivise per istanza, durata massima 180s. Nessuna nuova migrazione o nuova credenziale. Verifica build dello schema del diario a zero righe.

Pubblicazione sezioni: commit applicativo `09128ca614610cb7eba0a0bf2825743328131757`, deployment `dpl_vAfAFEuk3Frs6Zz41hCypFQbE4Lk` **READY**. Alias `https://ping-pong-ping-pong3.vercel.app` verificato sul nuovo deployment. Build cloud completata in 34s, feed 604 eventi / 11 competizioni / 36 nomi mercato, archivio pubblico 23.732 risultati utilizzabili. Verifiche accessi DB, RLS, storico, scelte e schema `manual_bets` a zero righe passate. Google attivo confermato (`googleEnabled=true`).

Un tentativo autorizzato tramite connettore Vercel su `/api/health` non ha potuto accedere al deployment: il connettore ha restituito `success=false` e deployment non trovato/non autorizzato, non un risultato HTTP dell'app. Non è stata rimossa la protezione e non si è chiesto un token privato. Il routing catch-all è stato accettato dalla build; navigazione e API sono verificate localmente, ma il probe HTTP automatizzato della produzione e le nuove scritture con l'account reale restano non verificati.

Nuovo test prospettico: 216 test in 28 file e build TypeScript/Vite superati. Hash dei pesi congelati e codice caratteristiche, esiti incompleti/tardivi, confronto con bookmaker, bootstrap per date, cron autenticato, permessi del proprietario e separazione degli snapshot automatici/personali verificati. Browser locale 393×851 e 1440×1000: tutte le otto sezioni, nuova schermata test e aggiornamento manuale, nessun errore console/overflow. Fonte feed/risultati reale; Auth, report prospettico e scritture private simulati soltanto nella prova locale. Dati giocatori selezionati: 72 e 40 precedenti. Nessuna prova di profitto o validazione indipendente ricavata da questa verifica funzionale.

Pubblicazione test prospettico: commit `7c623d5ee891ae8af7ba8a94406c13a465479022`, deployment Production `dpl_6K3N2m6kAKJDGHwVPX5WbkJScvwb` READY, URL stabile https://ping-pong-ping-pong3.vercel.app assegnato. Bootstrap concluso il 5 novembre 2026 alle 03:12:25 UTC: **18 previsioni nuove**, 18 tentativi, zero duplicati/errori, zero esiti ancora valutabili. Il report è letto dal database reale dopo gli inserimenti; tutte le versioni restano non validate. Query PostgREST dello studio a limite zero, RLS/accesso proprietario, feed (565 eventi) e archivio (23774 risultati utilizzabili) verificati dal server Vercel. Questi numeri sono una fotografia del bootstrap, non del futuro traffico live.

`CRON_SECRET` generato e configurato come Sensitive server-only Production, mai stampato o salvato nel repository. Raccolta abilitata; cron nel deployment `15 4 * * *`, singolo lotto giornaliero idempotente. Prima esecuzione periodica futura non ancora osservata: configurazione del cron e flag `scheduled=true` non costituiscono prova di esecuzione futura. Flag bootstrap riportato a 0 dopo il lotto riuscito; nessuna migrazione o puntata reale inserita. Restano i limiti del controllo HTTP Production protetto già documentati: nessuna disattivazione della protezione e nessuna impersonificazione del JWT del proprietario.

Accesso diretto agli eventi (5 novembre 2026): rimosso l'ingresso nell'anteprima senza dati e lo stato demo dalla navigazione principale. Dopo login/ripristino sessione autorizzata si apre Partite e mercati e il feed viene richiesto automaticamente; nessuna chiamata board prima dell'autorizzazione. Ricerca ampliata a giocatore/campionato/ID, con gli stessi vincoli live/futuro e di quota. Suite **217 test in 28 file**, TypeScript e build superati. Chromium mobile 393×851 e desktop 1440×1000 verifica assenza demo, caricamento immediato, ricerca ID, ricerca senza risultati e ripristino filtri; tutte le otto sezioni e i flussi personali ancora verificati, nessun errore console/overflow. Fonte sportiva reale; Auth e scritture private isolate/sintetiche nella prova locale, nessuna impersonificazione dell'account reale. Protocollo/pesi del test prospettico invariati.

Release accesso reale `cf0bac5fd2c5cef98a939bce959fdcb3299f2ea6`: deployment Production `dpl_HxfhFXzrtxycMyCwVGP788impe4o` READY e alias stabile assegnato. GitHub CI del commit superata. Server Vercel conferma feed reale di 541 eventi, 12 campionati e 3473 voci quota (fotografia del build alle 04:52 UTC); archivio giocatori con 23804 risultati utilizzabili e controlli DB/RLS/schema riusciti. La rimozione demo non modifica protocollo, pesi o raccolta del test. Rimangono i limiti già documentati sull'automazione dell'accesso Production protetto.

Correzione errore reale di accesso (5 novembre 2026, 05:03 UTC): i log runtime Production mostrano `GET /api/access` con `ERR_MODULE_NOT_FOUND` per l'import senza estensione di `player-model` in `study-metrics.js`. Il processo si arrestava prima della verifica Auth; non era un rifiuto dell'account. I test precedenti con tsx/Vite e i diagnostici build non provavano il caricamento ESM della funzione pubblicata.

Corrette le estensioni `.js` nel grafo condiviso server, inclusi analytics e Google Auth; pesi, protocollo e criteri statistici invariati. Aggiunti `tsconfig.server.json` con NodeNext e `npm run check:server`, eseguito anche dalla build Vercel/CI: compila l'entry API reale con le dipendenze, lo importa mediante Node senza tsx e prova health 200, access/board/cron anonimi 401, header privati e formato JSON. Il processo smoke non riceve segreti/sessioni e blocca/conta le chiamate esterne. Output locale Node 24.22.1 riuscito; suite 217 test, TypeScript e Vite superati.
