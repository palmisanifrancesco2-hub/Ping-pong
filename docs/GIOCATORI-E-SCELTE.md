# Partite attive, giocatori e scelte personali

Richiesta del proprietario: mostrare solo live/partite future, consultare i due giocatori, ottenere previsioni verificabili, salvare proprie scelte e relativo storico.

## Partite

Il server e il client escludono partite oltre orario, senza orario verificabile o con segnalazione live priva di lettura recente. Una partita è ammessa se live con lettura entro 60 secondi oppure non live con inizio strettamente futuro. Il filtro continua ad agire sui dati in cache e sull'orologio del client, quindi gli eventi vengono rimossi anche tra due risposte del provider. La conferma dipende dai dati MoviOdds: non viene dedotto un live dal solo orario.

## Dati dei giocatori

Endpoint privato POST `/api/analysis?eventId=...`: recupera risultati pubblici MoviOdds e mostra numero di partite utilizzabili, vittorie/sconfitte, percentuale storica, set vinti/persi, punti fatti/subiti, ultimi 20 incontri e scontri diretti nella medesima competizione. Identità per nome esatto normalizzato nella competizione; nessun fuzzy matching tra omonimi o campionati diversi. Anagrafica, ranking e dati non forniti sono dichiarati mancanti.

Risultati non conclusi, punteggi incoerenti, righe future, duplicati contrastanti e set incompleti vengono scartati. Il campo di disponibilità è il massimo tra fine e ultimo aggiornamento, per non anticipare correzioni del risultato. Copertura effettiva e fonte sono mostrate: non si promettono dati anteriori all'archivio. La fonte resta un aggregatore indipendente, non una conferma ufficiale.

Archivio pubblico osservato: circa 24.660 righe iniziali, circa un mese. La quantità e la retention cambiano. Prima richiesta potenzialmente lenta; timeout server 60 secondi, dimensione massima 20 MB, cache/single-flight per istanza di 5 minuti, cooldown errori 30 secondi. Nessun dato inventato in caso di errore.

## Primo modello: prova reale NON superata

Elo interpretabile: valore iniziale 1500, K=20, probabilità logistica e calibrazione su intervallo separato. Il runner `scripts/train-elo.ts` ha verificato 320 archivi pubblici di chiusura, con 264 orari di inizio noti e non stimati. Solo risultati disponibili prima dell'istante di previsione sono usati; l'istante è l'inizio dichiarato dalla fonte meno 60 secondi. Campioni senza sufficiente storia sono esclusi. Gli esiti di calibrazione devono essere disponibili prima dell'inizio del test, con esclusione delle sovrapposizioni.

196 casi utilizzabili; 77 per calibrazione e 118 fuori campione. Calibrazione disponibile fino al 3 novembre 12:36:56 UTC, test da 3 novembre 12:44 a 4 novembre 19:49 UTC. Rilevazione modello: 4 novembre 20:30 UTC, dati fino a 20:10 UTC.

- Brier Score: **0,251484**, peggiore del riferimento neutro 0,25.
- Log Loss: **0,696029**, peggiore del riferimento neutro ln(2), circa 0,693147.
- ECE: 0,077039.

**Il modello globale è bloccato. Non produce percentuali operative né registra pronostici dell'app.** Il risultato sfavorevole non è stato nascosto, i parametri non sono stati ritoccati per forzare un esito favorevole e i test storici non sono inseriti come previsioni retroattive. Alcune metriche per competizione sono migliori, ma non aggirano il blocco globale.

L'artefatto `models/elo-v1.json` conserva metriche, cutoff, digest del dataset e parametri/rating con chiavi hash, non lo storico di quote o dati privati. La schermata Statistiche modello presenta le misure effettive. Il percorso di registrazione è predisposto solo per un futuro modello che superi tutti i controlli, un campione adeguato, quota recente >=1,30 e un limite prudente di probabilità >50%. Non è stato collaudato generando previsioni reali: il blocco è attivo. Live e altri mercati non hanno ancora modelli validati. Le opportunità ADM e lo stake restano disattivati.

## Scelte personali

In ogni partita: “Segna questa partita” salva un'osservazione senza previsione; “Scelgo questa selezione” salva selezione, mercato/periodo/linea, quota e timestamp originali. Il server ricontrolla prezzo e timestamp scelti: una variazione restituisce 409, senza registrare una quota diversa da quella vista. Ripetere il salvataggio non sovrascrive il primo snapshot.

Sezione **Le mie scelte** con intervalli da un giorno a un anno e storico completo, filtro esito, note e indicazione manuale corretta/sbagliata/annullata/in attesa per le selezioni. Le partite semplicemente osservate non vengono trasformate in previsioni vinte o perse. I salvataggi rimangono visibili dopo la fine dell'evento. Nessuna puntata reale viene dedotta da un salvataggio.

Nuova migrazione `202611040003_personal_choices.sql`: aggiunge una tabella privata con RLS, indice, unicità utente/evento/selezione e snapshot non riscrivibile dai client. Permette aggiornamenti soltanto di note ed esiti personali; non permette cancellazione dello storico dal browser. Estende inoltre gli stati risultato con `reported`, per separare risultati dell'aggregatore da quelli ufficiali. Nessun dato esistente cancellato, nessuna autorizzazione di utenti modificata.

Il runner separato `db:choices`, attivato solo con `APP_CHOICES_SETUP=1` in Production, controlla i checksum delle tre migrazioni in transazione e applica solo quella mancante. `APP_DATABASE_SETUP` resta 0; il vecchio bootstrap non è usato per aggirare il controllo sulle nuove migrazioni. Il flag dedicato va riportato a 0 dopo la verifica. La modifica remota sarà dichiarata solo dopo riuscita effettiva.

## Storico dei pronostici del modello

La quota e probabilità originali restano collegate a ogni registrazione autentica. È predisposto un aggiornamento protetto degli esiti da MoviOdds: risultati riportati sono classificati come provvisori, con testo “corretta/sbagliata secondo MoviOdds” e riepilogo separato. Non vengono promossi a risultati ufficiali né mescolati alle statistiche verificate. Per questa versione non ci sono nuove previsioni generate perché il modello non è passato.

## Verifiche

155 test in 18 file, TypeScript e build superati anche dopo la correzione del timeout. Test specifici su esclusione eventi, schema risultati, statistiche, punteggi di validazione, blocco del modello, snapshot/quote cambiate, duplicati, autorizzazioni, RLS tra due utenti autorizzati e un estraneo, divieto di riscrivere il prezzo e cancellare storico. Le fixture sintetiche esistono soltanto nei test. Nessun account, risultato o pronostico fittizio viene inserito in produzione.

Chromium locale: 396 partite tutte live recenti o future, dati reali dei due giocatori (32 e 56 incontri nella scheda verificata), salvataggio partita e selezione, esito personale manuale, quota originale invariata, dati mantenuti dopo ricaricamento, filtro annuale, mobile 393×851 e desktop 1440×1000 senza overflow o errori JS. Auth e scelte erano isolate nel server locale di prova esterno al repository; quote e risultati giocatori provenivano realmente da MoviOdds. Nessuna scrittura di fixture in Supabase.
