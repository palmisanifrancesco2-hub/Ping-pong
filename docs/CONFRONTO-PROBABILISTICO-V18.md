# Confronto probabilistico v18 — 11 novembre 2026

## Fase 1–2: dati e copertura

Riutilizzati gli input privati verificati del benchmark v16: 1804 incontri comuni su 9 giorni, 63 caratteristiche e 14 esiti binari ricostruiti dai punteggi. Nessuna nuova partita scaricata: questi casi non si sommano ai 700 del registro prospettico. Hash e percorsi sono nel protocollo. Risultati e timestamp sono quelli dichiarati dalla fonte; non sono stati nuovamente certificati da una fonte ufficiale indipendente.

## Fase 3–4: protocollo ed esecuzione

Protocollo salvato prima del nuovo fitting, configurazioni fisse e budget limitato. Quattro finestre expanding, con un giorno successivo per calibrare e un test ancora successivo. Il primo blocco, privo dei minimi già fissati nel v16, è escluso per tutti i candidati; i restanti 1.804 ID coincidono esattamente con il confronto precedente. Nessuna selezione di parametri, epoche o famiglia sui nuovi esiti di test. Tutti gli iperparametri sono nel protocollo e nello script: NGBoost usa anche un albero base depth=3/min_samples_leaf=15; il flow usa full-batch Adam, clip gradiente 5 e standardizzazione appresa solo sul refit.

| Refit | Calibrazione | Test |
| ---: | ---: | ---: |
| 176 | 174 | 309 |
| 516 | 148 | 449 |
| 872 | 241 | 412 |
| 1299 | 226 | 634 |

CatBoost e NGBoost/Bernoulli: 14 modelli binari per finestra. Flow condizionale: distribuzione congiunta continua di totale e differenza punti, sette mercati a linea fissa. Rumore uniforme di dequantizzazione soltanto nel training; non è un dataset simulato né un risultato sportivo inventato. 2.048 campioni Monte Carlo per evento: errore standard massimo teorico della frequenza circa 1,10 punti percentuali, senza includere errore di modello. Le soglie sono applicate direttamente alla distribuzione dequantizzata; nessun arrotondamento. Il flow non impone parità dei punti o traiettorie legali del match: limite importante per l’uso operativo.

Calibrazione: miscela con riferimento empirico per competizione, peso scelto sul solo giorno di calibrazione tra 0 / 0,25 / 0,5 / 0,75 / 1. Il peso zero significa nessun contributo del candidato. Il report contiene sempre anche le metriche grezze; i risultati calibrati non devono essere attribuiti interamente alla nuova libreria. Le teste dirette e la calibrazione separata possono perdere coerenza congiunta tra mercati.

## Fase 5: risultati su tutti i mercati

Brier più basso è migliore. Accuracy: scelta della selezione più probabile tra evento e complementare; non è automaticamente la frequenza dell’Over o dell’handicap indicato. Nessuna quota storica eseguibile in questo campione: EV/ROI non calcolati.

| Mercato | Riferimento Brier | CatBoost | NGBoost | Flow |
| --- | ---: | ---: | ---: | ---: |
| winner | 0.250108 | 0.248516 | 0.248615 | Non applicato |
| first-set | 0.249883 | 0.250208 | 0.249943 | Non applicato |
| first-set-points-over-19.5 | 0.218552 | 0.218181 | 0.218781 | Non applicato |
| sets-over-3.5 | 0.202334 | 0.203030 | 0.202645 | Non applicato |
| sets-over-4.5 | 0.218531 | 0.218645 | 0.218531 | Non applicato |
| points-over-74.5 | 0.249762 | 0.252412 | 0.251886 | 0.250672 |
| points-over-79.5 | 0.240630 | 0.240851 | 0.240901 | 0.242351 |
| points-over-84.5 | 0.220016 | 0.220639 | 0.220016 | 0.220016 |
| home-set-handicap-minus-1.5 | 0.221371 | 0.219520 | 0.220557 | Non applicato |
| home-set-handicap-plus-1.5 | 0.227467 | 0.227067 | 0.228345 | Non applicato |
| home-point-handicap-minus-5.5 | 0.223615 | 0.222587 | 0.222326 | 0.222138 |
| home-point-handicap-plus-5.5 | 0.231212 | 0.229321 | 0.229847 | 0.230629 |
| home-point-handicap-minus-9.5 | 0.156222 | 0.154918 | 0.156231 | 0.155479 |
| home-point-handicap-plus-9.5 | 0.163368 | 0.163279 | 0.164015 | 0.162699 |

