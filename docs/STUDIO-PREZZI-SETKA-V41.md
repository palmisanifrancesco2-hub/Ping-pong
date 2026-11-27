# Verifica dei prezzi prematch nel tennis tavolo

**Giudizio al 27 novembre 2026.** Nessun vantaggio dimostrato su prezzi ADM. Lo studio confronta le stime con Bet365 Australia e avvia un registro a puntata simulata. I prezzi italiani, l’effettiva disponibilità al momento della decisione e un consenso indipendente restano da verificare.

## Audit delle fonti

| Fonte | Evidenza disponibile | Uso |
| --- | --- | --- |
| MoviOdds `/odds` | Il connettore usa la versione `bet365.com.au`. Sono disponibili identificatori di evento, gruppo, mercato, linea, periodo, prezzo, timestamp e stato della selezione quando dichiarati. | Registro delle osservazioni prematch. Nessun prezzo ADM confermato. |
| MoviOdds `/results` e cache `/closing` | Punteggi dei set per i risultati completi. Il campione di prezzi richiede ID e nomi verificabili, orario di kickoff noto, coppia completa e prezzi precedenti alla soglia di sicurezza di un minuto. | Refertazione simulata e confronto a posteriori. Nessun riscontro dell’accettazione della quota. |
| Setka Cup 2022 | 7.843 risultati eleggibili nel protocollo precedente. | Addestramento sportivo storico. L’archivio non contiene uno storico sincronizzato di prezzi ADM. |
| ADM | Concessione 16030, Hillside (New Media Malta), dominio `bet365.it`. | Verifica dell’operatore italiano. Le versioni .au e .it restano listini distinti. |
| SNAI, Sisal, OddsPapi, odss-api.com | Esistono palinsesti italiani o documentazione di possibili fonti. Il progetto non dispone qui di campioni accoppiati con listino italiano, linea esatta, refertazione e prezzo storico verificabile per la Setka. | Fonti da verificare prima di calcolare consenso e ritardi tra operatori. |

Il catalogo pubblico di odss-api.com, verificato il 27 novembre, riporta 1.455 eventi sotto lo sport `tennistavolo`, di cui 140 etichettati `Setka Cup`. Elenca separatamente le competizioni omonime e i palinsesti handicap. Sono conteggi di catalogo, non prove di prezzi italiani disponibili o bookmaker indipendenti. L’endpoint dei prezzi richiede una chiave di questo fornitore. Il piano gratuito documentato indica 500 richieste al mese.

Un confronto tra bookmaker deve escludere il book valutato, usare la stessa linea e granularità e raggruppare fonti che replicano il medesimo fornitore. Oggi gli operatori indipendenti verificati per il consenso sono **zero**. Un margine depurato su Bet365 è un riferimento interno. Cambi del margine, sospensioni, aggiornamenti asincroni e differenze di refertazione possono produrre scarti apparenti. Non si possono inferire le esposizioni o i limiti del bookmaker dai prezzi osservati.

