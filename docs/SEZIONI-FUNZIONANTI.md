# Flussi delle otto sezioni

Aggiornamento del 5 novembre 2026. La modalità reale usa dati MoviOdds e accesso privato Supabase. La demo è stata rimossa dalla navigazione: dopo il login privato si apre direttamente Partite e mercati e viene caricato il feed reale. Ricerca per giocatore, campionato o ID evento.

| Sezione | Comportamento implementato |
| --- | --- |
| Dashboard | Eventi disponibili, competizioni, quote e live confermati dalla fonte; accesso alle partite e allo stato del modello. |
| Partite e mercati | Quote selezionate con probabilità in evidenza, una per evento, ordine decrescente di probabilità dopo il filtro EV prudente positivo. Vista Eventi e giocatori per live/futuri e statistiche, senza catalogo indiscriminato delle quote. Filtri espandibili, aggiornamento manuale e comandi fissi di chiusura. |
| Value Tracker | Stessa selezione statistica e ordinamento per probabilità, con controlli di prezzo/freschezza, EV, accesso ai giocatori e registrazione esplicita. Pesi del modello e raccolta prospettica invariati. |
| Statistiche modello | Report storico da 3.000 e metriche delle previsioni realmente registrate nel periodo: corrette, quote medie vinte/perse, saldo teorico a 1 unità, Brier, Log Loss e calibrazione. Esiti verificati e provvisori distinti. |
| Storico pronostici | Prima probabilità e quota immutabili, versione del modello, marcatura non validata, filtri fino a un anno/completo. Lettura immediata e sincronizzazione degli esiti in background o tramite pulsante. |
| Le mie scelte | Partite osservate e selezioni personali con primo prezzo conservato, note ed esito manuale; passaggio al diario delle puntate senza inviare operazioni a bookmaker. |
| Smart Stake | Simulatore Kelly manuale disattivabile, riduzione per incertezza, limite massimo 2%; diario reale manuale in Supabase con importi, quote effettive, esiti e saldi. |
| Collegamenti | Feed MoviOdds attivo, controllo accesso privato, lettura DB, disponibilità Google e modello. The Odds API rimossa dall’interfaccia: nessun suo controllo o richiesta nel flusso dell’app. |

## Modello e registrazioni

`models/score-runtime-v1.json` contiene pesi reali del candidato completo, regolarizzazione 0,001. Addestramento su 1.777 casi precedenti al 3 novembre; calibrazione simmetrica su 386 casi del 3–4 novembre, con esiti disponibili prima del 5 novembre. Il confronto storico di 3.000 casi riguarda la procedura di modello; non è una validazione indipendente dei nuovi pesi.

Il runtime costruisce caratteristiche solo da risultati già disponibili, richiede almeno 30 incontri per ciascun giocatore nella competizione e una coppia coerente e fresca di quote vincente partita prematch. Esclude eventi conclusi, live, quote sospese, future o scadute, archivio temporaneo incompleto e modello più vecchio di 35 giorni (pesi congelati durante il test prospettico). Le stime restano **sperimentali**: nessuna modifica del flag validato per renderle operative e nessuna etichetta “Ottima”.

Le previsioni personali vengono salvate mediante azione esplicita, con ricalcolo server-side e controllo di prezzo e timestamp attesi. Il browser non può inviare una propria probabilità, un altro proprietario o un profitto. Sono registrate con `model_versions.validated=false`, dati disponibili al momento e versione identificata anche dai parametri del modello. I clic ripetuti conservano il primo valore. Le 304 osservazioni prospettiche precedenti rimangono immutate.

Il limite prudente è euristico, non un intervallo di probabilità certificato. Per un modello non validato non vengono prodotte opportunità operative o puntate automatiche. Le stime live e degli altri mercati rimangono indisponibili finché mancano modelli e validazioni specifici. Il nuovo test prospettico raccoglie ogni giorno previsioni virtuali separate, mantenendo congelati i pesi. Nessun riaddestramento o promozione automatica. Vedere [protocollo e funzionamento](TEST-PROSPETTICO.md).

## Esiti e puntate

Gli esiti MoviOdds sono riportati come provvisori, distinti da conferme ufficiali indipendenti. Le loro metriche sono disponibili separatamente. Una statistica senza casi non viene mostrata come zero o come risultato positivo.

Le puntate manuali usano la tabella esistente `manual_bets`, il JWT del chiamante e RLS. Un eventuale collegamento a una previsione deve appartenere allo stesso utente (vincolo composto nel database). Saldo registrato: vinta = importo × (quota − 1); persa = −importo; annullata = 0; in attesa = non disponibile. Il primo inserimento è idempotente; un duplicato con dati diversi viene respinto. Gli esiti del diario sono dichiarazioni dell'utente, non risultati certificati.

Il simulatore non collega automaticamente probabilità sperimentali a una raccomandazione di puntata. Le ipotesi inserite restano nella schermata; frazione Kelly e limite sono configurabili, senza aumento automatico per recuperare perdite.

## Architettura e verifiche

Un'unica funzione API catch-all condivide cache di quote e risultati per istanza e mantiene ridotto il numero di funzioni sul piano gratuito. Tutti gli endpoint privati verificano membership; `/api/health` è un diagnostico privo di dati privati; `/api/study-run` accetta esclusivamente il segreto server del cron. Nessuna nuova migrazione o chiave richiesta. Il controllo build verifica anche lo schema di `manual_bets` senza restituire righe.

I test API e SQL locali verificano salvataggio sperimentale, integrità degli snapshot, vincoli FK, isolamento dei membri, calcoli, rifiuto di proprietà/probabilità/profitti falsificati e quote cambiate. Il test browser usa dati pubblici reali, un account sintetico, salvataggi isolati in memoria e indicatori di stato simulati; non crea puntate o utenti nel database reale. La scrittura con il JWT reale del proprietario non viene impersonata né dichiarata testata automaticamente.

## Comodità delle quote selezionate

La vista normale non espone tutti i prezzi del fornitore. Richiede coppia vincente prematch coerente e fresca, storico minimo e EV prudente positivo; una selezione per evento, prima probabilità decrescente, poi EV prudente e vicinanza a 2. Il test prospettico conserva il proprio ordinamento originale per EV e non cambia campione o pesi. Le percentuali restano sperimentali.

Il pulsante manuale aggiorna insieme feed e valutazione, con nuove letture della fonte distanziate almeno 10 secondi per istanza; polling visibile sempre ogni 30 secondi. Snapshot ricevuti prima/dopo un cambio prezzo non sono abbinati: una quota cambiata o sospesa sparisce finché la valutazione coerente è disponibile. Gli aggiornamenti non azzerano l’elenco a ogni polling.

Pulsanti fissi sullo schermo per aggiornare e chiudere la partita aperta, oppure chiudere l’intero elenco; comandi anche nella scheda e in fondo alle statistiche, Escape da tastiera e focus restituito al riepilogo. Lista riapribile e altre 12 selezioni per volta. Gli eventi live restano consultabili, ma non ricevono percentuali del modello prematch.
