# Inventario dei dati reali v16

Ispezione del repository e dei file locali completata e ricontrollata l’11 novembre 2026. Il rapporto strutturato è [data-inventory-v16.json](../research/data-inventory-v16.json), prodotto da `python scripts/inventory-data-v16.py`. I dati individuali rimangono in `.research-data/`, esclusi da Git. Non sono stati letti segreti, file di credenziali o sessioni del proprietario; non è stata interrogata direttamente la base Supabase remota.

## Fase 1 — fonti e infrastruttura trovate

Il progetto esistente usa React/TypeScript/Vite, backend Node/TypeScript, Supabase Auth/PostgreSQL e Vercel. Il feed attivo è MoviOdds, sito bookmaker `bet365.com.au`. `server/provider.ts` conserva il connettore ufficiale The Odds API V4 (sport/eventi/mercati/quote), con chiave esclusivamente server-side tramite `server/env.ts`; questa ispezione non ha consumato richieste né verificato credenziali o nuova copertura del tennistavolo. La presenza del connettore non dimostra disponibilità dei mercati.

Le migrazioni includono autorizzazioni private, profili, giocatori, competizioni, eventi, risultati, bookmaker, mercati, quote append-only, versioni dei modelli, previsioni, esiti, puntate manuali, metriche e scelte personali. Quote e previsioni hanno timestamp distinti di fonte/ricezione/registrazione. RLS e controlli del proprietario sono nel codice e nello schema. **I conteggi remoti correnti non sono stati verificati da questo inventario**: lo schema esistente non dimostra che tutte le colonne contengano dati o che la raccolta sia completa.

Le osservazioni prospettiche v9/v10 sono salvate in `model_versions.parameters` con hash delle previsioni e checkpoint. I relativi record non sono stati esportati o alterati. I conteggi locali dei rapporti precedenti non vengono presentati come stato corrente di queste raccolte.

## Fase 2 — quantità, copertura e qualità misurate

| Fonte / coorte | Righe | Intervallo della fonte | Identità dei giocatori | Punteggi completi coerenti |
| --- | ---: | --- | ---: | ---: |
| MoviOdds, snapshot principale | 23.596 | 5 ottobre–4 novembre 2026 | 1.903 nomi normalizzati **entro competizione** | 23.596 |
| MoviOdds, archivio alla cattura prospettica | 23.670 | 5 ottobre–4 novembre 2026, ore 22:12 UTC | 1.909 entro competizione | 23.670 |
| WTT uomini | 5.442 | 27 febbraio 2022–10 dicembre 2025 | 752 nomi normalizzati nella coorte | 5.436 senza fidarsi di `best_of` |
| WTT donne | 4.850 | 27 febbraio 2022–10 dicembre 2025 | 624 nomi normalizzati nella coorte | 4.848 senza fidarsi di `best_of` |
| Setka, SCORE | 7.851 | 10 giugno–8 luglio 2022 nel CSV | 565 nomi normalizzati | 7.848 prima della deduplicazione |

Le due fotografie MoviOdds si sovrappongono: l’unione contiene **23.670 ID**, solo 74 in più dello snapshot principale. Non sono 47.266 nuove partite. Tutti i punteggi di questi due snapshot ricostruiscono incontri al meglio dei cinque set; il formato è inferito dal risultato, non verificato come informazione disponibile prematch.

MoviOdds comprende 35 nomi di competizione. Nello snapshot principale: Setka Cup 9.627, Czech Liga Pro 5.790, TT Cup 3.971, TT Elite Series 3.393, Setka Cup Women 235, Challenger Series TT 149; le altre competizioni hanno coperture minori. L’elenco completo con le numerosità è nel JSON. Un nome presente nello storico non dimostra una copertura corrente continua o rappresentatività statistica.

Ogni coorte WTT contiene 81 nomi di evento/torneo; il JSON li elenca separatamente. Nomi e ID dei file maschili e femminili non vengono fusi. Gli ID grezzi si ripetono fra file: il prefisso della coorte è obbligatorio per non abbinare incontri diversi. La normalizzazione usa Unicode NFKC, spazi e maiuscole/minuscole; non inventa alias, non elimina accenti e non certifica l’identità anagrafica dei giocatori.

### Campi mancanti, duplicati e incongruenze

