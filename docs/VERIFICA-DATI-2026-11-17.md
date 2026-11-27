# Verifica risultati e dati — 17 novembre 2026

## Esito principale

Il fornitore MoviOdds richiede ora una chiave API. I due endpoint effettivamente usati dal progetto, `/odds?sport=table_tennis` e `/results?sport=table_tennis`, hanno entrambi risposto HTTP 401 alle richieste senza autenticazione, con messaggio `API key required` e registrazione su https://moviodds.com/account.

La documentazione https://moviodds.com/doc indica l’header server-side `X-API-Key`. I file `server/moviodds.ts` e `server/results.ts` del commit effettivamente in produzione `7abd3a0e70e084cb422123221348fceb06ce2789` non inviano tale header. Una chiave eventualmente presente nelle impostazioni non sarebbe sufficiente senza adeguare questi connettori e le chiamate a closing/history. Non sono state lette chiavi o tentate richieste autenticate.

Questa verifica dimostra che i connettori senza autenticazione non possono acquisire questi dati oggi. Non dimostra la data esatta in cui il servizio ha cambiato politica o l’esito di ogni cron passato. Non confondere un blocco della raccolta con un miglioramento o peggioramento dell’algoritmo.

## Inventario locale ricontrollato

| Dataset | Partite | Qualità e limiti |
| --- | ---: | --- |
| MoviOdds principale | 23.596 | ID unici, zero duplicati/conflitti, punteggi di tutti i set coerenti con vincitore e regola di arresto. Zero campi essenziali mancanti. |
| MoviOdds archivio forward locale | 23.670 | Include tutte le 23.596 precedenti: soltanto 74 aggiuntive, non 23.670 nuove partite. |
| WTT uomini | 5.442 | 5.436 punteggi coerenti senza fidarsi del formato dichiarato; sei incongruenti. 5.214 formati dichiarati contraddicono il risultato completo. |
| WTT donne | 4.850 | 4.848 punteggi coerenti senza fidarsi del formato dichiarato; due incongruenti. 4.627 formati dichiarati contraddicono il risultato completo. |
| Setka CSV storico | 7.851 | 7.848 punteggi coerenti, tre incongruenti. Date giugno–luglio 2022 contraddicono la descrizione “September 2022”. |

I dataset WTT/Setka non hanno quote storiche o timestamp di prima pubblicazione verificati. Identificatori WTT vanno separati per coorte; i nomi non sono ID universali. Nessun accorpamento automatico di periodi/competizioni differenti e nessuna somma di tutti gli archivi come nuovi incontri indipendenti. Gli esiti sono riportati dalle fonti e controllati internamente, non certificati ufficialmente da questo audit.

Il principale archivio MoviOdds copre dal 5 ottobre al 4 novembre 2026, 35 competizioni e 1.903 identità normalizzate all’interno della competizione. Campioni maggiori: Setka Cup 9.627, Czech Liga Pro 5.790, TT Cup 3.971, TT Elite Series 3.393, Challenger Series TT 149. Questi sono conteggi storici: la copertura attuale del feed autenticato non è stata verificata.

## Informazioni effettivamente utilizzabili

| Informazione | Verifica |
| --- | --- |
| Esiti, set e punti per set | Presenti nello snapshot principale; consentono di ricostruire etichette del vincente, totali, handicap e risultati esatti. Non provano la qualità delle previsioni. |
| Forma, rating e scontri diretti | Ricostruibili dai risultati antecedenti, usando identità e competizione coerenti. Non garantita una scheda completa di ogni atleta del mondo. |
| Caratteristiche causali | 2.168 righe principali, 63 valori finiti e 14 etichette ricontrollate dai punteggi; zero ID duplicati, etichette discordanti o ordini temporali invalidi osservati. Hash della fonte coincidente. |
| Altri file di caratteristiche | 249 righe di conferma con disponibilità presente; file di estensione di 12 righe senza `available` dell’esito, da non equiparare al principale. |
| Inizi storici ricontrollati | 3.845 eventi soddisfano i controlli rigorosi nel closing salvato. Non tutti i 23.596. |
| Quote prima della decisione | 269 coppie sul vincente con controlli rigorosi; 153 allineate alle caratteristiche, tutte ricontrollate senza errori. Non è prova di eseguibilità del prezzo. |
| Quote per tutti i mercati storici | Assenti in quantità adeguata; non è possibile dichiarare ROI/EV realizzati per tutti i 14 mercati. |
| Formato noto prima dell’evento | Non verificato per ogni incontro; ricavarlo dal risultato è informazione successiva. |
| Sequenza punto per punto, servizio/ricezione, colpi | Non disponibile in questi dataset. Nessun modello live completo dimostrato. |

