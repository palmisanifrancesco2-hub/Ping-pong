# Vincente prematch su 20.449 partite

Il replay cronologico copre 27 giorni UTC dal 9 ottobre al 4 novembre 2026 e sei competizioni dell’archivio MoviOdds. Comprende le 10.789 partite del test v31 e altre 9.660 partite precedenti. I risultati delle tre finestre v31 sono stati riprodotti e ogni ID conta una volta.

## Addestramento e test

| Finestra di test (UTC) | Training MoviOdds | Training Setka 2022 | Calibrazione MoviOdds | Partite di test |
| --- | ---: | ---: | ---: | ---: |
| 9–12 ottobre | 0 | 7.843 | 1.999 | 3.113 |
| 13–16 ottobre | 1.999 | 7.843 | 2.330 | 3.075 |
| 17–21 ottobre | 5.116 | 7.843 | 2.307 | 3.472 |
| 22–26 ottobre | 8.974 | 7.843 | 1.988 | 3.880 |
| 27–31 ottobre | 12.446 | 7.843 | 2.282 | 3.820 |
| 1–4 novembre | 16.326 | 7.843 | 2.318 | 3.089 |

Il training termina sei giorni prima di ciascuna finestra. La calibrazione usa i giorni da quattro a due giorni prima. La prima finestra ha quindi training Setka e calibrazione MoviOdds. I modelli sportivi usano lo stato iniziale 0–0 e nessuna quota. La data UTC di fine in archivio approssima la data dell’incontro. Per calcolare le statistiche storiche si applica il ritardo di due giorni del protocollo v29. Le finestre di test sono disgiunte. I modelli possono usare esiti delle finestre precedenti nelle finestre successive dopo il ritardo previsto.

## Prestazioni

| Modello | Corretti | Sbagliati | Pari al 50% | Accuratezza sulle scelte | Brier ↓ | Log Loss ↓ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Regressione logistica | 11.051 | 9.398 | 0 | 54,04% | 0,24676 | 0,68660 |
| CatBoost binario | 11.002 | 9.447 | 0 | 53,80% | 0,24701 | 0,68711 |
| Elo | 10.467 | 9.227 | 755 | 53,15% | 0,24908 | 0,69138 |

Sulle 9.660 partite aggiunte, la logistica indovina 5.124 vincitori (53,04%) e CatBoost 5.119 (52,99%). Su questo periodo CatBoost ottiene un Brier leggermente migliore (0,24806 contro 0,24822). La logistica mantiene il Brier migliore sul totale, con un divario di 0,00025 da CatBoost. Continua a essere il riferimento sportivo per i confronti successivi.

Sul campione totale la differenza di Brier rispetto a Elo è compresa tra −0,00357 e −0,00124 per la logistica e tra −0,00311 e −0,00124 per CatBoost. Gli intervalli usano un bootstrap a blocchi di tre giorni, con 10.000 replicazioni e correzione per due confronti. Coprono un periodo storico di 27 giorni.

## Quote prematch archiviate

Su 266 partite erano disponibili entrambe le quote Bet365 del vincente con timestamp prematch accettato. Sei di queste partite provengono dalle 9.660 aggiunte. Sullo stesso campione le quote depurate dal margine hanno il Brier più basso (0,23964), seguite da logistica (0,24828), CatBoost (0,24893) ed Elo (0,25176).

| Modello | Selezioni a quota > 2,00 | Corrette | Sbagliate | Quota media corretta | Quota media sbagliata | Differenza |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Regressione logistica | 52 | 18 | 34 | 2,308 | 2,480 | +0,172 |
| CatBoost binario | 51 | 19 | 32 | 2,293 | 2,543 | +0,250 |
| Elo | 58 | 25 | 33 | 2,417 | 2,575 | +0,158 |

Ciascun modello sceglie solo il lato a cui assegna una probabilità superiore al 50%. Le scelte possono riguardare partite diverse. Il confronto usa quote di chiusura registrate dalla fonte prima dell’orario verificato. Per stimare un ROI storico servirebbero prezzi effettivamente disponibili al momento della decisione. L’archivio degli esiti era già stato esaminato in altri studi. La validazione prospettica, con previsioni e quote registrate insieme prima dell’evento, resta aperta.

## Riproduzione e verifica

Il benchmark usa gli stessi archivi privati MoviOdds e Setka e la stessa cache delle quote del v31. Con questi dati in `.research-data`, l’ambiente Python di ricerca attivo e un file di destinazione ancora assente, eseguire il comando seguente.

```bash
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 .research-data/venv-v18/bin/python \
  scripts/benchmark-prematch-10000.py \
  --protocol protocol-prematch-20000-v32.json \
  --report report-prematch-20000-v32.json
```

Verificati unicità degli ID, conteggi, disponibilità delle quote e riproduzione delle tre finestre v31. I 42 test Python sono passati. [Protocollo](../research/protocol-prematch-20000-v32.json) · [Risultati aggregati e calibrazione](../research/report-prematch-20000-v32.json)
