# Benchmark avanzato v16 — esecuzione 7 novembre, confronto quote 11 novembre 2026

Questo lavoro ha realmente addestrato e salvato **16 artefatti** per il benchmark principale e **due artefatti** per il confronto con quote as-of. Si tratta di ricerca esplorativa su un archivio già esaminato, con separazione temporale; non è una nuova validazione indipendente, né una promozione del modello operativo.

## Benchmark principale: dati, parametri e controlli

Protocollo `research/protocol-v16-benchmark.json`, dati `.research-data/market-v8-features.json` e snapshot MoviOdds originale. Hash e versioni Python/numpy/scipy/sklearn/joblib sono nel report. Ogni etichetta dei 14 mercati è ricalcolata dai set e confrontata con il dataset. 63 caratteristiche causali: forza Elo, forma, set, punti, H2H regolarizzati, riposo/carico e statistiche per competizione. Si richiedono almeno 30 precedenti per ciascun giocatore; si conservano soltanto orari e ID già verificati dalla ricerca precedente.

Quattro finestre effettive, **1.804 ID di test comuni**, nove giorni. Prima di ogni finestra: training sul passato, primo giorno successivo per scegliere gli iperparametri, secondo giorno per calibrare le probabilità e scegliere la famiglia, poi test. Esiti tardivi non entrano nel training/tuning/calibrazione prima della loro disponibilità. Le previsioni di test appartengono alla finestra della previsione anche quando il risultato si rende disponibile dopo il suo termine; per valutarle vale lo snapshot finale dichiarato del 5 novembre.

Un primo avvio escludeva erroneamente 14 esiti di test arrivati dopo il termine della loro finestra intermedia: prima di esaminare le prestazioni sono stati conservati privatamente report e artefatti e corretto soltanto quel limite di assestamento. La correzione è registrata nel protocollo; soglie e configurazioni non sono state scelte usando i risultati.

Modelli eseguiti: frequenze gerarchiche regolarizzate, regressione logistica, HistGradientBoosting, Random Forest multioutput e Bradley–Terry per il vincente. Due configurazioni predefinite per famiglia, scelte sul giorno di tuning. Le configurazioni scelte sono riaddestrate sui dati anteriori al giorno di calibrazione. Bradley–Terry usa forze dei giocatori distinte per competizione, penalizzate, su risultati BO5 già disponibili prima del limite; giocatori non visti hanno forza zero. I tempi di addestramento/predizione, parametri selezionati e pesi di calibrazione sono registrati per ogni finestra. Tempo complessivo del benchmark: circa 31,5 secondi nell’ambiente indicato dal report.

CatBoost, LightGBM e XGBoost non erano installati e **non sono stati eseguiti** in questo benchmark a budget controllato. Non viene dichiarata equivalenza fra HistGradientBoosting e quelle librerie. Nessuna rete neurale è stata introdotta senza evidenza o dati aggiuntivi.

## Risultati del vincente sugli stessi 1.804 incontri

| Famiglia | Corretti | Sbagliati | Accuracy | Brier | Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frequenza di competizione | 916 | 888 | 50,78% | 0,250108 | 0,693364 |
| Elo | 985 | 819 | 54,60% | 0,249582 | 0,692518 |
| Gerarchico regolarizzato | 977 | 827 | 54,16% | 0,247922 | 0,688957 |
| Logistica | 977 | 827 | 54,16% | 0,248474 | 0,690170 |
| HistGradientBoosting | 966 | 838 | 53,55% | 0,249134 | 0,691474 |
| Random Forest | 964 | 840 | 53,44% | 0,248185 | 0,689486 |
| Bradley–Terry | 965 | 839 | 53,49% | **0,247365** | **0,688011** |

Bradley–Terry ha il Brier più basso **fra questi candidati in questo protocollo**; Elo indovina più esiti. Non è il migliore dell’intero progetto: alcuni precedenti candidati esplorativi hanno Brier inferiori. Scegliere retroattivamente il minimo non crea una validazione indipendente.

## Altri mercati

Sono valutati 14 target: vincente, primo set, punti primo set 19,5, totali set 3,5/4,5, punti partita 74,5/79,5/84,5 e handicap set ±1,5 / punti ±5,5 / ±9,5. Under e selezioni opposte possono essere complementi sulle linee a mezzo punto; ciò non certifica tutte le altre linee.

Il report completo `research/report-v16-benchmark.json` contiene ogni candidato, numerosità, accuracy, Brier, Log Loss, curve di calibrazione, ECE, copertura delle decisioni, metriche per competizione e intervalli appaiati in blocchi di tre giorni. La correzione comprende 62 confronti. Il selettore per mercato usa il giorno di calibrazione prima del test e la sua prestazione è riportata separatamente dal miglior risultato scelto a posteriori. `operationalWinner` rimane null per tutti i mercati.

I modelli diretti e la calibrazione separata per target non assicurano una distribuzione congiunta coerente tra ogni mercato: queste percentuali non sono state collegate a pronostici operativi. Le metriche per competizione hanno spesso campioni piccoli e sono descrittive. Le quote non sono presenti nelle righe del benchmark principale: il confronto seguente usa un sottoinsieme separato, senza alterare i 1.804 ID.

