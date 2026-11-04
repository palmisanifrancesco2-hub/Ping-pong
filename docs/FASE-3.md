# Feed MoviOdds e interfaccia mercati

Implementazione del 4 novembre 2026, richiesta esplicita del proprietario di usare il feed gratuito e includere tutti i campionati e mercati presenti.

## Funzioni completate

- Endpoint privato `/api/board`: verifica Supabase e appartenenza prima del recupero, nessuna chiave richiesta. URL fisso esclusivamente tennistavolo, nessun input del browser viene inoltrato al fornitore.
- Intero catalogo dinamico, senza whitelist di campionati o mercati. Nomi originali, quote decimali, lato, etichetta, linea, handicap, partecipante, periodo, fase e identificativi conservati. Periodi e sottomercati restano separati anche quando il fornitore riusa un gruppo.
- Schema runtime, dimensione decompressa massima 3,5 MB, controllo del tempo fonte e dell'identità, timeout 15 secondi, nessun retry immediato. Errori sanitizzati e risposta privata/no-store. Cache e single-flight di 30 secondi per istanza, cooldown di 30 secondi dopo errori; nessuna garanzia di limite globale tra istanze.
- Dashboard con conteggi reali e tutti i campionati osservati. Sezione Partite e mercati con ricerca, filtri dinamici, quota minima 1,30 modificabile e nessuna massima. Voci sospese visibili separatamente; quota minima 1 per tutti i prezzi. Tutti gli eventi raggiungibili tramite paginazione a blocchi di 25.
- Timestamp prezzo e lettura mercato distinti. Sospensione, zero, mercato non confermato, vecchia quota prematch durante il live e orario evento superato vengono segnalati. Nessun timestamp inventato per dichiarare un mercato aggiornato.
- Polling ogni 30 secondi solo con sessione attiva e pagina visibile; richieste annullate a logout/cambio sessione. In errore la risposta precedente viene rimossa. Demo senza dati o chiamate.
- Build Vercel predisposto per controllare il feed realmente con riepilogo privo di dati account/segreti. The Odds API non è più una dipendenza del build. Bootstrap database resta disattivato, nessuna nuova migrazione.

## Evidenze

Il connettore completo ha recuperato alle 19:29 UTC 465 partite, 11 campionati, 38 nomi di mercato e 3.264 voci quota; risposta normalizzata circa 1 MB. Sono conteggi della fonte, inclusi eventuali elementi sospesi e oltre orario, non opportunità giocabili. Il feed cambia tra rilevazioni.

129 test superati in 14 file, TypeScript e build riusciti. Test specifici coprono campionati nuovi, periodi/sottomercati/fasi, selezioni duplicate, quote di altro evento, sport errato, timestamp fonte obsoleti/futuri, letture mercato mancanti, sospensioni, filtri, cache concorrente, cooldown e limite dimensione. Test HTTP verificano 401 prima di contattare il provider, risposta privata e 503 senza dettagli interni.

Chromium locale: viewport 393×851 e 1440×1000, nessun overflow orizzontale o errore JS. Login e autorizzazione sono sostituiti **solo nell'ambiente di test locale**; backend applicativo e MoviOdds sono reali. Nella prova browser: 456 partite, 10 campionati e 43 nomi di mercato. Ricerca giocatore, filtro campionato/live, pagina iniziale 25 eventi, espansione mercati, paginazione 50 eventi e logout/demo verificati. Una seconda prova ha verificato anche filtro per mercato, rimozione delle quote a HTTP 503 e ripristino successivo; 456 partite e 41 nomi mercato in quella risposta. L'API rifiuta richieste senza token. La produzione continua a usare Supabase reale; nessun bypass è stato inserito nel repository.

## Limiti e lavoro rimanente

La [documentazione del provider](https://moviodds.com/doc) indica fonte predefinita bet365.com.au, distinta da bet365 Italia. L'app la espone come fonte estera; non la inserisce tra quote ADM verificate. Gratuità dichiarata dal fornitore senza chiave; continuità, diritti a valle e prezzi italiani non verificati indipendentemente.

Questa integrazione visualizza i dati ricevuti, senza inventare una tassonomia di settlement per ogni mercato. Non esegue confronti operativi tra bookmaker, addestramento, calcoli EV, suggerimenti di stake o scommesse. Persistenza storico, risultati ufficiali e modelli validati restano da sviluppare. Nessun servizio a pagamento attivato.

Il test browser locale non certifica l'intero flusso autenticato del deployment Vercel protetto. La verifica del deployment va riportata separatamente dopo build e controllo server.

## Pubblicazione verificata

Deployment Production `dpl_8nEVHmM3Y4L1ra2NDjVtMpJVHrdK`, commit applicativo `b3de748939d427f0fdc23bc3f9bb96ed4900a99b`, Node 24/Vite, stato **READY**:

https://ping-pong-cvsy6nrzk-ping-pong3.vercel.app

Build completato in 25 secondi. Il controllo eseguito sul server Vercel alle 19:38:11 UTC ha confermato feed MoviOdds valido: 455 partite, 10 campionati, 46 nomi mercato, 3.856 voci quota. Le quantità sono una rilevazione, non un elenco fisso. La verifica database READ ONLY ha confermato proprietario autorizzato e isolamento da estranei/anonimi; il bootstrap ha riportato «non richiesto». Nessuna nuova migrazione eseguita.

HEAD della root risponde HTTP 302 verso autenticazione Vercel. Il fetch protetto dello strumento continua a fallire per risoluzione/accesso al deployment e non è disponibile un CLI Vercel autenticato locale; nessuna protezione disattivata. Il nuovo flusso completo con login di produzione non è stato automatizzato. La scansione runtime error/fatal nella finestra di 10 minuti non ha trovato log; questo non certifica traffico utente o assenza generale di errori. Nessun nuovo drain o servizio di monitoraggio acquistato.