I controlli di timestamp verificano quanto è registrato nei file, non dimostrano da soli l’intera storia di pubblicazione. La correzione della cache temporale v19 già in produzione è descritta in [INTEGRITA-TEMPORALE-V19.md](INTEGRITA-TEMPORALE-V19.md). Questo audit non ricalcola o sovrascrive previsioni originali e non ne certifica retroattivamente tutte le caratteristiche.

## Risultati dei modelli

Il benchmark storico v18 resta immutato: 1.804 partite di test comuni su nove giorni. Vincente: CatBoost 946 corretti/858 errati; NGBoost 936/868; gerarchico precedente 977/827. Nessun candidato nuovo supera il migliore Brier precedente sul vincente. Nessuna nuova validazione indipendente, nuovo training o promozione eseguiti in questo audit. [Confronto completo](CONFRONTO-PROBABILISTICO-V18.md).

L’ultima fotografia privata effettivamente verificata proviene dai log del deployment `dpl_CQsjZ7dcQ9dhK3SM2FrpGMTF5PMv`, 12 novembre alle 16:59:31 UTC: 800 registrate, 730 settled, 67 pending, tre invalidi, otto giorni; vincente 379 corretti e 351 errati (51,92%). Non sono conteggi aggiornati al 17 novembre. `daily_already_attempted` nel log del 12 novembre prova soltanto un claim giornaliero precedente, non un training completato.

Il cron configurato è giornaliero alle 04:15 UTC. Configurazione, completamento dell’esecuzione, arrivo dei nuovi dati e validità del modello sono quattro verifiche distinte. Non si può dichiarare che l’addestramento sia riuscito ogni giorno basandosi sul solo cron.

## Gratuità e aggiornamento quote

La pagina https://moviodds.com/pricing/ pubblicizza Free con 5.000 richieste/mese, fino a 30/minuto, linee principali, 24 ore di history, senza WebSocket e senza closing lines. La stessa pagina indica una transizione imminente delle condizioni Free: i limiti dell’account effettivamente attivi non sono stati letti o confermati. Le condizioni non autorizzano a promettere tutti i mercati e uno storico illimitato gratuitamente.

Un polling ogni 30 secondi per 24 ore al giorno e 30 giorni richiederebbe **86.400 chiamate** per un solo endpoint, prima di risultati, closing e utenti aggiuntivi. È incompatibile con il budget pubblicizzato di 5.000. Occorre un budget condiviso, cache, aggiornamento durante l’uso e una cadenza compatibile col piano; nessun acquisto autorizzato o effettuato.

## Verifica privata rimasta bloccata

Non sono stati letti il ledger corrente, i training successivi al 12 novembre, le consistenze attuali delle tabelle o i risultati di tutti i cron. I log runtime gratuiti non conservano le giornate necessarie. La revisione automatica ha rifiutato la creazione di una build diagnostica con variabili di produzione, citando esecuzione di codice con segreti, possibili effetti sull’ambiente live e dati nei log. La build non è stata avviata; nessun tentativo di aggiramento o lettura dei segreti.

Preparato [scripts/audit-study-readonly.ts](../scripts/audit-study-readonly.ts), non collegato a build, cron o API: legge solo i metodi report esistenti, non invoca `run`, training, migrazioni o scritture. L’output esplicito limita i riepiloghi a date, conteggi e metriche; i metodi report esistenti registrano anche etichette di protocollo/competizione. Nessuna chiave, identificativo individuale, nome di atleta o puntata viene stampata. Il flag `APP_READONLY_DATA_AUDIT=1` è richiesto. Non è stato eseguito con credenziali. Per farlo in produzione serve approvazione esplicita del metodo; un’alternativa è leggere i report dal normale pannello autenticato del proprietario.

## Riproduzione e controlli

`python scripts/audit-data-20261117.py` ricontrolla i file privati esistenti senza rete, training o scritture sulle fonti. Salva un nuovo report aggregato e rifiuta di sovrascriverlo. Gli hash degli input prima/dopo coincidono. Report: [data-audit-20261117.json](../research/data-audit-20261117.json).

