# Addestramento con archivi estesi

Il ciclo precedente usava 161.655 risultati. Qui i controlli accettano **563.382 risultati**, un incremento netto di **401.727**. I modelli sono stati riaddestrati su **466.745 incontri** con almeno quattro precedenti utilizzabili per partecipante al momento previsto dal replay. I restanti risultati contribuiscono allo storico dove ammissibili. Il confronto cronologico precedente al riaddestramento ha valutato **288.713 incontri**. Parte dello storico era già presente in studi precedenti.

| Circuito | Risultati utilizzabili | Incontri per il riaddestramento | Test cronologico | Corretti | Log Loss rif. / candidato |
| --- | ---: | ---: | ---: | ---: | --- |
| Tennistavolo WTT M/F | 10.284 | 6.858 | 3.005 | 2.104 | 0,58086 / 0,57203 |
| Tennistavolo MoviOdds, ottobre–novembre 2026 | 23.557 | 16.764 | 9.851 | 5.378 | 0,68835 / 0,68506 |
| Tennistavolo Setka Cup 2022 | 7.843 | 5.556 | 3.008 | 1.759 | 0,68235 / 0,66941 |
| Tennis ATP/WTA singolare | 320.262 | 271.139 | 213.282 | 143.559 | 0,61251 / 0,60199 |
| Badminton BWF singolare | 48.324 | 37.334 | 16.820 | 12.153 | 0,55598 / 0,54196 |
| Freccette PDC | 26.196 | 24.586 | 11.390 | 7.457 | 0,62865 / 0,62911 |
| Snooker CueTracker | 113.275 | 101.512 | 29.824 | 19.855 | 0,61011 / 0,61021 |
| Boxe, titoli mondiali | 7.023 | 698 | 314 | 205 | 0,62235 / 0,61299 |
| MMA, UFC | 6.618 | 2.298 | 1.219 | 699 | 0,67856 / 0,67707 |

Nello stesso campione ATP/WTA il candidato riduce la Log Loss da 0,61251 a 0,60199, con differenza compresa tra −0,01155 e −0,00962 dopo correzione per nove confronti. Anche WTT e badminton mantengono una Log Loss migliore del riferimento. Lo snooker sul nuovo archivio ha una differenza incerta. I due gruppi di tennistavolo dai risultati MoviOdds e Setka indicano un miglioramento puntuale, con troppo poche settimane per l’intervallo corretto. I risultati storici per le nuove popolazioni vanno letti sul rispettivo riferimento della tabella. [Protocollo e risultati del ciclo precedente](ADDESTRAMENTO-SPORT-V2.md)

## Origine e controlli

- Tennis. 46 file ATP/WTA dal 2010 al 2025. Inclusi main draw, qualificazioni ATP e WTA, Challenger e ITF per i file di qualificazione dal 2019. Sono richiesti identità distinte, punteggi completi e migliore di tre o cinque. I dati sono deduplicati per tour, torneo, numero incontro e turno. ATP e WTA hanno spazi ID distinti. Le date di inizio torneo usano 21 giorni di ritardo prima di aggiornare lo storico. Archivio Jeff Sackmann, CC BY-NC-SA 4.0. [Versione delle fonti](https://github.com/Aneeshers/tennis-sackmann-archive/tree/83733587353df8a41f2fd4f516147d5aa83f5a8d)
- Snooker. SnookerDB di Joey O’Brien, basato sui risultati pubblicati da CueTracker. Il campione richiede un numero di frame conclusivo coerente con formato, punteggio e vincitore. Esclude walkover. Quando manca la data della partita si usa l’inizio del torneo per lo split e si attende la fine del torneo per aggiornare i risultati. File originari tenuti nell’area locale di ricerca. [Versione di SnookerDB](https://github.com/obrienjoey/snookerdb/tree/bb5780c1e39120b68373d6b072e9af2197dfb38b)
- Tennistavolo. Le copie MoviOdds da 3.000, 5.000 e studio prospettico sono unite per ID evento. I record in conflitto sono esclusi. Le date UTC di fine e disponibilità sono usate con almeno un giorno di margine. WTT e Setka SCORE 2022 restano coorti separate. [Archivio Setka SCORE](https://data.scorenetwork.org/table_tennis/table_tennis_sept2022.html) · [Verifica WTT](ADDESTRAMENTO-WTT-V15.md)
- Badminton, freccette, boxe e UFC riusano gli archivi documentati. [Origine degli altri archivi](QUOTE-MIGLIORI-SPORT.md)

Il test usa tre blocchi disgiunti per coorte e periodi precedenti per addestramento, scelta e calibrazione. Dopo il confronto, per ogni archivio è stata riaddestrata su tutto lo storico ammissibile la famiglia selezionata nell’ultima finestra, oppure ricostruito l’Elo finale, che non ha coefficienti da stimare. Sono nove artefatti di ricerca per sette sport. Le partite del test già osservate entrano a quel punto nel riaddestramento. I nuovi artefatti richiedono dati futuri per la conferma. Nessun prezzo Bet365 è stato usato per produrre queste metriche sul vincente.

## Riproduzione

Salva i file ATP e WTA indicati in `.research-data/tennis-expanded` con il nome originale e il file `Database/snookerdb.db` in `.research-data/snooker-expanded/snookerdb.db`. Conserva i CSV e gli snapshot MoviOdds come nei passaggi precedenti. Usa nuove cartelle di output per ogni esecuzione.

```sh
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 python research/evaluate-sports-walk-forward.py .research-data .research-data/studio-esteso --expand
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 python research/evaluate-sports-walk-forward.py .research-data .research-data/modelli-estesi --refit-from .research-data/studio-esteso/report.json
```

I rapporti riassuntivi sono disponibili nell’app in **Quote migliori**. [Risultati per finestra](../research/report-sports-walk-forward-v3.json) · [Registro del riaddestramento](../research/report-sports-refit-v3.json)
