# Vincente prematch su 10.789 partite

Il replay v31 ha valutato 10.789 incontri distinti dell’archivio MoviOdds, in sei competizioni e su 14 giorni UTC dal 22 ottobre al 4 novembre 2026. Su 23.670 risultati caricati, 23.235 rientravano nelle competizioni ammesse. Per aumentare il campione di addestramento, ciascuna finestra include anche 7.843 incontri Setka Cup del 2022.

## Protocollo

| Giorni di test inclusi (UTC) | Training MoviOdds | Training Setka | Calibrazione | Test |
| --- | ---: | ---: | ---: | ---: |
| 22–26 ottobre | 8.974 | 7.843 | 1.988 | 3.880 |
| 27–31 ottobre | 12.446 | 7.843 | 2.282 | 3.820 |
| 1–4 novembre | 16.326 | 7.843 | 2.318 | 3.089 |

Ogni partita conta una volta nel test. Per ciascuna finestra sono stati riaddestrati regressione logistica e CatBoost binario con le configurazioni v28. Il training termina sei giorni prima della finestra e la calibrazione usa i giorni da quattro a due giorni prima. Gli esiti di una finestra precedente possono entrare in una finestra successiva solo dopo il ritardo previsto. L’archivio usa la data UTC di fine come approssimazione della data della partita. Le statistiche dei giocatori ereditano il ritardo di due giorni del replay v29. Le previsioni usano lo stato 0–0 e i modelli sportivi sono addestrati senza quote.

## Risultati sul campione completo

| Modello | Corretti | Sbagliati | Pari al 50% | Accuratezza sulle scelte | Brier ↓ | Log Loss ↓ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Regressione logistica | 5.927 | 4.862 | 0 | 54,94% | 0,24545 | 0,68395 |
| CatBoost binario | 5.883 | 4.906 | 0 | 54,53% | 0,24607 | 0,68520 |
| Elo | 5.764 | 4.953 | 72 | 53,78% | 0,24873 | 0,69070 |

Un Brier più basso indica probabilità mediamente più vicine agli esiti osservati. La logistica ha il Brier più basso in tutte e tre le finestre e indovina 44 incontri in più di CatBoost sul totale. Rispetto a Elo, gli intervalli della differenza di Brier sono da −0,00476 a −0,00190 per la logistica e da −0,00398 a −0,00141 per CatBoost. Sono intervalli retrospettivi ottenuti ricampionando blocchi di tre giorni con 10.000 replicazioni e correzione per due confronti. Il periodo osservato comprende 14 giorni.

## Risultati con quote archiviate

Su 260 incontri (2,41% del totale) erano disponibili entrambe le quote Bet365 del vincente con timestamp prematch accettato. Sullo stesso sottocampione, la probabilità implicita depurata dal margine ha Brier 0,23833, davanti a logistica (0,24757), CatBoost (0,24808) ed Elo (0,25126).

| Modello | Selezioni a quota > 2,00 | Corrette | Sbagliate | Quota media corretta | Quota media sbagliata | Differenza |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Regressione logistica | 50 | 17 | 33 | 2,321 | 2,480 | +0,159 |
| CatBoost binario | 50 | 19 | 31 | 2,293 | 2,544 | +0,251 |
| Elo | 56 | 24 | 32 | 2,403 | 2,577 | +0,174 |

Ogni modello seleziona il lato con probabilità stimata superiore al 50%. I modelli possono quindi selezionare incontri diversi. Le quote sono prezzi di chiusura registrati dalla fonte prima dell’orario verificato. Il log non dimostra che quei prezzi fossero eseguibili al momento della decisione. Il ROI verificato resta indisponibile.

La regressione logistica è il riferimento sportivo per il prossimo test sul vincente prematch. La validazione operativa richiede un periodo prospettico e quote raccolte al momento della previsione. Questo replay usa porzioni di archivio già analizzate in studi precedenti. Il benchmark è stato eseguito offline.

## Riproduzione

Il protocollo, il programma e il risultato aggregato sono versionati. Per ripetere l’esperimento occorrono gli archivi privati MoviOdds e Setka e la cache delle quote in `.research-data`, insieme all’ambiente Python di ricerca `.research-data/venv-v18`. Il programma controlla le impronte dei due archivi degli esiti. Il JSON aggregato è scritto in un nuovo file. Su una copia di lavoro usata per la riproduzione, spostare il report esistente prima dell’esecuzione.

```bash
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 .research-data/venv-v18/bin/python scripts/benchmark-prematch-10000.py
```

L’esecuzione ha confermato l’unicità degli ID di test. Tutti i 42 test Python sono passati. [Protocollo](../research/protocol-prematch-10000-v31.json) · [Risultati aggregati](../research/report-prematch-10000-v31.json)
