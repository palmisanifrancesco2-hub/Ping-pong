# Pannelli persistenti, ensemble e profili pubblici

## Aggiornamenti della partita aperta

La partita ispezionata mantiene ID, posizione nella lista e componenti montati anche se sparisce momentaneamente dalle selezioni, il prezzo perde convenienza o il feed va in errore. Le statistiche già caricate non vengono azzerate dal polling. Quota, probabilità ed EV vengono aggiornati sul posto quando i due snapshot sono coerenti. Una quota non più conveniente resta consultabile nel pannello con la dicitura «Fuori selezione» e registrazione disabilitata; non è riproposta tra le nuove opportunità. Se mancano prezzo/stima correnti, vengono indicati come indisponibili, conservando i dati già aperti. Un evento uscito dal feed resta aperto solo se l'utente lo stava consultando; gli altri eventi conclusi rimangono esclusi.

## Nuovo confronto storico

Protocollo: `research/protocol-v7.json`. Report: `research/report-v7.json`. Audit con previsioni individuali escluso dal repository in `.research-data/multi-model-v7-audit.json`. Modelli runtime separati: `models/multi-research-v1.json`.

Sottoinsieme dell'archivio precedente: **1804 casi comuni fuori campione**, quattro finestre su nove giorni; requisito minimo aumentato a 30 precedenti per giocatore. La prima finestra non aveva sufficiente addestramento con questa soglia e viene esclusa per tutti i candidati. Non è un nuovo test su 3000 casi. Tutti i sette candidati vengono confrontati sugli stessi eventi. Riutilizzo esplorativo di un archivio già esaminato, non validazione indipendente. Verifica locale aggiuntiva di tutti i **3348 orari** del dataset tramite le risposte closing archiviate, senza richieste di rete; hash sorgenti `e09d4fbc82ee1193aebe67f6d86befa80548851b2a1d9d8177dbe9f161b92834`.

| Candidato | Brier |
| --- | --- |
| Media di logistica completa, logistica punti/set e Glicko-2 | 0,245733 |
| Logistica completa | 0,245877 |
| Ensemble con pesi scelti nella sola calibrazione | 0,246015 |
| Glicko-2 | 0,247149 |
| Frazioni set regolarizzate con prior Beta | 0,247707 |
| Logistica punti/set | 0,247748 |
| Markov dei punti | 0,247870 |

Il primo supera il singolo di appena 0,0001435 Brier. Intervallo appaiato giornaliero corretto per confronti multipli: circa **−0,00226 / +0,00114**, include zero. Nessuna superiorità dimostrata e nessun «modello migliore in assoluto». Il bootstrap stima soltanto incertezza: le previsioni sono deterministiche, senza numeri casuali.

Glicko-2 usa aggiornamenti simultanei per giorni UTC conclusi, tau 0,5, volatilità e deviazione del rating, con probabilità simmetrica basata sulle due deviazioni. Il test riproduce l'esempio numerico ufficiale di Glickman. Il modello Markov usa rally IID e una coda analitica dei vantaggi: non dispone di servizio, tattiche o rally individuali. TrueSkill è stato esaminato come alternativa metodologica, non dichiarato implementato o validato.

Nella schermata quote si può scegliere **Modello per le quote → Ensemble di tre modelli · sperimentale**. Probabilità, EV e salvataggi sono ricalcolati sul server e registrati con versione distinta. Le componenti, gli input numerici e i rating Glicko vengono salvati nell'evidenza della singola previsione. Pesi finali addestrati su 1777 casi e calibrati su 386, con esiti disponibili prima del 5 novembre. Il modello del test prospettico esistente resta il predefinito; protocollo, pesi, campione e regole di arruolamento precedenti invariati.

## Altri mercati

Sono stati addestrati target distinti, non riciclate le probabilità del vincente partita. Calibrazione e baseline costante usano esclusivamente la finestra precedente al test.

| Target | Brier modello / riferimento | Stato |
| --- | --- | --- |
| Primo set | 0,248839 / 0,249946 | Intervallo differenza include zero |
| Over 3,5 set | 0,202160 / 0,202283 | Miglioramento non dimostrato |
| Over 4,5 set | 0,220484 / 0,219498 | Peggiore del riferimento |

