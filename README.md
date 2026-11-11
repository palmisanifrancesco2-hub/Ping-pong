# Ping Pong Analytics

## Stato corrente — sistema predittivo v17

Inventario reale, benchmark cronologici su 14 target e 1.804 incontri, confronto separato con quote as-of e motore matematico coerente aggiunti. Statistiche modello mostra i report; le classifiche A probabilità, B valore e combinata accettano **bet365 anche senza requisito ADM**, mantenendo dominio e provenienza. Restano necessarie validazione indipendente del modello ed EV positivo anche prudente: nessuna opportunità operativa viene forzata. Eventi, giocatori e ricerca sperimentale restano consultabili.

[Avanzamento delle dieci fasi](docs/AVANZAMENTO-SISTEMA-PREDITTIVO.md) · [Inventario dati](docs/INVENTARIO-DATI-V16.md) · [Benchmark e quote](docs/BENCHMARK-AVANZATO-V16.md) · [Motore coerente](docs/MOTORE-COERENTE-V16.md) · [Istruzioni operative](docs/OPERATIVITA-SISTEMA-PREDITTIVO.md).

Le sezioni successive conservano la cronologia del progetto; in caso di indicazioni superate vale questo stato corrente e la policy v17. Nessun modello è stato promosso sulla sola base del minimo nello storico. Il training automatico dei candidati è collegato al cron giornaliero esistente; dati insufficienti o tentativi falliti sono registrati e nessun modello viene promosso automaticamente. [Funzionamento e controlli](docs/ADDESTRAMENTO-CONTINUO-V17.md).

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

Timeout, schema, identità evento/selezione, errori, dimensione del payload e timestamp sono controllati lato server. In errore il client rimuove la vecchia risposta; nessun fallback a quote inventate. Accesso privato obbligatorio; dopo il login vengono caricati automaticamente gli eventi reali in Partite e mercati. Ricerca per giocatore, campionato o ID evento.

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

La ricerca successiva introduce nove regressioni logistiche su punti, set,
forma e scontri diretti. Su 385 nuovi eventi utilizzabili, il candidato scelto
ottiene Brier 0,247901 e 55,32% di esiti corretti, ma non supera Elo sullo stesso
campione né i controlli di stabilità. Sono state inoltre congelate 304 previsioni
prima dell'inizio previsto degli eventi, con manifesto di integrità in Git e dati
individuali esclusi dal repository. Dettagli in
[docs/RICERCA-PUNTEGGI.md](docs/RICERCA-PUNTEGGI.md). Nessuna validazione automatica
e nessuna raccolta periodica attivata.

La classifica v4 confronta **15 modelli sulle stesse 784 partite**, in cinque
finestre temporali e nove giorni. Primo per Brier aggregato: logistica completa
λ=0,001 (0,246657; 57,65% corretti), seguita da Elo K=10 (0,246808).
Il vantaggio sul secondo non è statisticamente convincente e, dando uguale peso
ai giorni, prevale Elo K=10. Classifica e incertezza sono visibili in
**Statistiche modello**; metodo in [docs/CLASSIFICA-MODELLI.md](docs/CLASSIFICA-MODELLI.md).
Il confronto è esplorativo su uno storico già studiato; nessuna promozione
automatica e nessuna modifica alle 304 previsioni future congelate.

Su richiesta del proprietario, l'obiettivo da 5.000 è stato ridotto a **3.000
partite**. Il nuovo confronto è completato: 15 modelli sugli stessi 3.000 casi,
11 giorni e cinque finestre. Primo per Brier: modello completo λ=0,001
(**0,247647; 53,77% corretti, 1.613/3.000**). Il campione da 5.000 non è stato
completato e la sua raccolta è stata fermata. Il report attivo in Statistiche
modello è ora quello da 3.000; dettagli in [docs/TEST-3000.md](docs/TEST-3000.md).

### Flussi applicativi completati

Le otto sezioni ora collegano navigazione, dati e azioni: modello completo per
stime prematch sperimentali, registrazione esplicita nello storico, statistiche
sulle registrazioni con esiti della fonte separati da quelli confermati, scelte
personali, simulatore Kelly disattivabile e diario manuale delle puntate reali in
Supabase. Le puntate del diario sono esclusivamente inserite dall'utente: nessuna
esecuzione su bookmaker. Collegamenti mostra i controlli dei servizi principali;
The Odds API resta opzionale.

211 test in 27 file, TypeScript, build e flusso browser su tutte le sezioni
verificati. Nel collaudo browser sono reali soltanto feed, risultati pubblici e
calcoli; account e salvataggi privati sono isolati. Nessuna nuova migrazione.
Dettagli e limiti in [docs/SEZIONI-FUNZIONANTI.md](docs/SEZIONI-FUNZIONANTI.md).
Le stime restano non validate; pronostici live e altri mercati non vengono inventati.

## Test prospettico durante l’uso dell’app

Raccolta cloud giornaliera con protocollo e pesi congelati, previsioni virtuali separate dalle scelte personali e controllo in Statistiche modello. [Regole, criteri e limiti del test](docs/TEST-PROSPETTICO.md). 216 test in 28 file, TypeScript/build superati; browser locale verifica tutte le otto sezioni su Android/desktop con fonte reale e salvataggi isolati.

