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
