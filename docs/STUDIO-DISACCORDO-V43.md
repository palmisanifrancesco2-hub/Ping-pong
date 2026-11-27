# Errori del modello quando cambia il favorito

Sulle 258 coppie di quote storiche del v38, il modello sportivo e Bet365 indicano due favoriti diversi in 82 incontri. Il modello ne indovina 34 e Bet365 48. Nel blocco dal 1° al 4 novembre, sono rispettivamente 19 e 27 su 46. Espandere la selezione a più casi di disaccordo richiede evidenza prospettica.

| Fascia EV nominale | Selezioni | Esatte | Frequenza osservata | Probabilità media del modello |
| --- | ---: | ---: | ---: | ---: |
| Da oltre 0% a 10% | 72 | 35 | 48,6% | 50,6% |
| Da oltre 10% a 25% | 62 | 26 | 41,9% | 50,2% |
| Da oltre 25% a 50% | 34 | 13 | 38,2% | 48,8% |
| Oltre 50% | 12 | 3 | 25,0% | 48,5% |

È usata una selezione per incontro con quota minima 1,30. La fascia più alta contiene quote più lunghe e il modello sovrastima la frequenza di successo su questo campione. Le probabilità di pareggio nella scelta del favorito sono escluse solo dai conteggi del disaccordo.

Dal blocco storico di 156 incontri del 1°–4 novembre: Brier 0,24694 per il modello sportivo, 0,24288 per il mercato, 0,24220 per la combinazione fissa 25% sport e 0,24152 per la variante che applica il 25% solo se i favoriti concordano o una delle stime è alla pari. La variante usa la scala logit. Il periodo era già stato osservato, quindi questo confronto è esplorativo. Sulle 258 partite, l’intervallo descrittivo al 95% per la differenza di Brier dalla baseline Bet365 è [−0,00251, +0,00068], con bootstrap a blocchi di tre giorni su 16 giornate.

Le nuove previsioni del vincente con entrambe le quote registrano anche questa variante. In **Studio → Storico e confronto nel tempo** la stessa coorte confronta variante, modello sportivo e Bet365 dopo verifica dell'orario di inizio. Il CSV contiene la colonna `home_agreement_blend_v43_p`. Il candidato è sperimentale.
