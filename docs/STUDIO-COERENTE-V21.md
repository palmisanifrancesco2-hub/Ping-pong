# Studio v21 — risultati coerenti, rete neurale e CatBoost

## Analisi e protocollo

Studio eseguito sui medesimi 1.804 incontri storici di test su nove giorni, con controllo aggiuntivo sui 249 del giorno successivo già usati nel v20. Non sono nuovi incontri scaricati e non si sommano al ledger prospettico dell’app. Gli esiti di entrambi i campioni erano già stati esaminati: nessuna nuova validazione indipendente.

Il modello produce una distribuzione sui sei esiti BO5: 3-0 / 3-1 / 3-2 / 0-3 / 1-3 / 2-3. Da questa derivano esattamente vincente, totale set 3,5 e 4,5, handicap set −1,5 e +1,5. Non si deducono totali punti, handicap punti o vincitore del primo set dal solo risultato finale dei set. Questi mercati sono esclusi dal presente esperimento.

Configurazioni e regole salvate prima dei nuovi risultati nel [protocollo](../research/protocol-v21-coherent-scores.json). Quattro finestre valide: training sul passato, tuning successivo per scegliere i parametri, refit anteriore alla calibrazione, calibrazione successiva e test finale della finestra. Stesso numero e stessi ID del confronto precedente, senza split casuale.

| Refit | Tuning | Calibrazione | Test |
| ---: | ---: | ---: | ---: |
| 176 | 93 | 174 | 309 |
| 516 | 152 | 148 | 449 |
| 872 | 199 | 241 | 412 |
| 1299 | 177 | 226 | 634 |

CatBoost multiclasse: profondità 3 o 4, 120 iterazioni, regolarizzazione fissata. MLP: 63 input, uno strato Tanh da 16 o 32 neuroni, dropout 0,1, sei uscite softmax; scaler appreso soltanto sul campione di fitting, AdamW per 120 epoche, peso L2 0,01 o 0,05. Nessun early stopping o scelta dell’epoca sul test. Seed fissato.

La configurazione viene scelta dal Log Loss multiclasse del tuning. Temperatura e shrinkage verso il riferimento sono scelti solo sulla calibrazione e applicati all’intera distribuzione di sei esiti: preservano la coerenza. Si confrontano anche il selettore di famiglia dalla sola calibrazione e un pool fisso 50/50. Tutti i candidati, inclusi i peggiori, restano nel report.

Il riferimento usa frequenze dei sei risultati per competizione, regolarizzate verso quelle globali e aggiornate solo con risultati disponibili prima del cutoff di refit. Rimane congelato per calibrazione/test della finestra. Questo riferimento differisce dalle frequenze binarie causali per evento del benchmark v16: i confronti con i migliori modelli binari precedenti sono riportati separatamente e non si attribuisce un vantaggio universale superando il solo riferimento congelato.

## Risultato esatto sui 1.804 incontri

| Modello | Corretti | Errati | Accuracy | Brier multiclasse | Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| riferimento | 343 | 1461 | 19.01% | 0.830353 | 1.782942 |
| categorical-catboost | 343 | 1461 | 19.01% | 0.830495 | 1.783042 |
| categorical-mlp | 340 | 1464 | 18.85% | 0.831214 | 1.785113 |
| calibration-selector | 336 | 1468 | 18.63% | 0.831578 | 1.785898 |
| fixed-pool | 362 | 1442 | 20.07% | 0.830391 | 1.782769 |

Il pool aumenta le scelte esatte corrette, ma il suo Brier non migliora il riferimento e il cambiamento del Log Loss è piccolo. Tutti gli intervalli corretti della differenza Brier multiclasse includono zero o peggioramento: nessun incremento robusto dimostrato. Il Brier multiclasse somma i sei errori quadratici e non è confrontabile numericamente con il Brier binario del vincente.

## Mercati derivati — stessi casi

| Mercato | Riferimento congiunto | CatBoost | MLP | Selettore | Pool | Miglior Brier binario v16 osservato |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| winner | 0.250065 | 0.248612 | 0.249898 | 0.249271 | 0.249050 | 0.247365 |
| sets-over-3.5 | 0.202348 | 0.203093 | 0.202754 | 0.203499 | 0.202797 | 0.201722 |
| sets-over-4.5 | 0.218545 | 0.218723 | 0.218756 | 0.218696 | 0.218669 | 0.218155 |
| home-set-handicap-minus-1.5 | 0.221455 | 0.220250 | 0.221273 | 0.220631 | 0.220640 | 0.218663 |
| home-set-handicap-plus-1.5 | 0.227396 | 0.225881 | 0.227932 | 0.226588 | 0.226746 | 0.225671 |

