# Combinare proiezione e modelli statistici — 6 novembre 2026

La combinazione è possibile, ma più modelli non implicano automaticamente più pronostici corretti. Modelli che usano statistiche simili possono commettere molti degli stessi errori. Inoltre una miscela può migliorare la qualità delle probabilità e peggiorare il numero di esiti indovinati, o il contrario.

## Test effettivamente eseguito

Protocollo `research/protocol-v12.json` scritto prima del calcolo di queste combinazioni, con hash degli archivi. Non è una preregistrazione indipendente: gli esiti storici erano già stati esaminati nei precedenti studi. Sono testate tre ricette fisse, senza ottimizzare i pesi sui risultati:

- Proiezione con variabilità + candidato precedente: 50% ciascuno, 14 obiettivi. Per il vincente il candidato precedente è l’ensemble v7; negli altri mercati è la selezione storica v8.
- Proiezione + candidato precedente + Poisson: un terzo ciascuno, soltanto punti totali Over 74,5 / 79,5 / 84,5.
- Proiezione + logistica completa: 50% ciascuno, soltanto vincente.

In tutto 18 combinazioni su **1.804 incontri storici identici**, nove giorni. Ogni previsione dei componenti deriva dalle rispettive finestre temporali precedenti; le combinazioni riutilizzano quelle previsioni, senza nuovo addestramento o lettura degli esiti prospettici. Identità, ordine, etichette, orari, hash e insieme completo degli ID sono ricontrollati. Nessuna eliminazione per EV, consenso o correttezza.

## Risultati sul vincente

| Modello | Corretti | Sbagliati | Percentuale corretti | Brier |
| --- | ---: | ---: | ---: | ---: |
| Completo | 971 | 833 | 53,82% | 0,245877 |
| Proiezione con variabilità | 996 | 808 | 55,21% | 0,245772 |
| Completo + proiezione | 992 | 812 | 54,99% | 0,245395 |
| Ensemble precedente | 989 | 815 | 54,82% | 0,245733 |
| Ensemble precedente + proiezione | 994 | 810 | 55,10% | 0,245611 |

Completo + proiezione guadagna 21 esiti corretti rispetto al completo ma ne perde quattro rispetto alla proiezione. Ha il Brier più basso tra queste righe, senza dimostrare un vantaggio oltre l’incertezza rispetto a tutti i componenti. Per esempio la differenza rispetto al completo ha intervallo appaiato circa [−0,001240; +0,000141], che include zero. Non equivale a un aumento affidabile della probabilità di successo futuro.

Le selezioni errate di completo e proiezione hanno correlazione circa 0,648; i residui probabilistici correlano circa 0,997. Quest’ultima misura contiene anche la variabilità degli esiti condivisi e non va interpretata da sola come una misura pura di ridondanza dei modelli. Quando concordano, il risultato descrittivo è 826 corretti su 1.489 (55,47%); la copertura scende all’82,54%. Non è una regola di selezione validata o attivata nell’app.

## Altri mercati e incertezza

Alcune miscele migliorano il precedente candidato nel Brier storico, anche con un intervallo interamente negativo rispetto a quel solo riferimento: per esempio primo set e alcuni handicap. **Nessuna delle 18 miscele supera contemporaneamente tutti i componenti, il candidato precedente e la frequenza causale di riferimento oltre l’incertezza.** Non si dichiara che nessuna singola differenza sia favorevole.

Su Over 74,5 punti, la miscela con Poisson indovina 972/1.804 esiti contro 965/1.804 di Poisson da solo, ma ha un Brier peggiore (0,248453 contro 0,248038). È un esempio concreto del perché contare soltanto gli esiti corretti non basti per stimare il valore di una quota. Su handicap punti −9,5, il tasso di esiti corretti dell’80,65% coincide anche con la frequenza di riferimento: non dimostra capacità di battere il bookmaker.

Il report `research/report-v12.json` contiene metriche, componenti e confronti. Ricampionamento appaiato con blocchi di tre giorni, 10.000 repliche e correzione per 58 confronti dichiarati. Nove giorni e i ripetuti studi sullo stesso archivio limitano queste conclusioni; la correzione non controlla globalmente tutti gli esperimenti del progetto. Il riferimento migliore per mercato era stato selezionato sullo stesso storico. Nessuna validazione indipendente o redditività dimostrata.

## Prossimo sviluppo sensato

Un insieme con pesi appresi e ricalibrazione richiede una finestra temporale dedicata precedente ai test, regolarizzazione e successiva conferma su incontri futuri mai usati per scegliere la ricetta. Non abbiamo ottimizzato quei pesi sul campione appena mostrato. I test prospettici v9/v10 continuano con protocolli e previsioni originali; non inseriamo retroattivamente nuove probabilità nei registri.

Un modello dipendente dal servizio e dal punteggio potrebbe usare informazioni aggiuntive rispetto agli stessi risultati storici, ma richiede sequenze dei punti e servizio/risposta verificabili, attualmente mancanti. Elo/Glicko, logistiche, modelli gerarchici, boosting e foreste sono già stati studiati nel progetto: non vengono presentati come nuove scoperte.

Riferimenti verificati: Gneiting e Ranjan, [Combining Predictive Distributions](https://arxiv.org/abs/1106.1638), e [Combining Probability Forecasts](https://academic.oup.com/jrsssb/article/72/1/71/7076442). La letteratura studia anche la ricalibrazione delle miscele: la media di probabilità calibrate non conserva automaticamente la calibrazione. Questo test implementa soltanto combinazioni lineari a pesi fissi, non i metodi completi di ricalibrazione dei lavori citati.

## Verifiche e limiti operativi

Quattordici test Python superati, inclusi quattro nuovi su corrispondenza degli eventi, rifiuto di probabilità/pesi non validi, identità di decomposizione del Brier, modelli identici e consenso senza convertire i pareggi in pronostici decisi. I calcoli sono offline; nessun segreto, richiesta al bookmaker o nuova puntata. Archivi individuali esclusi da Git. Nessuna nuova combinazione attivata nelle quote, nelle registrazioni o nel live.

TypeScript, build Vite e avvio server ESM compilato passati. Browser Chromium con report aggregati reali: quattro righe del vincente, 18 combinazioni e 14 risultati precedenti, Android 393×851 e desktop 1440×1000 senza errori JavaScript o overflow. È il controllo del componente isolato, senza login del proprietario o scritture remote.
