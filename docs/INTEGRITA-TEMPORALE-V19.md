# Integrità temporale e trasparenza v19 — 12 novembre 2026

## Correzione mirata

Le istanze server warm possono riutilizzare la stessa fotografia dei risultati per varie richieste. Prima di v19, le cache dei motori `scoreSignals` ed `ensembleSignals` erano indicizzate solo dall'identità dell'archivio: modificando il momento della previsione, il motore poteva riusare risultati non ancora disponibili al cutoff (o ignorare risultati diventati disponibili). In produzione il tempo normalmente avanza, ma anche il riuso a un cutoff successivo poteva diventare incoerente.

`server/as-of-window.ts` definisce il limite rigoroso `availableAt < predictedAt` e la finestra esatta entro cui un'istanza può riutilizzare il calcolo senza cambiamenti. Entrambi i motori usano ora lo stesso helper. Le finestre di validità sono determinate dai timestamp verificati dell'archivio; risultati senza timestamp valido vengono esclusi, mai trattati come noti.

Test aggiunti per risultati disponibili esattamente al cutoff, avanzamento e ritorno del tempo, motore singolo ed ensemble. Le previsioni registrate e i protocolli prospettici precedenti non vengono ricalcolati o sovrascritti.

## Ricerca visibile nel prodotto

La sezione **Statistiche modello** presenta un riepilogo compatto e verificabile del benchmark probabilistico v18: 1.804 incontri su 9 giorni e 14 mercati. Il riepilogo è derivato dal report congelato e verificato automaticamente da un test che ne controlla ogni Brier. Il bundle del sito non contiene l'archivio di incontri né gli artefatti privati.

Questo non rende CatBoost, NGBoost o flow modelli operativi: i risultati derivano da periodi già esaminati e mancano quote storiche eseguibili per un ROI. Nessuna credenziale, variabile di ambiente, migrazione database, quota, funzione cron o policy di promozione è stata cambiata.

## Prossimo requisito per miglioramento predittivo effettivo

Servono dati prospettici nuovi su più giorni e più competizioni, con screenshot/snapshot di prezzo originali e disponibilità del risultato, per confronti sullo stesso campione fuori campione. Una migliore architettura da sola non garantisce un incremento misurato dell'accuratezza.
