# Ricerca di errori di quota sul vincente prematch

La formazione delle quote è stata studiata in mercati dove i bookmaker fissano prezzi e possono incorporare margine e preferenze degli scommettitori. Questo motiva il confronto con una stima senza margine. Il metodo potenza corregge il margine in modo non uniforme. Gli studi sul movimento delle quote mostrano anche che una rilevazione più vicina alla partenza non è sempre più accurata. I lavori riguardano altri sport e sono la motivazione per il test locale. [Levitt](https://www.nber.org/papers/w9422) · [Clarke, Kovalchik e Ingram](https://doi.org/10.11648/j.ajss.20170506.12) · [Simon](https://pubsonline.informs.org/doi/10.1287/mnsc.2022.00456)

## Dati e risultati

Riutilizzate le 258 coppie Bet365 verificabili del v36. Su tutte le partite il Brier della normalizzazione proporzionale è 0,24121 e quello del metodo potenza 0,24186. Il preferito secondo il bookmaker coincide per entrambi i metodi in tutte le partite. Nessuno dei due prezzi equi depurati cambia la soglia di pareggio alla quota offerta.

Su 156 partite di quattro giorni si può anche calibrare il mercato e misurare se lo scarto fra modello sportivo e mercato aggiunge informazione. Ogni giorno usa solo campioni fino a due giorni di calendario prima, da 86 a 167 partite, con almeno 70 partite e quattro giorni richiesti dal protocollo. Il test confronta la calibrazione della sola quota e una calibrazione regolarizzata che può attribuire un peso positivo allo scarto sportivo. Tutte le regole mantengono fisso il favorito del modello sportivo, quota minima 1,30 e EV originale positivo.

| Metodo | Brier ↓ | Quote selezionate | Esatti | Sbagliati | Rendimento teorico |
| --- | ---: | ---: | ---: | ---: | ---: |
| Modello sportivo | 0,24694 | 55 | 25 | 30 | −5,62% |
| Mercato proporzionale senza margine | 0,24288 | | | | |
| Metodo potenza | 0,24375 | | | | |
| Potenza calibrata | 0,24378 | 4 | 1 | 3 | −31,25% |
| Potenza calibrata con scarto sportivo | 0,24378 | 4 | 1 | 3 | −31,25% |

Il peso dello scarto si azzera in tutti i quattro giorni. Il metodo potenza calibrato seleziona quattro quote, tutte su sfavoriti Bet365. La numerosità e i giorni sono insufficienti per distinguere un guadagno da una fluttuazione. Test retrospettivo, prezzi eseguibili non verificati. Le varianti non entrano nelle classifiche e le quote storiche di chiusura non passano come prezzi disponibili ore prima.

## Misurazione sulle nuove partite

Il confronto prospettico registra la coppia di prezzi vicina alla chiusura tramite la chiamata MoviOdds già utilizzata per verificare il risultato. Accetta entrambe le quote del vincente solo se sono precedenti di almeno un minuto all’inizio verificato, attive a quell’orario, non più vecchie di cinque minuti rispetto a quel limite e successive alla registrazione iniziale. La coppia è opzionale, perciò una quota mancante non invalida il risultato. Non usa `last`, che può essere una quota live. Non modifica i pronostici iniziali o i checkpoint archiviati e non effettua nuove richieste. La scheda di affidabilità mostra la quota iniziale rispetto a quella equa successiva per i favoriti sportivi con EV originale positivo. L’indicatore misura la direzione rispetto al mercato, senza usare l’esito nel calcolo. Un prezzo favorevole a chiusura non dimostra da solo un profitto. La documentazione MoviOdds indica 24 ore per lo storico dettagliato sul piano gratuito. [Documentazione MoviOdds](https://moviodds.com/doc) · [Copertura dello storico](https://moviodds.com/bet365-historical-odds-api/)

## Riproduzione

Con gli archivi privati esposti al benchmark, produrre gli input con `scripts/benchmark-sports-favorites.py --output /tmp/v36.json --priced-sample /tmp/v37-input.json`, poi eseguire `scripts/benchmark-price-error.py /tmp/v37-input.json --output /tmp/v37.json`. Entrambi i comandi vanno avviati con il Python dell’ambiente di ricerca. Il campione intermedio è privato. Nel repository rimangono solo aggregati e configurazione.

[Protocollo](../research/protocol-price-error-v37.json) · [Risultati aggregati](../research/report-price-error-v37.json)
