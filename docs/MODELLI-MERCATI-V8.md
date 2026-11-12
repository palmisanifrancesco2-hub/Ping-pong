# Test dedicati di set, punti e handicap

Protocollo fissato in `research/protocol-v8.json`; risultati aggregati in `research/report-v8.json`. La ricerca non modifica pesi, campioni o regole del test prospettico `forward-value-v1-20261105` e non abilita nuovi pronostici operativi.

## Metodo e separazione temporale

Quattro famiglie: frequenze gerarchiche regolarizzate (giocatori/competizione/H2H), logistica, gradient boosting e foresta multiuscita. Le 63 caratteristiche comprendono gli otto indicatori precedenti, frequenze dei singoli risultati, totali e margini di set/punti dei giocatori, forma recente e H2H. I trenta referti disponibili più recenti contribuiscono al contesto di ogni giocatore. I nomi sono abbinati esattamente all'interno della competizione; nessuna identità esterna presunta.

**1.804 casi comuni**, quattro finestre temporali del vecchio archivio, minimo 30 precedenti per giocatore. Una prima finestra esclusa per tutti: addestramento insufficiente. Le caratteristiche usano solo referti disponibili prima dell'orario di previsione; le etichette di training e calibrazione devono essere disponibili prima del relativo cutoff. Gli orari di 3.348 eventi sono ricontrollati sulle risposte closing conservate. Il vecchio archivio era già stato esaminato: selezione esplorativa.

Per ogni target si sceglie il candidato dal Brier complessivo delle finestre storiche. Le eventuali riduzioni verso la frequenza della competizione si scelgono esclusivamente nella calibrazione precedente. Fit finale: 1.777 casi, calibrazione 386. Manifesto e hash dei modelli vengono salvati prima che lo script di conferma apra le nuove etichette. La raccolta può acquisire e sigillare i referti prima: il programma di selezione non legge quei file.

Il campione successivo contiene **249 partite**, verificate tramite closing, su **14 ore osservate del 5 novembre 2026**. L'ordine dei candidati deriva dall'hash dell'ID e non dagli esiti. La finestra termina alle 14:20:32 UTC come fissato nel protocollo, senza ampliarla dopo i risultati. Dei 271 candidati disponibili, 22 non hanno superato i controlli dell'orario; 271 richieste, zero errori. Tutte le caratteristiche della conferma rimangono ferme allo snapshot precedente raccolto il 4 novembre: nessun esito della conferma viene riutilizzato come input.

È una verifica **retrospettiva temporale**, non un test prospettico di scommesse: eventi e prezzi non erano stati registrati preventivamente. Il campione è inferiore ai **500 casi richiesti**, oltre a coprire un solo giorno. Non è lecito abbassare la soglia dopo aver visto i risultati.

## Risultati del campione successivo

Brier più basso è migliore. Il riferimento è la frequenza causale della competizione, regolarizzata sullo storico globale, non una probabilità fissa del 50%.

| Target | Candidato scelto sullo storico | Brier / riferimento |
| --- | --- | --- |
| Vincente partita | Frequenze regolarizzate | 0,24601 / 0,25012 |
| Primo set | Foresta | 0,24821 / 0,24977 |
| Over 19,5 punti primo set | Logistica, ridotta interamente al riferimento | 0,22517 / 0,22517 |
| Over 3,5 set | Frequenze regolarizzate | 0,23303 / 0,23093 |
| Over 4,5 set | Frequenze regolarizzate | 0,20734 / 0,20745 |
| Over 74,5 punti | Frequenze regolarizzate | 0,24928 / 0,25158 |
| Over 79,5 punti | Frequenze regolarizzate | 0,23200 / 0,23333 |
| Over 84,5 punti | Frequenze regolarizzate | 0,20927 / 0,21076 |
| Primo giocatore −1,5 set | Frequenze regolarizzate | 0,21404 / 0,21977 |
| Primo giocatore +1,5 set | Foresta | 0,23277 / 0,23722 |
| Primo giocatore −5,5 punti | Frequenze regolarizzate | 0,22493 / 0,23234 |
| Primo giocatore +5,5 punti | Frequenze regolarizzate | 0,22507 / 0,22965 |
| Primo giocatore −9,5 punti | Frequenze regolarizzate | 0,17074 / 0,17263 |
| Primo giocatore +9,5 punti | Frequenze regolarizzate | 0,16145 / 0,16614 |

Intervalli appaiati con bootstrap per blocchi mobili di tre ore, correzione Bonferroni sui 14 target. La differenza Brier modello−riferimento è sotto zero anche all'estremo superiore per −1,5 set, +1,5 set e −5,5 punti; è un segnale promettente su quel singolo giorno. **Zero modelli superano tutti i requisiti**: numerosità insufficiente e conferma prospettica su più giorni mancante. Per Over/Under e primo set gli intervalli includono zero. Il miglioramento non è dimostrato. Accuratezza elevata su esiti frequenti non prova un vantaggio contro le quote.

Under e selezioni dell'altro giocatore alla linea opposta si ottengono come complementi in questi mercati binari senza rimborso; non sono nuovi test indipendenti. Sono state usate soltanto linee a mezzo punto/set e partite complete BO5. Altre linee, formati, annullamenti e mercati live richiedono regole e test specifici. Nessun ROI o EV storico misurato senza prezzi effettivamente disponibili al momento della previsione.

La foresta applica pesi di foglia comuni agli indicatori dei risultati osservati, mantenendo l'ordine dei totali alle soglie dichiarate. È un prototipo CART multiuscita: **non** implementa l'algoritmo Distributional Random Forest basato su MMD. Logistiche indipendenti per linea non garantiscono automaticamente distribuzioni coerenti e non sono esportate come motore operativo. I semi fissi servono all'addestramento e alla stima d'incertezza, mai a generare esiti o pronostici casuali.

## Riproduzione

Dipendenze ricerca: `research/requirements.txt`; esclusivamente offline, senza aggiungerle al frontend o al deploy. Dataset e modelli individuali in `.research-data/`, esclusa da Git; il report pubblica solo aggregati.

1. `node --import tsx scripts/build-market-features.ts`
2. `python scripts/evaluate-market-distributions.py select`
3. `NODE_USE_ENV_PROXY=1 node --import tsx scripts/collect-market-confirmation.ts`
4. `node --import tsx scripts/build-market-confirmation-features.ts`
5. `python scripts/evaluate-market-distributions.py confirm`

La raccolta del punto 3 può precedere o affiancare il punto 2, mantenendo sigillate le etichette. Gli artefatti sono creati in esclusiva: non sovrascrivere la selezione dopo aver letto gli esiti. In un ambiente nuovo occorrono gli snapshot originali e la cache closing, non ricostruibili da un archivio che cambia nel tempo. Il limite di raccolta è storico, quindi eseguire oggi il collettore non promette gli stessi eventi.

Test: `python -m unittest discover -s scripts -p 'test_market_distributions.py'`, `npm run check`. Verificati causalità temporale, identità/duplicati, orientamento e linee degli handicap, nesting delle probabilità, calibrazione, purging delle etichette tardive, bootstrap e punteggi propri.

Fonti metodologiche: [Quantile Regression Forests](https://www.jmlr.org/papers/v7/meinshausen06a.html), [Distributional Random Forests](https://jmlr.org/papers/v23/21-0585.html), [scikit-learn: ensemble](https://scikit-learn.org/stable/modules/ensemble.html). Queste pubblicazioni motivano candidati: non attestano le prestazioni della nostra app.
