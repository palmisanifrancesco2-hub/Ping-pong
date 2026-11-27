# Motore probabilistico coerente — 7 novembre 2026

`src/domain/coherent-markets.ts` aggiunge un motore analitico indipendente. Dalla probabilità di vincere un punto fornita dal chiamante e dalle regole esplicite ricava probabilità compatibili tra loro. **La coerenza numerica non convalida la probabilità iniziale né dimostra capacità predittiva.** Ogni risultato restituisce `status: structural-experimental` e `operationallyValidated: false`.

## Ingresso e assunzioni

`coherentMatchMarkets(pointProbability, {bestOf, pointsToWin, winBy: 2}, totalPointCap=256)`.

Sono supportati formati dispari da BO1 a BO9, da 2 a 31 punti per vincere un set, e vantaggio minimo di due punti. Gli altri formati sono rifiutati. Le regole devono essere verificate alla fonte: non sono ricostruite dall’esito della partita. Gli endpoint matematici 0 e 1 sono accettati per testare i limiti deterministici, non costituiscono stime sportive.

Il modello assume scambi indipendenti, probabilità costante, set indipendenti con la stessa distribuzione. Non include servizio/risposta, stanchezza, forma live o il punteggio corrente. Non è un modello validato per pronostici live e non stima da solo la forza dei giocatori.

## Risultati disponibili

- Vincente casa/ospite e risultati esatti del match: la massa è condivisa con la distribuzione del totale set.
- Totale set e copertura handicap set per qualsiasi linea finita. Le linee intere restituiscono separatamente la probabilità di rimborso.
- Per ciascun set: probabilità che venga disputato, vincente **condizionato al fatto che si disputi**, vincente e set disputato, probabilità che non venga disputato. I set non disputati non vengono conteggiati come vittorie o sconfitte.
- Vittoria senza perdere set e probabilità di vincere almeno un set.
- Rimonta, definita esplicitamente come **casa vince il match dopo aver perso il primo set**. Sono restituiti evento congiunto e probabilità condizionata; non significa genericamente aver recuperato uno svantaggio in qualunque momento.
- Distribuzione della differenza dei punti e handicap punti, anche del singolo set.
- Totali punti del match e del set, punti attesi e probabilità dei punteggi terminali esatti di un set.

Gli helper `setHandicap` e `pointHandicap` aggiungono la linea al punteggio del giocatore scelto: casa −1,5 significa margine casa maggiore di 1,5. Le tre uscite `over`, `under`, `push` significano rispettivamente copertura, mancata copertura e rimborso; nel totale punti/set hanno il significato naturale di sopra, sotto e uguale alla linea.

## Coda infinita e precisione

Il set ai vantaggi può durare arbitrariamente. Il calcolo somma analiticamente la coda geometrica, conservando tutta la probabilità. Per i totali punti, i valori uguali o superiori al limite di convoluzione sono conservati in `overflowProbability`, con soglia `overflowFromInclusive`. Non si finge che la massa di eccesso sia esattamente sulla soglia.

`totalPointsLine` è preciso entro l’aritmetica numerica per linee inferiori alla soglia. Rifiuta linee uguali o superiori, che richiederebbero la distribuzione della coda non risolta. Si può aumentare il limite fino a 512. La media dei punti usa la somma analitica non troncata e non il contenitore di eccesso. Le differenze finali dei punti hanno supporto finito anche con vantaggi illimitati, perché ogni set lungo termina con margine ±2: quella distribuzione non è troncata.

## Verifiche eseguite

Sei test Vitest passati: corrispondenza con il modello analitico esistente per BO5/BO7; massa di punteggi, set e punti; invariabilità delle soglie aumentando il limite; handicap e inversione dei giocatori; raggiungibilità dei set; rimborso su linee intere; code dei vantaggi; valori attesi; rimonta definita; limiti deterministici; formati alternativi espliciti; rifiuto degli input non validi. TypeScript passato.

Nessuna modifica ai pesi o ai protocolli congelati. Il modulo non è una promozione di nuovi mercati operativi: l’integrazione deve mantenere separati regole verificate, qualità della stima iniziale, evidenza di validazione e presenza di quote realmente confrontabili.
