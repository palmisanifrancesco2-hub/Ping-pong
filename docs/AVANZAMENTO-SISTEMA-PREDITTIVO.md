# Avanzamento del sistema predittivo — v16

Stato di integrazione aggiornato l’11 novembre 2026. Gli esperimenti v16 e l’inventario sono stati eseguiti sullo snapshot disponibile il 7 novembre; la data della consultazione non aggiorna retroattivamente i dati. Questo documento distingue implementazione, valutazione esplorativa e validazione indipendente.

| Fase | Risultato concreto | Stato / limiti |
| --- | --- | --- |
| 1 · Repository e fonti | Stack React/TS, backend Node, Supabase Auth/RLS, migrazioni, cron, CSV/JSON, provider e archivi ispezionati. The Odds API esiste come diagnostico server, non alimenta i pronostici attuali. | Completata sui file locali. Nessuna lettura di chiavi o impersonificazione del proprietario. DB remoto verificabile solo tramite server autorizzato. |
| 2 · Quantità e mercati | Inventario v16 con righe, giocatori, competizioni, campi mancanti, timestamp, incongruenze e fattibilità dei mercati. | 23.596 risultati nello snapshot principale; archivi sovrapposti non sommati. 3.845 inizi verificati in cache, 269 coppie storiche di quote compatibili, 153 allineate alle caratteristiche. Dati riportati, non certificazione ufficiale indipendente. |
| 3 · Dataset temporale | 63 caratteristiche causali già disponibili, ID unici, esiti ricostruiti e verificati. Finestre separate per addestramento, tuning, calibrazione e test. | 1.804 incontri comuni; archivio già studiato, quindi test temporale esplorativo. Nessuna nuova validazione indipendente. |
| 4 · Baseline | Frequenze regolarizzate, Elo e Bradley–Terry. | Eseguiti realmente, con metriche sugli stessi casi. |
| 5 · ML | Logistica, gradient boosting e random forest multioutput. 16 artefatti privati addestrati per le finestre valide. | Ricerca contenuta sui parametri; CatBoost/LightGBM/XGBoost e reti neurali non eseguiti in questo budget. Nessuna prestazione attribuita a librerie non eseguite. |
| 6 · Ottimizzazione | Iperparametri sul primo giorno di validation, calibrazione sul secondo, test successivo. Selettore per mercato sceglie la famiglia solo sulla calibrazione. | Le probabilità di modelli diretti separati non garantiscono coerenza tra mercati. Motore strutturale coerente aggiunto e testato separatamente. |
| 7 · Backtest | Metriche, calibrazione, risultati per competizione e intervalli a blocchi giornalieri su 14 target. | Il confronto con quote as-of è un sottoinsieme distinto; nessun ROI inventato o quote di chiusura trattate automaticamente come prezzi disponibili. Nuovo test futuro indipendente ancora necessario. |
| 8 · Classifiche | A probabilità, B valore, combinata con pesi configurabili; tutte con EV positivo anche prudente come già richiesto; quota minima 1,30 e nessun massimo. | Vincoli ADM e validazione indipendente applicati server-side. Il feed bet365.com.au non è equiparato a bet365.it. Nessuna selezione è forzata. |
| 9 · App | API privata /api/prediction-system, inventario/benchmark/calibrazione in Statistiche modello, classifiche nella vista quote. Eventi e analisi conservati. | Modello operativo e protocolli prospettici originali invariati. Le nuove famiglie restano di ricerca. |
| 10 · Qualità e consegna | Test Python/TS, ESM compilato, HTTP con autorizzazione, Chromium Android/desktop e istruzioni riproducibili. | Verifiche e pubblicazione registrate qui sotto quando concluse. Nessuna garanzia di profitto o accredito di una nuova validazione. |

## Aggiornamento e versioni

