# Test su un archivio Setka del 2022

Usato il CSV di Gavin Cassidy conservato nello SCORE Sports Data Repository. Le date nel file vanno dal 10 giugno all’8 luglio 2022, mentre la pagina parla di settembre. Lo studio segue le date del CSV. Il file era già stato inventariato e resta distinto dagli incontri MoviOdds degli ultimi confronti. Si pubblicano codice e aggregati. [Fonte](https://data.scorenetwork.org/table_tennis/table_tennis_sept2022.html)

Delle 7.851 righe, rimangono 7.843 dopo quattro duplicati e quattro esclusioni dovute ai controlli su identità, punteggi dichiarati, sequenza dei set ed esito. La divisione usa 3.928 partite per il training, 1.298 per la calibrazione e 2.077 per il test dall’1 all’8 luglio. Altre 540 righe contribuiscono solo allo storico quando diventano ammissibili. Le caratteristiche includono Elo, forma nelle ultime 20 partite, differenziali di set e punti e scontri diretti regolarizzati. Per una previsione nel giorno D si usano risultati con data fino a D−2. Il ritardo è una precauzione del replay dato che l’orario effettivo di disponibilità non è verificato. L’Elo si aggiorna contemporaneamente per tutte le partite del giorno. Il test applica modelli e calibrazione fissati sulle finestre precedenti, con aggiornamenti soltanto delle statistiche dei giocatori.

| Mercato | Modello | Corretti | Errati | Senza preferenza | Brier | Log Loss |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Vincente | Elo | 1.163 | 903 | 11 | 0,24356 | 0,67993 |
| Vincente | Logistica | 1.209 | 868 | 0 | 0,23746 | 0,66726 |
| Vincente | Gradient Boosting | 1.180 | 897 | 0 | 0,24256 | 0,67799 |
| Over/Under 3,5 set | Frequenza storica | 1.465 | 612 | 0 | 0,20798 | 0,60662 |
| Over/Under 3,5 set | Logistica | 1.465 | 612 | 0 | 0,20821 | 0,60715 |
| Over/Under 3,5 set | Gradient Boosting | 1.465 | 612 | 0 | 0,20828 | 0,60730 |

Il Brier della logistica sul vincente migliora di 0,00609 rispetto a Elo. L’intervallo bootstrap a blocchi di due giorni, con correzione per quattro confronti, va da −0,00890 a −0,00292. La stima resta limitata a soli otto giorni in un archivio storico. Il Gradient Boosting ha un intervallo che include zero. Sui set i due modelli hanno la stessa accuratezza della frequenza storica e aumentano leggermente l’errore delle probabilità. Le stime finali usano tutte le 2.077 partite, comprese quelle in cui Elo assegna il 50%.

Mancano quote originali. Il confronto misura la qualità delle stime sportive e lascia aperta la verifica del vantaggio sul mercato e sulle competizioni attuali. Verificata l’invarianza delle caratteristiche alterando gli esiti del primo giorno di test e rimuovendo tutte le giornate successive. Nel controllo software Python, 35 test superati e sette opzionali saltati.

[Protocollo](../research/protocol-setka-2022-v25.json) · [Risultati aggregati](../research/report-setka-2022-v25.json) · [Script di riproduzione](../scripts/benchmark-setka-2022.py)