28 test Python eseguiti e passati; tre test delle librerie opzionali v18 saltati esplicitamente in questo ambiente leggero. Quattro test TypeScript mirati alla cache temporale e alla corrispondenza del riepilogo v18 passati; TypeScript dell’intero progetto passato, incluso lo script diagnostico preparato. Non si ripetono build e test browser perché non cambia il runtime dell’app. Nessuna nuova statistica di validazione è attribuita a questi test software.

## Azioni necessarie

1. Ripristinare l’accesso legittimo MoviOdds con chiave gratuita privata, senza inviarla in chat; adattare tutti i connettori all’header documentato e verificare limiti/copertura dell’account. La sola aggiunta della variabile non cambia il codice attuale.
2. Ottenere il report privato corrente attraverso il pannello owner o una diagnostica autorizzata, per verificare successi/fallimenti dei training e aggiornamento degli esiti.
3. Raccogliere quote disponibili al momento esatto della previsione e nuovi risultati mai usati per scegliere i modelli, rispettando budget gratuito e controlli di integrità. Nessun vantaggio operativo è dimostrato finché questi confronti non passano.


## Esito dopo autorizzazione esplicita del proprietario

Il proprietario ha autorizzato la verifica in sola lettura. Il tentativo con il solo script preparato e arresto intenzionale prima del rilascio è stato comunque rifiutato dalla revisione automatica: secondo il revisore, creare una build con credenziali di produzione e riepiloghi nei log eccede il controllo autorizzato. Nessuna build avviata e nessun nuovo tentativo di esecuzione alternativa con credenziali.

Controllo alternativo sui normali endpoint già pubblicati, senza cambiamenti: `/api/health` HTTP 200; GET `/api/training` e `/api/market-study` HTTP 401 senza la sessione Supabase del proprietario. L’accesso Vercel non sostituisce il login Google dell’app. Il deployment servito dall’alias stabile resta `dpl_CQsjZ7dcQ9dhK3SM2FrpGMTF5PMv` (commit applicativo `7abd3a0`). Nessun nuovo conteggio privato o risultato di training è stato ottenuto; i dati del 12 novembre restano l’ultimo snapshot verificato.

Per leggere il dato corrente senza questo metodo di esecuzione serve il normale pannello del proprietario: Statistiche modello → Addestramento continuo dei candidati → Aggiorna stato training. Data/stato, conteggi Training/Calibrazione/Test e Brier sono visibili senza condividere password, token o chiavi. Non serve premere “Verifica e addestra candidato” per la sola lettura.


## Collegamento autenticato MoviOdds — 17 novembre 2026

Il proprietario ha confermato di avere salvato `MOVIODDS_API_KEY` su Vercel Production. Il connettore ora usa la variabile privata nell’header documentato `X-API-Key` per board, discovery, risultati e closing. Il valore non viene letto negli strumenti, inserito in URL, restituito nelle risposte o esportato con prefissi VITE_. L’helper ammette soltanto l’origine esatta HTTPS moviodds.com e disabilita i redirect; rifiuta header injection e domini/porte estranei. Le dipendenze iniettate ricevono la stessa configurazione privata del server.

Sui closing, un rifiuto 401/403 ferma il ciclo senza consumare i tentativi dei singoli eventi successivi. Questo evita di trasformare la mancanza di accesso del piano in cento errori di partita; non autorizza un closing non disponibile e non modifica le regole degli studi congelati. Timeout, cache, cooldown e limiti di dimensione esistenti restano attivi. Il piano Free può non includere closing e mercati secondari: autenticazione riuscita non significa copertura completa o validazione statistica.

Sei nuovi test di autenticazione usano esclusivamente chiavi sintetiche. Controllano inoltro degli header, assenza della chiave negli URL, origine e redirect, input non validi, comportamento senza chiave, i tre client e gli errori di accesso. Il test discovery precedente è aggiornato per verificare gli header normalizzati e l’assenza di credenziali inventate, invece di presumere che l’API resti pubblica per sempre. Suite finale: 287 test in 41 file, TypeScript, build Vite e avvio server ESM compilato passati localmente. Nessuna libreria ML, nuovo modello, migrazione o accesso privato mediante lo script audit è introdotto da questo cambiamento. La verifica effettiva di connessione verrà registrata dopo il rilascio normale, tramite i controlli feed/risultati già previsti dal progetto.


