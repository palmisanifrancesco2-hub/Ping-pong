# Proiezione dei punteggi e confronto Poisson — 6 novembre 2026

La proiezione è l’obiettivo: ricavare la distribuzione dei possibili risultati. Poisson è una specifica distribuzione per conteggi. Non sono due parole equivalenti né una garanzia di precisione.

## Modelli realizzati

- **Proiezione dei punti:** una regressione stima la probabilità di vincere un punto usando otto differenze causali di forza dei giocatori. Il processo applica set a 11 con due punti di vantaggio e partite al meglio dei cinque set. Le probabilità derivano dalla somma dei possibili sviluppi, senza pronostici casuali.
- **Proiezione con variabilità:** una distribuzione Beta permette alla forza relativa di variare tra partite. La sua dispersione è stimata sui punteggi di addestramento; non è una misura completa dell’incertezza sui parametri. Le probabilità sono integrate deterministicamente.
- **Poisson sui punti totali:** regressione del conteggio complessivo, condizionata al minimo di 33 punti di una partita completa al meglio dei cinque set. Testata esclusivamente sugli Over 74,5 / 79,5 / 84,5. Non ricava il vincente: si può vincere la partita facendo meno punti dell’avversario.

Il processo dei punti produce marginali coerenti per vincente, primo set, totale punti primo set, numero di set, totale punti e handicap di set/punti. Under e selezioni opposte sono complementi solo sulle linee a mezzo punto qui esaminate. Non si estendono automaticamente i risultati ad altre linee, formati o al live.

Riferimento teorico verificato: Dominicy, Ley e Swan, [A Stochastic Analysis of Table Tennis](https://arxiv.org/abs/1109.6628). Il nostro modello senza dipendenza dal servizio è un caso semplificato; la variabilità Beta è una nostra estensione. La fonte non fornisce sequenze dei punti, primo battitore o statistiche servizio/risposta: non abbiamo implementato il modello completo dipendente dal servizio del lavoro citato.

## Confronto realmente eseguito

Protocollo `research/protocol-v11.json` fissato prima dell’esecuzione; implementazione `scripts/score_projection.py`, valutazione `scripts/evaluate-score-projection.py`. È ricerca esplorativa su un archivio già esaminato, non una nuova validazione indipendente preregistrata.

Usati esattamente **1.804 incontri comuni**, con almeno 30 precedenti per giocatore, quattro finestre temporali e nove giorni di test. Tutti i 14 obiettivi hanno gli stessi ID. Risultati riportati da MoviOdds, con orari storici già verificati tramite closing; etichette ricalcolate dai set e confrontate con quelle dell’archivio. Addestramento e calibrazione precedono ogni finestra, incluse le date di disponibilità degli esiti. Le caratteristiche dei test si aggiornano soltanto con passato disponibile. Addestramento finale 1.777 incontri e calibrazione 386.

La calibrazione sceglie temperatura e peso verso frequenze causali soltanto sul proprio intervallo. Pesi, dispersione e iperparametri non sono selezionati dai 64 esiti diagnostici o dalle raccolte prospettiche v9/v10, che non vengono lette dal programma. Gli archivi privati individuali rimangono esclusi da Git.

Brier più basso indica probabilità migliori. Alcuni risultati rappresentativi:

| Obiettivo | Nuovo candidato | Brier nuovo | Migliore precedente |
| --- | --- | ---: | ---: |
| Vincente | Proiezione con variabilità | 0,245772 | 0,245733 |
| Primo set | Proiezione con variabilità | 0,248386 | 0,248863 |
| Over 3,5 set | Proiezione con variabilità | 0,201886 | 0,201722 |
| Over 74,5 punti | Poisson | 0,248038 | 0,248734 |
| Over 79,5 punti | Poisson | 0,239425 | 0,239016 |
| Over 84,5 punti | Proiezione con variabilità | 0,220314 | 0,219302 |
| Handicap punti −5,5 | Proiezione con variabilità | 0,218840 | 0,220006 |

Il report primario confronta 31 coppie candidato/obiettivo con la frequenza causale di riferimento. Un approfondimento successivo confronta gli stessi ID con i candidati precedenti: ensemble v7 per il vincente e selezioni storiche v8 per gli altri obiettivi. Non è un nuovo esperimento confermativo. Intervalli appaiati con ricampionamento in blocchi di tre giorni, 10.000 repliche e correzione prudente per 62 confronti nel secondo report; appena nove giorni limitano comunque la stima dell’incertezza. Questa correzione non dimostra controllo globale di tutti gli esperimenti svolti nel progetto.

**Nessuno dei nuovi candidati dimostra un miglioramento oltre l’incertezza rispetto al migliore precedente.** Per esempio, Poisson su Over 74,5 migliora il Brier di circa 0,000696, ma l’intervallo della differenza è circa [−0,003021; +0,000021] e include zero. Selezionare a posteriori il candidato minimo per ogni riga non costituisce validazione indipendente.

Report completi: `research/report-v11.json` e `research/report-v11-existing.json`. La pagina **Statistiche modello** ne mostra i risultati aggregati e la distinzione tra proiezione e Poisson. Nessuna nuova opzione operativa, sostituzione del modello, percentuale live o previsione nei registri privati deriva da questo esperimento. Nessuna prova di profitto: mancano quote eseguibili registrate prima degli incontri in questo archivio.

## Calcoli e verifiche

Il calcolo tiene tutta la coda infinita dei vantaggi: i punti oltre il limite di convoluzione finiscono in un contenitore di eccesso, senza perdere probabilità alle soglie dichiarate. Le marginali degli handicap mantengono l’intera massa. La miscela Beta usa quadratura di Gauss–Jacobi normalizzata, evitando overflow della normalizzazione.

- Dieci test Python superati, compresi cinque nuovi su massa, vantaggi, inversione dei giocatori, linee annidate, limiti deterministici, momenti Beta, quadratura estrema, ottimizzazione e miscela coerente.
- Differenza massima di interpolazione osservata su 97 controlli: circa 0,000000697. Differenza massima osservata tra quadratura a 21 e 41 nodi: circa 0,000000282. Sono controlli numerici sui punti esaminati, non limiti uniformi certificati.
- TypeScript, build Vite e avvio ESM del server compilato superati; health 200 e rifiuto 401 degli endpoint anonimi nel controllo locale senza segreti e senza chiamate esterne.
- Chromium locale Android 393×851 e desktop 1440×1000: componente isolato con report aggregati reali, spiegazioni apribili e 14 righe, nessun errore JavaScript o overflow. Il controllo non usa il login del proprietario e non certifica il flusso privato completo in produzione.

Riproduzione dei test software: `python -m unittest discover -s scripts -p 'test_*.py'`. Le valutazioni storiche richiedono gli archivi locali esclusi da Git e le dipendenze fissate in `research/requirements.txt`; rifiutano di sovrascrivere i report già ispezionati. Non confondere i dieci test software con le 1.804 partite del confronto.
