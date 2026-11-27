# Selezioni oltre +50% e +60% di EV

In **Studio → Test a risultato coperto → Archivio completo e studio per soglie EV** i tre conteggi usano una selezione per incontro, scegliendo il lato con maggiore EV fra quelli che rispettano la quota minima. Il gruppo a quota Bet365 da 2,00 include 2,00. Un EV esattamente pari alla soglia resta fuori. I conteggi si sovrappongono, quindi vanno letti separatamente. Il CSV contiene selezione ed esito verificato per ciascun filtro.

I risultati separano Esatto, Sbagliato, attesa, inizio da verificare ed esclusi. La percentuale di esatti e il ROI simulato usano il solo sottoinsieme verificato. Il confronto prospettico sullo stesso campione con Elo misura se richiedere che entrambe le stime superino la soglia per lo stesso lato aumenta la precisione e quante selezioni si perdono.

Sul campione storico v38 di 258 partite con coppie di quote Bet365 Australia del 20 ottobre–4 novembre, il modello sportivo registra 3 esatte su 12 a EV oltre +50%, 2 su 10 oltre +60% e 3 su 12 con quota almeno 2 e EV oltre +50%. Il modello simmetrico recupera una vittoria in ciascun filtro sull’intero archivio. Nel blocco del 1°–4 novembre (156 incontri) modello sportivo, simmetrico e filtro con doppia conferma producono tutti 1 esatta e 4 sbagliate oltre +50%, 1 esatta e 3 sbagliate oltre +60%, e 1 esatta e 4 sbagliate a quota almeno 2 con EV oltre +50%. Questo blocco era già stato usato per altre analisi. I campioni ad alto EV sono piccoli e la disponibilità effettiva delle quote resta da verificare. Il replay non dimostra un aumento della precisione.

[Aggregati del replay](../research/report-high-ev-v44.json)

```bash
.research-data/venv-v18/bin/python scripts/benchmark-high-ev-v44.py \
  /workspace/scratch/v38-quote-sample.json research/report-high-ev-v44.json
```