### Vincente: confronto diretto sulle stesse partite

| Modello | Corretti | Errati | Accuracy | Brier | Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| catboost | 946 | 858 | 52.44% | 0.248516 | 0.690201 |
| ngboost | 936 | 868 | 51.88% | 0.248615 | 0.690295 |
| hierarchical-eb | 977 | 827 | 54.16% | 0.247922 | 0.688957 |
| logistic | 977 | 827 | 54.16% | 0.248474 | 0.690170 |
| hist-gradient-boosting | 966 | 838 | 53.55% | 0.249134 | 0.691474 |
| random-forest | 964 | 840 | 53.44% | 0.248185 | 0.689486 |
| bradley-terry-winner | 965 | 839 | 53.49% | 0.247365 | 0.688011 |

Nessun nuovo candidato migliora il migliore Brier precedente sul vincente. NGBoost su handicap punti −5,5 e CatBoost su −9,5 hanno intervalli bootstrap della differenza Brier rispetto al riferimento empirico interamente negativi nel protocollo esplorativo (blocchi di tre giorni, 42 confronti, correzione familiare). Tuttavia il precedente gerarchico sul −5,5 e Random Forest sul −9,5 hanno Brier ancora inferiori: non sono nuovi vincitori del confronto completo. Nove giorni e un archivio già esaminato non forniscono una nuova validazione indipendente. Nessun altro intervallo dei nuovi candidati dimostra un miglioramento stretto rispetto al riferimento empirico.

Il flow non mostra un miglioramento generale: sui totali punti grezzi peggiora nettamente e vari pesi sono ridotti a zero dalla calibrazione. Non viene promosso. Non continuiamo a modificare configurazioni su questi esiti per poi chiamarli test indipendente.

## Fase 6: artefatti e stato app

Addestramento realmente eseguito in 84.8 secondi: 12 artefatti privati (quattro finestre × tre famiglie), più audit individuale con predizioni grezze/calibrate. Hash e dimensioni nel report aggregato. I pesi e gli incontri privati restano in `.research-data/`, esclusa da Git; nessun caricamento a servizi esterni. Lo script impedisce di sovrascrivere report o artefatti già esaminati.

Nessuna modifica al modello dell’app, al training giornaliero v17, ai protocolli prospettici congelati, al database o alle credenziali. Nessuna nuova spesa. I nuovi candidati non entrano automaticamente nel cron: questo rilascio è un benchmark offline con nessuna promozione. Report aggregato versionato nel repository, non aggiunto alla dashboard in questa attività.

## Riproduzione e verifiche

Da eseguire nell’ambiente cloud di sviluppo, senza PC dell’utente:

```bash
python -m venv --system-site-packages .research-data/venv-v18
.research-data/venv-v18/bin/python -m pip install "torch==2.6.0+cpu" --index-url https://download.pytorch.org/whl/cpu
.research-data/venv-v18/bin/python -m pip install -r research/requirements-v18.txt
.research-data/venv-v18/bin/python -m unittest discover -s scripts -p "test_*.py"
# Richiede input privati originali con hash coincidenti e destinazioni nuove:
.research-data/venv-v18/bin/python scripts/run-probabilistic-benchmark.py
```

Non cancellare i risultati originali per riprovare: per una nuova esecuzione creare una nuova versione con percorsi di output distinti. Versioni effettive registrate nel JSON. I pesi di CatBoost, NGBoost e flow si trovano negli artefatti separati; la ricostruzione flow richiede configurazione del protocollo e scaler salvati. Non caricare joblib provenienti da fonti non fidate.

31 test Python passati nell’ambiente v18, compresi test reali delle librerie, probabilità, soglie, costanza, inferenza senza label e riproducibilità flow. Nella CI leggera, i tre test che richiedono le librerie opzionali vengono esplicitamente saltati, mentre i precedenti 28 restano eseguiti. Nessuna nuova verifica browser necessaria: nessun componente UI è cambiato.


Verifiche finali v18: 277 test applicativi in 38 file, TypeScript, build Vite e avvio ESM Node 24.22.1 passati; endpoint anonimi 401 e zero chiamate esterne nello smoke test. Il primo tentativo di test API nella sandbox senza socket locali non era eseguibile correttamente: ripetuto fuori da tale restrizione, senza modifiche al codice, con esito positivo. 31 test Python passati con tutte le dipendenze opzionali; ambiente CI leggero 28 eseguiti e tre saltati esplicitamente. Nessun deployment aggiuntivo: modificati solo ricerca e documentazione, nessun codice runtime dell’app.