`src/domain/model-governance.ts` implementa revisione configurabile per intervallo/nuovi dati e monitoraggio del Brier/Log Loss, con minimo di casi per l’avviso. Sono soglie operative, non test di significatività. La funzione non aggiorna i pesi dopo ogni partita e non promuove mai automaticamente un modello. Le versioni precedenti restano in Git e nei manifest di artefatti. Il cron gratuito esistente continua raccolta ed esiti prospettici, indipendentemente dalle classifiche ADM.

Il training Python gira nell’ambiente di ricerca, non dentro una richiesta web o ad ogni esito. L’esecuzione periodica automatica del training non è attivata: manca un flusso cloud di dataset versionati con una nuova coorte finale indipendente e un ambiente Python schedulato collegato in modo sicuro. La revisione periodica e il monitor sono implementati; non sono un job di training già avviato. Il report mostra esplicitamente quando conteggi remoti nuovi e metriche recenti di drift non sono disponibili, senza inventare zero nuovi risultati.

## Blocchi da risolvere per promuovere nuovi mercati

- Nuove partite mai usate per scegliere modello, iperparametri o regole.
- Regole prematch del formato e timestamp di pubblicazione verificabili; il campo best_of WTT presenta errori.
- Quote italiane del sito esatto e verifica ADM con provenienza e scadenza. Il registro ADM non è raggiungibile in questa sessione con fetch diretto (403); i risultati indicizzati non autorizzano a convertire il dominio estero in italiano.
- Copertura storica as-of sufficiente e verificabile per valutare quote, fasce, ROI e CLV. Una presenza nella cache non prova prezzo eseguibile.
- Input reali del modello dei punti e sua validazione: il modulo coerente garantisce regole e somme, non la qualità di una probabilità assunta.

Nessuna credenziale deve essere pubblicata o incollata in chat. Nessun acquisto, nuova migrazione o scommessa automatica è necessario per le parti già implementate.

## Verifiche locali concluse — 11 novembre 2026

264 test applicativi in 37 file e 28 test Python passati. TypeScript, build Vite e avvio Node ESM compilato riusciti: health 200 e nuovi/precedenti endpoint anonimi 401 senza chiamate esterne. Chromium con vero handler locale, report aggregati reali e identità QA sintetica isolata: 14 mercati, tre classifiche, modifica pesi, rifiuto dei prezzi esteri, errore 503 e recupero, Android 393×851 e desktop 1440×1000, zero errori JavaScript o overflow. Il board vuoto è una fixture QA; nessuna sessione del proprietario o scrittura remota è stata usata. Non certifica il login del telefono in produzione. La CI aggiunge i controlli Python con dipendenze fissate; nessun dataset privato è necessario ai test unitari.

Confronto quote as-of concluso: 153 osservazioni compatibili, 29 training / 35 calibrazione / 88 test su tre giorni. Il modello combinato coincide con il mercato dopo la calibrazione: nessun incremento sportivo dimostrato. Il supplemento per fasce quota/competizione/giorno è descrittivo, non una nuova selezione dei parametri. Nessuna nuova validazione o promozione.

## Pubblicazione verificata — 11 novembre 2026

Commit applicativo finale `1c3be9f12a312a8b383937dded26cb45ec18e839`, deployment Production `dpl_5srpJAgVandVp9WVq84dkyzav5xy` READY. Alias https://ping-pong-ping-pong3.vercel.app assegnato al deployment finale, health protetto HTTP 200, avvio server ESM anche su Node 26.13.0. CI GitHub push/PR superata, inclusi i test Python aggiunti. Ricerca nei log Production level:error degli ultimi dieci minuti senza risultati; non equivale a monitoraggio continuo o verifica del login reale del proprietario. Nessuna protezione rimossa.

La versione iniziale `d4c9994` è stata seguita dalla policy finale che conserva EV positivo anche prudente in tutte le classifiche, oltre a ADM e validazione indipendente. I dati grezzi e gli artefatti binari non sono stati pubblicati. Nessuna nuova migrazione, spesa, credenziale o scommessa.

### Fotografia prospettica verificata alle 10:29:45 UTC

