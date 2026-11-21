# Test storico aggiuntivo con modelli congelati — v20

## Fasi completate

1. Ispezionati input e artefatti privati esistenti, senza richieste ai fornitori o letture di credenziali.
2. Individuati 249 eventi del 5 novembre 2026, senza sovrapposizione con i 2.168 ID del dataset principale né con i 1.804 test precedenti. Tutti i 14 esiti ricontrollati dai set e inizi verificati nei closing salvati.
3. Salvato il protocollo prima dell’inferenza. Nessun nuovo fitting, calibrazione, selezione di soglie, famiglia o iperparametri su questi 249 casi.
4. Caricati sette artefatti dell’ultima finestra v16/v18 dopo verifica degli hash. Gerarchico ricostruito dai pesi congelati del manifest.
5. Eseguite anche due miscele prestabilite: CatBoost/NGBoost al 50%; sui punti, CatBoost/NGBoost/flow a un terzo ciascuno.
6. Salvati report aggregato e audit individuale privato; controllati nuovamente gli hash degli artefatti dopo l’inferenza.

## Interpretazione corretta

Questo è un **test retrospettivo esplorativo su una coorte diversa**, non una nuova validazione indipendente. Gli incontri sono successivi alle finestre di fitting/calibrazione simulate, ma precedono l’addestramento reale degli artefatti v18 e i loro risultati erano già stati esaminati in studi v8. Queste probabilità non furono registrate prima degli incontri. La coorte copre un solo giorno: niente intervalli temporali o dichiarazione di affidabilità multi-giorno. Nessuna inferenza di ROI o vantaggio operativo.

Le caratteristiche di conferma usano storia congelata del giorno precedente; il runtime aggiorna invece la storia causalmente. Questo cambiamento di contesto limita il trasferimento dei risultati al prodotto. Le 12 righe del file di estensione, prive della disponibilità dell’esito, non sono usate. Nessun record o modello originale viene sovrascritto.

## Vincente — stessi 249 incontri

| Modello | Corretti | Errati | Accuracy | Brier | Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| catboost | 141 | 108 | 56.63% | 0.242121 | 0.677097 |
| ngboost | 141 | 108 | 56.63% | 0.241101 | 0.674812 |
| logistic | 136 | 113 | 54.62% | 0.245077 | 0.683142 |
| hist-gradient-boosting | 139 | 110 | 55.82% | 0.242834 | 0.678561 |
| random-forest | 144 | 105 | 57.83% | 0.243238 | 0.679468 |
| bradley-terry-winner | 138 | 111 | 55.42% | 0.246165 | 0.685475 |
| hierarchical-eb | 134 | 115 | 53.82% | 0.246667 | 0.686447 |
| classifier-pool | 139 | 110 | 55.82% | 0.241123 | 0.675014 |

Random Forest ha il maggior numero di scelte corrette, NGBoost il Brier e Log Loss più bassi su questa giornata. La miscela non migliora entrambi i componenti. Non viene dichiarato un migliore modello assoluto o promosso il vincitore apparente di una singola giornata.

## Tutti i 14 mercati

Brier più basso è migliore. Le probabilità calibrate usano soltanto i pesi scelti nel precedente periodo di calibrazione: nessun nuovo adattamento alle risposte di questa giornata.

| Mercato | Riferimento | CatBoost | NGBoost | Flow | Pool classificatori | Pool punti |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| winner | 0.250116 | 0.242121 | 0.241101 | — | 0.241123 | — |
| first-set | 0.249766 | 0.249766 | 0.247194 | — | 0.248288 | — |
| first-set-points-over-19.5 | 0.225165 | 0.225165 | 0.225165 | — | 0.225165 | — |
| sets-over-3.5 | 0.230933 | 0.230933 | 0.230933 | — | 0.230933 | — |
| sets-over-4.5 | 0.207454 | 0.207948 | 0.207454 | — | 0.207653 | — |
| points-over-74.5 | 0.251577 | 0.251577 | 0.251577 | 0.251577 | 0.251577 | 0.251577 |
| points-over-79.5 | 0.233327 | 0.233327 | 0.233327 | 0.233327 | 0.233327 | 0.233327 |
| points-over-84.5 | 0.210763 | 0.210763 | 0.210763 | 0.210763 | 0.210763 | 0.210763 |
| home-set-handicap-minus-1.5 | 0.219766 | 0.213657 | 0.211154 | — | 0.212127 | — |
| home-set-handicap-plus-1.5 | 0.237221 | 0.234957 | 0.237221 | — | 0.235994 | — |
| home-point-handicap-minus-5.5 | 0.232340 | 0.228729 | 0.231077 | 0.230689 | 0.229757 | 0.229825 |
| home-point-handicap-plus-5.5 | 0.229654 | 0.226692 | 0.225925 | 0.225673 | 0.226133 | 0.225290 |
| home-point-handicap-minus-9.5 | 0.172625 | 0.171365 | 0.173674 | 0.172353 | 0.171476 | 0.171410 |
| home-point-handicap-plus-9.5 | 0.166138 | 0.166138 | 0.166138 | 0.163595 | 0.166138 | 0.165179 |