- **MoviOdds:** nessun duplicato di ID, conflitto, punteggio incoerente o campo essenziale mancante nei due snapshot normalizzati esaminati. Il risultato del controllo non certifica ufficialmente ogni esito riportato dalla fonte. Risultati e punteggi dei set sono presenti nel 100% delle righe; quote e orari d’inizio non sono incorporati nei record `MatchResult`.
- **WTT:** otto righe falliscono i controlli del punteggio, vincente o arresto del match. Il campo `best_of` è incompatibile con il punteggio in 5.214 righe maschili e 4.627 femminili altrimenti coerenti: soltanto 443 righe passano anche il formato dichiarato. Non sono stati corretti automaticamente questi valori usando l’esito. Sport, genere, dataset_id, superficie e tutte le colonne di ranking/punti ranking sono vuote nel 100% delle righe: la provenienza della coorte rimane nel nome del file. Nessun ID duplicato all’interno di ciascun file. Date, nomi e punteggi sono presenti, ma orari e pubblicazione delle informazioni non sono verificati.
- **Setka:** quattro righe duplicate ignorando la colonna indice; 7.847 righe distinte. Tre righe hanno punteggi/esiti incoerenti. La descrizione indica settembre 2022, ma il CSV contiene giugno–luglio 2022. Il formato mese/giorno/anno è riconoscibile anche da giorni maggiori di 12. L’ora è presente ma il fuso orario non è verificato. Le colonne del quarto e quinto set contengono rispettivamente il 30,6076% e 67,9277% di `NA`: un set non giocato non deve essere inventato né automaticamente trattato come dato corrotto. Le percentuali per ogni colonna, senza un ambiguo unico indice globale, sono nel JSON.