## Confronto separato con quote realmente as-of

Il controllo delle cache closing ha trovato **153** coppie di quote esatte, pre-close, non sospese, con timestamp entro il momento di decisione (un minuto prima del kickoff) e anzianità massima di cinque minuti. Gli ID coincidono con le caratteristiche originali e `featuresAvailable < decisionTime`. Il campo `at` delle caratteristiche è già il limite kickoff−60 secondi: non si sottrae un secondo minuto.

Fonte bet365.com.au tramite MoviOdds, probabilità normalizzate mediante `(1/quotaA) / ((1/quotaA)+(1/quotaB))`; margine e probabilità grezze rimangono distinti. Non è stata verificata autorizzazione ADM per quel sito.

Protocollo separato `research/protocol-v16-odds.json`: **29** eventi di training anteriori al 30 ottobre, **35** di calibrazione fino al 2 novembre, **88** di test nei tre giorni successivi; una riga tardiva non entra nei blocchi di training/calibrazione. Sono confrontati logistica sulle prime otto caratteristiche sportive, logistica che aggiunge il logit della probabilità bookmaker, e il bookmaker normalizzato da solo. Specchiando i giocatori i dati di training diventano 58 righe numeriche, ma restano **29 eventi indipendenti**.

La calibrazione sceglie contrazione zero per entrambi i candidati: lo sport-only ritorna 50% e si astiene su tutti gli 88 casi; sport+quote ritorna esattamente la probabilità del mercato. Quindi **non è osservato alcun contributo predittivo aggiuntivo delle statistiche rispetto al mercato in questo esperimento**.

| Metodo | Brier | Log Loss | Corretti / sbagliati / indecisi |
| --- | ---: | ---: | --- |
| Sport-only calibrato | 0,250000 | 0,693147 | 0 / 0 / 88 |
| Sport + quote calibrato | 0,247814 | 0,689432 | 45 / 37 / 6 |
| Mercato normalizzato | 0,247814 | 0,689432 | 45 / 37 / 6 |

L’accuracy del mercato è 45/82 = 54,88% **fra gli esiti decisi**; la copertura è 82/88 = 93,18%. Non è 54,88% di tutti gli 88 casi. Con tre giorni non si calcolano gli intervalli: il minimo di sette giorni resta invariato. Campione piccolo e selezionato sulla copertura delle quote, esiti storici già noti da altri studi; nessuna conclusione forte o operativa. ROI non disponibile (`null`), non zero osservato: mancano garanzia di eseguibilità e qualificazione ADM del sito. Report `research/report-v16-odds.json`.

Il supplemento immutabile `research/report-v16-odds-slices.json` descrive gli stessi 88 eventi per competizione, giorno e fasce di quota fisse della selezione favorita dal mercato: sotto 1,30; 1,30–1,50; 1,50–2,00; 2,00–3,00; da 3,00 in su. Le sei parità non ricevono una selezione o una quota favorita. Sono intervalli di visualizzazione scelti per leggibilità, non soglie scientifiche o filtri ottimizzati; non introducono nuovi eventi o risultati di test. Il supplemento non modifica modello o report principale. Nel confronto quote il tempo di fitting non è stato misurato separatamente; non viene inventato un valore, mentre i tempi per il benchmark principale sono effettivamente registrati.

## Riproduzione e gestione dei modelli

1. Installare le versioni scientifiche fissate in `research/requirements.txt` in un ambiente Python dedicato. Nessuna di queste dipendenze viene importata nel browser o nelle funzioni Vercel.
2. Conservare gli archivi originali nelle posizioni dichiarate dai protocolli e confrontarne gli hash. Le esportazioni individuali restano escluse da Git.
3. Eseguire `python -m unittest discover -s scripts -p 'test_*.py'`.
4. Per una **nuova versione** del benchmark, congelare un nuovo protocollo e nuovi nomi di report/artefatti, quindi eseguire `python scripts/run-advanced-benchmark.py`. Il programma rifiuta di sovrascrivere report e modelli già esaminati: non cancellarli per cercare una prestazione migliore.
5. Il confronto quote usa `python scripts/benchmark-asof-odds-v16.py` e l’esportazione privata qualificata. Anche qui una nuova ricerca richiede versioni nuove.
6. Gli artefatti joblib sono salvati in `.research-data/advanced-v16-fold-*.joblib` e `.research-data/v16-asof-*.joblib`, permessi 0600. Hash e dimensioni sono nei report. Non caricare artefatti joblib di provenienza non fidata: il formato può eseguire codice.
7. Non sostituire il modello operativo con un file di ricerca. Occorrono inferenza equivalente verificata, compatibilità della competizione, nuove previsioni prospettiche, confronto con il modello corrente, controlli di calibrazione e provenienza, stato ADM della quota e versione di rollback. Nessuna sostituzione automatica è stata eseguita.

I test specifici verificano separazione dei blocchi, esclusione degli esiti tardivi dal fitting, calibrazione senza valori non finiti, conteggi di indecisi e metriche probabilistiche. Audit privati e hash dei report verificati; gli ID sono unici. Nessuna credenziale, puntata reale, acquisto o modifica dei protocolli prospettici originali.
