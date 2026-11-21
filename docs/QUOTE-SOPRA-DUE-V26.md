# Pronostici sul vincente a quota superiore a 2,00

Test retrospettivo su 142 partite del benchmark principale con quote prematch qualificabili, incluse le 88 del precedente confronto, e 28 partite di un giorno successivo senza sovrapposizioni. In totale, 170 partite distribuite su dieci date. Gli esiti e le probabilità provengono dagli audit storici già esaminati. I candidati usano le loro versioni già valutate per ciascun campione. Il CSV Setka 2022 è privo di quote.

Per ogni partita e modello si prende la selezione con probabilità superiore al 50%, se la sua quota originale è strettamente sopra 2,00. I pareggi di probabilità e le quote esattamente a 2,00 rimangono fuori. Con questa regola le selezioni hanno già EV nominale positivo, poiché probabilità oltre 0,50 moltiplicata per quota oltre 2,00 supera 1.

| Modello | Corrette / tentate su 142 | Corrette / tentate su 28 | Corrette | Errate | Totale | Accuratezza |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CatBoost coerente | 18 / 33 | 4 / 5 | 22 | 16 | 38 | 57,9% |
| Rete neurale coerente | 24 / 49 | 6 / 10 | 30 | 29 | 59 | 50,8% |
| Gradient Boosting | 17 / 35 | 2 / 4 | 19 | 20 | 39 | 48,7% |
| NGBoost | 13 / 35 | 4 / 6 | 17 | 24 | 41 | 41,5% |
| Random Forest | 13 / 28 | 2 / 6 | 15 | 19 | 34 | 44,1% |

Ogni modello può scegliere incontri diversi. Le righe possono condividere partite. La tabella mostra alcune famiglie, mentre il JSON contiene tutti i risultati e le statistiche delle quote. Le stime sono descrittive e dipendono dalla copertura dei prezzi storici. Il miglior risultato osservato su questa selezione non è una stima del vantaggio sulle prossime partite.

Riproduzione con `python scripts/benchmark-odds-above-two.py` dove sono disponibili gli audit privati. Verificati soglia stretta, lato previsto, assenza di sovrapposizioni, inclusione delle 88 già analizzate e riconciliazione dei conteggi. Suite Python leggera con 35 test passati e sette opzionali saltati.

[Risultati aggregati completi](../research/report-odds-above-two-v26.json)
