# Calibrazione separata per fascia di quota

In **Studio → Test a risultato coperto → Archivio completo e studio per soglie EV → Calibrazione per fascia di quota** il confronto riguarda gli esiti con due quote Bet365 e orario di inizio verificato. Si distinguono 2,00–2,50 inclusi, oltre 2,50 e sotto 3,65, e da 3,65 in su. Una partita può contribuire con entrambi i lati quando le due quote appartengono alla stessa fascia. Vengono mostrati sia gli esiti sia le partite distinte.

Per ogni fascia il Brier confronta modello e mercato senza margine sugli stessi esiti. L’app mostra la frequenza osservata di vittoria, le probabilità medie e le selezioni sopra +50% e +60% di EV. Il confronto a tre include soltanto le previsioni con la variante v43 già registrata prima del risultato. Le selezioni sopra soglia possono variare tra i due metodi anche quando il campione usato per il confronto è identico.

## Replay storico

Protocollo applicato al campione archiviato v38 senza riaddestrare il modello sui suoi esiti. Nel blocco 1–4 novembre, già esaminato in studi precedenti, 156 incontri complessivi.

| Quota | Esiti | Vittorie | Probabilità media modello / mercato | Brier modello / mercato / variante | Modello EV sopra +50% (esatte/sbagliate) |
| --- | ---: | ---: | --- | --- | --- |
| 2,00–2,50 | 92 | 41 | 48,5% / 43,2% | 0,25315 / 0,24729 / 0,24718 | 0 / 0 |
| Oltre 2,50 e sotto 3,65 | 33 | 13 | 43,5% / 32,8% | 0,22529 / 0,23706 / 0,23222 | 0 / 1 |
| Da 3,65 | 5 | 1 | 43,6% / 21,2% | 0,22346 / 0,17136 / 0,16051 | 1 / 3 |

Nella fascia 2,00–2,50 la differenza di Brier fra variante e mercato è circa −0,00011. Quattro giornate e nessuna selezione oltre soglia in quella fascia danno un confronto descrittivo. Da 3,65 in su tutti e quattro i casi oltre +50% superano anche +60%. La variante non produce alcuna selezione sopra +50% nelle tre fasce di questo blocco. Il confronto non dimostra un vantaggio prospettico.

```bash
node --import tsx scripts/replay-odds-calibration.ts \
  /workspace/scratch/v38-quote-sample.json research/report-odds-calibration-v45.json
```

[Aggregati per fascia](../research/report-odds-calibration-v45.json)
