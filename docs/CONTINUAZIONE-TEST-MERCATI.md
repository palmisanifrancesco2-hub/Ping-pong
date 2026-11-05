# Continuazione dei test oltre i 249 casi

## Due conteggi distinti

Lo storico retrospettivo passa da **249 a 261 partite**, con 12 nuovi casi verificati tramite closing nella finestra aggiuntiva 14:20:32–15:21:36 UTC del 5 novembre 2026. Ventidue candidati controllati: dieci esclusi perché l'inizio effettivo non rientrava nella nuova finestra, nessun errore della fonte. Pesi, scelta per target e snapshot precedente delle caratteristiche invariati. `research/protocol-v8-extension.json` e `research/report-v8-extension.json` conservano metodo e metriche. Estensione decisa dopo l'esame dei primi esiti: aggiornamento descrittivo, senza nuova dichiarazione di significatività o promozione.

La nuova raccolta **prospettica** `forward-markets-v9-20261105` salva invece le probabilità prima di partite future. È separata sia dai 261 casi storici sia dal test originario del vincente partita. Non crea previsioni retroattive nello storico personale, scelte dell'utente o puntate.

## Protocollo fissato prima della raccolta

`research/prospective-markets-v9.json` registra hash, candidati e regole:

- Stessi 14 target e medesimi candidati/pesi scelti sullo storico v8; nessuna nuova selezione dai 249 esiti.
- Contesto aggiornato causalmente alla registrazione: almeno 30 precedenti per giocatore, solo referti già disponibili, eventi prematch con almeno 10 minuti di anticipo previsto e non oltre 48 ore. Risultati BO5 completi e inizio effettivo controllati dopo l'evento; formati diversi o registrazioni tardive rimangono invalidi, senza eliminare osservazioni sfavorevoli.
- Nessun filtro su EV, accuratezza o risultato. Ordine di raccolta deterministico per hash dell'evento, massimo 100 nuovi eventi al giorno e 3000 complessivi.
- Controlli fissi sui primi **500, 1000, 2000 e 3000 eventi registrati**, non sui primi N esiti risolti. Almeno 14 giorni osservati, copertura esiti ≥95%, confronto Brier e Log Loss con frequenze causali della competizione, ECE <0,08.
- Chiusura unica del controllo almeno sette giorni dopo l'ultimo inizio previsto nel relativo prefisso. Gli irrisolti/invalidi contribuiscono +1 alla differenza Brier prudente, il peggior valore possibile; non vengono scartati. Bootstrap per blocchi di tre giorni di calendario, includendo i giorni vuoti, 20.000 repliche e correzione della famiglia sui 14 target × 4 controlli. Il campione ridotto di giorni e la natura approssimata del bootstrap impongono comunque revisione, anche se passa un controllo preliminare.
- Esito del controllo salvato una volta con hash del prefisso. Eventuali cambiamenti successivi dei dati ne invalidano la coerenza: nessuna rivalutazione automatica fino a ottenere significatività. Ispezionare le metriche descrittive intermedie non crea un nuovo controllo inferenziale.
- Arruolamento per 60 giorni, follow-up fino a 70; a campione/tempo esauriti si riporta fallimento o inconcludenza, senza prolungare fino a un risultato favorevole.

L'export `models/market-v8-runtime.json` riproduce i pesi congelati: frequenze gerarchiche, foresta per i due target selezionati e il riferimento per la logistica ridotta a peso zero. I 96 alberi usano input float32 come scikit-learn. Un test confronta le probabilità TypeScript con quelle Python su 22 vettori storici reali, senza esportare nomi, ID o etichette. Hash degli algoritmi delle caratteristiche e dell'artefatto verificati dai test. Nessuna dipendenza Python nel runtime Vercel.

## Persistenza, autorizzazione e aggiornamenti

Osservazioni, controlli, lotti giornalieri e limiti alle richieste sono conservati come record di ricerca con nomi/versioni separati nella tabella esistente `model_versions`, nel campo JSONB `parameters`, sempre `validated=false`. Riutilizzo del registro di esperimenti già usato per i lotti dello studio precedente: **nessuna nuova tabella o migrazione**. La RLS esistente consente lettura ai membri privati; il nuovo endpoint riserva il report e le esecuzioni al proprietario. Nessuna scrittura diretta del client. I record non contengono puntate o note personali.

