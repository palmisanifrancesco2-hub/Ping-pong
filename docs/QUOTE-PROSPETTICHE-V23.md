# Quote dei pronostici futuri nell’app — v23

## Risultato concreto

Il confronto prospettico v10 salva già le due quote originali insieme alle quattro probabilità. La nuova sezione usa quei record e gli esiti verificati per mostrare, per ogni modello, numero di pronostici corretti/sbagliati, quota media, mediana, differenza delle medie e saldo ipotetico a una unità per scelta. Non ricostruisce i prezzi mancanti dai risultati o dalle quote attuali.

Percorso: **Statistiche modello → Confronto parallelo su partite future → Quote medie dei pronostici corretti e sbagliati**. Sezione richiudibile. Periodi: ultime 24 ore, 7/14/21/30/90/180/365 giorni e storico completo, basati sull’ora della previsione. Filtri distinti: tutte le scelte, quota almeno 1,30, quota almeno 1,30 ed EV nominale positivo. Nessun massimo di quota; filtro predefinito EV positivo. Il lato è quello più probabile secondo ciascun modello: non è una ricerca di tutte le possibili selezioni di valore.

Il ricaricamento dello stato mantiene aperta la sezione e conserva periodo/filtro. Un cambio account o demo azzera i dati; una risposta annullata non può ripristinare il report del vecchio account. Il filtro attivo è evidenziato e ha aria-pressed; periodi senza dati e gruppi senza vittorie/sconfitte mostrano indisponibilità esplicita, non medie inventate.

## Dati e integrità

`src/domain/winner-price-performance.ts` è un aggregatore puro. `WinnerShadow.report` lo applica ai record già controllati dal servizio; nessun nuovo endpoint, migrazione, credenziale, fetch al fornitore o scrittura in database è necessario per calcolare le statistiche. Il normale endpoint owner-only `/api/market-study` include soltanto i riepiloghi. Non restituisce record individuali, atleti, utente, vettori o hash delle previsioni nel nuovo campo.

Gli esiti pending/invalid rimangono nei conteggi. Eventi duplicati sono esclusi tutti dal riepilogo dei prezzi, con contatore; nessuna selezione della copia più favorevole. Timestamp futuri/non validi delle previsioni, esiti settled senza etichetta, quote mancanti/non valide, timestamp di cambio quota successivi alla previsione e board non osservato entro 30 secondi sono conteggiati esplicitamente. Le probabilità non valide o esattamente al 50% restano escluse con motivo. Non si applica un limite di età al solo timestamp di cambio prezzo: un prezzo stabile può essere vecchio; il collector originale ha già verificato la freschezza della lettura del mercato al momento della cattura.

La registrazione precedente all’inizio effettivo e la corrispondenza dell’esito sono verificate dal percorso di settlement originale, conservato. Il nuovo riepilogo non ricertifica i risultati come ufficiali o i prezzi come eseguibili. Tutti i casi originali, forecastHash, prefixHash, probabilità, versioni dei modelli, protocollo e criteri di checkpoint restano invariati. Non si ricalcolano checkpoint già sigillati con nuove regole.

## Interpretazione statistica

Questi sono i quattro modelli dello studio prospettico v10, non CatBoost, NGBoost, rete MLP o Random Forest dei confronti retrospettivi v18–v22. Quei modelli offline non sono stati aggiunti automaticamente al cron o promossi nell’app. I campioni v9 e v10 possono sovrapporsi e non si sommano come nuove partite.

Il saldo teorico è somma delle quote delle scelte corrette meno il numero delle scelte, con una unità ipotetica per ciascuna. Non è una puntata registrata, né il profitto reale dell’utente o un ROI verificato. EV nominale positivo su probabilità ancora da validare non autorizza opportunità operative. I filtri non cambiano la coorte o l’ordine d’iscrizione dello studio. Nessuna selezione di un modello in base al saldo, nessuna promessa di affidabilità e nessuna attivazione automatica.

## Verifiche completate prima del rilascio

293 test applicativi in 42 file, TypeScript, build Vite e smoke del server ESM compilato passati. Sei nuovi test significativi verificano selezione del lato, medie/mediane e aritmetica, filtri separati senza quota massima, EV zero, vuoti/pareggi, quote future o mancanti, prezzo stabile, finestre temporali, duplicati, esiti/probabilità non validi, immutabilità e assenza di identificativi privati nell’output.

Chromium locale: componente integrato nella raccolta prospettica con report e autorizzazione di QA esclusivamente sintetici, quattro modelli, apertura/chiusura, tre filtri, periodo vuoto, ripristino dello storico e ricaricamento che mantiene sezione e filtro. Android 393×851 e desktop 1440×1000 senza overflow o errori JavaScript. Questi dati sintetici verificano il software, non le prestazioni sportive. Nessun token o sessione del proprietario, lettura privata o scrittura remota da QA.

Revisione React: fetch esistente riutilizzato, nessuna nuova cascata di richieste, import dei tipi eliminati dal bundle, solo quattro schede, chiavi stabili, label del select e stato accessibile dei pulsanti. Nessuna nuova libreria o componente pesante. La sezione è chiusa inizialmente per mantenere leggibile la pagina da telefono.

Il rilascio normale e gli aggregati effettivamente osservati verranno aggiunti qui dopo la verifica; la sola implementazione non prova la riuscita del cron del 18 novembre.