Le licenze WTT sono dichiarate CC BY 4.0 dall’autore [Li02003121 / RSMD](https://github.com/Li02003121/racket-sports-dataset), con [archivio OSF](https://doi.org/10.17605/OSF.IO/PJUW8). La fonte Setka è Gavin Cassidy, [SCORE Sports Data Repository](https://data.scorenetwork.org/table_tennis/table_tennis_sept2022.html); la licenza di ridistribuzione non è stata verificata. I grezzi non sono pubblicati nel nostro repository.

### Orari, disponibilità e quote storiche: ciò che esiste davvero

`finishedAt` è l’orario di conclusione riportato dalla fonte. `availableAt` è il massimo fra conclusione e aggiornamento del fornitore. Non sono l’orario d’inizio e non dimostrano la prima pubblicazione di un risultato. I CSV WTT hanno date, non timestamp di disponibilità verificati. Il ritardo convenzionale di sette giorni dello studio WTT v15 è un’ipotesi dichiarata, non una verifica indipendente dei tempi.

La cache locale contiene **3.887 payload closing** corrispondenti allo snapshot principale. **3.845** superano nuovamente il controllo dell’inizio noto, non stimato, corrispondenza dell’incontro e compatibilità temporale col risultato. Il manifesto precedente ne includeva 3.348: nessuno di questi manca o fallisce il nuovo controllo. Non è stato ancora ricostruito un campione con 10.000 inizi verificati.

Esistono quote storiche, ma con copertura limitata: **269 incontri** hanno una coppia vincente coerente, non sospesa, quota decimale maggiore di 1, con timestamp non successivo alla decisione a un minuto dall’inizio noto e non più vecchio di cinque minuti. Non è corretto dire che non abbiamo alcuna quota storica, né che ne abbiamo per tutti i 23.596 incontri.

Di queste coppie, **153** coincidono esattamente con le righe del dataset causale v8 (2.168 righe totali). L’export privato `.research-data/v16-qualified-market-baselines.json` comprende ID, momento decisionale, inizio effettivo riportato, data di disponibilità delle caratteristiche, entrambe le quote e relativi timestamp, probabilità implicite grezze, probabilità normalizzata e margine. L’`at` delle caratteristiche e dell’export è **già** l’inizio meno un minuto: non va sottratto un secondo minuto. Tutte le caratteristiche esportate precedono questa decisione. Il JSON pubblico riporta solo conteggio e hash dell’export, non gli ID.

La regola rispecchia `src/domain/research-source.ts`, compreso il controllo di freschezza. Gli ultimi prezzi dopo la decisione non diventano retroattivamente input prematch. Le coppie costituiscono un sottoinsieme utile per un benchmark separato sport/quote; non possono sostituire silenziosamente i 1.804 casi comuni degli studi precedenti. Prezzi memorizzati non certificano la possibilità storica di esecuzione, limiti di puntata o assenza di revisione della fonte.

Il manifesto locale prospettico v3 contiene inoltre **304** previsioni con entrambe le quote timestampate entro l’osservazione e registrazione anteriore all’inizio **programmato**, osservate il 4 novembre 2026 alle 22:17:32 UTC. Non è stato ricalcolato l’esito di questo vecchio campione, né viene definito un nuovo test indipendente dopo i precedenti esami. La corrispondenza con l’inizio effettivo richiede il relativo controllo, non solo il calendario previsto.

Tutte queste quote provengono dal sito **bet365.com.au**. Non è stata verificata per questo sito l’autorizzazione italiana ADM. Una concessione riferita a un marchio o a un dominio diverso non può essere trasferita automaticamente a queste quote.

## Fase 3 — dataset causali e mercati ricostruibili

| Archivio di caratteristiche | Righe | Caratteristiche | Obiettivi | Controllo temporale memorizzato |
| --- | ---: | ---: | ---: | --- |
| Storico v8 | 2.168 | 63 | 14 | `featuresAvailable < at < available` in tutte le righe |
| Conferma v8 | 249 | 63 | 14 | stesso controllo superato |
| Estensione v8 | 12 | 63 | 14 | `available` assente nelle 12 righe; non dichiarata completa questa verifica |

Questi file sono già stati esaminati nei precedenti esperimenti e non sono un test finale nuovo. I casi da 249+12 non vengono sommati automaticamente ai 1.804 comuni dei confronti passati.

I punteggi completi e ordinati permettono di ricostruire etichette per vincente, risultato esatto del match, numero di set, handicap set, totali e handicap punti, vincitori e punti dei set **effettivamente giocati**, almeno un set vinto, vittoria senza perdere set e rimonta dopo il primo set perso. Per set che potrebbero non essere giocati serve una semantica condizionata esplicita; non va attribuito loro un esito fittizio.

Sono già definiti 14 obiettivi di ricerca: vincente, primo set, punti primo set 19,5, numero set 3,5/4,5, punti match 74,5/79,5/84,5, handicap set ±1,5 e handicap punti ±5,5/±9,5. L’esistenza dell’etichetta storica **non** implica una previsione sufficientemente affidabile o un mercato effettivamente quotato oggi.

Per i nuovi mercati occorrono formato e regole disponibili prima dell’incontro, associazione esatta evento/linea/selezione e validazione specifica. Le caratteristiche causali devono avere timestamp entro l’istante della previsione. Sono assenti sequenze rally per rally, servizio/risposta e colpi: non è possibile dichiarare addestrato un modello live condizionato a questi dati.

## Blocchi reali e parti utilizzabili

1. **Formati prematch:** da verificare, specialmente WTT. Il risultato finale non può essere una scorciatoia per ottenere un’informazione prematch mancante.
2. **Pubblicazione e orari:** date di CSV e ritardi ipotetici non sostituiscono timestamp verificati.
3. **Quote:** il sottoinsieme di 153 righe consente un esperimento separato con confronti sport-only, quote-only e sport+quote. La numerosità e il periodo possono non bastare per un addestramento e test indipendenti robusti.
4. **ADM:** nessuna autorizzazione italiana del sito estero verificata; non approvare automaticamente opportunità operative su queste quote.
5. **Test futuro:** dopo ripetute scelte sullo storico serve un campione prospettico congelato, con conteggi e risultati letti dal report privato autorizzato.

Le strutture esistenti di raccolta con quote append-only, date di disponibilità, registrazioni immutabili, hash, risultati e checkpoint possono supportare questa raccolta. Non sono necessarie credenziali nel frontend o nuove tabelle per inventare dati mancanti.

## Verifiche eseguite

Cinque test dedicati superati con `python -m unittest discover -s scripts -p 'test_inventory_v16.py'`: legalità e arresto dei punteggi, inversione del vincente, normalizzazione prudente, istante decisionale a inizio meno un minuto, rifiuto di quote future/obsolete/sospese/mancanti/non numeriche e distinzione fra risultato falso e valore mancante. L’inventario legge i file reali e produce soltanto aggregati; l’export per il benchmark resta privato con permessi 0600. Nessuna nuova prestazione predittiva è dichiarata da questo audit.
