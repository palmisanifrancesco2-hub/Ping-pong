# Favoriti del modello senza quote nel calcolo

Il replay del mercato vincente prematch ha addestrato due regressioni simmetriche e confrontato la loro media con la logistica v32. Le previsioni sport-only considerano Elo, forma recente, differenza di set e punti, scontri diretti e quantità di storico. La simmetria impone che invertire i due giocatori inverta anche le probabilità. La variante recente pesa i dati con emivita di otto giorni e stima correzioni per lega con regolarizzazione. Le temperature di calibrazione sono state scelte sui tre giorni precedenti di calibrazione, separati dal training e dal test. Il training termina sei giorni prima di ciascuna finestra. I profili restano separati per lega e usano il ritardo storico di due giorni del protocollo MoviOdds. L’archivio usa la data UTC di fine come approssimazione della data dell’incontro.

## Qualità del pronostico sportivo

| Modello | Esatti | Sbagliati | Pari al 50% | Brier ↓ | Log Loss ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Logistica v32 | 7.780 | 6.481 | 0 | 0,24584 | 0,68473 |
| Logistica simmetrica | 7.592 | 6.565 | 104 | 0,24789 | 0,68896 |
| Simmetrica recente per lega | 7.642 | 6.515 | 104 | 0,24827 | 0,69000 |
| Media delle due simmetriche | 7.615 | 6.542 | 104 | 0,24747 | 0,68809 |

Il confronto copre 14.261 incontri univoci su quattro finestre dal 17 ottobre al 4 novembre 2026. La v32 conserva il Brier più basso in tutte e quattro le finestre. Gli intervalli per la differenza rispetto a v32, calcolati a blocchi di tre giorni e corretti per tre confronti, sono interamente sopra zero per le tre varianti. L’archivio era già stato usato in studi precedenti.

## Selezione delle quote

Solo dopo aver calcolato le probabilità si cerca la quota del lato con stima sopra il 50%, anche quando Bet365 lo quota da sfavorito. La regola usa quota minima 1,30 ed EV strettamente positivo. Il rapporto riporta anche i risultati con soglie EV superiori al 3% e al 6%, come analisi di sensibilità. Non è stato scelto un filtro in base al risultato sul test.

12.283 partite hanno almeno cinque precedenti per entrambi i giocatori. Su 258 di queste, distribuite su 16 giorni, le quattro cache locali offrono una coppia di prezzi che supera le verifiche. Le quote sono della stessa partita e dello stesso mercato, con orario di inizio noto, ed erano attive negli ultimi cinque minuti prima del punto di decisione fissato a un minuto dall’inizio. Si usa la coppia più recente che supera i controlli, escludendo conflitti a pari timestamp o sull’ora d’inizio. L’archivio non certifica che il prezzo fosse eseguibile al momento della decisione.

| Modello | Quote con EV positivo | Esatti | Sbagliati | Rendimento teorico | Sfavoriti Bet365 esatti / selezionati | Rendimento teorico sfavoriti |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Logistica v32 | 93 | 41 | 52 | −8,60% | 32 / 79 | −12,31% |
| Logistica simmetrica | 108 | 52 | 56 | −0,31% | 41 / 93 | −4,88% |
| Simmetrica recente per lega | 100 | 44 | 56 | −7,02% | 37 / 86 | −6,06% |
| Media delle due simmetriche | 95 | 41 | 54 | −10,34% | 35 / 83 | −10,02% |

Alle quote sopra 2,00 la simmetrica ha **25 esatti e 39 sbagliati**, con rendimento teorico **−11,21%**. La stessa variante con EV sopra il 3% ha 43 esatti su 91 e rendimento teorico −0,07%. L’intervallo a blocchi per il rendimento con EV superiore a zero va da −14,4% a +26,9%. Su tutte le 258 partite abbinate il Brier del mercato depurato dal margine è 0,24121, rispetto a 0,24725 per la simmetrica e 0,24811 per v32. Lo studio mostra una variante che amplia la copertura, con evidenza insufficiente per un vantaggio economico. Il modello dell’app e il protocollo dello studio prospettico non sono stati modificati.

## Riproduzione

Servono gli archivi privati MoviOdds e Setka, le cache storiche e l’ambiente Python di ricerca. Eseguire `OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 .research-data/venv-v18/bin/python scripts/benchmark-sports-favorites.py --output /tmp/report-sports-favorites-v36.json`. Il test salva solo aggregati. La suite Python ha superato 54 test, compresi selezione indipendente dal mercato, simmetria, timestamp delle quote e calcolo del rendimento.

[Protocollo](../research/protocol-sports-favorites-v36.json) · [Risultati per finestra, calibratura e quote](../research/report-sports-favorites-v36.json)