Prima registrazione per evento immutabile tramite ID deterministico e inserimento senza aggiornare duplicati. Hash canonico indipendente dall'ordine delle chiavi JSONB. Gli esiti sono aggiornati con controllo ottimistico di stato e tentativi, per evitare che una richiesta concorrente degradi un risultato risolto. Controllo dell'ora effettiva anche contro `created_at` del database, non solo il timestamp dichiarato dall'app. Correzioni della fonte rendono l'osservazione invalida senza riscrivere la previsione.

- `GET /api/market-study`: report aggregato privato, conteggi nuovi e metriche descrittive.
- `POST /api/market-study`: controllo manuale del proprietario; registrazione al massimo una volta al giorno, aggiornamento esiti con tentativi limitati e cooldown.
- Cron Vercel esistente `15 4 * * *`, stesso endpoint protetto `/api/study-run`: esegue lo studio originario e quello nuovi mercati separatamente; un errore del primo non impedisce il tentativo del secondo. Durata complessiva limitata al budget Hobby di 300 secondi, con deadline per il secondo studio. Nessun nuovo cron o piano.
- Bootstrap Production versionato nel build, attivo con il flag di raccolta già abilitato. Il lotto giornaliero persistente evita duplicati nei rebuild; dopo l'esecuzione il bootstrap rilegge il report dal database e stampa soltanto conteggi.
- Blocco di esecuzione distribuito per intervalli di 15 minuti. Al massimo 100 verifiche closing per esecuzione, almeno 750 ms tra richieste, tre tentativi per evento con 12 ore di pausa. Su 429/503 interrompe il lotto e persiste una pausa globale di almeno 15 minuti, rispettando eventuale `Retry-After` più lungo. Nessuna attesa per giorni dentro una funzione: lo stato persiste tra invocazioni.

La pagina **Statistiche modello** mostra raccolta nuova, risolte/in attesa/invalidi, giorni, controlli e aggiornamento manuale. Il report storico da 261 casi resta consultabile se il nuovo endpoint non risponde.

Il dettaglio **Pronostici corretti e sbagliati per mercato** aggiunge un conteggio descrittivo dall'esito più probabile nelle probabilità originali: p>0,5 indica il target nominato, p<0,5 il complemento (altro giocatore/Under/handicap opposto), p=0,5 nessuna preferenza. Corrette e sbagliate includono soltanto esiti verificati con preferenza; l'accuratezza divide corrette per corrette+sbagliate. In attesa e invalidi sono separati; le stime al 50% restano comunque nei Brier/Log Loss/ECE e in tutti i controlli del protocollo. È una statistica descrittiva aggiuntiva: non modifica previsioni, criteri, coorte o esiti, non filtra lo studio per EV e non rappresenta il bilancio delle puntate personali o delle sole opportunità EV positive.

Per consentire controlli successivi senza leggere credenziali o singoli record, il report privato scrive nei log privati di hosting `marketStudyStatus` con soli aggregati per mercato. Nessun nome, ID giocatore/evento/utente, probabilità individuale o puntata nei log. La pagina continua a richiedere login e proprietà. Test espliciti su preferenze/opposti, 50%, irrisolti e invalidi; 245 test dell'app e build superati, QA locale dei 14 contatori su telefono e PC con API sintetica dichiarata.

## Cosa non è dimostrato

Passare un controllo statistico non dimostra EV, profitto o prezzi eseguibili: questi target non hanno snapshot di quote operative confrontabili. Le fonti restano referti riportati da MoviOdds, non certificazioni ufficiali indipendenti. Nessuna attivazione automatica dei nuovi mercati o sostituzione del modello del test originario, nessuna garanzia che un candidato diventi affidabile. La programmazione del cron non dimostra l'esecuzione futura: si controllano i lotti realmente salvati.

## Verifiche

