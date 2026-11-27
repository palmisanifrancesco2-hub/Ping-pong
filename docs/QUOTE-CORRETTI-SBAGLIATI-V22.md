# Quote dei pronostici corretti e sbagliati — v22

## Metodo

Confronto descrittivo sul solo vincente partita. Si usa il lato indicato dalla probabilità del modello: casa se p>50%, ospite se p<50%. A esattamente 50% nessuna scelta; mai sostituire il lato pronosticato con il vincitore noto. Le quote sono quelle registrate prima della decisione verificata, con coppia esatta, prezzo non sospeso e timestamp entro cinque minuti. Nessun nuovo fitting o pronostico operativo.

Due coorti distinte: **88 incontri su tre giorni** del sottoinsieme as-of v16 e **28 su una giornata** del controllo v20. Non sono nuove partite e non si sommano ai 1.200 eventi del ledger corrente. Non esistono quote storiche compatibili per tutti i 1.804 test principali né per tutti i mercati dello studio coerente; non se ne inventano. Gli audit delle probabilità sono collegati ai report congelati tramite hash e agli esiti tramite ID esatti.

Statistiche: numero, quota media, mediana, min/max, differenza media sbagliati meno corretti. Tre politiche distinte: tutti i decisi con prezzo disponibile; quota almeno 1,30; quota almeno 1,30 ed EV nominale positivo. Nessun massimo di quota. Le soglie sono quelle già richieste dall’utente, non sono ottimizzate su questi esiti. Tolleranza EV 1e-12 solo per considerare zero il rumore numerico.

Il filtro EV è riferito al lato più probabile scelto nei test, non enumera tutte le potenziali selezioni di valore, comprese quelle meno probabili. Le probabilità dei modelli non sono validate operativamente: EV positivo rimane un filtro esplorativo. Non si sceglie un vincitore operativo a partire da queste tabelle.

## Tutte le scelte con prezzo registrato

Quote decimali. Il numero fra parentesi è quello dei casi nel gruppo; medie arrotondate solo nella tabella, valori completi nel JSON. La differenza positiva significa quota media maggiore tra gli sbagliati.

### v16-asof-test-88 — 88 incontri

| Modello | Corretti: N / quota media / mediana | Sbagliati: N / quota media / mediana | Differenza medie |
| --- | ---: | ---: | ---: |
| v16/hierarchical-eb | 47 / 1.762 / 1.727 | 41 / 1.883 / 1.833 | +0.122 |
| v16/logistic | 44 / 1.767 / 1.667 | 44 / 1.874 / 1.833 | +0.107 |
| v16/hist-gradient-boosting | 50 / 1.863 / 1.727 | 38 / 1.867 / 1.833 | +0.004 |
| v16/random-forest | 50 / 1.836 / 1.727 | 38 / 1.890 / 1.833 | +0.054 |
| v16/bradley-terry-winner | 44 / 1.751 / 1.697 | 44 / 1.859 / 1.727 | +0.109 |
| v18/catboost | 47 / 1.831 / 1.727 | 41 / 1.865 / 1.833 | +0.034 |
| v18/ngboost | 44 / 1.783 / 1.727 | 44 / 1.908 / 1.817 | +0.125 |
| v16-odds/sports-only | 0 / non disponibile | 0 / non disponibile | Non disponibile |
| v16-odds/sports-and-market | 45 / 1.558 / 1.571 | 37 / 1.592 / 1.667 | +0.033 |
| v21/categorical-catboost | 56 / 1.890 / 1.764 | 32 / 1.972 / 1.833 | +0.082 |
| v21/categorical-mlp | 54 / 1.982 / 1.833 | 34 / 2.195 / 2.000 | +0.212 |
| v21/calibration-selector | 56 / 1.890 / 1.764 | 32 / 1.972 / 1.833 | +0.082 |
| v21/fixed-pool | 57 / 1.931 / 1.800 | 31 / 2.043 / 1.909 | +0.112 |
| bookmaker-reference | 45 / 1.558 / 1.571 | 37 / 1.592 / 1.667 | +0.033 |

### v20-transfer-qualified-28 — 28 incontri

