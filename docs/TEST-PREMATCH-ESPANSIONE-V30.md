# Verifica prematch dei modelli addestrati su 21.089 partite

Il test applica CatBoost binario e logistica del v29 allo stato 0–0. I modelli e i calibratori sono quelli salvati dal precedente addestramento. Ho verificato gli hash dell’archivio e dei modelli, gli ID distinti rispetto al v29 e l’orario di inizio attraverso il dato di chiusura MoviOdds. Il 5 novembre 2026 è successivo alla finestra di test del v29. Le 261 partite vengono da archivi già esaminati in altri studi. Le caratteristiche dei giocatori seguono il ritardo di due giorni del v29; nessun esito di questa coorte contribuisce a tali caratteristiche.

| Modello | Corretti su 261 | Errati | Brier su 261 | Brier sui 28 con quote |
| --- | ---: | ---: | ---: | ---: |
| Logistica | 153 | 108 | 0,23975 | 0,24542 |
| CatBoost | 151 | 110 | 0,24256 | 0,24651 |
| Bookmaker senza margine | — | — | — | 0,26290 |

Sulle 28 partite con entrambi i prezzi, ho preso per ogni modello il lato sopra il 50% quando la sua quota era strettamente sopra 2,00. La logistica ha indovinato una scelta a 2,20 e ha sbagliato una scelta a 3,00. CatBoost ha indovinato la sua unica scelta, a 2,20. La stessa partita può comparire nelle due righe. Prezzi dello stesso bookmaker, mercato e periodo, non sospesi, rilevati entro cinque minuti dal punto di decisione e prima di esso. Il punto di decisione è un minuto prima dell’inizio verificato.

I modelli di questo test sono le versioni binarie del v29. Il CatBoost coerente multiclasse dello studio precedente ha un conteggio distinto di 22 su 38. Le coorti con quote si sovrappongono a test precedenti e non vanno sommate. Il nostro confronto resta storico, su una sola giornata e con poche scelte sopra 2,00. Le probabilità qui sono state ricostruite a posteriori.

Riproduzione con `.research-data/venv-v18/bin/python scripts/evaluate-expanded-prematch.py` e gli archivi locali originali. Verificata la concordanza tra ricostruzione per singola partita e per gruppi. [Risultati aggregati](../research/report-prematch-expansion-v30.json)
