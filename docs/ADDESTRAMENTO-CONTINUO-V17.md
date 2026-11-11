# Addestramento controllato dei candidati — v17

Il servizio `AdaptiveTraining` addestra realmente nuovi candidati usando le osservazioni prospettiche già raccolte. È separato dalla promozione del modello: il candidato rimane sempre `validated=false`, non modifica il modello delle quote e non riscrive le probabilità congelate degli studi v9/v10.

## Attivazione e integrazione

Abilitato quando `APP_FORWARD_STUDY_ENABLED=1`, salvo `APP_ADAPTIVE_TRAINING_DISABLED=1`. Non richiede nuove credenziali, migrazioni, servizi a pagamento o chiamate al fornitore dei risultati. Riutilizza Supabase e il cron giornaliero gratuito esistente; il chiamante deve invocare `run()` dopo la raccolta e l’assestamento degli esiti. Un pulsante privato può invocare lo stesso metodo: non crea un secondo tentativo nella stessa giornata.

Interfaccia: `new AdaptiveTraining(env, now=Date.now)`, `run(userId?, deadline=this.now()+90000)`, `report(userId)`. `adaptiveTrainingEnabled(env)` e `adaptiveTrainingProtocol` sono esportati. Le richieste manuali verificano l’owner anche quando il servizio è disabilitato o il tempo residuo è insufficiente. La lettura del report è sempre riservata all’owner. Una chiamata cron senza utente può uscire subito quando disabilitata.

`report()` restituisce protocollo, stato enabled/scheduled, ultimi 30 riepiloghi giornalieri e `lastRun`. Scheduled significa configurazione production, cron secret presente e training abilitato; non prova che ogni esecuzione abbia avuto successo. I riepiloghi non espongono pesi, vettori, ID individuali, nomi di giocatori o credenziali.

## Dati ammessi

Si leggono soltanto i record `model_versions` con nome esatto `Market observations ${marketStudyProtocol.id}`, study ID e owner esatti. Le osservazioni sono verificate con `assertMarketCase`: hash canonico del forecast, modello e protocollo congelati, vettore di 63 caratteristiche finite e disponibilità delle caratteristiche antecedente alla previsione. Anche il UUID del record deve corrispondere all’ID deterministico originale della cattura.

Si usano solo casi settled con esito binario del vincente, timestamp di disponibilità non futuro, orario effettivo d’inizio e hash closing salvati. Sia la previsione sia la registrazione effettiva in DB devono precedere strettamente l’inizio verificato meno un minuto; il risultato deve essere disponibile dopo l’inizio. Nessun nuovo fetch è eseguito per riempire un dato mancante. Si utilizzano le prime otto caratteristiche originali, senza ricostruirle usando statistiche aggiornate dopo la partita.

I record pending, invalid, indisponibili e rifiutati dai controlli rimangono nei conteggi. Duplicati dello stesso evento sono rifiutati tutti, senza scegliere quello più conveniente. Per il giorno di test si riportano registrati, settled eleggibili e copertura; un campione incompleto non viene presentato come interamente valutato. Questi conteggi sono diagnostici, non una prova di affidabilità.

## Separazione per giorni UTC

Per un tentativo del giorno D:

- Training: previsioni anteriori a D−2, con esiti disponibili prima dell’inizio di D−2. Al massimo 1.000 casi recenti; per rispettare il limite si eliminano intere giornate più vecchie, senza tagliarle a metà.
- Calibrazione: previsioni del giorno D−2, con esiti disponibili prima dell’inizio di D−1.
- Test: previsioni del giorno D−1, con esiti già disponibili al momento del tentativo.

Minimi fissati: **200 training, 50 calibrazione, 50 test**. Se mancano, lo stato è `insufficient_data` con conteggi espliciti. I minimi non vengono abbassati per far apparire il servizio attivo.

Due candidati: logistica full con lambda 0,001 e logistica scores con lambda 0,01, usando le funzioni deterministiche esistenti. La temperatura è scelta tra 0,5 / 0,75 / 1 / 1,25 / 1,5. Famiglia e temperatura sono selezionate soltanto sul Brier della calibrazione; gli esiti del giorno di test non scelgono nessun parametro. Il candidato selezionato viene confrontato con `models/score-runtime-v1.json` sulle stesse righe. Un controllo impedisce di applicare un baseline che sia stato calibrato dopo quelle partite.

**È un replay retrospettivo esplorativo.** Il candidato viene costruito oggi usando una divisione storica e valutato sul giorno successivo al periodo di fitting: le sue nuove probabilità non erano state registrate prima delle partite di quel test. Le caratteristiche originarie erano prospettiche, ma ciò non trasforma questo nuovo candidato in una previsione prospettica già validata. Per dimostrare affidabilità servono catture future della versione candidata e confronto su più giorni, con criteri indipendenti.

## Persistenza, budget e tentativi

Record separati con nome `Adaptive candidates adaptive-candidates-v17`, versione contenente owner e giorno UTC, UUID deterministico. L’insert atomico è il claim: collisione `23505` restituisce `daily_already_attempted`. Il claim è completato nello stesso record con stato, riepilogo, hash degli input e, se addestrato, artefatto privato contenente pesi e temperatura. Tutti i record hanno `validated=false`. Il modello operativo precedente resta intatto e disponibile.

Un fallimento o campione insufficiente resta registrato: nessun secondo tentativo nello stesso giorno; il prossimo giorno UTC può riprovare con dati aggiornati. Un claim interrotto senza esito resta visibile nel report e non viene aggirato. Se prima del claim restano meno di 12 secondi, ritorna `deferred_deadline` senza consumare la giornata. Se il tempo si esaurisce dopo il claim, l’esito deferred/failure viene registrato e il tentativo è consumato. I controlli di deadline sono ripetuti prima delle pagine DB, prima di ogni fitting e prima della valutazione/salvataggio; le operazioni DB in corso dipendono comunque dai limiti di runtime del chiamante.

Il riepilogo e il log compatto `adaptiveTrainingRun` contengono soltanto stato, giorno, conteggi, copertura, famiglia e metriche aggregate. Nessun processo rimane in esecuzione dopo la risposta; non si promette training continuo in background tra le esecuzioni del cron.

## Verifiche

`tests/adaptive-training.test.ts` copre training reale dei due candidati, invarianza della famiglia/temperatura quando si cambiano soltanto gli esiti di test, separazione delle giornate e degli esiti tardivi, cap per giornate intere, rifiuto di input corrotti o futuri, hash dei forecast, registrazione prematch, controllo owner, claim unico, deadline, fallimenti persistiti, conteggio dei dati mancanti, salvataggio privato dei pesi e assenza dei pesi dai report/risposte. I dati di questi test software sono sintetici e non dichiarano prestazioni sportive reali.

Questo documento descrive il servizio e il contratto di integrazione. L’effettiva invocazione da cron, bootstrap e API, e i risultati registrati in produzione, vanno verificati dal relativo rilascio: la sola presenza del file non significa che un candidato sia già stato addestrato in produzione.
