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
