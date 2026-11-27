# CatBoost coerente su Setka 2022

Ho riaddestrato la struttura CatBoost multiclasse del v21 sulle caratteristiche Setka del v25. I parametri sono fissati nel protocollo. La calibrazione ha scelto peso 75% CatBoost e 25% frequenza storica, con temperatura 1. Il modello stima i sei risultati esatti di una partita al meglio dei cinque set. Vincente, totali e handicap derivano dalla stessa distribuzione.

L’archivio è distinto da MoviOdds e contiene risultati del 2022. Ho riusato le finestre cronologiche del v25, con 3.928 partite di addestramento, 1.298 di calibrazione e 2.077 di test sugli otto giorni dall’1 all’8 luglio. Per le caratteristiche valgono soltanto gli esiti disponibili secondo l’ipotesi del ritardo di due giorni di calendario. Il campione Setka era già stato esaminato nel v25 e manca di quote originali.

| Mercato | Corretti CatBoost | Errati | Brier CatBoost | Brier frequenza storica |
| --- | ---: | ---: | ---: | ---: |
| Vincente | 1.210 | 867 | 0,24087 | 0,25005 |
| Over/Under 3,5 set | 1.465 | 612 | 0,20781 | 0,20798 |
| Over/Under 4,5 set | 1.382 | 695 | 0,22247 | 0,22301 |
| Handicap set −1,5 casa | 1.378 | 699 | 0,21579 | 0,22328 |
| Handicap set +1,5 casa | 1.394 | 683 | 0,21359 | 0,22101 |
| Risultato esatto | 446 | 1.631 | 0,82543 | 0,83219 |

La logistica v25 ha un vincitore corretto in meno sullo stesso test, ma mantiene Brier 0,23746 e Log Loss 0,66726, inferiori a 0,24087 e 0,67462 di CatBoost. Sul risultato esatto CatBoost ha 446 scelte corrette contro 388 della frequenza storica. Per i due handicap il Brier migliora anche nel confronto a blocchi, mentre per entrambi i totali set l’intervallo include zero. Il Brier del risultato esatto è multiclasse.

Per testare ancora le quote oltre 2,00, la documentazione TT Lossbeater descrive prezzi di apertura con timestamp e risultati, ma le colonne di mercato richiedono una chiave con accesso ai prezzi. Non è stato acquisito un nuovo campione quotato. I 22 su 38 del v26 restano il conteggio storico di CatBoost per quella fascia. [Documentazione della fonte](https://tt-lossbeater.com/api/datasets)

Riproduzione con `.research-data/venv-v18/bin/python scripts/benchmark-catboost-setka.py` e CSV originale corrispondente all’hash del protocollo Setka. I dati grezzi restano nell’archivio locale. [Protocollo](../research/protocol-catboost-setka-v27.json) · [Risultati](../research/report-catboost-setka-v27.json)
