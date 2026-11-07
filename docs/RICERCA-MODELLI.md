# Confronto riproducibile dei modelli

Protocollo fissato in `research/protocol-v2.json` prima del calcolo delle metriche.
Questa ricerca non sostituisce automaticamente il modello pubblicato e non cambia
il suo indicatore di validazione.

## Dati e protezione temporale

- Archivio pubblico MoviOdds: risultati completi, coerenti e non futuri.
- Identità esatta del giocatore nella stessa competizione; risultati conflittuali esclusi.
- Campione deterministico uniforme di massimo 1.000 partite del 20 ottobre–2 novembre 2026.
- Orario di inizio recuperato da `/closing`, noto e non stimato; entrambi i nomi devono essere presenti esattamente nelle selezioni.
- Previsione ricostruita un minuto prima dell'inizio. Il modello vede solo risultati con `availableAt` strettamente precedente.
- Minimo 20 risultati per ciascun giocatore. L'assenza di dati è un'esclusione, non una previsione sostitutiva.
- Quote `pre_close` considerate solo nel confronto supplementare: coppia vincente partita completa, non sospesa, timestamp precedente alla previsione e vecchio al massimo cinque minuti. Le quote di chiusura successive sono escluse.

## Esperimento

Sei varianti: Elo K=10, 20, 40, 80; forma sulle ultime 20 partite con smoothing Beta(5,5); media di Elo K=40 e forma recente.

1. **Scelta**: previsioni precedenti al 29 ottobre, con esiti disponibili prima di tale data. Selezione tramite Brier Score.
2. **Calibrazione**: 29–30 ottobre, con esiti disponibili prima del 31 ottobre. Platt con regolarizzazione, almeno 40 campioni.
3. **Test finale**: 31 ottobre–2 novembre, candidato e calibrazione congelati. I rating possono aggiornarsi cronologicamente solo con risultati già disponibili: è un test sequenziale, non un addestramento sugli esiti futuri.

Il test finale non determina la scelta del candidato o delle soglie. Non si provano nuovi parametri sullo stesso test dopo averne visto il risultato.

Criteri retrospettivi: almeno 200 casi finali e tre giorni; miglioramento del Brier rispetto sia a 50/50 sia alla frequenza storica della prima selezione, con limite superiore dell'intervallo per giorno inferiore a zero; Log Loss migliore di entrambi; ECE inferiore a 0,08. Almeno 200 casi di sviluppo e 40 di calibrazione.

L'intervallo usa differenze Brier appaiate aggregate per giorno e Student t. Tre giorni sono pochi e i giocatori ripetuti rendono le osservazioni correlate: non è una certificazione di affidabilità.

## Riproduzione nell'ambiente cloud

```sh
NODE_USE_ENV_PROXY=1 npx tsx scripts/collect-research.ts /path/archive.json /tmp/pingpong-research-v2.json
npx tsx scripts/evaluate-models.ts /tmp/pingpong-research-v2.json research/report-v2.json
npm run check
```

La raccolta usa una cache locale e un massimo globale di circa 86 richieste/minuto, sotto il limite pubblico dichiarato di 120/minuto. Un rate limit interrompe il processo; nessuna chiave, acquisto o retry automatico. Archivio e cache grezza rimangono nell'ambiente di lavoro, esclusi dai commit. Il report conserva gli hash del protocollo, del dataset e delle risposte closing, le metriche e le previsioni del test.

## Limiti

I timestamp storici sono dichiarati dal fornitore, non osservati dall'app all'epoca. Esclusioni e dati mancanti possono introdurre distorsioni. Una parte dell'archivio ha contribuito all'addestramento del precedente Elo: occorre comunque una verifica prospettica su nuovi eventi. I risultati non sono certificati da una fonte ufficiale indipendente.

Un Brier migliore non dimostra profitto. Il confronto supplementare con quote senza margine usa solo il sottocampione con prezzi validi e non dimostra che fossero eseguibili. Nessun test effettuato qui autorizza pronostici live, set, punti o altri mercati.

Nella scheda giocatore l'intervallo Wilson è **descrittivo** della frequenza storica, non della probabilità della prossima partita. Presuppone indipendenza: forma e avversari ripetuti possono aumentare l'incertezza reale.

Il protocollo è stato registrato nel commit `a18faf0` prima della valutazione.
I controlli automatici includono esclusione di esiti futuri e coincidenti con l'istante di previsione, mancato uso dell'esito del target, deduplica, isolamento delle competizioni, simmetria dei giocatori e rifiuto di prezzi futuri/sospesi/obsoleti.

L'endpoint privato `/api/model` espone il riepilogo della ricerca, separato dal modello usato nelle stime sperimentali. Non espone le singole righe della ricostruzione e non salva questi test come pronostici effettuati dagli utenti.

## Risultato effettivo del 4 novembre 2026

Archivio: 23.596 risultati utilizzabili. Su 1.000 eventi campionati, 956 hanno orari e identità verificabili; 44 esclusi. I casi con storico minimo sono 570; i tagli temporali e la rimozione degli esiti non ancora disponibili danno 321 casi di sviluppo, 99 di calibrazione e 146 di test finale.

- Candidato scelto **Elo K=10**, Brier di sviluppo 0,244673.
- Test finale: **53,42%** di esiti corretti; Brier **0,252164**, contro 0,250000 del 50/50.
- Log Loss 0,697443, contro 0,693147; ECE 0,043412.
- Differenza media Brier per giorno +0,003128; intervallo diagnostico 95% da −0,014165 a +0,020420. Include zero: il miglioramento non è dimostrato.
- Campione finale inferiore ai 200 casi prefissati. Non si abbassa la soglia dopo il risultato.
- Solo 9 casi hanno una coppia di quote compatibili con il timestamp richiesto: confronto bookmaker troppo piccolo per conclusioni.
- **Controlli retrospettivi non superati. Nessuna promozione del modello e nessun profitto dimostrato.**

Il test finale non viene riutilizzato per cercare parametri migliori. Un'ulteriore ricerca dovrà avere un nuovo test indipendente; la verifica prospettica richiede nuovi eventi e registrazione prima dell'inizio. L'archivio gratuito e la sola variazione di Elo/forma recente non hanno finora dimostrato un modello affidabile.
