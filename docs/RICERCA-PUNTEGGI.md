# Modello sui punteggi e verifica prospettica

Protocollo `research/protocol-v3.json`, registrato nel commit `7cc3386` prima di valutare le nuove configurazioni.

## Approccio

Regressione logistica simmetrica, senza intercetta: invertire i giocatori produce probabilità complementari. Otto caratteristiche ricostruite solo con risultati disponibili prima dell'istante della previsione:

1. Differenza Elo K=20 (riferimento di forza relativo agli avversari).
2. Differenza della frazione di punti vinti nelle ultime 20 partite, con smoothing.
3. Differenza della frazione di set vinti nelle ultime 20 partite.
4. Differenza della frequenza di vittorie nelle ultime 10 partite.
5. Differenza della frequenza di vittorie nelle ultime 30 partite.
6. Scontri diretti con regolarizzazione verso neutralità quando il campione è piccolo.
7. Differenza del tempo dall'ultima partita disponibile, limitata a tre giorni.
8. Differenza del numero di partite nelle ultime 24 ore.

Il tempo dall'ultima partita e il carico di incontri sono misure osservate, non affermazioni sullo stato fisico del giocatore. Punti e set non sono prove indipendenti: il modello li tratta come caratteristiche della partita, non come centinaia di campioni indipendenti.

Tre gruppi di caratteristiche (punteggi, completo, forma) e tre penalizzazioni L2 (0,001; 0,01; 0,1), per nove candidati. Scelta tramite Brier su un periodo distinto dall'addestramento. Calibrazione simmetrica con temperatura selezionata tra 0,25 / 0,5 / 0,75 / 1 / 1,25 / 1,5 tramite Log Loss nel solo periodo di calibrazione.

## Separazione temporale

- Addestramento: risultati dei target precedenti al 26 ottobre, disponibili prima del 26 ottobre.
- Scelta: 26–27 ottobre, esiti disponibili prima del 28 ottobre.
- Calibrazione: 28–29 ottobre, esiti disponibili prima del 30 ottobre.
- Nuovo test: 600 eventi campionati deterministicamente dal 30 ottobre al 1 novembre, escludendo gli ID con orari noti della ricerca v2.
- Ciascuna previsione ricostruita un minuto prima dell'inizio noto, con almeno 20 risultati disponibili per entrambi i giocatori.

I pesi e la temperatura sono congelati prima del test. I dati dei giocatori possono aggiornarsi sequenzialmente con esiti già disponibili. Le metriche confrontano il candidato con 50/50 ed Elo K=20 sugli stessi eventi; il miglioramento deve avere anche il limite superiore dell'intervallo appaiato per giorno sotto zero. Richiesti almeno 200 eventi, tre giorni, 40 casi di calibrazione, Log Loss migliore dei riferimenti ed ECE sotto 0,08.

**Limite essenziale:** i nuovi ID non rendono incontaminato un periodo già esplorato. È una ricerca retrospettiva aggiuntiva; da sola non attiva un modello operativo validato.

## Previsioni registrate prima delle partite

`scripts/capture-forward-study.ts` registra un gruppo reale di eventi futuri, con pesi già congelati, dati giocatore realmente disponibili, quote lette in quel momento, timestamp della fonte e dell'osservazione. La finestra è 5 minuti–48 ore dall'osservazione; sono richieste identità coerenti, storico minimo e coppia completa del mercato vincente partita, aggiornata secondo la fonte.

Il file completo rimane in `.research-data/`, escluso da Git. Un manifesto con hash SHA-256, numero di eventi e protocollo viene registrato in Git prima di conoscere gli esiti. I file sono creati con modalità esclusiva e non sovrascritti. Non sono suggerimenti operativi, puntate o pronostici inseriti retroattivamente nello storico dell'app.

`scripts/score-forward-study.ts` verifica l'hash e confronta gli esiti con risultati completi della fonte; richiede anche conferma dell'inizio effettivo dopo l'osservazione e delle identità esatte. I casi irrisolti restano tali. Nessun singolo gruppo viene dichiarato validato automaticamente.

Il protocollo prospettico richiede almeno 200 eventi su almeno sette giorni, confronto appaiato con 50/50 e probabilità bookmaker senza margine, Log Loss migliore ed ECE sotto 0,08. La raccolta effettuata dal comando è una singola osservazione: **non è un servizio pianificato in background**. L'ambiente cloud conserva il file di lavoro; non è stato configurato un archivio remoto aggiuntivo.

## Riproduzione per lo sviluppatore nell'ambiente cloud

```sh
NODE_USE_ENV_PROXY=1 npx tsx scripts/collect-research.ts /tmp/pingpong-results-all.json /tmp/pingpong-research-v3.json research/protocol-v3.json /tmp/pingpong-research-v2.json
npx tsx scripts/evaluate-score-models.ts /tmp/pingpong-research-v2.json /tmp/pingpong-research-v3.json research/report-v3.json
NODE_USE_ENV_PROXY=1 npx tsx scripts/capture-forward-study.ts research/report-v3.json .research-data/forward-v3.json research/forward-v3-manifest.json
NODE_USE_ENV_PROXY=1 npx tsx scripts/score-forward-study.ts .research-data/forward-v3.json .research-data/forward-v3-audit.json research/forward-v3-manifest.json
```

Fonte: MoviOdds. Risultati aggregati, non certificati indipendentemente. Nessun acquisto, nuova chiave o scommessa.

## Risultato effettivo del test

600 eventi selezionati, 577 orari verificati e **385 casi utilizzabili** nel test finale. Addestramento su 202 casi, scelta su 75, calibrazione su 92. Selezionato `scores:0.001`: Elo, frazione di punti e frazione di set, temperatura 1,5.

- Esiti corretti: **55,32%**.
- Brier **0,247901**, rispetto a 0,250000 del 50/50 e **0,247380** di Elo K=20 sugli stessi casi.
- Log Loss **0,688948**, rispetto a 0,693147 e 0,688261.
- ECE a cinque intervalli: **0,007677**; valore aggregato su questo campione, non certificazione della precisione di ogni percentuale.
- Differenza Brier per giorno rispetto a 50/50: intervallo diagnostico 95% **[−0,005512; +0,001496]**, che comprende zero.
- Il miglioramento rispetto al riferimento neutrale è piccolo e non statisticamente convincente con tre giorni. Il modello non supera Elo sugli stessi casi. **Controlli di validazione non superati.**

Questo è un segnale da studiare, non un modello dichiarato affidabile. Non si confronta direttamente il Brier 0,247901 con il precedente 0,252164 come prova di superiorità: i campioni sono differenti. Il confronto corretto con Elo è quello sugli stessi 385 eventi riportato sopra.

## Prima osservazione prospettica effettiva

Il 4 novembre 2026 alle **22:17:32 UTC** sono state registrate **304 previsioni**, per eventi previsti tra le 22:25 UTC del 4 novembre e le 21:30 UTC del 5 novembre. Il manifesto e il modello congelato sono nel commit `39f93c9`, inviato a GitHub prima dell'inizio previsto del primo evento. L'hash del file completo è stato verificato; dati individuali e archivio necessario alla ricostruzione sono esclusi da Git.

Questo gruppo copre meno di due giorni: non soddisfa da solo il requisito di almeno sette giorni. Non è stata attivata una raccolta periodica automatica. La schermata mostra il manifesto del campione; non presenta esiti ancora non verificati.