Studio v9 originale: **700 incontri registrati**, **603 valutati**, **94 in attesa**, **3 non validi**, sette giorni osservati. Sul vincente del candidato v9: **307 corretti e 296 errati (50,91%)**. I non validi rimangono nel registro e nei controlli conservativi; non sono eliminati per migliorare le prestazioni.

Studio v10 separato: **426 registrati**, **347 valutati**, **75 in attesa**, **4 non validi**, sette giorni. Sui medesimi 347 incontri:

| Modello/riferimento | Corretti | Errati | Non decisi | Brier | Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Gerarchico corrente | 184 | 163 | 0 | 0,245350 | 0,683713 |
| Completo | 196 | 151 | 0 | 0,245489 | 0,684316 |
| Punti/set | 189 | 158 | 0 | 0,243939 | 0,680737 |
| Contesto | 188 | 159 | 0 | 0,245739 | 0,684548 |
| Bookmaker no-vig | 192 | 124 | 31 | **0,233314** | **0,658033** |

Il mercato resta migliore in Brier/Log Loss dei quattro candidati. La sua accuracy sui soli decisi è 192/316, non 192/347; Brier e Log Loss usano tutti i 347 casi. Non si confronta direttamente il tasso v9 sui 603 con quello v10 sui 347: sono coorti diverse. Non è stato raggiunto alcun checkpoint valido con durata minima richiesta; nessun modello validato o promosso. Questi dati nuovi sono separati dai 1.804 incontri del benchmark storico v16 e dagli 88 del sottoinsieme quote. I nuovi modelli v16 non vengono presentati come già valutati su questa coorte futura originale.


## Aggiornamento v17 — bet365 e training candidati

L’ultima istruzione dell’utente rimuove ADM come requisito obbligatorio. Le quote bet365.com.au sono ammesse nelle classifiche senza cambiare il loro dominio; rimangono freschezza, confrontabilità, EV positivo anche prudente e validazione indipendente dei modelli. I riferimenti v16 ad ADM sopra descrivono lo stato precedente, non il filtro corrente.

Il training già eseguito nei precedenti studi e la raccolta prospettica non erano stati disattivati. Mancava l’esecuzione periodica automatica dei nuovi addestramenti. Questa versione collega un servizio di training candidati al cron esistente e al bootstrap Production, con comando manuale riservato al proprietario. Applica claim atomico giornaliero, controlli sulle osservazioni originali, finestre cronologiche distinte e persistenza privata. Non avvia servizi a pagamento, non cambia gli studi congelati e non promuove automaticamente un modello. [Contratto, minimi e limitazioni](ADDESTRAMENTO-CONTINUO-V17.md).


## Rilascio v17 verificato — 11 novembre 2026

Commit applicativo `4acf8c2ad955962a5e5e34fe05a9b1d3318a6c97`, deployment Production `dpl_GUmdNURermsaYEpiLDhS6AsAxFqi` READY. Alias https://ping-pong-ping-pong3.vercel.app collegato al deployment; health HTTP 200 verificato alle 11:21 UTC, nessuna voce nella ricerca runtime level:error degli ultimi dieci minuti. CI push/PR superata sullo stesso SHA: 38 file di test applicativi e 28 test Python, TypeScript, build Vite e avvio server ESM compilato. Avvio cloud verificato anche con Node 26.13.0.

ADM non è più obbligatorio: bet365 è ammesso con dominio originale e provenienza verificata. Rimangono i controlli statistici, temporali e di EV positivo. QA browser locale con handler reale e autenticazione/stato training sintetici isolati: Android 393×851 e desktop 1440×1000, nessun overflow o errore JavaScript; pulsante training, autorizzazione, report e recupero errori verificati. Questo non certifica il percorso autenticato del proprietario in produzione; nessun suo JWT è stato usato.

Prima esecuzione reale del training salvata in Production: **362 training / 87 calibrazione / 96 test**, candidato full con temperatura 0,5; 46 corretti e 50 errati, Brier 0,251049 contro 0,248510 del riferimento sulle stesse 96 partite. Nessuna promozione automatica o dimostrazione di vantaggio. Raccolta esistente alle 11:18 UTC: 700 registrati, 607 settled, 90 pending, tre invalidi, sette giorni. Nessuna nuova migrazione, chiave, spesa o modifica dei protocolli congelati. [Risultati e limiti del training](ADDESTRAMENTO-CONTINUO-V17.md).


