# Riduzione dello scarto tra modelli sportivi e mercato

L’obiettivo è verificare quando due previsioni sportive aggiungono informazione alle quote Bet365 senza margine. Il candidato parte dalla probabilità del mercato e aggiunge una frazione della differenza con la media dei due modelli sportivi, sulla scala logit. La frazione è scelta sul passato, fra 0, 25, 50, 75 e 100%. La seconda variante differenzia il peso quando il favorito Bet365 ha una probabilità senza margine di almeno 65%. I pesi locali restano regolarizzati verso quello globale.

Il replay parte dalle 258 partite già archiviate nello studio precedente. Il protocollo riserva un ritardo di due giorni, almeno 70 eventi e quattro giorni di dati per stimare i pesi. Restano 156 partite da valutare su quattro giornate. Il filtro di valore richiede che entrambi i modelli sportivi indichino lo sfavorito Bet365 come favorito, quota almeno 1,30 ed EV positivo con la probabilità del metodo confrontato. La fascia da 3,65 resta aperta verso l’alto.

| Stima | Brier ↓ | Selezioni | Esatte | Sbagliate | Rendimento teorico |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bet365 senza margine | 0,24288 | 0 | 0 | 0 | — |
| Correzione globale | 0,24313 | 6 | 3 | 3 | +22,92% |
| Correzione per forza del favorito Bet365 | 0,24346 | 3 | 0 | 3 | −100% |
| Media sportiva | 0,24767 | 39 | 17 | 22 | −7,07% |

La correzione globale riduce l’errore rispetto alla media sportiva. Bet365 resta davanti sia sul Brier sia sulla log loss. Il saldo positivo su sei partite è esplorativo. Da 3,65 le due correzioni selezionano due casi, entrambi sbagliati, nello stesso replay. Con quattro giorni il bootstrap a blocchi non produce un intervallo. I candidati restano nella ricerca.

Per la riproduzione, usare il campione privato v38 e lanciare `scripts/benchmark-market-shrinkage.py /tmp/v38-input.json /tmp/v40-output.json` con il Python dell’ambiente di ricerca. L’archivio pubblico del progetto contiene solo metriche aggregate.

[Risultati aggregati](../research/report-market-shrinkage-v40.json)

## Raccolta continuativa e confronto settimanale

Dopo la fine dell’arruolamento nello studio pilota il 1° dicembre 2026, la raccolta dedicata al vincente del tennis tavolo è programmata ogni due ore. Lo stesso registro conserva una sola previsione per incontro con versione, probabilità ed eventuali quote Bet365. L’esito e i punteggi dei set disponibili vengono aggiunti alla scheda dopo il risultato della fonte. I risultati già verificati prima di questo aggiornamento possono avere solo il vincitore.

In **Statistiche modello → Test a risultato coperto** lo storico si sfoglia in periodi di 12 settimane UTC, per data della previsione. Il confronto a tre tra modello principale, Elo e Bet365 senza margine richiede entrambe le quote, entrambe le stime e la verifica dell’inizio effettivo. Lo storico mostra le fasce di quota degli sfavoriti selezionati, il rendimento teorico e le medie delle quote degli esiti esatti e sbagliati. Un esito ricevuto con inizio ancora da verificare è visibile nello storico degli incontri e resta fuori dal confronto rigoroso.

Il job dedicato usa l’archivio dei risultati e limita a due le richieste di verifica dell’orario effettivo per scansione. Il budget di verifiche è condiviso con gli altri flussi della fonte. Gli incontri in attesa restano registrati. I riesami automatici del registro operativo usano una finestra di dieci giorni.

Sui nuovi incontri con entrambe le quote e le due stime sportive il registro congela anche la variante a peso fisso del 25%, scelta come candidata perché ricorre in tre delle quattro giornate del replay. Il Brier di questa variante e quello di Bet365 sono confrontati sulle stesse nuove partite verificate. La variante resta sperimentale e l’app non la usa per proporre giocate.
