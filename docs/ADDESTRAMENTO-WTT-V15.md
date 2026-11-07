# Addestramento e test WTT — 7 novembre 2026

Sono stati realmente addestrati quattro artefatti: logistica e gradient boosting, ciascuno separato per uomini e donne. Protocollo v15 scritto prima dell’esecuzione. Sono nuovi modelli di ricerca sul vincente; nessun modello operativo, studio prospettico o previsione privata dell’app è stato sostituito.

## Dati e divisione temporale

Fonte: [RSMD / Li02003121](https://github.com/Li02003121/racket-sports-dataset), [OSF](https://doi.org/10.17605/OSF.IO/PJUW8), dati dichiarati CC BY 4.0. Hash dei due CSV congelati nel protocollo, grezzi mantenuti locali. Gli otto risultati incoerenti sono esclusi. I formati dichiarati best_of e i ranking non sono usati: il primo è spesso errato e i secondi non hanno provenienza temporale verificata.

| Passaggio | Incontri |
| --- | ---: |
| Righe scaricate | 10.292 |
| Escluse per punteggio, vincente o arresto incoerente | 8 |
| Senza cinque precedenti disponibili per entrambi | 3.619 |
| Addestramento 2022–2023 | 2.284 |
| Calibrazione 2024 | 2.178 |
| Test distinto 2025 | 2.203 |

Il numero totale torna esattamente; le righe di test non addestrano i pesi. Gli esiti 2025 precedenti possono contribuire alle statistiche per partite successive, simulando l’aggiornamento dello storico, con il ritardo convenzionale descritto sotto. I modelli non vengono riaddestrati sugli esiti di test.

La fonte ha date, non orari d’inizio o timestamp di disponibilità ufficiale. Le caratteristiche usano solo risultati di date strettamente anteriori di oltre sette giorni: è un’ipotesi prudenziale dichiarata, non la verifica degli inizi o dell’assenza assoluta di leakage. Le date del fornitore possono essere date dell’evento anziché di ciascun incontro e non sono state confrontate con ogni scheda ufficiale. Pertanto questo esperimento non certifica pronostici prematch realmente registrati nel 2025.

## Modelli

Caratteristiche: differenza Elo, vittorie regolarizzate, ultime dieci partite, differenze dei margini di set e punti, scontri diretti regolarizzati, differenza nella dimensione dello storico. Solo dati già passati secondo le date della fonte e il ritardo dichiarato; ranking, nomi come variabili, best_of ed esiti correnti esclusi.

Logistica con C=1 e boosting con 100 iterazioni, profondità 3, learning rate 0,05, minimo 30 osservazioni per foglia e L2=5. Parametri fissati prima del test. Si aggiungono esempi invertendo i giocatori durante il training e si simmetrizzano gli output, così l’ordine del tabellone non diventa una scorciatoia predittiva. Sul solo 2024 si scelgono temperatura e contrazione verso 50%; Elo K=20 è il riferimento interpretabile.

## Risultati sui medesimi 2.203 casi del 2025

| Modello | Corretti | Sbagliati | Percentuale | Brier | Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Elo | 1.520 | 683 | 69,00% | 0,203134 | 0,592037 |
| Logistica | **1.540** | **663** | **69,90%** | **0,195449** | **0,573992** |
| Boosting | 1.495 | 708 | 67,86% | 0,202303 | 0,588409 |

La logistica dà 775 corretti su 1.141 nel maschile e 765 su 1.062 nel femminile. Non confondere questo 69,90% con i risultati del 55% circa sui campionati minori: cambiano fonte, atleti, competitività, periodo, dati disponibili e protocollo. Non sono modelli confrontati sugli stessi incontri dell’app.

Gli intervalli appaiati per coorte rispetto a Elo includono zero: sul Brier la logistica non dimostra ancora superiorità oltre l’incertezza. Sono calcolati sui giorni del calendario, in blocchi di tre giorni, 10.000 repliche e correzione prudente per 12 confronti previsti (otto effettivamente riportati per le due coorti; l’aggregato contiene solo metriche descrittive). Le date test osservate sono 25 per coorte e molte partite condividono lo stesso evento. Nessuna validazione operativa, confronto con probabilità bookmaker o prova di profitto: le quote storiche eseguibili mancano.

## Artefatti e controlli

- `research/protocol-v15.json`: scelte congelate prima della valutazione.
- `research/report-v15.json`: conteggi, metriche per coorte, calibrazione e intervalli.
- `research/training-v15-artifacts.json`: hash e dimensioni dei quattro modelli realmente addestrati, conservati privatamente in `.research-data/`.
- `scripts/train-large-wtt.py`: riproduzione; rifiuta di sovrascrivere report o modelli già ispezionati.
- `scripts/test_large_wtt.py`: controlli su risultati ritardati/futuri, date del giorno corrente, vincente errato, formato dichiarato ignorato, namespace degli ID, inversione dei giocatori e calibrazione identità.

Venti test Python superati. Audit del report verificato con SHA-256, 2.203 ID test unici tutti nel 2025, riconciliazione dei conteggi completa. I file individuali e i binari dei modelli sono esclusi da Git. Frontend e backend non sono cambiati: build e test TypeScript non sono stati rieseguiti per questo lavoro offline.

Per ottenere 10.000 vere previsioni di test dopo addestramento, calibrazione ed esclusioni serve un archivio più grande o un ampliamento verificato di MoviOdds. Questo lavoro usa oltre 10.000 righe di origine, ma non viene presentato come 10.000 previsioni indipendenti valutate. Over/Under e handicap richiedono verifica dei formati e ulteriori protocolli separati; non sono stati attivati usando metadati errati.