## Benchmark v18 — CatBoost, NGBoost e normalizing flow

Completate analisi input, protocollo temporale, installazione isolata, training reale e valutazione: 1.804 incontri comuni su nove giorni, 14 mercati per i due classificatori, sette mercati punti per il flow e 12 artefatti privati. CatBoost 946 corretti/858 errati sul vincente, NGBoost 936/868; gerarchico precedente 977/827. Nessun nuovo modello supera il migliore Brier precedente sul vincente; miglioramenti locali rispetto alla frequenza di competizione non superano tutti i modelli già studiati. Nessuna validazione indipendente, ROI o promozione. Training giornaliero e app invariati. [Protocollo, risultati completi, limiti e riproduzione](CONFRONTO-PROBABILISTICO-V18.md).


## Audit del 17 novembre 2026 — fonte ora autenticata

Verificati entrambi gli endpoint MoviOdds: HTTP 401 / API key required. Documentazione corrente richiede X-API-Key; connettori del commit di produzione 7abd3a0 non lo inviano. Piano gratuito pubblicizzato limitato; nessuna garanzia di tutti i mercati o polling continuativo a 30 secondi. Ricontrollati 23.596 risultati principali, unione non duplicata 23.670, 2.168 feature row e 153 coppie quote allineate senza errori osservati. WTT e Setka mantengono i limiti già documentati. Nessun nuovo training o modello promosso. Lettura privata corrente bloccata dalla revisione automatica della diagnostica con credenziali di produzione; nessuna build avviata. Ultimo snapshot verificato resta 12 novembre (800/730/67/3), non dato attuale. [Rapporto, dati mancanti e azioni necessarie](VERIFICA-DATI-2026-11-17.md).


## Ripristino autenticazione MoviOdds

Dopo la conferma del salvataggio della chiave privata in Vercel, implementato header X-API-Key server-side per board, risultati, discovery e closing, senza esposizione al browser. Blocco di domini estranei/redirect e stop dei cicli su 401/403 closing senza consumare tentativi individuali. 287 test/41 file, TypeScript, build e smoke ESM passati. Nessuno script di audit privato eseguito; nessun modello o protocollo modificato. Connessione reale e copertura del piano da confermare nel normale rilascio. [Dettagli](VERIFICA-DATI-2026-11-17.md).


## Collegamento ripristinato e rilascio verificato

Commit 82d1360, Production dpl_E1BYD5HUxc9Ymn6KaNwHtN47Q34n READY, alias e health 200. Chiave accettata nei controlli normali: 454 eventi live/futuri, 3.130 voci quota; archivio 33.934 risultati accettati e 1.329 righe rifiutate. Raccolta originale ripresa con 100 catture e 97 esiti aggiornati, zero errori di fonte. v9 attuale 1.200/1.057 settled/140 pending/3 invalidi, 12 giorni; vincente 562 corretti e 495 errati. Training oggi già tentato, nessun nuovo fitting o promozione. v10 separato su 748 esiti mantiene Brier bookmaker 0,229301 migliore del completo 0,242154. [Rilascio, dati e limiti](VERIFICA-DATI-2026-11-17.md).


## Test aggiuntivo v20 — modelli congelati, 249 casi distinti

Completata una verifica retrospettiva sui 249 incontri di conferma già disponibili, nessun overlap con i 2.168 ID principali. Sette artefatti verificati con hash, nessun fitting o ricalibrazione, due pool a pesi fissi e 14 mercati. Vincente: Random Forest 144/105 (57,83%); CatBoost e NGBoost 141/108 (56,63%); pool 139/110. NGBoost ha Brier più basso (0,241101), senza nuovo vincitore operativo. Una sola giornata già esaminata in studi precedenti: nessuna validazione indipendente. Solo 28 coppie quote valide, niente ROI. Totali punti dei nuovi candidati coincidono con il riferimento dopo shrinkage congelato a zero. 33 test Python passati, nessun nuovo costo, runtime o cron cambiato. [Rapporto e limiti](TEST-CONGELATI-V20.md).