L’ultima colonna è descrittiva e post hoc, non un selettore operativo. CatBoost migliora il riferimento congiunto su vincente e alcuni handicap nei confronti a blocchi previsti, ma non supera il migliore Brier dei modelli binari già studiati su nessuno dei cinque mercati. Sui totali set non emerge miglioramento. Nove giorni, ripetute analisi storiche e la ricerca complessiva precedente limitano le conclusioni anche dove l’intervallo del confronto locale è favorevole. Correzione del presente esperimento: 24 confronti, blocchi di tre giorni, 10.000 repliche; non corregge tutte le scelte fatte nella storia del progetto.

### Vincente

| Modello | Corretti | Errati | Accuracy | Brier |
| --- | ---: | ---: | ---: | ---: |
| categorical-catboost | 953 | 851 | 52.83% | 0.248612 |
| categorical-mlp | 903 | 901 | 50.06% | 0.249898 |
| calibration-selector | 936 | 868 | 51.88% | 0.249271 |
| fixed-pool | 947 | 857 | 52.49% | 0.249050 |

La rete non aggiunge segnale stabile: la calibrazione le assegna peso zero in tre finestre su quattro e peso 0,25 nell’altra. Il suo Brier grezzo sul risultato esatto è 0,921274 contro 0,830353 del riferimento. Non si presenta la prestazione quasi identica al riferimento dopo shrinkage come successo della rete.

## Controllo sui 249 incontri distinti

Nessun nuovo fitting, riadattamento di temperatura o scelta di famiglia sui 249: si applica l’ultima versione selezionata nelle finestre principali. Anche questa coorte è retrospettiva e già esaminata, e copre un solo giorno.

| Modello | Vincente corretto | Vincente errato | Brier vincente | Risultati esatti corretti | Risultati esatti errati |
| --- | ---: | ---: | ---: | ---: | ---: |
| categorical-catboost | 138 | 111 | 0.246687 | 60 | 189 |
| categorical-mlp | 133 | 116 | 0.249931 | 41 | 208 |
| calibration-selector | 138 | 111 | 0.246687 | 60 | 189 |
| fixed-pool | 135 | 114 | 0.248243 | 52 | 197 |

CatBoost identifica 60 risultati esatti su 249, ma questa singola giornata non stabilisce affidabilità. Sul vincente, i 138 corretti del modello congiunto non superano i 144 del Random Forest v20; il Brier 0,246687 non supera lo 0,241101 di NGBoost v20 sugli stessi 249. Non vengono sommati modelli o mercati per gonfiare il numero delle partite.

## Qualità, artefatti e stato operativo

Addestrati realmente 24 modelli ML, comprese le configurazioni di tuning; salvati 8 artefatti delle versioni refit selezionate, con scaler, pesi, baseline e calibrazione. Tempo totale 10.81 secondi su CPU. Hash e dimensioni nel [report completo](../research/report-v21-coherent-scores.json). Artefatti e audit evento per evento rimangono in `.research-data/`, privati e con permessi 0600. Il report conserva anche metriche grezze, calibrazione, competizioni e scelte per finestra.

39 test Python nell’ambiente completo passati, inclusi validità dei punteggi, arresto del match, somme/complementari/monotonia dei mercati, calibrazione e pooling congiunti, gestione dei pareggi, esclusione dei risultati futuri dal riferimento, leghe sconosciute, riproducibilità neurale e inferenza senza etichette. Nell’ambiente leggero la CI esegue 32 test e salta esplicitamente sette test che richiedono librerie opzionali. Nessuna modifica TypeScript, frontend o runtime: nessuna nuova build/app pubblicata. Nessuna richiesta a fornitori o servizio a pagamento.

Comandi nell’ambiente cloud già predisposto:

```bash
.research-data/venv-v18/bin/python scripts/benchmark-coherent-scores.py
.research-data/venv-v18/bin/python -m unittest discover -s scripts -p "test_*.py"
```

Lo script rifiuta output o artefatti già presenti. Per ulteriori studi usare nuove versioni e destinazioni, senza sovrascrivere risultati esaminati. Nessun modello operativo, protocollo prospettico o cron originale è cambiato. Nessun ROI/EV realizzato dichiarato in assenza di quote storiche eseguibili di questi mercati. La raccolta futura già ripristinata resta la fonte per verifiche indipendenti: non si trasforma questo esperimento storico in previsioni pubblicate prima delle partite.

## Conclusione per questa fase

La struttura congiunta risolve la coerenza matematica, ma non aggiunge da sola informazione predittiva. Questo confronto non giustifica di forzare un modello unico o attivare la rete neurale. Si conservano i modelli precedenti dell’app e si continuano le osservazioni future; eventuali nuovi modelli dovranno superare riferimenti probabilistici e mercato su campioni adeguati e successivi alla selezione.
