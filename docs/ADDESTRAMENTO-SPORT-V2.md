# Secondo ciclo di addestramento sui sette sport

Lo studio riguarda il vincente e misura la qualità delle probabilità. Sono stati riaddestrati e salvati sette candidati di ricerca con un confronto su **66.505 partite distinte tra le finestre di test di ciascuno sport**. Gli archivi sono in larga parte già usati in studi precedenti. I risultati non costituiscono una nuova conferma indipendente e le quantità non vanno sommate ai test pubblicati in precedenza.

## Risultati

| Sport e ambito | Partite | Corretti candidato | Log Loss riferimento | Log Loss candidato | Differenza e intervallo simultaneo 95% |
| --- | ---: | ---: | ---: | ---: | --- |
| Tennistavolo WTT M/F | 3.005 | 2.104 | 0,58086 | 0,57203 | −0,00883 [−0,01285, −0,00433] |
| Tennis ATP singolare | 6.495 | 4.177 | 0,62434 | 0,62259 | −0,00175 [−0,00374, +0,00036] |
| Badminton BWF M/F | 16.820 | 12.153 | 0,55598 | 0,54196 | −0,01402 [−0,01831, −0,00988] |
| Freccette PDC | 11.390 | 7.457 | 0,62865 | 0,62911 | +0,00046 [−0,00005, +0,00101] |
| Snooker storico | 27.262 | 16.877 | 0,64601 | 0,64717 | +0,00116 [+0,00032, +0,00195] |
| Boxe, titoli mondiali | 314 | 205 | 0,62235 | 0,61299 | −0,00936 [−0,02915, +0,00961] |
| MMA, UFC | 1.219 | 699 | 0,67856 | 0,67707 | −0,00149 [−0,00640, +0,00314] |

Una Log Loss più bassa indica probabilità migliori. WTT e badminton migliorano in ciascuna delle tre finestre. Nello snooker il riferimento conserva un vantaggio sul candidato e nelle freccette ha una Log Loss più bassa con differenza incerta. Tennis ATP, boxe e MMA hanno stime puntuali favorevoli al candidato e intervalli simultanei che comprendono lo zero. La boxe è il campione più piccolo.

## Metodo

- In ciascuno sport ci sono tre finestre di test disgiunte. Ogni finestra ha periodi precedenti distinti per addestramento, scelta della famiglia e calibrazione della temperatura. Le famiglie possono cambiare tra le finestre.
- Il riferimento sceglie fra Elo e logistica con rating, frequenza di vittorie ed esperienza. Il candidato può scegliere anche una logistica con Elo più reattivo, forma, riposo e scontri diretti regolarizzati o un gradient boosting con le stesse caratteristiche. Entrambi sono valutati sulle stesse partite e usano la stessa procedura di calibrazione.
- I risultati entrano nello storico soltanto dopo il margine temporale dichiarato. WTT e ATP usano date di riferimento dei tornei con un margine di 21 giorni. Per gli altri archivi si usa una data di calendario e si attendono giorni successivi. Lo snooker usa l’intera stagione come blocco e non aggiorna le caratteristiche all’interno della stagione. Queste date non rappresentano l’orario prematch effettivo.
- Le differenze di Log Loss sono abbinate partita per partita. Gli intervalli ricampionano settimane, o stagioni per lo snooker, applicando una correzione per i sette confronti. Le metriche includono Brier ed errore di calibrazione ECE con dieci raggruppamenti.
- I risultati sono stati integrati nella sezione **Quote migliori** come ricerca. Le stime sul feed corrente e le classifiche di valore non adottano questi candidati senza una verifica prospettica degli incontri e delle quote disponibili prima dell’inizio. WTT, ATP, BWF, PDC e UFC descrivono solo i rispettivi circuiti.

## Riproduzione

Prepara gli archivi come nei precedenti studi e tieni i file grezzi fuori dal repository. Comando di confronto `OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 python research/evaluate-sports-walk-forward.py .research-data .research-data/sports-walk-forward-new`. Il runner salva gli artefatti finali per sport e il rapporto con metriche per finestra e hash delle fonti. I file dei modelli rimangono nella cartella di ricerca. [Archivi multisport](QUOTE-MIGLIORI-SPORT.md) · [Origine WTT](ADDESTRAMENTO-WTT-V15.md) · [Origine ATP](SPORT-INDIVIDUALI.md) · [Rapporto completo](../research/report-sports-walk-forward-v2.json)