## Studio v21 — rete neurale e distribuzione coerente dei set

Completati protocollo temporale, fitting reale di 24 modelli (tuning/refit), otto artefatti privati, distribuzioni coerenti sui sei esiti BO5 e confronto di cinque mercati derivati. Stessi 1.804 casi principali/9 giorni e 249 di controllo, già esaminati: nessuna nuova validazione indipendente. Vincente principale: CatBoost 953 corretti/851 errati, MLP 903/901; nessuno supera il migliore Brier binario precedente. Pool risultato esatto 362/1.804 contro 343 del riferimento, senza miglioramento robusto del Brier. Sul controllo CatBoost 138/249 sul vincente e 60/249 sul risultato esatto. Nessun nuovo modello operativo, ROI, costo o cambiamento del cron. [Report, test e limiti](STUDIO-COERENTE-V21.md).


## Quote dei pronostici corretti/sbagliati — v22

Calcolate medie, mediane, estremi e differenze delle quote del lato realmente previsto dai modelli, con esiti corretti/sbagliati separati. Solo vincente, 88 incontri as-of principali e 28 del controllo, senza sovrapposizioni; non 116 nuove partite. Politiche complete, quota≥1,30 ed EV nominale positivo riportate separatamente, nessun massimo. Esempio principale filtrato: CatBoost coerente 21 corretti/quota media2,394, 13 errati/media2,438; rete23/media2,452 contro18/media2,646. Nessun ROI verificato, fitting, chiamata provider o modifica dell’app. [Tutte le tabelle e limiti](QUOTE-CORRETTI-SBAGLIATI-V22.md).


## v23 — quote dei pronostici prospettici nell’app

Usato il ledger v10 che già salva prezzi originali e quattro previsioni contemporanee: nuovo aggregatore owner-only con medie, mediane, differenza corretti/sbagliati, periodi fino a un anno e filtri min1,30/EV positivo, senza massimo. Contatori per dati mancanti, invalidi, duplicati e pareggi; nessun prezzo ricostruito o modello nuovo. Nuova sezione richiudibile e ricaricamento senza perdita di apertura/filtri. 293 test in42 file, TypeScript, build, smoke ESM e QA Android/desktop passati; nessun cambio ai protocolli congelati o nuove richieste provider. [Dettagli e limiti](QUOTE-PROSPETTICHE-V23.md).


## v23 pubblicata e dati del 18 novembre verificati

Production dpl_ACXuqPsNw6BWrWZY43oeimFBc8nn READY (c735d47), alias e health200. Sezione quote corretti/sbagliati utilizzabile nell’app; CI entrambe superate. v9 1.300 registrati/1.109 settled/185 pending/6 invalidi, 13giorni. v10 distinto980/800/173/7: 800 esiti con quote utilizzabili, nessun duplicato/mancante. Filtro quota≥1,30/EV>0: completo136 corretti/media1,946 e158 sbagliati/media2,110; saldo ipotetico−29,391unità. Tutti e quattro i saldi filtrati negativi; nessun vantaggio dimostrato, nuovo modello o ROI verificato. [Dettagli e aggregati](QUOTE-PROSPETTICHE-V23.md).

## Combinazioni tra bookmaker e modelli sportivi

Confrontate quattro famiglie con cinque pesi fissi su 88 e 28 incontri storici con prezzi prematch. Le miscele migliorano i punteggi probabilistici medi sui due campioni, con risultati variabili per giorno. Con peso sportivo del 10% o 25% nessuna selezione supera il filtro EV. Con quattro soli giorni già studiati, il miglioramento resta esplorativo. [Risultati e limiti](STUDIO-BOOKMAKER-V24.md).

## Verifica su Setka 2022

