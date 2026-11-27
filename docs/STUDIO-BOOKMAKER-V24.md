# Quanto aggiungono i modelli alle probabilità del bookmaker

Il test confronta le probabilità implicite senza margine con quelle ottenute aggiungendo CatBoost, rete neurale, NGBoost o Random Forest. I pesi sportivi 0%, 10%, 25%, 50% e 100% sono fissati nel protocollo prima del calcolo. Le probabilità sportive vengono dagli audit esistenti. Il calcolo riusa i controlli del v22 su identità, timestamp, esiti e prezzi delle due selezioni. Il primo campione contiene 88 incontri su tre giorni, il secondo 28 incontri di una giornata successiva. Entrambi erano già stati analizzati e il confronto resta esplorativo.

| Modello al 25% con bookmaker al 75% | Brier su 88 | Brier su 28 |
| --- | ---: | ---: |
| Bookmaker senza margine | 0,24781 | 0,26290 |
| CatBoost coerente | 0,24492 | 0,25647 |
| Rete neurale coerente | 0,24502 | 0,25622 |
| NGBoost | 0,24463 | 0,25346 |
| Random Forest | 0,24393 | 0,25795 |

Tutte e quattro le miscele della tabella migliorano anche il Log Loss medio nei due campioni. Il miglioramento del Brier varia però per giornata. Per esempio, con NGBoost al 50%, il Brier migliora in uno dei tre giorni del primo campione e peggiora negli altri due. Quattro giorni complessivi non consentono di stimare in modo convincente la stabilità temporale, e le quote disponibili delimitano il campione.

Con peso sportivo del 10% o 25% nessuna delle quattro miscele supera il filtro quota almeno 1,30 ed EV nominale positivo sul lato stimato più probabile. Al 50%, ogni modello passa il filtro su non più di sei incontri per campione. I saldi teorici su gruppi così piccoli sono descrittivi. La valutazione usa prezzi registrati e una unità ipotetica per scelta.

Il confronto prospettico pubblicato il 18 novembre copre 800 esiti e usa i quattro candidati v10. Su quella coorte, il bookmaker ha Brier 0,23016 e il miglior candidato del confronto 0,24200. I risultati di questo replay sulle miscele non dimostrano un vantaggio prospettico. Servono nuove probabilità registrate prima dell’inizio e un confronto con il bookmaker sulle stesse partite per verificarlo.

Riproduzione con `python scripts/benchmark-market-blend.py` nell’ambiente che conserva gli audit privati v22. Il report include tutte le configurazioni, le differenze giornaliere, i conteggi e i saldi. Verificati i conteggi e la riconciliazione delle differenze giornaliere con la media. La suite Python leggera ha superato 35 test e ha saltato i sette con dipendenze opzionali.

[Protocollo](../research/protocol-market-blend-v24.json) · [Report completo](../research/report-market-blend-v24.json) · [Confronto prospettico del 18 novembre](../research/prospective-prices-20261118.json)
