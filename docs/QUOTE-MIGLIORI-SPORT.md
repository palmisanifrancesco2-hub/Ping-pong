# Quote migliori e ricerca per sport

La sezione privata **Quote migliori** consente di cambiare sport. Il tennistavolo usa il Value Tracker e distingue le stime sperimentali dalla classifica con validazione indipendente. Per gli altri sport la pagina mostra il confronto storico e il collegamento alle quote effettive di Bet365 per mercati e incontri. Una quota entra nella classifica verificata con validazione indipendente sulla competizione, prezzo fresco a partire da 1,30 ed EV prudente positivo.

## Risultati sul vincente

| Sport e ambito | Candidato scelto prima del test | Test | Corretti | Accuracy | Brier | Log Loss |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Tennis ATP singolare, 2025 | Logistica Elo e superficie | 2.273 | 1.465 | 64,45% | 0,21740 | 0,62281 |
| Badminton BWF, singolare | Elo | 7.977 | 5.664 | 71,00% | 0,19101 | 0,56114 |
| Freccette, PDC Players Championship | Logistica Elo e storico | 5.031 | 3.302 | 65,63% | 0,21729 | 0,62468 |
| Snooker, stagioni storiche | Logistica Elo e storico | 15.810 | 10.156 | 64,24% | 0,22035 | 0,63076 |
| Boxe, incontri per titoli mondiali | Logistica Elo e storico | 137 | 87 | 63,50% | 0,22418 | 0,64063 |
| MMA, solo UFC | Elo | 556 | 306 | 55,04% | 0,24465 | 0,68236 |

Le percentuali descrivono dataset e sport diversi. Per tennis l’esperimento ATP è riportato a parte. Per il tennistavolo restano disponibili i confronti già eseguiti su 41.216 incontri di test. [Test ATP](SPORT-INDIVIDUALI.md) · [Studio tennistavolo](STUDIO-40000-PARTITE-V35.md)

### Archivio del fornitore

Il 21 novembre 2026 la chiave MoviOdds già configurata su Vercel ha restituito 10.932 esiti singoli utilizzabili nel tennis, 690 nel badminton, 834 nelle freccette e 180 nello snooker. Per la boxe e le MMA sono arrivati 118 e 74 record totali, rispettivamente, senza un vincitore binario verificabile dalla combinazione di punteggio e risultato del combattimento prevista dal parser. Nessuna delle sei risposte esponeva l’inizio programmato degli incontri utilizzabili. In tennis, il confronto esplorativo del fornitore ha scelto Elo e ottenuto 509 su 863, pari al 58,98%. È un campione diverso dall’ATP. [Documentazione risultati MoviOdds](https://moviodds.com/doc#results)

### Metodo e copertura

Vengono confrontati Elo, una logistica a un coefficiente su Elo e una logistica che combina Elo globale, Elo nella competizione, frequenza vittorie regolarizzata e differenza di esperienza. La scelta minimizza la Log Loss nel blocco di validazione. Il test usa il periodo successivo. La procedura richiede quattro risultati precedenti per entrambi gli atleti. Per gli archivi che espongono una data senza orario, la previsione usa solo informazioni dei giorni precedenti con un margine di almeno un giorno. Nello snooker si usano intere stagioni senza aggiornamento all’interno della stagione. Pareggi, annullamenti e risultati incompleti sono esclusi. La prestazione della boxe ha un campione piccolo. Per ogni sport restano da verificare la corrispondenza degli atleti e delle competizioni dal vivo, le regole del mercato in caso di ritiro o pareggio e i prezzi Bet365 disponibili prima dell’inizio. Gli esperimenti riguardano il vincente. Non stimano il rendimento delle puntate.

### Riproduzione

`npm run research:train-sports` legge MoviOdds dal backend con la chiave configurata. I rapporti degli archivi aggiuntivi si riproducono salvando i file indicati nella cartella locale di ricerca. Esegui `python research/normalize-individual-archives.py <cartella>` e `node --import tsx scripts/evaluate-individual-archives.ts <cartella>`. Il repository contiene metriche e coefficienti. I file di partite restano nell’area di ricerca privata.

- Badminton. Sahil Motyar, compilazione dei risultati BWF, file `ms.csv` e `ws.csv` come `badminton-ms.csv` e `badminton-ws.csv`. [Fonte](https://github.com/SahilMotyar/bwf-match-data/tree/0a6899162bf4b9639b76dcdbc0dca4c5d4800664)
- Freccette. Darts for Windows, archivio PDC preparato da Wharton SABI. File `data/moneyball/mens_matches.csv.gz` come `darts.csv.gz`. Uso in ricerca locale con dati mantenuti fuori dal repository. [Fonte e condizioni](https://github.com/WhartonSABI/mba2026_darts/blob/93eac341738dc6b245cdcf7604625b1c0b0d054b/data/moneyball/README.md)
- Snooker. Joseph D. O’Brien, *Snooker datasets*, CC BY 4.0. File `Data/final_match_df.csv` come `snooker.csv`. [Dataset](https://doi.org/10.6084/m9.figshare.13604480.v1) · [Versione del file](https://github.com/obrienjoey/snooker_rankings/tree/2733a94974c72028ebb5403229b787fa85f496e4/Data)
- Boxe. Ed H. Wright, Open Boxing, file `data/bouts.csv` come `boxing.csv`. [Fonte](https://github.com/edhwright/open-boxing/tree/4bbb8fa86d2e495c28b3e1666694f375528ed003/data)
- MMA. Nathan Bair, *UFC Data*, CC BY 4.0. File `data/ufc_all_fights_wide.csv` come `mma.csv`. [Dataset](https://doi.org/10.5281/zenodo.23458636) · [Versione del file](https://github.com/nlbair/ufc-data/tree/a9c65430b3c5cb6e6351940f36e03b2adeb908d0/data)
