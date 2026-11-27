# Replay live del vincente a fine set

Lo studio ricostruisce in ordine cronologico 2.077 partite Setka del 2022. Prima della partita usa le caratteristiche sportive del v25; dopo ogni set disponibile usa anche il conteggio dei set vinti. Ogni fotografia contiene solo set già conclusi e l’ultima viene esclusa perché il vincente è già deciso. Il protocollo usa le finestre di addestramento, calibrazione e test del v25. L’archivio era già stato esaminato in studi precedenti. [Protocollo](../research/protocol-live-setka-v28.json)

Per ogni fase ho addestrato una logistica e CatBoost binario. Il riferimento usa solo il punteggio in set, con frequenze stimate sull’addestramento. La scelta per fase usa il Brier di calibrazione. Per misurare quanto aggiunge il punteggio, confronto anche la logistica prematch sulle stesse partite ancora aperte.

| Set chiusi | Partite ancora aperte | Prematch corrette | Solo punteggio corrette | Logistica corretta | CatBoost corrette |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 2.077 | 1.209 | 1.038 | 1.209 | 1.202 |
| 1 | 2.077 | 1.209 | 1.454 | 1.465 | 1.459 |
| 2 | 2.077 | 1.209 | 1.476 | 1.519 | 1.504 |
| 3 | 1.465 | 817 | 1.099 | 1.099 | 1.099 |
| 4 | 695 | 365 | 355 | 336 | 353 |

La logistica dopo due set ottiene 73,1% di corrette. CatBoost ne ottiene meno, ma il Brier è leggermente migliore, 0,16913 contro 0,17008. A 2–2 tutti i risultati di accuratezza sono vicini al caso e i modelli live non migliorano la logistica prematch in accuratezza su quel sottoinsieme. I numeri di più fasi possono riferirsi alla stessa partita.

MoviOdds documenta un indicatore in-play e timestamp delle quote e dell’ultima lettura per mercato. Il connettore conserva un campo generico di punteggio. Le letture delle quote non certificano che punteggio e prezzi rappresentino lo stesso stato. Per valutare su partite in corso servono uno stato set interpretato e verificato, il formato della partita, lo stesso istante decisionale per probabilità e coppia di quote attive e l’esito finale. Il replay Setka usa i punteggi storici, senza prezzi abbinati allo stato live. [Documentazione MoviOdds](https://moviodds.com/doc)

Riproduzione con `.research-data/venv-v18/bin/python scripts/benchmark-live-setka.py`. I modelli e i calibratori addestrati sono salvati localmente in `.research-data/live-setka-v28.joblib`; il report ne contiene l’hash. Superati 42 test Python e controllata la ricostruzione su tutte le sequenze legali al meglio dei cinque set. [Risultati](../research/report-live-setka-v28.json)
