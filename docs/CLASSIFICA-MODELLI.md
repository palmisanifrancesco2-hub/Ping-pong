# Classifica comparabile su partite già giocate

Protocollo v4 fissato prima dell'esecuzione nel commit `0ff475a`. Questo confronto risponde alla domanda «quale modello ha ottenuto il punteggio migliore sullo stesso storico?». Non dimostra un migliore assoluto né una validazione indipendente: l'archivio è già stato esplorato.

## Dati e metodo

Unione degli archivi v2/v3: 1.533 orari verificati con identità esatte e kickoff non stimato; 956 casi con almeno 20 risultati disponibili per entrambi i giocatori. Tutte le risposte closing sono ricontrollate dalla cache, senza nuove richieste a pagamento o nuovi dati inventati. I due snapshot dei risultati devono avere hash identico; duplicati o incongruenze interrompono il confronto.

Cinque finestre di test: 25–26, 27–28, 29–30, 31 ottobre–1 novembre e 2 novembre. Ogni finestra ha addestramento precedente a due giorni prima dell'inizio e calibrazione sui due giorni precedenti. Gli esiti devono essere disponibili strettamente prima della rispettiva soglia. Minimi: 50 casi di addestramento, 40 di calibrazione. Le caratteristiche dei giocatori si aggiornano solo con risultati già disponibili al momento della previsione.

Sei modelli Elo/forma e nove regressioni logistiche. Per tutti si sceglie una temperatura simmetrica tramite Log Loss nel solo periodo di calibrazione; nessuna scelta di temperatura usa il test. Per ogni modello si conserva esattamente la stessa sequenza di ID di test: una differenza di copertura interrompe l'esperimento.

Classifica primaria: Brier aggregato, poi Log Loss per gli eventuali pareggi. La percentuale di esiti corretti e la media Brier con uguale peso a ciascun giorno sono indicatori secondari dichiarati prima del confronto.

## Risultati effettivi

**784 partite uguali per tutti i 15 modelli, 9 giorni, 5 finestre.**

| Modello | Brier | Log Loss | Esiti corretti |
| --- | ---: | ---: | ---: |
| Logistica completa, λ=0,001 | 0,246657 | 0,686461 | 57,65% (452/784) |
| Elo K=10 | 0,246808 | 0,686774 | 57,53% |
| Logistica forma, λ=0,001 | 0,247015 | 0,687181 | 58,55% |

La logistica completa usa Elo, punti, set, forma a 10/30 partite, scontri diretti, distanza dall'ultima partita e numero di incontri recenti. Queste misure non certificano lo stato fisico del giocatore.

Il primo per percentuale di esiti corretti è diverso dal primo per precisione delle probabilità: non si cambia il criterio dopo aver visto il risultato. Dando lo stesso peso ai giorni, il primo è **Elo K=10**. L'archivio contiene più casi in alcune giornate: la sensibilità alla ponderazione è una limitazione concreta.

La differenza Brier tra logistica completa ed Elo K=10 è appena −0,000150. L'intervallo diagnostico al 95% va da −0,003709 a +0,007123 e include zero. **Non è dimostrata una superiorità netta sul secondo classificato.**

Il riferimento 50/50 ha Brier 0,25. Il primo classificato lo supera nel campione; questo non dimostra un vantaggio rispetto alle quote dei bookmaker o un profitto realizzabile.

## Incertezza e limiti

10.000 ricampionamenti per giorno, seme fisso, per differenze appaiate del Brier. La casualità serve soltanto a stimare l'incertezza: tutte le previsioni e gli esiti restano deterministici e reali. Gli intervalli includono un aggiustamento nominale per 15 confronti, ma restano diagnostici: il vincitore è selezionato negli stessi dati e il procedimento non certifica un controllo dell'errore successivo alla selezione. Giocatori ripetuti possono creare dipendenza anche tra giorni.

Nessun cambio automatico del modello operativo. Le 304 previsioni prospettiche v3 restano identiche, con il loro modello originale e hash; non si sostituisce il modello dopo aver registrato le previsioni.

Il report pubblico di ricerca `research/report-v4.json` conserva metriche, finestre, hash del protocollo e degli input e hash dell'audit. Predizioni individuali e parametri per finestra restano in `.research-data/comparison-v4-audit.json`, escluso da Git e dalle risposte API. L'API è privata.

## Riproduzione nell'ambiente cloud

```sh
npx tsx scripts/compare-models.ts /tmp/pingpong-research-v2.json /tmp/pingpong-research-v3.json research/new-comparison.json .research-data/new-comparison-audit.json
npm run check
```

I file di output sono creati in modo esclusivo: non vengono sovrascritti report o campioni esistenti.