243 test Vitest in 34 file e 5 test Python, controllo TypeScript, build Vite e avvio ESM compilato. Test dedicati a parità Python/TS, hash congelati, dati futuri/simultanei, soglia storico, duplicati, login/proprietario, isolamento degli errori del cron, fonte/identità, registrazione effettiva prima dell'inizio, formati, prefissi fissi, irrisolti, finestre chiuse e controlli multipli. Browser locale su nuovo pannello e storico a 393×851/1440×1000, con API prospettica sintetica dichiarata: aggiornamenti, 14 mercati, errore fonte, nessun overflow orizzontale o errore JavaScript. Il bootstrap Production fornisce la verifica separata delle scritture reali, quando il deployment è completato; non è un login remoto con l'account del proprietario.

Pubblicazione del codice `2ea8ab833addc1d1793a76d55151c48b88dc4c44`: deployment Production `dpl_BuPFTwFNPeEG9GTSWa2ghoGzf8ti` READY, alias https://ping-pong-ping-pong3.vercel.app verificato sullo stesso ID, GitHub CI superata. Bootstrap reale del 5 novembre 2026 alle **15:32:12 UTC**: **100 nuove partite**, 0 esiti risolti, 100 in attesa, 0 errori della fonte. La successiva rilettura del report dal database conferma tutti i 100 record, un giorno osservato e `scheduled=true`; nessun risultato prospettico ancora misurabile. La programmazione non prova l'esecuzione futura del cron.

Probe HTTP nativo sul deployment protetto `/api/health` = 200, JSON `status=ok`. Smoke ESM riuscito anche con Node 26.13.0 nel build Vercel, compreso 401 applicativo anonimo della nuova API. Verifiche DB/RLS e Google riuscite senza cambiare schema, chiavi o membership. Nessun login remoto con il JWT del proprietario, nessuna protezione Vercel rimossa. Il bootstrap del vecchio studio non è stato richiesto; pesi e protocollo precedenti invariati.

### Controllo successivo — 5 novembre 2026, 16:16:46 UTC

Eseguita la procedura server esistente su richiesta di continuare lo studio, senza cambiamenti al codice applicativo, ai pesi o al protocollo. **Due partite risolte** con risultato e closing verificati; due tentativi, zero errori della fonte. Rilettura del database: **100 registrate, 2 risolte, 98 in attesa**, un giorno osservato, raccolta giornaliera configurata. Zero nuove registrazioni nello stesso giorno, come previsto dal limite di arruolamento; nessuna riscrittura delle probabilità e nessuna puntata. I 261 casi retrospettivi rimangono separati. Due esiti non consentono alcuna conclusione sull'affidabilità e nessun controllo formale è ancora raggiunto.

Deployment `dpl_AAxdXvpg7wWFtvsQJWRQVudrApPL` READY dal commit documentale `b4ad981125a87a193324e4db274b1d4827c039b4`, con identico codice applicativo già testato. Alias stabile verificato sul nuovo ID e probe protetto `/api/health` = 200. Build, TypeScript e smoke ESM Node 26.13.0 riusciti; la suite statistica/software precedente non è stata ripetuta perché non sono stati modificati algoritmi o implementazione. L'esecuzione del controllo tramite build non viene presentata come prova dell'avvenuta esecuzione del futuro cron.

### Controllo successivo — 5 novembre 2026, 20:46:58 UTC

Rieseguita la procedura esistente di continuazione senza modifiche al codice pubblicato `b9cc1a3979248040ef55f5680d2ca87cf9df0341`. **62 ulteriori esiti verificati**, 62 tentativi, zero errori della fonte. La rilettura del database conferma **100 partite registrate, 64 risolte e 36 in attesa**, un solo giorno osservato; raccolta giornaliera configurata, nessuna nuova registrazione nel lotto già arruolato. Le probabilità originali e i protocolli restano invariati; i 261 casi retrospettivi restano separati. Questi conteggi misurano la copertura degli esiti, non l'accuratezza dei pronostici, e non consentono ancora una conclusione sull'affidabilità.

Deployment di controllo `dpl_FpgmAutjGPbAFHq9zF1FLVL8U5tU` READY, alias stabile verificato sullo stesso ID, probe protetto `/api/health` = 200 e smoke ESM compilato riuscito su Node 26.13.0. Nessun aggiornamento di modelli, criteri, filtro EV o credenziali, nessuna puntata o nuovo login remoto con l'account del proprietario. Il controllo manuale non certifica l'esecuzione futura del cron programmato.
