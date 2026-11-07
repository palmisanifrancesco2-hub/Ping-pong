# Studio v13: pesi temporali e ricerca bibliografica — 7 novembre 2026

Il protocollo `research/protocol-v13.json` è stato scritto prima del calcolo di questi nuovi candidati. È ricerca esplorativa su esiti già esaminati: non una preregistrazione indipendente. Non sono stati letti gli esiti prospettici v9/v10, né modificati i relativi protocolli.

## Ricerca online verificata

- Yao, Vehtari, Simpson e Gelman, [Using stacking to average Bayesian predictive distributions](https://arxiv.org/abs/1704.02030): combinazione di distribuzioni usando previsioni fuori campione e regolarizzazione. Il nostro esperimento è ispirato al principio di stacking con una regola di punteggio propria (Brier); non implementa il loro intero procedimento bayesiano PSIS-LOO.
- Kull, Silva Filho e Flach, [Beta calibration](https://proceedings.mlr.press/v54/kull17a.html), AISTATS 2017: studia mappe di calibrazione e i limiti di alcune trasformazioni. La beta calibration completa rimane una possibilità di studio, non è implementata qui. Il test usa una temperatura sul logit che conserva la simmetria scambiando i giocatori e include la trasformazione identità.
- Yu e colleghi, [Stroke-level performance fluctuation analysis in elite table tennis](https://link.springer.com/article/10.1186/s13102-025-01521-8), pubblicato il 10 gennaio 2026: analisi tecnica tramite probabilità degli scambi e modelli di Markov, su 100 incontri d’élite. Richiede dati dei singoli colpi/scambi che la nostra fonte non fornisce; non dimostra direttamente un vantaggio prematch sulle quote delle competizioni monitorate.

## Esperimento eseguito

Sono riutilizzate esclusivamente le previsioni storiche fuori campione del completo v7 e della proiezione con variabilità v11, con ID, etichette e orari comuni. Prima di ogni giornata UTC si raccolgono soltanto previsioni precedenti il cui esito era già disponibile prima dell’inizio di quella giornata. Servono almeno 400 osservazioni e tre giorni precedenti. Si ottimizzano due ricette fissate prima del test: peso della miscela, oppure peso e temperatura insieme. Penalizzazione 0,001 verso peso 50% e temperatura 1; peso tra 0 e 1, temperatura tra 0,5 e 1,5. Nessun intercetto per conservare la simmetria tra giocatori. Gradiente analitico e verifica della convergenza; nessuna scelta dei parametri sugli esiti del giorno di test.

I primi tre giorni dell’archivio servono alla calibrazione, lasciando **1.291 incontri comuni su sei giorni**. Non si confrontano direttamente questi tassi con quelli sulle 1.804 partite precedenti.

| Candidato sugli stessi 1.291 incontri | Corretti | Sbagliati | Brier |
| --- | ---: | ---: | ---: |
| Completo | 713 | 578 | 0,244420 |
| Proiezione con variabilità | 721 | 570 | 0,244989 |
| Media fissa 50% / 50% | 719 | 572 | **0,244240** |
| Peso appreso dal passato | 723 | 568 | 0,244416 |
| Peso e temperatura appresi dal passato | **724** | 567 | 0,244397 |

L’ultima ricetta indovina il 56,08%, guadagnando cinque esiti rispetto alla media fissa ma peggiorando il Brier. Pertanto non è dimostrato un miglioramento complessivo. Tutti gli intervalli appaiati sono correttamente non disponibili: con sei giorni non si raggiunge il minimo di sette già richiesto dal calcolo. Il limite non è stato abbassato. Anche sette giorni sarebbero pochi per conclusioni forti; l’intero archivio è già noto e le famiglie precedenti sono state esplorate ripetutamente.

Report: `research/report-v13.json`, incluse numerosità, orari limite e parametri per ogni giornata. Archivi e previsioni individuali restano in `.research-data/`, esclusi da Git. Nessuna quota storica eseguibile: non si stima profitto o EV realizzabile.

## Verifiche

Diciassette test Python passati, inclusi tre nuovi su esclusione degli esiti tardivi e degli incontri del giorno corrente, apprendimento verso il componente migliore, limiti dei parametri, inversione dei giocatori e probabilità estreme. Codice e report soltanto offline: frontend, backend, database e modelli operativi invariati; nessuna nuova build o pubblicazione dell’app necessaria. La conferma su nuove partite di questa specifica combinazione non è ancora attiva e non viene confusa con gli studi prospettici già esistenti.

Riproduzione dei controlli: `python -m unittest discover -s scripts -p 'test_*.py'`. La valutazione richiede gli archivi privati e rifiuta di sovrascrivere un report già ispezionato.