Per i totali punti 74,5 / 79,5 / 84,5, i pesi precedentemente congelati dei nuovi candidati sono zero: le stime calibrate e le miscele coincidono con il riferimento per competizione. Nessuna di queste accuracy va presentata come beneficio del flow o della nuova IA. Le metriche grezze sono conservate nel JSON, anche quando peggiori. La calibrazione separata e le miscele tra modelli con teste diverse non garantiscono una distribuzione congiunta coerente per tutti i mercati.

Il flow usa 8.192 campioni per evento e seed congelato, senza addestramento; errore standard Monte Carlo massimo di una frequenza circa 0,55 punti percentuali, che non include l’incertezza del modello. Per le etichette di handicap/Over si valuta l’esito o il complementare più probabile: l’accuracy non è automaticamente la percentuale di Over vinti o la probabilità del lato indicato nel nome.

## Confronto quote su sottoinsieme qualificato

Solo 28 incontri hanno coppie pre-close sul vincente entro la decisione, identità/periodo coerenti, prezzi non sospesi e non più vecchi di cinque minuti. Non si confrontano le metriche del bookmaker su 28 con quelle dei modelli su 249.

| Riferimento/modello | N | Brier | Log Loss |
| --- | ---: | ---: | ---: |
| bookmaker-no-vig | 28 | 0.262903 | 0.729724 |
| catboost | 28 | 0.250487 | 0.694309 |
| ngboost | 28 | 0.237263 | 0.666731 |
| logistic | 28 | 0.253440 | 0.700380 |
| hist-gradient-boosting | 28 | 0.253603 | 0.700122 |
| random-forest | 28 | 0.252875 | 0.698836 |
| bradley-terry-winner | 28 | 0.261571 | 0.718052 |
| hierarchical-eb | 28 | 0.251874 | 0.696970 |
| classifier-pool | 28 | 0.243074 | 0.679003 |

Il bookmaker ha 13 corretti, 12 errati e tre casi esattamente al 50%; la sua accuracy del 52% usa solo i 25 decisi, mentre Brier/Log Loss includono tutti i 28. Il Brier favorevole a NGBoost nel sottoinsieme è un dato descrittivo piccolo e selezionato dalla disponibilità delle quote, non prova di un vantaggio sul mercato. Nessuna eseguibilità del prezzo, strategia EV, ROI o CLV dimostrati.

## Artefatti e riproducibilità

Report generato realmente in 10.02 secondi; nessun modello nuovo addestrato. File pubblico: [report-v20-frozen-transfer.json](../research/report-v20-frozen-transfer.json). Protocollo: [protocol-v20-frozen-transfer.json](../research/protocol-v20-frozen-transfer.json). L’audit individuale resta in `.research-data/frozen-transfer-v20-audit.json`, escluso da Git e con permessi 0600.

Comando nell’ambiente cloud già predisposto:

```bash
.research-data/venv-v18/bin/python scripts/evaluate-frozen-transfer.py
.research-data/venv-v18/bin/python -m unittest discover -s scripts -p "test_*.py"
```

Lo script rifiuta output già presenti; per nuovi esperimenti creare nuove versioni e destinazioni. Richiede gli input privati originali con hash coincidenti e le dipendenze già fissate in requirements-v18. Non caricare pickle/joblib di terze parti senza fiducia nella provenienza.

33 test Python passati nell’ambiente completo, inclusi rifiuto degli artefatti alterati prima della deserializzazione e verifica dei flag. La CI leggera esegue 28 test e salta esplicitamente i cinque che richiedono librerie opzionali. Nessun file TypeScript o frontend cambiato: non vengono ripetuti build e browser senza motivo. Nessuna nuova spesa o chiamata al fornitore.

## Stato operativo e prossimo controllo

La raccolta giornaliera già pubblicata continua secondo il cron esistente. Il suo ultimo stato confermato rimane 1.200 registrati/1.057 valutati al 17 novembre 19:46 UTC: questo test offline non aggiunge record a quel ledger e non ne modifica le previsioni. Le nuove osservazioni future sono la fonte necessaria per un confronto indipendente; non si sostituiscono con queste partite storiche. Nessuna sostituzione del modello o rilascio dell’app per questo esperimento.