Nessuno supera i criteri fissati: non vengono attivate nuove opportunità per questi mercati. I report sono visibili in Statistiche modello. Sono implementate e testate le distribuzioni di set per formato 5/7 e la trasformazione punto→set; ciò non basta a validare risultato esatto, punti o handicap. Il feed reale è stato esaminato per gruppi, periodi e linee: ad esempio primo set `920096` e risultato in set `920129`. La disponibilità di un mercato non dimostra disponibilità di un modello affidabile. Nessun ROI storico viene calcolato senza snapshot di quote utilizzabili al momento.

## Fonte aggiuntiva per i giocatori

Aggiunta **Wikidata**, dati strutturati CC0, senza chiave o abbonamento. Pulsante «Cerca profili estesi» nei dati della partita; ricerca richiesta dall'utente, non raccolta massiva del feed. Nome esatto normalizzato, entità persona e sport/occupazione tennistavolo obbligatori. Omonimi di altri sport esclusi; corrispondenze multiple non risolte automaticamente. Anche una singola corrispondenza resta candidata da verificare, perché MoviOdds e Wikidata non condividono un identificativo.

Visualizzati ID/link alla fonte, nascita con la precisione disponibile e cittadinanza, senza inventare ranking, mano, biografia o campi mancanti. Dati esclusi dalle previsioni. Limite di una richiesta al secondo per istanza, cache giornaliera fino a 400 nomi, errori conservati per 30 secondi, richieste duplicate accorpate, timeout e controlli di schema. L'API profili richiede login/membership e ricava i nomi da un evento sorgente attivo o dal suo risultato. La modalità interattiva omette maxlag come consentito dal manuale Wikimedia; le chiamate non interattive mantengono maxlag=5. Nessun ciclo di retry in caso di sovraccarico.

Verifica reale riuscita su Ma Long: Q459114, nascita presente, cittadinanza Cina; non utilizzato per modificare alcuna previsione. La copertura resta **parziale**, soprattutto per leghe locali/commerciali. Non è stato trovato e verificato un servizio gratuito con tutti i dati di tutti i giocatori dei campionati monitorati.

Valutate altre fonti: Table Tennis API offre un piano gratuito con chiave, **50 richieste/giorno e 10/minuto**; storico individuale, H2H e varie funzioni live/archivio richiedono piani ulteriori. Non attivato e nessun account/acquisto creato. La documentazione ufficiale WTT espone endpoint profilo, ma lo schema OpenAPI richiede Authorization: nessun tentativo di estrarre credenziali o aggirare l'accesso.

Fonti consultate: [Glicko-2 originale](https://www.glicko.net/glicko/glicko2.pdf), [analisi stocastica del tennistavolo](https://arxiv.org/abs/1109.6628), [TrueSkill Microsoft Research](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/), [Wikibase API](https://www.mediawiki.org/wiki/Wikibase/API), [licenza dati Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing), [maxlag e richieste interattive](https://www.mediawiki.org/wiki/Manual:Maxlag_parameter), [piani Table Tennis API](https://tabletennisapi.com/pricing), [schema ufficiale WTT](https://mobileappapi.worldtabletennis.com/swagger/v2/swagger.json).

## Come leggere i nomi dei modelli

Le classifiche da 3000 e 1804 casi riguardano il **vincente partita**. I nomi storici “completo” e “punti e set” descrivono le caratteristiche in ingresso: il primo usa tutte le statistiche, il secondo soprattutto rating e frazioni di punti/set. Nella classifica da 3000 casi, punti/set ha 54,63% di vincitori corretti contro 53,77% del completo; il Brier è però 0,247782 contro 0,247647. Sono due misure diverse e nessuna è una validazione di primo set, totale set o handicap. L’interfaccia esplicita ora il target delle classifiche e distingue i modelli/test per ciascun mercato. Nessuna probabilità, scelta di modello o soglia è cambiata con questa precisazione.
