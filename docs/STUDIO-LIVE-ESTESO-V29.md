# Addestramento live esteso a due archivi

Ho trovato 23.670 risultati nell’archivio MoviOdds già salvato e ne ho usati 23.235 di sei competizioni. Ho aggiunto 7.843 partite ammissibili del CSV Setka 2022 al training. La ricerca online ha individuato anche RSMD, ma i suoi incontri WTT appartengono a un circuito diverso e non sono inclusi in questo confronto. [Archivio RSMD](https://github.com/Li02003121/racket-sports-dataset)

Il confronto usa 13.246 partite di training MoviOdds da sole o con le 7.843 Setka, per un totale di 21.089. Entrambe le versioni usano la stessa calibrazione su 3.070 partite MoviOdds e lo stesso test su 5.355 incontri dal 29 ottobre al 4 novembre 2026. Altre 1.564 partite MoviOdds contribuiscono solo alla storia quando ammissibili. Le sei competizioni sono Setka Cup, Czech Liga Pro, TT Cup, TT Elite Series, Setka Cup Women e Challenger Series TT. I nomi e le cronologie dei giocatori restano separati per fonte e competizione.

I modelli stimano il vincente a fine set usando il punteggio corrente e le statistiche storiche dei giocatori. La data UTC di fine incontro nell’archivio è un’approssimazione della data di gioco. Manteniamo un ritardo di due giorni di calendario ed escludiamo disponibilità oltre il giorno successivo per evitare che la storia usi esiti troppo recenti. Il formato al meglio dei cinque set è ricavato dal punteggio finale ai fini della selezione del campione storico. Il selettore di famiglia è fissato dalla calibrazione, prima del test.

| Dopo set | Partite aperte | Logistica MoviOdds | Logistica estesa | CatBoost esteso |
| --- | ---: | ---: | ---: | ---: |
| 1 | 5.355 | 3.850 | 3.848 | 3.849 |
| 2 | 5.355 | 3.871 | 3.902 | 3.892 |
| 3 | 3.776 | 2.938 | 2.938 | 2.938 |
| 4 | 1.728 | 860 | 877 | 890 |

Dopo due set la logistica estesa indovina il 72,87% delle partite, con Brier 0,16157 contro 0,16192 della versione MoviOdds. Il riferimento esteso basato solo sul punteggio indovina 3.811 partite con Brier 0,16261. Questo è un guadagno descrittivo su sette giorni. Il CatBoost esteso ha più vincitori corretti a 2–2, ma resta vicino al 50% e ha Brier 0,25013. Le righe della tabella riusano le stesse partite e non vanno sommate.

Il training usa gli esiti verificabili dell’archivio come etichette. Il test non contiene quote live sincronizzate e non stima il rendimento sopra quota 2,00. Le previsioni del registro privato dell’app non sono state esportate o conteggiate come partite di training. I modelli e i calibratori addestrati sono salvati localmente in `.research-data/live-expanded-v29.joblib` con hash registrato. Nessun aggiornamento del modello operativo da questi soli risultati storici.

Riproduzione con `.research-data/venv-v18/bin/python scripts/benchmark-live-expanded.py`. La suite Python completa ha superato 42 test. Verificati conteggi comuni di calibrazione e test e hash dell’artefatto. [Protocollo](../research/protocol-live-expanded-v29.json) · [Risultati](../research/report-live-expanded-v29.json)

## Stima live nell’app

L’app usa le frequenze del riferimento `scoreOnly` esteso, esportate dall’artefatto verificato con `scripts/export-live-winner-baseline.py`. Sul test storico dopo due set questo riferimento ha indovinato 3.811 vincitori su 5.355, con Brier 0,16261. Nell’app la stima appare nelle sei competizioni dello studio quando il feed conferma un incontro live recente, almeno un set concluso e un mercato del risultato esatto coerente con il formato al meglio di cinque. I punti del set in corso sono esclusi dal calcolo. La quota equa è l’inverso della probabilità stimata. Il confronto delle opportunità resta prematch. [Formato del punteggio MoviOdds](https://moviodds.com/doc)
