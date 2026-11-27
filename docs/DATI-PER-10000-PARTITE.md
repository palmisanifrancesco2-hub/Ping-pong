# Dati reperiti per uno studio da 10.000 incontri — 7 novembre 2026

Sono stati scaricati due nuovi archivi gratuiti e controllato l’archivio MoviOdds già disponibile. Il numero di righe non è il numero di test indipendenti: servono anche addestramento, calibrazione, storico dei giocatori e date verificabili.

| Fonte | Righe effettive | Stato |
| --- | ---: | --- |
| MoviOdds già archiviato | 23.596 ID unici | 3.348 inizi già verificati nello snapshot; non tutti i risultati sono ancora eleggibili per un test prematch |
| WTT uomini + donne, RSMD/OSF | 10.292 | CSV scaricati; 10.284 superano i primi controlli di punteggi e vincente senza fidarsi del campo best_of |
| Setka, SCORE | 7.851 | CSV scaricato; 7.847 righe distinte ignorando l’indice |

## Fonti e download verificati

- [RSMD, autore GitHub Li02003121](https://github.com/Li02003121/racket-sports-dataset), [DOI OSF](https://doi.org/10.17605/OSF.IO/PJUW8), [ZIP effettivo](https://osf.io/download/3f6ak/). CSV WTT 5.442 uomini e 4.850 donne, date 2022-02-27 / 2025-12-10. Il repository dichiara dati CC BY 4.0 e provenienza dal portale WTT. Non abbiamo certificato ogni risultato con WTT. Sono stati letti solo i due CSV di tennistavolo, senza conteggiare tennis e badminton.
- Gavin Cassidy, [Setka Table Tennis Dataset, SCORE Sports Data Repository](https://data.scorenetwork.org/table_tennis/table_tennis_sept2022.html), [CSV effettivo](https://data.scorenetwork.org/data/table_tennis-sept2022.csv). Nomi, ora, punteggi dei set e vincente; nessuna quota storica. La pagina dichiara settembre 2022, ma il file contiene date dal 10 giugno all’8 luglio 2022, interpretate come mese/giorno/anno (sono presenti giorni maggiori di 12). Quattro righe duplicate. La licenza di ridistribuzione non è stata verificata: il CSV resta locale e non è pubblicato nel nostro repository.
- [MoviOdds, documentazione ufficiale](https://moviodds.com/doc): fonte già usata dall’app, con risultati e closing. Lo snapshot locale contiene 23.596 risultati del periodo 5 ottobre / 4 novembre 2026. Il timestamp di disponibilità del risultato non deve sostituire l’inizio della partita.
- [Dataset Elo lathise2025](https://github.com/lathise2025/table-tennis-elo-dataset): campione gratuito dichiarato di 2.000 righe e archivio completo commerciale. Non acquistato e non conteggiato tra i nuovi dati scaricati.

## Problemi trovati nei dati WTT

Gli ID delle partite si ripetono tra file maschile e femminile: occorre un prefisso di coorte per evitare abbinamenti sbagliati. I campi sport/genere sono spesso vuoti; il file di origine deve restare nella provenienza.

Tra le righe altrimenti coerenti, il campo best_of è incompatibile con il punteggio in 5.214 incontri maschili e 4.627 femminili. Soltanto 443 righe superano anche il controllo del formato dichiarato. Non abbiamo corretto automaticamente quei valori usando l’esito: per modelli dei set, totali e handicap il formato deve essere verificato indipendentemente. Otto righe falliscono già i controlli di punteggio, vincente o arresto della partita. I controlli formali non certificano l’autenticità della fonte.

## Impostazione del campione

La fonte più pertinente alle competizioni attualmente monitorate resta MoviOdds. Per arrivare a 10.000 casi prematch valutabili occorre ampliare i controlli degli inizi e accertare lo storico precedente. Il manifest degli inizi esistente ne comprende 3.348: non dichiariamo raggiunti 10.000 casi verificati.

WTT maschile, WTT femminile, Setka 2022 e competizioni attuali devono restare coorti distinte, con divisioni temporali, modelli/risultati per competizione e nessun trasferimento automatico delle prestazioni all’app. Un archivio di 10.292 righe può lasciare meno di 10.000 casi di test dopo l’addestramento e le esclusioni. Non si riducono i requisiti solo per raggiungere la cifra.

Questi CSV non forniscono quote storiche prematch verificabili: consentono ricerca sulle probabilità, non la dimostrazione di un profitto o di EV realmente eseguibile. I dati dei singoli colpi e del servizio restano assenti.

Audit riproducibile: `scripts/audit-large-history.py`. Riepilogo aggregato, hash SHA-256 dei CSV e controlli in `research/history-10000-sources.json`; file grezzi in `.research-data/`, esclusi da Git, permessi 0600. Nessuna modifica a modello operativo, registrazioni o protocolli prospettici.
