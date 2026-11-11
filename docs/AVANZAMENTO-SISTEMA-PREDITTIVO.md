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
