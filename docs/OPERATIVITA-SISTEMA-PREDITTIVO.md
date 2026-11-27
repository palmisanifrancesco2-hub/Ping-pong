# Operatività del sistema predittivo

L’utente può consultare tutto dal browser Android. I comandi seguenti sono istruzioni per Codex/ambiente cloud; non richiedono un PC dell’utente.

## Consultazione

Accedere con l’account privato esistente. In **Statistiche modello**, aprire il report del sistema: inventario, mercato del benchmark, calibrazione per intervallo e competizione, confronto WTT separato e stato delle versioni. **Aggiorna report** rilegge gli aggregati senza avviare training o scritture. Lo stato del test prospettico rimane nella sezione dedicata e non è ricavato dai risultati storici.

Tutte e tre le classifiche conservano il filtro EV positivo anche prudente già richiesto, oltre a quote bet365 con provenienza verificabile e validazione indipendente. Nella vista quote, la classifica A ordina per probabilità, B per valore prudente positivo, la combinata usa pesi modificabili. Non va interpretato come scientificamente ottimale alcun peso impostato dall’utente. I prezzi bet365.com.au sono accettati, senza equipararli a quelli di altri domini. I modelli non validati restano esclusi dalle classifiche operative. **Eventi e giocatori** consente comunque di consultare le partite disponibili e le statistiche reali; i dettagli conservano il comportamento persistente durante gli aggiornamenti.

## Dati e training

1. Conservare nuovi risultati/quote con ID provider, timestamp originale e data effettiva di ricezione; formato e autorizzazione del bookmaker devono avere una fonte verificabile. Non sostituire l’ora d’inizio con l’ora del risultato.
2. Esportare lo snapshot in `.research-data/` tramite strumenti server autorizzati; nessun segreto o dato individuale deve finire nel repository. Mantenere gli archivi grezzi immutabili, con hash e provenienza. I CSV gratuiti restano nelle coorti originali.
3. Eseguire `python scripts/inventory-data-v16.py` soltanto per una nuova versione dell’audit dopo aver predisposto percorsi/versioni nuovi. Gli script esistenti rifiutano di sovrascrivere report già ispezionati: non cancellarli per rifare la selezione sul test.
4. Il benchmark `python scripts/run-advanced-benchmark.py` riproduce il protocollo v16 su input e hash fissati. I dati privati non sono inclusi in Git; dipendenze offline in `research/requirements.txt`. Per nuovi dati creare una nuova versione di protocollo, report e artefatti, mantenendo periodi di training/tuning/calibrazione/test distinti.
5. I modelli vengono salvati privatamente come joblib, con hash negli aggregati. Il modello vincente per un mercato non viene scelto leggendo il minimo del test: la scelta deve essere fissata nella validation e confermata su nuovi dati.
6. Per aggiornare il runtime serve verificare coorte, formato, schema delle feature, parità Python/TS, cutoff e qualità fuori campione, poi produrre un artefatto versionato e confrontarlo con la versione corrente. Nessuna promozione automatica. Il ritorno alla precedente versione avviene ripristinando il commit/artefatto già verificato e pubblicando quella versione; le registrazioni storiche conservano il proprio modello originale.

## Verifiche dell’ambiente cloud

- `python -m unittest discover -s scripts -p 'test_*.py'`: causalità, punteggi, probabilità, calibrazione, inventario e benchmark.
- `npm run check`: test applicativi, TypeScript, avvio del server ESM compilato e build Vite.
- `npm run dev`: frontend e backend locali; per l’utente finale si usa la pubblicazione Vercel protetta e Supabase Auth già esistente.
- API GET `/api/prediction-system`: solo utenti autorizzati, cache privata/no-store, aggregati senza righe individuali di test. POST non consentito.
- API GET `/api/value`: include le tre classifiche con policy bet365/validazione; nessun input del browser può promuovere un modello o cambiare la provenienza del prezzo.

## Monitoraggio

Intervallo di revisione, numero di nuovi esiti e campione minimo di drift sono parametri di `monitorModel`. Gli avvisi confrontano Brier e Log Loss sulla stessa coorte e non sono una prova statistica di peggioramento. In assenza di metriche recenti verificabili lo stato resta non disponibile. La raccolta e il settlement esistenti proseguono sul cron già configurato; il training automatico dei candidati è ora collegato al cron esistente, senza nuovi piani a pagamento.


## Addestramento continuo v17

In Statistiche modello, **Addestramento continuo dei candidati** mostra lo stato e l’ultima esecuzione. **Verifica e addestra candidato** usa POST `/api/training`, riservato al proprietario; **Aggiorna stato training** usa GET dello stesso endpoint. Non sono ammessi parametri dal browser per alterare algoritmo, validazione o dataset. Il comando rispetta lo stesso limite di un tentativo per giornata del cron.

Il cron `/api/study-run` continua prima gli studi originali e il settlement, poi il training di candidati. Si usa la configurazione già abilitata `APP_FORWARD_STUDY_ENABLED=1`; `APP_ADAPTIVE_TRAINING_DISABLED=1` è il comando server per sospendere soltanto i nuovi training. Nessuna chiave aggiuntiva. La raccolta resta separata dalla promozione dei candidati e i protocolli v9/v10 restano invariati.

Per fonti, divisione per giorni UTC, copertura, replay retrospettivo e limiti della raccolta, vedere [il contratto v17](ADDESTRAMENTO-CONTINUO-V17.md). L’automazione dipende dalla disponibilità di osservazioni compatibili: al termine dell’arruolamento originario o in assenza di dati recenti il tentativo resta registrato come insufficiente, senza inventare dati o modificare quel protocollo.
