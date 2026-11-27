# Calibrazione del vincente e archivio EV

In **Studio → Test a risultato coperto → Archivio completo e selezioni con EV sopra +50%** si può aggiornare il riepilogo e scaricare l’intero registro privato del vincente. Ogni partita occupa una riga. L’esportazione contiene probabilità e quote eque per i due giocatori, prezzi prematch Bet365 Australia disponibili con timestamp, versione del modello, esito e stato della verifica. La quota equa è calcolata dalla stima congelata, quindi è riproducibile anche per le previsioni già archiviate.

EV significa probabilità del modello × quota decimale − 1. La soglia è strettamente superiore a +50%, con quota minima 1,30 e una selezione per partita. Si considera il lato col maggiore EV, anche quando è lo sfavorito del modello. Sono contati a parte i casi selezionati che erano anche i favoriti. I conteggi Esatto e Sbagliato richiedono inizio verificato. Esiti in attesa, esiti senza inizio verificato ed esclusi restano visibili separatamente. Un prezzo mancante resta vuoto. Il riepilogo riguarda le previsioni effettivamente congelate e si può suddividere per versione. I match usati per addestrare i modelli senza previsione prematch registrata e quota datata non sono ricostruiti come segnali storici.

## Risultati storici

Sulle 258 partite con le coppie Bet365 archiviate da v38 (20 ottobre–4 novembre 2026), il modello sportivo ha 12 selezioni sopra +50% di EV, 3 esatte e 9 sbagliate. Nel blocco del 1–4 novembre, tenuto fuori dalla scelta per questo esperimento, ne ha 5, 1 esatta e 4 sbagliate. Si tratta di letture archiviate, senza prova di esecuzione. Il campione era già stato esaminato in analisi precedenti.

La correzione con una temperatura è adattata sui 23 casi del 20–25 ottobre con regolarizzazione verso un coefficiente di 1. La validazione sui 79 casi dal 26 al 31 ottobre seleziona la temperatura del mercato senza componente sportiva. Nel blocco finale su 156 incontri il riferimento Bet365 senza margine ha Brier 0,242878 e la correzione 0,242866. Quattro giornate non bastano per un intervallo a blocchi affidabile. Il risultato resta esplorativo. Il modello sportivo ha Brier 0,246943 nello stesso blocco.

Il campione esterno CC BY 4.0 di lathise2025 contiene 2.000 match, 625 nelle due coorti Setka, dal 25 giugno al 20 ottobre 2026. Il fit usa 1.181 incontri fino ad agosto e il test i successivi 819. L’Elo fornito passa da Brier 0,244679 a 0,243921 dopo la ricalibrazione. Intervallo al 95% della differenza a blocchi [-0,001682; -0,000136] su 50 giorni. Le identità sono opache e il file è privo di quote, quindi il risultato non misura la precisione rispetto a Bet365. Il coefficiente esterno viene ora testato come candidato sperimentale sull’Elo locale, con una colonna separata nell’archivio delle nuove previsioni. Il trasferimento a un Elo diverso richiede una verifica prospettica sulle stesse partite con entrambe le quote. I dati grezzi esterni restano nell’area di ricerca.

[Campione Elo e licenza](https://github.com/lathise2025/table-tennis-elo-dataset) · [Risultati riproducibili del benchmark](../research/report-brier-audit-v42.json)

```bash
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 .research-data/venv-v18/bin/python \
  scripts/benchmark-brier-audit.py /workspace/scratch/v38-quote-sample.json \
  .research-data/v42/elo-2000.csv research/report-brier-audit-v42.json
```