### Connessione autenticata effettivamente verificata

Nel normale build Production del commit `82d13602a6c32437f14619ff7e22e8e107223804`, i controlli del 17 novembre alle 19:44:39–40 UTC hanno restituito successo: feed MoviOdds non in warming, 454 eventi live/futuri, nove competizioni correnti, 43 nomi/gruppi di mercato e 3.130 voci quota. Archivio Postgres: 33.934 risultati accettati, 1.329 record rifiutati dal parser/controlli, intervallo 5 ottobre–17 novembre 2026, ultimo risultato alle 19:40:52 UTC. Il numero di rifiuti non ne identifica singolarmente la causa e non significa automaticamente altrettanti risultati sportivi sbagliati.

I dati sono aggregati reali dei controlli già previsti dal build; nessuna chiave è stata estratta o pubblicata e lo script di audit privato non è stato eseguito. L’API autenticata è raggiungibile; ciò non dimostra accesso futuro illimitato, closing inclusi nel piano o riuscita di ogni training. CI GitHub push/PR del commit entrambe concluse con successo (run 44161727367 e 44161712541). Asset client controllati: nessuna presenza dei marcatori MOVIODDS_API_KEY, X-API-Key o della chiave sintetica di test. Compilato cloud Node26.13.1 avviato correttamente. Stato finale del deployment e raccolta sono documentati soltanto quando verificati.


### Rilascio concluso e dati aggiornati — 17 novembre, 19:47 UTC

Deployment Production `dpl_E1BYD5HUxc9Ymn6KaNwHtN47Q34n` READY sul commit `82d13602a6c32437f14619ff7e22e8e107223804`, alias https://ping-pong-ping-pong3.vercel.app verificato e health HTTP 200. È il normale rilascio del connettore richiesto dopo l’inserimento della chiave, non la diagnostica privata precedentemente rifiutata. Nessuno script audit privato eseguito, nuova migrazione o modello promosso.

Il bootstrap originale ha acquisito **100 nuovi incontri** e aggiornato **97 esiti** su 97 tentativi, con **zero errori di fonte**. Stato v9 verificato alle 19:46:31 UTC: **1.200 registrati, 1.057 settled, 140 pending, tre invalidi, 12 giorni osservati**. Sul vincente del candidato v9: **562 corretti, 495 errati (53,17%)**. Gli altri 14 target sono nel report aggregato; i risultati di più mercati sullo stesso incontro non sono nuove partite indipendenti.

Il training del giorno era già stato tentato: `daily_already_attempted`. Questo non modifica né riscrive l’esito `insufficient_data` mostrato al mattino nello screenshot. Il cron resta programmato e riproverà nel prossimo giorno UTC; l’addestramento riuscirà soltanto quando le finestre recenti di calibrazione e test avranno i minimi richiesti. Non viene abbassata la soglia o riutilizzato il test storico per far partire forzatamente il training. Le risposte di closing usate dai 97 esiti erano accessibili durante questa esecuzione; ciò non certifica che il piano conservi tale accesso in futuro.

Confronto v10 separato: 880 registrati, 748 settled, 128 pending, quattro invalidi, 12 giorni. Sugli stessi 748 casi:

| Modello | Corretti | Errati | Brier | Log Loss |
| --- | ---: | ---: | ---: | ---: |
| Gerarchico corrente | 405 | 343 | 0,243767 | 0,680530 |
| Completo logistica | 414 | 334 | 0,242154 | 0,677146 |
| Punti/set logistica | 420 | 328 | 0,242479 | 0,677792 |
| Contesto logistica | 417 | 331 | 0,243504 | 0,680007 |
| Bookmaker no-vig | 425 | 260 | **0,229301** | **0,649518** |

Il bookmaker ha anche 63 casi a probabilità esattamente 50%, senza selezione preferita: accuracy sui soli 685 decisi 62,04%, Brier/Log Loss su tutti i 748. Non si confronta questa accuracy con il v9 da 1.057 casi, né si sommano le coorti. Il mercato continua a fare meglio nelle metriche probabilistiche; nessun vantaggio indipendente dimostrato e nessun ROI inventato. Conteggi, metriche e riferimenti temporali salvati in [restored-source-20261117.json](../research/restored-source-20261117.json).