Archivio SCORE distinto, 7.843 partite dopo i controlli. Sul test cronologico di 2.077 partite, la logistica ottiene 1.209 vincitori corretti e Brier 0,23746 contro 0,24356 di Elo. Sul totale set 3,5 la frequenza storica conserva il Brier più basso. Il campione non contiene quote per una verifica di EV o rendimento. [Risultati](STUDIO-SETKA-2022-V25.md).

## Vincente a quote superiori a 2,00

Verificati 170 incontri storici con prezzi prematch. CatBoost coerente ne ha scelti 38 a quota superiore a 2,00 e ne ha indovinati 22. La rete coerente ne ha indovinati 30 su 59 scelti. Il risultato resta descrittivo di campioni già esaminati. [Riepilogo](QUOTE-SOPRA-DUE-V26.md).

## CatBoost coerente su Setka

Confronto cronologico su 2.077 incontri Setka. CatBoost ha indovinato 1.210 vincitori contro 1.209 della logistica, che conserva il Brier migliore. Risultato esatto 446 corretti contro 388 della frequenza storica. Il dataset non contiene quote. [Studio e risultati per mercato](STUDIO-CATBOOST-SETKA-V27.md).

## Replay live del vincente

Sui reali punteggi Setka storici, dopo due set la logistica ha indovinato 1.519 vincitori su 2.077, CatBoost 1.504 e il solo punteggio 1.476. Sul 2–2 il vantaggio non emerge. I modelli sono salvati per ricerca e il replay è privo di quote live abbinate. [Studio e prerequisiti del test live](STUDIO-LIVE-SETKA-V28.md).

## Addestramento live esteso a MoviOdds e Setka

Con 21.089 incontri di training e 5.355 incontri MoviOdds di test, dopo due set la logistica estesa indovina 3.902 vincitori e passa da 0,16192 a 0,16157 di Brier rispetto alla versione MoviOdds. CatBoost esteso ne indovina 3.892. Nessuna quota live abbinata nel replay. [Studio](STUDIO-LIVE-ESTESO-V29.md).

## Verifica prematch dell’addestramento esteso

Applicati i modelli congelati v29 a 261 incontri del 5 novembre successivi alla loro finestra di test. Logistica 153 corretti, CatBoost binario 151. Su 28 partite con quote valide, sopra 2,00 la logistica ne indovina 1 su 2, CatBoost 1 su 1. Campione storico già usato per altri confronti, con selezioni insufficienti per concludere sulla fascia di quota. [Rapporto](TEST-PREMATCH-ESPANSIONE-V30.md).

## Vincente prematch su 10.789 partite

Completato il replay v31 su tre finestre cronologiche disgiunte, ognuna con nuovo training e calibrazione sui giorni precedenti. Logistica 5.927 corretti e Brier 0,24545. CatBoost binario 5.883 corretti e Brier 0,24607. Su 260 gare con quote prematch di entrambe le selezioni, il mercato depurato dal margine ha il Brier migliore. Sopra 2,00 la logistica ne indovina 17 su 50 e CatBoost 19 su 50. Tutti i 42 test Python passati. Il passaggio ancora aperto è la validazione prospettica con quote registrate al momento della previsione. [Rapporto e riproduzione](STUDIO-PREMATCH-10000-V31.md).

## Vincente prematch su 20.449 partite

Completato il replay v32 su sei finestre, con 9.660 partite aggiunte e riproduzione delle tre finestre v31. La logistica indovina 11.051 vincitori (54,04%, Brier 0,24676) e CatBoost 11.002 (53,80%, Brier 0,24701). Sulle sole partite aggiunte CatBoost ha un Brier leggermente migliore. Su 266 partite con quote archiviate, il bookmaker depurato dal margine conserva il Brier più basso. Sopra quota 2,00 la logistica ne indovina 18 su 52 e CatBoost 19 su 51. Tutti i 42 test Python passati. Validazione prospettica ancora aperta. [Rapporto e riproduzione](STUDIO-PREMATCH-20000-V32.md).