| Modello | Corretti: N / quota media / mediana | Sbagliati: N / quota media / mediana | Differenza medie |
| --- | ---: | ---: | ---: |
| v20/catboost | 15 / 1.747 / 1.667 | 13 / 1.801 / 1.727 | +0.054 |
| v20/ngboost | 16 / 2.134 / 1.733 | 12 / 1.900 / 1.780 | -0.234 |
| v20/logistic | 12 / 1.726 / 1.641 | 16 / 1.845 / 1.764 | +0.119 |
| v20/hist-gradient-boosting | 13 / 1.678 / 1.571 | 15 / 1.734 / 1.727 | +0.057 |
| v20/random-forest | 13 / 1.753 / 1.727 | 15 / 1.929 / 1.727 | +0.175 |
| v20/bradley-terry-winner | 16 / 1.791 / 1.697 | 12 / 1.735 / 1.727 | -0.056 |
| v20/hierarchical-eb | 14 / 1.885 / 1.780 | 14 / 2.035 / 1.764 | +0.151 |
| v20/classifier-pool | 15 / 1.730 / 1.667 | 13 / 1.789 / 1.727 | +0.058 |
| v21/categorical-catboost | 18 / 1.838 / 1.697 | 10 / 1.793 / 1.764 | -0.046 |
| v21/categorical-mlp | 15 / 2.247 / 2.000 | 13 / 2.022 / 1.909 | -0.225 |
| v21/calibration-selector | 18 / 1.838 / 1.697 | 10 / 1.793 / 1.764 | -0.046 |
| v21/fixed-pool | 16 / 2.172 / 1.817 | 12 / 1.954 / 1.833 | -0.218 |
| bookmaker-reference | 13 / 1.552 / 1.571 | 12 / 1.568 / 1.641 | +0.016 |

## Quota ≥1,30 ed EV teorico positivo

Queste sono statistiche di un filtro storico, non suggerimenti operativi. I numeri differiscono dalla tabella completa perché le selezioni e i prezzi scelti dai modelli possono essere differenti. Nessuna rimozione dei casi in base a vittoria/sconfitta.

### v16-asof-test-88

| Modello | Corretti | Quota media corretti | Sbagliati | Quota media sbagliati | Differenza medie |
| --- | ---: | ---: | ---: | ---: | ---: |
| v16/hierarchical-eb | 16 | 2.147 | 19 | 2.254 | +0.107 |
| v16/logistic | 18 | 2.144 | 23 | 2.146 | +0.002 |
| v16/hist-gradient-boosting | 22 | 2.307 | 21 | 2.084 | -0.222 |
| v16/random-forest | 19 | 2.305 | 16 | 2.266 | -0.039 |
| v16/bradley-terry-winner | 12 | 2.258 | 18 | 2.252 | -0.006 |
| v18/catboost | 21 | 2.221 | 18 | 2.178 | -0.043 |
| v18/ngboost | 15 | 2.206 | 21 | 2.259 | +0.053 |
| v16-odds/sports-only | 0 | — | 0 | — | — |
| v16-odds/sports-and-market | 0 | — | 0 | — | — |
| v21/categorical-catboost | 21 | 2.394 | 13 | 2.438 | +0.044 |
| v21/categorical-mlp | 23 | 2.452 | 18 | 2.646 | +0.194 |
| v21/calibration-selector | 21 | 2.394 | 13 | 2.438 | +0.044 |
| v21/fixed-pool | 23 | 2.425 | 14 | 2.480 | +0.055 |
| bookmaker-reference | 0 | — | 0 | — | — |

### v20-transfer-qualified-28

| Modello | Corretti | Quota media corretti | Sbagliati | Quota media sbagliati | Differenza medie |
| --- | ---: | ---: | ---: | ---: | ---: |
| v20/catboost | 5 | 2.132 | 5 | 2.187 | +0.055 |
| v20/ngboost | 6 | 3.024 | 5 | 2.242 | -0.783 |
| v20/logistic | 6 | 1.967 | 6 | 2.273 | +0.306 |
| v20/hist-gradient-boosting | 4 | 1.995 | 6 | 2.007 | +0.013 |
| v20/random-forest | 3 | 2.150 | 5 | 2.640 | +0.490 |
| v20/bradley-terry-winner | 6 | 2.228 | 5 | 2.032 | -0.196 |
| v20/hierarchical-eb | 4 | 2.425 | 5 | 2.825 | +0.400 |
| v20/classifier-pool | 5 | 2.029 | 5 | 2.187 | +0.158 |
| v21/categorical-catboost | 6 | 2.362 | 2 | 2.500 | +0.138 |
| v21/categorical-mlp | 8 | 2.866 | 6 | 2.354 | -0.511 |
| v21/calibration-selector | 6 | 2.362 | 2 | 2.500 | +0.138 |
| v21/fixed-pool | 7 | 2.954 | 5 | 2.325 | -0.629 |
| bookmaker-reference | 0 | — | 0 | — | — |

