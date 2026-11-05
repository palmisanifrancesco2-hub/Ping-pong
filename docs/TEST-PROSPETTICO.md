# Test prospettico e app utilizzabile

Il protocollo `research/prospective-value-v1.json` e il modello dedicato `research/prospective-value-v1-model.json` vengono versionati prima della prima raccolta. Il nuovo campione non riutilizza i 3000 test storici o le 304 previsioni del modello precedente. I pesi restano congelati; risultati recenti disponibili prima della previsione aggiornano soltanto le caratteristiche dei giocatori. Nessun riaddestramento e nessuna promozione automatica.

## Raccolta

Vercel Hobby: un cron al giorno, fascia 04:00–05:00 UTC (`15 4 * * *`, ora non garantita al minuto). L'app continua a leggere le quote ogni 30 secondi quando la relativa sezione è aperta. Il cron non è un polling quote continuo.

Massimo 100 nuove selezioni ogni data UTC, una per evento nell'intero studio, primo snapshot immutabile e distinto dalle registrazioni personali. Un inserimento atomico del lotto impedisce raccolte concorrenti o riempimenti selettivi nello stesso giorno. Lotti parziali conservati senza ritentare l'arruolamento quel giorno. Il pulsante del proprietario può anticipare il lotto giornaliero e aggiornare gli esiti.

Solo vincente partita prematch, quota minima 1,30 senza massima, almeno 30 precedenti per giocatore, partenza prevista tra 10 minuti e 48 ore, coppia quote coerente e fresca, EV prudente euristico positivo. Preferenza quota 2 soltanto a parità di EV e probabilità. Prima e durante il salvataggio vengono ricontrollati stato, fonte e anticipo. Fonte, timestamp quota, disponibilità caratteristiche, pesi/versione e probabilità no-vig della coppia bookmaker salvati server-side.

Le previsioni entrano nelle metriche del test solo dopo un risultato coerente per identità e competizione e un inizio non stimato verificabile tramite la fonte closing. Inizio effettivo non coerente: caso escluso e criterio di validazione fallito. Inizio non verificabile: caso in attesa, non trasformato in vittoria. Fino a tre tentativi di verifica distanziati almeno 12 ore; 150 interrogazioni al massimo per esecuzione, timeout e arresto su rate limit. Questi esiti restano riportati da MoviOdds, non certificati ufficialmente da un ente indipendente.

## Valutazione congelata

Due fasi consecutive di 14 giorni, almeno 1000 esiti valutabili per fase e almeno 14 giorni osservati, 95% di risoluzione, nessuna registrazione tardiva. Si attendono anche 48 ore dopo ciascuna finestra. Se il campione non basta il risultato è inconcludente; nessuna soglia adattata per ottenere un esito positivo.

Puntata virtuale fissa di 1 unità, rendimento e intervallo al 97,5% con bootstrap a blocchi mobili di tre giorni (10000 repliche, seme fissato solo per l'incertezza). Confronto Brier e Log Loss con la probabilità bookmaker normalizzata della stessa coppia quote; differenza Brier appaiata e calibrazione ECE. Per passare servono limite inferiore rendimento >0, limite superiore differenza Brier <0, Log Loss migliore, ECE <0,08. Anche considerando tutte le osservazioni irrisolte come perdite il saldo deve restare positivo. Dipendenze tra giocatori oltre tre giorni possono rendere l'incertezza ottimista: richiesto esame successivo, nessun `validated=true` automatico.

La raccolta termina a 28 giorni, aggiornamenti esiti fino a 35 giorni. Il runtime rifiuta pesi più vecchi di 35 giorni: una finestra di ricerca congelata, non una validazione implicita. Quote osservate e profitto virtuale non provano l'eseguibilità di una puntata né il profitto reale.

## Interfaccia e sicurezza

Statistiche modello mostra entrambe le fasi, conteggi, controlli e confronto bookmaker. Storico pronostici filtra origine personale/automatica; quote e probabilità originali restano visibili. Tutte le otto sezioni continuano a funzionare: statistiche giocatori, quote live/prematch effettivamente disponibili, percentuali sperimentali, scelte, note, storico e diario. Pronostici live e sugli altri mercati rimangono indisponibili senza un modello specifico validabile.

Endpoint `/api/study` protetto da JWT e membership; aggiornamento riservato al proprietario configurato. `/api/study-run` usa esclusivamente `CRON_SECRET` server-side, con confronto costante del token. Proprietario ricavato server-side dalla membership e dall'account Auth, mai da input del chiamante. Tabelle esistenti con RLS, nessuna migrazione. Il cron non inserisce puntate reali o messaggi. Nessun piano a pagamento richiesto.

Il bootstrap Production iniziale è esplicito mediante `APP_FORWARD_STUDY_BOOTSTRAP=1`, poi disattivato. La raccolta richiede `APP_FORWARD_STUDY_ENABLED=1`; disabilitandolo si sospendono nuove esecuzioni senza cancellare dati.

## Primo avvio verificato

Protocollo e codice congelati nel commit `7c623d5` prima del bootstrap Production. Primo lotto completato il 5 novembre 2026 alle 03:12:25 UTC: 18 nuove previsioni virtuali, nessun errore o duplicato, nessun esito ancora valutabile. Deployment `dpl_6K3N2m6kAKJDGHwVPX5WbkJScvwb` READY con alias stabile. Bootstrap disabilitato dopo la riuscita; cron configurato, prima successiva esecuzione periodica ancora da osservare.
