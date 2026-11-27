# Consenso sportivo e confronto con Bet365

Il test riutilizza le 258 partite del replay cronologico v36 con prezzi prematch verificabili. La media a pesi uguali usa le due logistiche sportive già addestrate e calibrate sui periodi precedenti, senza quote. La regola di selezione richiede che entrambe favoriscano lo stesso atleta e che il più basso dei due pronostici superi la probabilità di pareggio alla quota offerta. La quota minima è 1,30. La regola può includere il giocatore sfavorito secondo Bet365.

| Metodo | Brier ↓ | Log Loss ↓ | Quote con EV positivo | Esatti | Sbagliati | Rendimento teorico |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Logistica di riferimento | 0,24811 | 0,68924 | 93 | 41 | 52 | −8,60% |
| Logistica simmetrica | 0,24724 | 0,68771 | 108 | 52 | 56 | −0,31% |
| Media e filtro di consenso | 0,24724 | 0,68764 | 73 | 35 | 38 | −2,99% |
| Bet365 senza margine | 0,24121 | 0,67518 | | | | |

Sul filtro di consenso, 28 su 63 selezioni contro il favorito Bet365 sono esatte, con un rendimento teorico del −6,90%. Gli intervalli a blocchi includono zero per il rendimento del consenso e per la differenza di Brier contro il mercato. Il numero ridotto di selezioni non costituisce prova di un vantaggio. Il replay è esplorativo. Il candidato resta fuori dalla classifica operativa e la valutazione a risultato coperto prosegue su partite nuove.

Per riprodurre il confronto, esportare il campione privato con `scripts/benchmark-sports-favorites.py --priced-sample /tmp/v38-input.json --include-challenger --output /tmp/v36-output.json`. Eseguire `scripts/benchmark-consensus-value.py /tmp/v38-input.json /tmp/v38-output.json` con il Python dell’ambiente di ricerca. Nel repository sono salvati solo aggregati.

[Risultati aggregati e intervalli](../research/report-consensus-value-v38.json)