## Lettura dei risultati

Nel campione principale filtrato, CatBoost coerente ha 21 corretti con quota media 2,394 e 13 sbagliati con media 2,438. La rete ha 23 corretti a media 2,452 e 18 sbagliati a media 2,646. Random Forest ha invece media 2,305 tra i 19 corretti e 2,266 tra i 16 sbagliati: il segno della differenza non è una legge. NGBoost ha 15 corretti a media 2,206 e 21 sbagliati a media 2,259.

Sul controllo di una giornata i campioni filtrati sono ancora più piccoli, da otto a poche decine di selezioni. Non si trasferisce l’accuracy di un sottoinsieme ai 249 incontri completi e non si sommano le predizioni di più modelli come eventi indipendenti. La disponibilità stessa delle quote può introdurre selezione di copertura. Una media differente non dimostra causalità, calibrazione corretta o profitto futuro.

Il riferimento bookmaker no-vig può non scegliere un lato quando assegna esattamente 50%. Dopo il filtro EV positivo riferito ai suoi stessi prezzi può non avere selezioni: non si crea una scelta artificiale per riempire la tabella.

## Aritmetica teorica e limiti economici

Il report JSON contiene anche `theoreticalNetUnitsAtRecordedPrices`: somma delle quote delle scelte corrette meno il numero totale di scelte, assumendo una unità su ogni selezione ammessa. Serve a leggere insieme prezzi e frequenza delle vittorie. È una ricostruzione aritmetica descrittiva a prezzi registrati: non dimostra che quelle quote fossero eseguibili, che siano state piazzate puntate o che esista un ROI storico verificato. `verifiedHistoricalROI` resta null; nessuna scommessa è stata effettuata dallo script. Non si sceglie retroattivamente il modello in base a questo saldo.

I prezzi e le previsioni derivano da archivi già esaminati. Nessun nuovo esperimento indipendente o intervallo affidabile su questi pochi giorni; nessuna garanzia di rendimento e nessuna modifica ai criteri di validazione dell’app. Non sono quotazioni aggiornate live.

## Riproduzione e verifiche

```bash
python scripts/analyze-forecast-odds.py
python -m unittest discover -s scripts -p "test_*.py"
```

Richiede gli archivi privati originali; nessuna rete o credenziale viene usata. Lo script verifica hash, assenza di duplicati/sovrapposizioni e allineamento esiti. Rifiuta la sovrascrittura del report. Nuovi test software verificano lato pronosticato, pareggi, gruppi vuoti, prezzi invalidi, filtro minimo ed EV zero, assenza di un massimo e aritmetica unitaria. Nessun codice runtime o UI è cambiato: i risultati sono nel repository, non una nuova statistica dinamica già inserita nella dashboard.

[Protocollo](../research/protocol-v22-odds-outcomes.json) · [Report completo con tutte le politiche e valori non arrotondati](../research/report-v22-odds-outcomes.json).


Le probabilità sono quelle dei benchmark retrospettivi, generate dopo gli incontri con separazioni temporali simulate; i prezzi erano disponibili prima della decisione simulata secondo i timestamp salvati. Non sono pronostici pubblicati in anticipo né puntate registrate. Fonte dei prezzi: MoviOdds / bet365.com.au, senza attribuirle a un altro dominio.

Verifiche finali: 42 test software Python passati nell’ambiente completo. Ambiente leggero: 35 eseguiti e sette opzionali saltati esplicitamente. Controllata anche la riconciliazione dei conteggi per modello/politica, senza casi eliminati silenziosamente.
