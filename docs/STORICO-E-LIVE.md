# Badge live e storico delle previsioni

Modifica richiesta il 4 novembre 2026. Nessuna previsione o risultato retroattivo creato e nessuna nuova migrazione.

## Quote live

Polling dell'intero feed ogni 30 secondi mentre la pagina è visibile e la sessione è attiva, con cache di 30 secondi per istanza server. Non è una garanzia che ogni prezzo cambi o che la fonte sia disponibile entro 30 secondi. La conferma del singolo mercato resta distinta dal timestamp dell'ultimo cambio prezzo.

Badge rosso **LIVE**, bordo della partita e punteggio del provider quando presente, solo se `in_play=true` e lettura evento entro 60 secondi, con tolleranza massima futura di 60 secondi. Senza lettura recente compare **LIVE NON CONFERMATO** in giallo. Dashboard con numero di live aggiornati, pulsante Solo LIVE e filtro stato; il filtro include anche live segnalati dalla fonte ma non confermati, riconoscibili dal badge giallo. Nessun punteggio inventato.

## Storico privato

`GET /api/history?period=30&page=1&status=all` richiede autenticazione Supabase e appartenenza privata. Legge le tabelle esistenti con il JWT dell'utente e RLS, più filtro esplicito `user_id`; nessuna chiave amministrativa usata nell'endpoint. Seleziona solo modalità reale e previsioni registrate entro l'istante della richiesta. Errori non convertiti in contatori zero e nessuna cache condivisa tra utenti.

Intervalli mobili sulla data di registrazione: 24 ore, 5/7/10/14/15/21/30 giorni, tutti i mesi intermedi a passi di 30 giorni fino a 330, un anno di 365 giorni, storico completo. I mesi non sono mesi di calendario; il periodo esatto è visualizzato.

Esiti: corretta, sbagliata, annullata, in attesa ed esito da verificare. Gli esiti conclusi devono riferirsi allo stesso evento della previsione, con data di settlement coerente; corrette/sbagliate richiedono risultato registrato come ufficiale. Una probabilità elevata o un punteggio da soli non producono un esito. Esiti incoerenti sono da verificare, esclusi da accuratezza e profitto.

Percentuale corrette = vinte/(vinte+perse). Annullate e in attesa non entrano nel denominatore. Profitto teorico a 1 unità: quota-1 per corretta, -1 per sbagliata, 0 per annullata; nessuna conversione in puntate reali o euro. Il filtro esito restringe l'elenco, mentre i contatori descrivono il periodo analizzato completo. Quote registrate, probabilità, dimensione del campione, versione/stato del modello, fonte risultato, timestamp ed esito sono mostrati per ogni registrazione. Queste statistiche descrittive non certificano una validazione fuori campione.

Pagine da 50 righe. Per proteggere le risorse gratuite la lettura analizza al massimo le ultime 10.000 previsioni del periodo; oltre tale limite restituisce conteggio totale e un avviso di analisi parziale, senza presentare metriche come complete. La demo non interroga il database né mostra fixture sintetiche.

## Verifiche

140 test superati in 15 file, TypeScript e build riusciti. Nuovi controlli su intervalli, denominatori, profitti, esiti mancanti/incoerenti/futuri, proprietà delle righe, modalità reale, autenticazione, parametri, query, paginazione oltre 1.000 righe, analisi parziale e timestamp dei live.

Chromium locale 393×851 e 1440×1000: 16 badge live su feed reale nella rilevazione di prova; polling visibile osservato dopo 30 secondi; selezione di 1/7/14/21/30/60/90/180/365 giorni e storico completo; filtro corrette/sbagliate, riepilogo, errore senza vecchie righe, logout/demo senza richieste e rifiuto API senza token. Nessun errore JS o overflow orizzontale.

Auth e registrazioni storiche erano **sintetiche soltanto nel server locale di prova esterno al repository**, il provider quote era reale. Nessuna fixture caricata nel database remoto o nell'app distribuita. Questo non certifica il login di produzione.

Il build Production esegue anche `check:history-schema`, una query di sola lettura a limite zero per verificare realmente le relazioni PostgREST. Usa una chiave nativa server amministrativa soltanto nello script di build, senza restituire righe private; non crea sessioni di utenti e non scrive dati. L'endpoint runtime continua a usare il token del chiamante.

## Limite attuale

Il generatore di previsioni validate e la pipeline di settlement non sono ancora attivi. Lo storico è un lettore effettivo delle registrazioni esistenti, non un generatore di pronostici: finché non vengono registrate vere previsioni ed esiti, resta vuoto. Il solo feed MoviOdds non basta per validare un modello. Raccolta storico sportivo, fonti risultati verificati, addestramento e calibrazione restano lavoro necessario. Non viene promesso uno storico passato di un anno dove non esistono registrazioni.

## Pubblicazione reale

Commit applicativo `826338aa6e35957de83ccce4e7af13a6583ec004`, deployment Production `dpl_AinxFK9ZZ1z4154Qd59KQBjK99qm`, stato READY, build 23 secondi. URL fisso verificato assegnato a questo deployment e progetto: https://ping-pong-ping-pong3.vercel.app. URL versione: https://ping-pong-cib1h34sb-ping-pong3.vercel.app.

Alle 20:03 UTC il server Vercel ha confermato feed reale valido (437 partite, 10 campionati, 50 nomi mercato), accesso proprietario e isolamento database con transazione READ ONLY, bootstrap non richiesto e query reale dello storico riuscita a limite zero. La query diagnostica non ha restituito righe private e non misura il numero di previsioni presenti.

HEAD dell'URL fisso risponde 302 verso login Vercel. La protezione rimane attiva; il login della nuova versione di produzione non è stato automatizzato. Nessun abbonamento, aggiornamento dello schema o seed di previsioni effettuato.
