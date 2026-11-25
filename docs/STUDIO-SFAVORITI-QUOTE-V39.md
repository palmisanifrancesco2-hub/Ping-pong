# Quote alte quando modello e Bet365 indicano vincitori diversi

Analisi per fasce del replay v38. Il filtro richiede che entrambi i modelli sportivi assegnino più del 50% allo stesso giocatore e che la più bassa delle due probabilità superi la soglia di pareggio della quota offerta. Il bookmaker deve quotare quel giocatore a un prezzo più alto dell’avversario. Le fasce descrivono il campione storico e non costituiscono soglie operative. Le quote di 3,65 e superiori non hanno un tetto massimo.

| Quota dello sfavorito Bet365 | Partite con prezzo disponibile | Selezioni | Esatte | Sbagliate | Rendimento teorico |
| --- | ---: | ---: | ---: | ---: | ---: |
| Da 1,30 a meno di 2,00 | 22 | 6 | 3 | 3 | −4,55% |
| Da 2,00 a meno di 2,50 | 145 | 45 | 23 | 22 | +6,22% |
| Da 2,50 a meno di 3,65 | 66 | 10 | 2 | 8 | −48,75% |
| Da 3,65 | 8 | 2 | 0 | 2 | −100% |

La fascia da 3,65 contiene due selezioni dello stesso giorno. La fascia da 2,00 a meno di 2,50 raggruppa undici giorni. Il rendimento positivo di quest’ultima è descrittivo e richiede conferma su nuove partite. Gli importi sono teorici a puntata unitaria ai prezzi archiviati, con disponibilità all’esecuzione non verificata. Il report JSON include anche i risultati per ciascun modello usato singolarmente.

A quota 3,65 la soglia di pareggio è 1/3,65, circa il 27,4%. Tale soglia è distinta dal 50% richiesto per chiamare un atleta favorito in un confronto a due. Per citare un disaccordo sul favorito manteniamo la definizione a due modelli. La scomposizione delle fasce riproduce tutti i 63 casi di disaccordo del consenso v38.

Per riprodurre il report, esportare il campione privato con `scripts/benchmark-sports-favorites.py --include-challenger --priced-sample /tmp/v38-input.json --output /tmp/v36-output.json`, quindi eseguire `scripts/benchmark-consensus-value.py /tmp/v38-input.json /tmp/v39-output.json --price-bands` nell’ambiente Python di ricerca.

[Risultati aggregati per fascia](../research/report-underdog-price-bands-v39.json)
