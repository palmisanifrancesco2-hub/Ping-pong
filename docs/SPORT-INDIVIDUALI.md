# Quote per sport individuali

La pagina privata **Quote per sport** apre tennis, badminton, freccette, snooker, boxe e MMA. Il tennistavolo rimanda a **Partite e mercati**. La pagina richiede soltanto lo sport selezionato e usa la stessa chiave MoviOdds lato server. Esclude gli eventi conclusi e le coppie identificabili dalla denominazione. I filtri coprono giocatore, competizione e stato. La scheda dell’incontro mostra i mercati ricevuti, il loro stato, la rilevazione e le statistiche live effettivamente fornite per tennis e freccette. L’aggiornamento per gli altri sport è manuale.

Il piano gratuito può limitare il catalogo ai mercati principali e allo storico più recente. La documentazione segnala che i limiti annunciati e quelli in vigore possono differire. Il codice espone il flag `markets: "main"` quando ricevuto. [Documentazione sport](https://moviodds.com/docs/sports/) · [Piani](https://moviodds.com/pricing/)

## Primo confronto storico ATP singolare

Ricerca privata sui dati raccolti da Jeff Sackmann e conservati nel mirror fissato al commit `83733587353df8a41f2fd4f516147d5aa83f5a8d`. La licenza CC BY-NC-SA 4.0 riguarda i dati. Il repository contiene la procedura e i risultati aggregati. Il benchmark ha usato i file ATP principali dal 2019 al 2025, con il 2020 escluso dalla raccolta. [Archivio dati](https://github.com/Aneeshers/tennis-sackmann-archive/tree/83733587353df8a41f2fd4f516147d5aa83f5a8d/atp)

Usati 16.876 risultati completi per ricostruire lo storico. Il confronto ha incluso 7.732 partite di training, 2.493 di validazione nel 2024 e 2.273 di test nel 2025. Il dataset indica la data di inizio torneo. Per preservare l’ordine temporale, il codice rende i risultati disponibili dopo un margine di 21 giorni e lascia insieme tutte le partite di uno stesso torneo. Il confronto richiede ranking di entrambi e almeno 10 precedenti per giocatore.

| Modello sul vincente | Log Loss 2024 | Log Loss 2025 | Brier 2025 | Accuracy 2025 |
|---|---:|---:|---:|---:|
| Elo | 0,61844 | 0,62540 | 0,21840 | 63,88% |
| Ranking calibrato | 0,63421 | 0,63069 | 0,22045 | 64,63% |
| Logistica Elo e superficie | 0,61575 | 0,62281 | 0,21740 | 64,45% |
| Logistica completa | 0,61591 | 0,62029 | 0,21615 | 64,89% |
| Gradient boosting | 0,61767 | 0,62377 | 0,21757 | 64,54% |

La selezione in validazione favorisce la logistica Elo e superficie. Il test non stabilisce una superiorità robusta tra i candidati. Mancano una verifica recente sulle stesse competizioni del feed corrente, una corrispondenza affidabile degli atleti, quote Bet365 storiche con orari verificabili e un test live. La pagina mostra le quote disponibili. Le probabilità, le quote eque e le selezioni con EV restano in attesa di validazione per i nuovi sport.

Per ripetere lo studio, salva i file `atp/atp_matches_YYYY.csv` del commit indicato come `YYYY.csv` in una cartella locale, con anni 2019 e 2021–2025. Esegui `python research/benchmark-atp-singles.py <cartella>` con Python, numpy e scikit-learn 1.8.0.