[Concessione ADM](https://www.adm.gov.it/portale/monopoli/giochi/gioco_distanza/gioco_dist_concessionari?cod_conc=16030&nome_conc=&nome_sito=&sub_home=Ricerca) · [Documentazione MoviOdds](https://moviodds.com/doc) · [Palinsesto SNAI](https://www.snai.it/scommesse/sport/tennis-tavolo) · [Tennis tavolo OddsPapi](https://oddspapi.io/blog/table-tennis-odds-api/) · [Documentazione odss-api.com](https://odss-api.com/) · [Catalogo pubblico odss-api.com](https://odss-api.com/api/v1/leagues) · [Studio cronologico sui mercati secondari](STUDIO-MERCATI-PREMATCH-V33.md)

## Vincente su più competizioni

Il replay usa 258 partite con coppie di quote australiane, già esaminate per altri studi. Le probabilità sportive provengono dal replay cronologico v38. Il blocco iniziale del 20–25 ottobre contiene 23 partite. Il blocco del 26–31 ottobre ne contiene 79 e seleziona il peso della combinazione (0%, 25%, 50%, 75%, 100% sulla scala logit). Quello del 1–4 novembre contiene 156 partite e resta fuori dalla scelta in questo esperimento. Le previsioni del candidato fisso 25% mostrato come analisi di sensibilità parallela sono calcolate con lo stesso peso per ogni partita.

| Metodo, 156 partite | Brier | Log loss | Errore di calibrazione | EV nominale positivo a quota ≥1,30 | Di cui vicino a 2,00 (±0,25) | Superano lo stress |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mercato proporzionale, selezionato in validazione | 0,24288 | 0,67864 | 0,05622 | 0 | 0 | 0 |
| Mercato con metodo potenza | 0,24375 | 0,68080 | 0,06160 | 0 | 0 | 0 |
| Solo statistiche sportive | 0,24694 | 0,68659 | 0,04406 | 107 | 56 | 56 |
| Mercato + 25% sport, controllo a peso fisso | 0,24220 | 0,67704 | 0,06392 | 36 | 7 | 0 |

Il test finale copre quattro giornate. Per il bootstrap a blocchi sono richieste almeno sette. Sulle 258 partite, nel controllo descrittivo a peso fisso, l’intervallo della differenza di Brier rispetto al mercato è **[−0,00310; +0,00346]** su 16 giorni, con blocchi di tre giorni e correzione per tre confronti. Delle 56 selezioni sportive che superano lo stress non si conosce l’eseguibilità. Questa analisi non fornisce ROI, drawdown o un confronto con una chiusura distinta dai prezzi usati nel replay.

## Setka Cup e Setka Cup Women

Verifica su archivio del 5 novembre. In 249 incontri con feature anteriori al segnale, 121 sono Setka Cup e Setka Cup Women. La raccolta d’origine era incompleta. Sono state abbinate **35 coppie a un modello**. Alcune linee aggiuntive hanno coppie di prezzi ma sono fuori dalle linee del modello congelato. I conteggi per linea possono riferirsi alla stessa partita.

| Mercato | Coppie con modello | Brier mercato | Brier sport | Brier combinato 25% | Log loss mercato / sport / combinato | Giudizio |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Vincente | 7 | 0,28249 | 0,24623 | 0,27207 | 0,75858 / 0,68537 / 0,73748 | Ancora da verificare |
| Primo set | 11 | 0,22057 | 0,24320 | 0,22570 | 0,63386 / 0,67954 / 0,64433 | Ancora da verificare |
| Handicap set A −1,5 | 12 | 0,25905 | 0,27048 | 0,26042 | 0,71105 / 0,73845 / 0,71422 | Ancora da verificare |
| Handicap set A +1,5 | 3 | 0,29219 | 0,22827 | 0,27449 | 0,77864 / 0,64810 / 0,74225 | Dati insufficienti |
| Totale punti 74,5 | 2 | 0,24276 | 0,25306 | 0,24518 | 0,67865 / 0,69928 / 0,68350 | Dati insufficienti |
| Totali set, handicap punti, altri singoli set e risultato esatto | 0 sulle linee del modello | — | — | — | — | Dati insufficienti |

Nessun intervallo affidabile su una sola giornata. Alcune linee senza modello abbinato hanno dati grezzi, fra cui Over/Under 18,5 punti del primo set e handicap ±2,5 punti del primo set. L’archivio più ampio v33 valuta modelli di punteggio e handicap rispetto a frequenze storiche. I progressi predittivi di quel confronto non forniscono prezzi confrontabili per queste linee.

## Registro simulato

In **Statistiche modello → Test a risultato coperto → Studio prezzi Setka Cup** le opportunità ADM sono vuote. I prezzi australiani sono visibili tra le osservazioni di ricerca quando ci sono stime e scarti nominali positivi. La tabella riporta linea e lato, timestamp del prezzo e della rilevazione, probabilità senza margine proporzionale e con metodo potenza, probabilità sportiva, quota equa e valore atteso. Quota minima 1,30 e preferenza vicino a 2,00 sono filtri di visualizzazione.

La prima osservazione è l’apertura osservata dal registro. Le letture successive sono distinte e la chiusura viene conservata a parte quando rispetta le verifiche di linea, lato e tempo. La simulazione fissa una sola decisione per partita e linea. Richiede EV positivo anche sottraendo cinque punti percentuali alla stima e riducendo del 5% il guadagno netto del prezzo. Lo stress è una sensibilità deterministica. L’incertezza statistica è riportata separatamente. Il referto richiede registrazione prima del kickoff verificato e incontro completo. Il calcolo dell’EV supporta vittoria, mezza vittoria, rimborso, mezza perdita e perdita per regolamenti futuri. La prova in corso usa mercati binari a mezzo punto o senza rimborso di punteggio. I rimborsi per ritiro e le linee intere restano fuori finché mancano condizioni italiane verificate.

Lo storico recente riporta puntate simulate unitarie sul solo sottoinsieme verificato, Brier, log loss, calibrazione, drawdown e intervallo del ROI quando la copertura lo permette. Il test a 60–180 secondi richiede una nuova osservazione comparabile prima dell’inizio. La cadenza di raccolta è più lunga, quindi il test di ritardo può restare senza dati. Servono una fonte italiana con esatta mappatura delle linee e regole, nuovi risultati tenuti separati, e osservazioni abbastanza ravvicinate per verificare persistenza e rischio di prezzo.

## Riproduzione

L’estrazione legge la cache privata v8 e scrive un file temporaneo. Il replay usa il campione v38 privato, con impronta riportata nel risultato. Nel repository vengono salvate solo metriche aggregate.

```bash
node --import tsx scripts/replay-book-pricing.ts /tmp/ping-pong-setka-pricing.json
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 .research-data/venv-v18/bin/python \
  scripts/benchmark-book-pricing.py /workspace/scratch/v38-quote-sample.json \
  /tmp/ping-pong-setka-pricing.json research/report-book-pricing-v41.json
```

[Metriche complete, curve di calibrazione e copertura per linea](../research/report-book-pricing-v41.json)
