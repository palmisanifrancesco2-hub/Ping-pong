# Revisione del candidato del vincente

Il risultato iniziale di 30 esiti più probabili corretti e 34 sbagliati su 64 richiede diagnosi e confronto. Non basta a provare che un algoritmo diverso sia migliore o che la stima di probabilità sia calibrata. Il candidato delle frequenze nel test v9 è distinto dalla logistica completa delle quote dell'app. Il modello delle quote e tutti i suoi pesi rimangono invariati.

## Diagnosi sui dati già conosciuti

`winnerDiagnostic` confronta quattro candidati sui vettori di caratteristiche originali salvati prima delle partite:

- Frequenze gerarchiche del test v9, usando esattamente la probabilità originale.
- Logistica completa `score-full-v1`, già modello predefinito delle quote.
- Logistica punti/set `scores:0.01`, che predice sempre il vincente partita.
- Logistica contestuale v8, con i pesi e lo scaler già addestrati prima degli esiti; esportata dal file congelato senza alcun nuovo fit.

Sono inclusi soltanto gli esiti verificati entro il cutoff diagnostico 5 novembre 2026 20:55:54 UTC, identificato dal timestamp dei controlli già salvati. Il campione atteso è 64; revisioni della fonte possono ridurlo e sono segnalate. Il replay non modifica probabilità o risultati originali. Si riportano corrette/sbagliate, Brier, Log Loss ed ECE, riferimento di competizione, suddivisione per competizione e per confidenza del candidato originale. Le etichette dei 64 casi sono già note: confronto **esplorativo**, mai una nuova prova indipendente o una promozione del migliore per accuratezza.

L'export `scripts/export-winner-challenger.py` verifica l'hash del joblib v8 originale e serializza il solo classificatore logit contestuale, media/scala delle caratteristiche e peso di riduzione verso la competizione già scelto nella calibrazione precedente. Non addestra con gli esiti nuovi. Test di parità con scikit-learn su 22 vettori storici reali, senza esportare nomi, ID o etichette.

## Confronto parallelo su partite future

Protocollo nuovo e separato: `research/winner-challengers-v10.json`, creato prima della nuova raccolta. Tutti e quattro i candidati usano **lo stesso nuovo vettore causale**, calcolato al medesimo istante di registrazione. Pesi e caratteristiche congelati mediante hash di sei artefatti/file. Nessun cambiamento al protocollo originale o alle sue previsioni.

La raccolta prende soltanto eventi ancora futuri e irrisolti del bacino v9, assenti dai risultati già disponibili, con almeno 30 precedenti per giocatore, anticipo previsto ≥10 minuti, orizzonte ≤48 ore e coppia di quote vincente coerente e letta di recente. Il risultato non determina l'inclusione. Ordine per hash, prima registrazione immutabile, massimo 100 casi al giorno e 3000 totali. La nuova coorte può condividere eventi con v9: i conteggi non si sommano come partite indipendenti.

Vengono salvate quote di entrambi i giocatori, timestamp della modifica prezzo e della lettura, probabilità del bookmaker normalizzata senza margine, probabilità dei quattro modelli, caratteristiche e hash del collegamento alla previsione v9. Le quote sono osservazioni della fonte, non prova di esecuzione di una puntata. La normalizzazione `(1/quota casa) / (1/quota casa + 1/quota ospite)` è un riferimento del bookmaker, non una probabilità vera certificata.

Gli esiti riutilizzano la verifica closing già eseguita da v9: nessun raddoppio delle richieste closing. Devono corrispondere identità e hash della previsione sorgente; sia l'ora di registrazione del confronto sia `created_at` del database devono precedere l'inizio effettivo verificato di almeno un minuto. Risultati non disponibili restano in attesa; invalidazioni/revisioni della fonte invalidano l'osservazione collegata senza cambiare le probabilità.

Controlli fissi sui primi 500, 1000, 2000 e 3000 casi registrati, almeno 14 giorni osservati e copertura ≥95%. La finestra si chiude una volta almeno sette giorni dopo l'ultimo inizio previsto. Ogni challenger deve migliorare Brier oltre l'incertezza e Log Loss contro **tre riferimenti**: candidato delle frequenze, frequenze causali di competizione e probabilità del bookmaker salvata. ECE <0,08; gli irrisolti e invalidi danno +1 alla differenza Brier prudente, senza essere eliminati. Bootstrap a blocchi di tre giorni di calendario, 20.000 repliche e correzione su 3 challenger × 3 riferimenti × 4 controlli = **36 confronti**. Il valore predefinito della correzione del vecchio studio rimane identico.

Gli esiti dei controlli sono salvati una sola volta con hash del prefisso. Cambiamenti successivi ne segnalano l'incoerenza e richiedono revisione, senza rivalutare fino a ottenere un esito favorevole. Nessuna promozione automatica o garanzia che un candidato superi le soglie; qualità della probabilità e rendimento su quote eseguibili restano questioni distinte.

## Integrazione e protezioni

Nuovi record di ricerca con nomi/versioni separati nella tabella `model_versions` già protetta da RLS; nessuna migrazione, nuova chiave, acquisto o nuovo cron. Il confronto si aggiorna nel controllo v9 già programmato, con lo stesso proprietario e le stesse deadline. Errori del confronto non bloccano la raccolta originale. Il blocco di 15 minuti e il cooldown del vecchio studio rimangono applicati anche al percorso nuovo.

API e pagina restano riservate al proprietario. Il report contiene soltanto aggregati, senza vettori individuali o identificativi; log di hosting privati con soli conteggi/metriche. Nessuna credenziale, puntata o nota personale. Gli helper di hash canonico e UUID sono stati estratti mantenendo il medesimo algoritmo: gli hash delle osservazioni originali restano verificabili.

La sezione Statistiche modello mostra separatamente **Diagnosi sugli stessi incontri già conosciuti** e **Confronto parallelo su partite future**. Il filtro operativo EV >0, anche prudente, e il modello completo dell'app non cambiano.

## Verifiche

250 test in 35 file, TypeScript, build Vite e smoke ESM compilato superati. Nuovi test: parità numerica Python/TS, hash degli artefatti, cutoff diagnostico, nessuna modifica degli input originali, causalità e dati futuri, esclusione di risultati già noti, bacino condiviso e identità, quote coerenti/fresche, registrazione prima dell'inizio effettivo, risultati futuri non disponibili, revisione della fonte, controlli multipli, campione fisso e irrisolti. QA Chromium locale a 393×851 e 1440×1000 con aggregati sintetici dichiarati: quattro candidati, diagnosi e raccolta separata, riferimenti, assenza di risultati, zero errori JavaScript e nessun overflow. I dati reali della diagnosi e l'eventuale avvio della nuova coorte vanno confermati dalla rilettura Production.
