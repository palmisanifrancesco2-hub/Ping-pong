# Verifica su WTT e con quote prematch Bet365

Il v34 ripete il confronto su un circuito esterno e misura la qualità delle probabilità v33 sulle stesse partite e linee quotate da Bet365. Sono due verifiche con campioni e riferimenti diversi.

## Circuito esterno WTT

L’archivio RSMD contiene 10.292 righe WTT. Sono ammissibili 9.841 partite con punteggio BO5 completo e coerente. Il formato è verificato dal risultato finale per l’analisi retrospettiva. Gli esiti degli incontri BO7 restano fuori anche dallo storico usato in questo esperimento. Le quote e gli orari d’inizio verificati sono assenti. Le statistiche usano un ritardo di otto giorni di calendario e almeno cinque precedenti per atleta. Le date provengono dal dataset e potrebbero rappresentare l’evento.

| Coorte | BO5 ammissibili | Training 2022–23 | Calibrazione 2024, primo semestre | Scelta 2024, secondo semestre | Test 2025 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Maschile | 5.214 | 1.169 | 749 | 311 | 1.046 |
| Femminile | 4.627 | 985 | 651 | 308 | 969 |

I modelli sono stati riaddestrati separatamente con gli stessi parametri candidati del v33. Si applica un margine di otto giorni alla fine di ogni blocco. Lo storico recente può aggiornarsi con i risultati già ammissibili nel tempo. La scelta della famiglia per ogni mercato usa il secondo semestre 2024. I test sono 2.015 partite distinte dai campioni MoviOdds e Setka del v33. Lo stesso archivio WTT era già stato usato per un benchmark sul vincente, quindi il campione non costituisce una conferma prospettica indipendente.

| Mercato | WTT maschile, Brier prima → dopo | WTT femminile, Brier prima → dopo | Corretti WTT prima → dopo |
| --- | ---: | ---: | ---: |
| Handicap A −1,5 set | 0,23483 → 0,19281 | 0,23630 → 0,18102 | 1.255 → 1.458 |
| Handicap A −5,5 punti | 0,23914 → 0,18962 | 0,24016 → 0,17146 | 1.217 → 1.474 |
| Vincente primo set | 0,24951 → 0,23925 | 0,24990 → 0,21228 | 1.048 → 1.234 |
| Risultato esatto | 0,83296 → 0,79845 | 0,82194 → 0,75295 | 397 → 612 |

Il riferimento è la frequenza della coorte regolarizzata. Tutte e sei le linee handicap hanno un Brier più basso in entrambe le coorti. Sul totale punti 74,5 il Brier migliora in entrambe, con 573 corretti invariati nel maschile e da 628 a 625 nel femminile. Si tratta di risultati descrittivi di un circuito diverso da quello dell’app. [Archivio RSMD](https://github.com/Li02003121/racket-sports-dataset) · [Dati OSF](https://doi.org/10.17605/OSF.IO/PJUW8)

## Quote Bet365 archiviate

Sul campione MoviOdds v33 di 20.449 partite, 3.874 hanno almeno una risposta closing in cache. Per 396 è disponibile almeno una coppia esatta valida. I conteggi per mercato includono incontri in comune. Il controllo richiede kickoff noto, identificazione dei giocatori, selezioni complementari dello stesso mercato, stessa linea e periodo, quote non sospese e timestamp al massimo cinque minuti prima dell’istante di decisione, fissato a un minuto dal kickoff. Le sei scelte cronologiche v33 sono state riprodotte e verificate prima dell’abbinamento.

| Mercato | Partite | Brier modello | Brier Bet365 senza margine | Scelte a EV stimato positivo, corrette / sbagliate | Scelte sopra 2,00, corrette / sbagliate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vincente primo set | 317 | 0,25369 | 0,24566 | 45 / 56 | 19 / 31 |
| Handicap A −1,5 set | 161 | 0,24922 | 0,24045 | 50 / 44 | 1 / 1 |
| Handicap A +1,5 set | 165 | 0,23530 | 0,22855 | 44 / 35 | 3 / 2 |
| Over 74,5 punti | 40 | 0,25166 | 0,25269 | 1 / 0 | 0 / 0 |

Per l’EV si sceglie il lato con probabilità del modello superiore al 50%, a quota almeno 1,30 e con EV nominale positivo. La colonna «Sopra 2,00» usa il lato favorito dal modello senza filtro EV. Per handicap punti ci sono soltanto quattro coppie distribuite su tre linee. Le quote archiviate consentono un confronto descrittivo, mentre i prezzi effettivamente eseguibili e il ROI restano non verificati. Il Brier di Bet365 resta inferiore sui tre campioni più grandi: il miglioramento rispetto alle frequenze storiche WTT e MoviOdds non dimostra un vantaggio sulle quote.

## Riproduzione

Il benchmark legge gli archivi privati descritti nei protocolli e scrive soltanto dati aggregati. Su una copia di lavoro con gli archivi e l’ambiente Python di ricerca configurati, spostare il report esistente prima di ripetere l’esperimento.

```bash
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 .research-data/venv-v18/bin/python scripts/benchmark-market-robustness.py
```

Sono passati 44 test Python. [Protocollo](../research/protocol-market-robustness-v34.json) · [Metriche complete](../research/report-market-robustness-v34.json)