## Quote selezionate e controlli mobile

The Odds API rimossa dalla navigazione. Vista principale con sole quote di valore prudente positivo, una per evento e ordinate per probabilità stimata decrescente, percentuale/quota/EV in evidenza. Aggiornamento manuale della fonte e pulsanti fissi di chiusura; eventi e statistiche separati. [Comportamento attuale](docs/SEZIONI-FUNZIONANTI.md). Test prospettico e pesi congelati invariati.

## Ensemble, pannelli persistenti e profili

La partita aperta conserva statistiche e posizione durante polling, variazioni di convenienza ed errori. Disponibile un ensemble sperimentale di tre modelli, distinto dal modello del test congelato; confronto storico di 7 candidati su 1804 casi comuni con almeno 30 precedenti per giocatore. Nuovi target primo set/totali set testati ma non attivati perché non superano i criteri. Fonte aggiuntiva Wikidata CC0 per profili pubblici compatibili, con copertura parziale e identità da verificare. [Risultati, fonti e limiti](docs/MULTI-MODELLO-E-PROFILI.md).

## Test dedicati per Over/Under e handicap

Quattro famiglie confrontate su 1804 casi comuni, con target distinti per 14 risultati. Candidati fissati sullo storico prima di esaminare 249 partite successive verificate, mantenendo le caratteristiche ferme al giorno precedente. Alcuni handicap sono promettenti; nessun nuovo modello supera tutti i criteri, soprattutto i 500 casi richiesti e la conferma su più giorni. Nessuna nuova probabilità operativa attivata. Report e spiegazione di probabilità/EV nella sezione **Statistiche modello**. [Metodo, risultati e riproduzione](docs/MODELLI-MERCATI-V8.md). Protocollo e modello del test prospettico originale invariati.

Lo storico è ora esteso descrittivamente a **261 casi**, con 12 nuovi incontri verificati e pesi invariati. Aggiunta una raccolta prospettica separata per tutti i 14 target, con probabilità registrate prima degli incontri e controlli fissi a 500/1000/2000/3000 nuove partite e almeno 14 giorni. Usa il cron gratuito esistente e persistenza privata Supabase; nessuna puntata, acquisto, migrazione o attivazione automatica. Conteggi e pulsante in Statistiche modello. [Regole e limiti della continuazione](docs/CONTINUAZIONE-TEST-MERCATI.md).

Il candidato del vincente è ora confrontato con tre alternative già congelate: replay diagnostico sui dati originali e confronto parallelo separato su partite future, con nuove caratteristiche comuni e quote dei due giocatori registrate. Nessuna sostituzione automatica o modifica del test originale. [Revisione del vincente e criteri del confronto](docs/REVISIONE-VINCENTE.md).

## Proiezione dei punteggi e Poisson

Due modelli di proiezione punto→set→partita e un confronto Poisson per i totali sono stati testati sugli stessi 1.804 incontri storici già esaminati. Nessun nuovo candidato dimostra ancora un vantaggio oltre l’incertezza sui migliori precedenti. Risultati aggregati e spiegazione disponibili in Statistiche modello, senza modificare i modelli operativi o i test prospettici. [Metodo, risultati e limiti](docs/PROIEZIONE-E-POISSON.md).


Combinazioni della proiezione: 18 miscele a pesi fissi confrontate sugli stessi 1.804 incontri storici. Per il vincente completo + proiezione dà 992 corretti, contro 971 del completo e 996 della proiezione. Piccoli miglioramenti del Brier non dimostrano ancora superiorità rispetto a tutti i componenti o profitto. Risultati in Statistiche modello. [Metodo, diversità e limiti](docs/COMBINAZIONI-PROIEZIONE.md).


Studio v13: pesi della combinazione appresi solo dalle previsioni e dagli esiti disponibili nei giorni precedenti. Su 1.291 casi comuni, peso + temperatura dà 724 corretti contro 719 della media fissa, ma Brier peggiore. Sei giorni insufficienti per gli intervalli e nessuna promozione. [Fonti online, metodo e risultati](docs/STUDIO-TEMPORALE-V13.md).


Nuove fonti gratuite scaricate: 10.292 righe WTT e 7.851 Setka, oltre ai 23.596 risultati MoviOdds già disponibili. Audit trova duplicati, incongruenze di date e formato; non equivale a 10.000 test validati. [Fonti, numeri effettivi e condizioni per lo studio](docs/DATI-PER-10000-PARTITE.md).


Addestramento WTT eseguito: quattro modelli (logistica/boosting per uomini e donne), 2.284 casi di training, 2.178 di calibrazione e 2.203 di test 2025 distinti. Logistica 1.540 corretti / 663 errati, 69,90%; Elo 69,00%, vantaggio non confermato dagli intervalli per coorte. Date-only con ritardo convenzionale: nessuna validazione sui campionati dell’app o profitto. [Metodo, risultati e artefatti](docs/ADDESTRAMENTO-WTT-V15.md).
