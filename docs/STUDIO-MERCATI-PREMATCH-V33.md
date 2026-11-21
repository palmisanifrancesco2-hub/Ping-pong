# Test su 20.449 partite per set, punti e handicap

Il replay estende ai mercati secondari le sei finestre del benchmark v32, dal 9 ottobre al 4 novembre 2026. Sono le stesse 20.449 partite distinte MoviOdds, tutte con set completi e al meglio dei cinque. La storia dei giocatori è costruita separatamente per competizione e fonte. I 7.843 incontri Setka 2022 entrano nel training di ciascuna finestra insieme ai risultati MoviOdds precedenti. In totale, le finestre usano da 7.843 a 24.169 incontri di training.

Come in v32, il replay usa la data UTC di fine incontro come approssimazione della data di gioco e un ritardo di due giorni per costruire le statistiche. Per ogni finestra, due giornate precedenti servono per la calibrazione e una successiva, ancora precedente al test, per scegliere la famiglia col Brier più basso per ogni mercato. Nessun esito della finestra di test entra nella scelta. Gli esiti di finestre precedenti possono alimentare finestre successive solo dopo il ritardo previsto.

Sono state confrontate la frequenza del campionato regolarizzata, la regressione logistica e il gradient boosting a istogrammi. Per risultato esatto, totali set e handicap set è stata valutata anche una regressione logistica multinomiale. Quest’ultima produce una distribuzione unica sui sei risultati possibili, da cui si ricavano probabilità coerenti per totale e handicap set. Il selettore può usare modelli diretti diversi da questa distribuzione. Le stime dirette su linee diverse sono valutate singolarmente.

## Risultati sul test cronologico

La tabella confronta il riferimento con il modello scelto prima di ciascuna finestra. Un Brier più basso indica probabilità più vicine ai risultati osservati. Il risultato esatto usa il Brier multiclasse e va confrontato con il proprio riferimento.

| Mercato | Brier riferimento | Brier modello scelto | Corretti | Sbagliati | Intervallo della differenza interamente sotto zero |
| --- | ---: | ---: | ---: | ---: | --- |
| Vincente primo set | 0,24993 | 0,24930 | 10.682 | 9.767 | |
| Over 19,5 punti primo set | 0,22512 | 0,22508 | 13.457 | 6.992 | |
| Over 3,5 set | 0,20951 | 0,20965 | 14.342 | 6.107 | |
| Over 4,5 set | 0,21609 | 0,21603 | 13.998 | 6.451 | |
| Over 74,5 punti | 0,24992 | 0,25005 | 10.261 | 10.188 | |
| Over 79,5 punti | 0,23933 | 0,23945 | 12.343 | 8.106 | |
| Over 84,5 punti | 0,21851 | 0,21846 | 13.858 | 6.591 | |
| Handicap A −1,5 set | 0,22558 | 0,22321 | 13.432 | 7.017 | Sì |
| Handicap A +1,5 set | 0,22464 | 0,22209 | 13.485 | 6.964 | Sì |
| Handicap A −5,5 punti | 0,22959 | 0,22718 | 13.165 | 7.284 | Sì |
| Handicap A +5,5 punti | 0,22831 | 0,22566 | 13.244 | 7.205 | Sì |
| Handicap A −9,5 punti | 0,16231 | 0,16102 | 16.283 | 4.166 | Sì |
| Handicap A +9,5 punti | 0,16120 | 0,15924 | 16.318 | 4.131 | Sì |
| Risultato esatto | 0,83154 | 0,82873 | 4.165 | 16.284 | Sì |

Gli intervalli della differenza di Brier usano 10.000 repliche in blocchi di tre giorni e una correzione per i 14 confronti. In questo archivio gli handicap migliorano la qualità delle probabilità, anche quando la scelta sopra il 50% rimane la stessa. Per esempio, −9,5 punti indovina 16.283 esiti con entrambi i metodi. Il risultato esatto passa da 3.905 a 4.165 corretti. Sul primo set il modello indovina 336 esiti in più, con un intervallo di Brier che include ancora zero. Sulle linee Over 3,5 set, Over 74,5 e Over 79,5 punti, il riferimento ha avuto un Brier inferiore. Under e handicap opposto sono complementi sulle linee a mezzo punto.

Questa è una verifica retrospettiva su 27 giorni, in parte già analizzati per altri obiettivi. Il risultato è riferito alle frequenze storiche del campionato. Mancano prezzi prematch sincronizzati per stimare un vantaggio rispetto a Bet365, EV realizzato o ROI. Il motore operativo dell’app usa i propri criteri di validazione.

## Riproduzione

Servono gli archivi privati MoviOdds e Setka descritti nel v32. Lo script verifica le impronte dei file. I risultati sono scritti in un nuovo file e contengono solo aggregati. Su una copia di lavoro, spostare il report esistente prima di ripetere l’esperimento.

```bash
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 .research-data/venv-v18/bin/python scripts/benchmark-secondary-markets.py
```

[Protocollo](../research/protocol-secondary-markets-v33.json) · [Tutte le metriche, i modelli selezionati e la calibrazione](../research/report-secondary-markets-v33.json)
