# Vincente prematch su 41.216 partite di test

Il totale combina verifiche cronologiche con coorti separate. Conta i 20.449 incontri MoviOdds già valutati in v32 una volta sola. Il nuovo replay MoviOdds usa date successive. Setka 2022 e WTT sono verifiche di ricerca con training e calibrazione distinti. Le percentuali dei cinque gruppi rimangono separate.

| Coorte | Finestra di test | Partite | Corretti / sbagliati | Brier |
| --- | --- | ---: | ---: | ---: |
| MoviOdds v32, logistica | 9 ottobre–4 novembre 2026 | 20.449 | 11.051 / 9.398 | 0,24676 |
| MoviOdds v35, logistica o frequenza quando manca lo storico | 6–20 novembre 2026 | 11.875 | 6.409 / 5.466 | 0,24667 |
| Setka SCORE, logistica | 23 giugno–8 luglio 2022 | 4.223 | 2.378 / 1.845 | 0,24524 |
| WTT maschile, logistica | maggio 2024–dicembre 2025 | 2.411 | 1.616 / 795 | 0,21257 |
| WTT femminile, logistica | maggio 2024–dicembre 2025 | 2.258 | 1.591 / 667 | 0,19217 |
| **Totale** | | **41.216** | | |

## Replay recente MoviOdds

La verifica è stata eseguita nella build Vercel di produzione `dpl_AccdtCSQQyeX3wvpg6PNzC9at9qb`, leggendo l’archivio autenticato con la configurazione esistente. Il feed conteneva 37.025 risultati validi prima del filtro v35. Il confronto usa solo 15 giorni completi, partite BO5 e ID univoci nel nuovo campione. Il modello `score-full-v1` era già stato addestrato e calibrato prima della finestra. Le statistiche storiche usano risultati disponibili prima dell’istante della stima. La data UTC di fine approssima la data dell’incontro e si applica un ritardo minimo di due giorni di calendario allo storico.

| Confronto MoviOdds | Partite | Corretti | Sbagliati | Brier | Log Loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frequenza del campionato | 11.875 | 6.026 | 5.849 | 0,24967 | 0,69249 |
| Logistica, con frequenza se mancano precedenti | 11.875 | 6.409 | 5.466 | 0,24667 | 0,68639 |
| Logistica, partite con almeno 30 precedenti per giocatore | 7.607 | 4.179 | 3.428 | 0,24528 | 0,68354 |
| Elo sulle stesse partite con storico sufficiente | 7.607 | 4.066 | 3.541 | 0,24983 | 0,69307 |

La logistica ha indovinato 113 vincitori in più di Elo sullo stesso sottocampione. Per 4.268 incontri del benchmark esteso la stima di riferimento usa le frequenze del campionato. L’app continua a richiedere storico adeguato per mostrare il pronostico del modello.

## Limiti e verifiche

Si tratta di replay storici. Le date Setka e WTT sono dichiarate dal dataset e non certificano l’orario effettivo di ogni partita. Le coorti esterne documentano la performance nei propri circuiti. Per questo confronto mancano prezzi sincronizzati con la previsione, quindi il rendimento e un vantaggio contro Bet365 restano da verificare.

Nella stessa versione, la UI mostra affiancate **Quota Bet365** e **Quota equa modello**. La quota equa vale 1 diviso la probabilità stimata e usa la probabilità originale, prima dell’arrotondamento a schermo. L’app mostra il valore disponibile anche quando l’altro manca. Verificati layout Android a 360 px, formati italiani, navigazione dai prezzi ai dettagli, 309 test TypeScript e 44 test Python.

[Protocollo](../research/protocol-expansion-v35.json) · [Replay MoviOdds](../research/report-expansion-moviodds-v35.json) · [Metriche Setka e WTT](../research/report-expansion-cohorts-v35.json)
