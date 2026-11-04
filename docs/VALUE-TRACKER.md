# Selezione statistica delle quote

Il Value Tracker è la schermata iniziale: il catalogo completo resta disponibile nei dettagli. Non propone automaticamente tutte le quote, quote alte o vincitori storicamente frequenti.

Motore matematico predisposto e testato: probabilità implicita 1/quota, quota equa 1/p, EV=p×quota−1, EV prudente=p_lower×quota−1. Una selezione richiede modello validato, fonte/bookmaker ADM verificati, quote recenti, almeno 30 osservazioni, almeno 100 casi di validazione ed EV prudente positivo. Soglia quota minima 1,30, nessuna massima. Possibile valore anche su un underdog: non è imposto p>50%.

Etichetta “Ottima”: soglia di policy +5% di EV prudente e 200 casi di validazione; non garanzia di esito. Le altre selezioni idonee sono “Interessante”. Classifica per EV prudente, poi probabilità, poi vicinanza a quota 2 come spareggio. Percentuali storiche grezze non sostituiscono il modello calibrato.

**Stato reale: non operativo.** Il modello attuale ha fallito la validazione e bet365.com.au non è verificato come fonte ADM italiana. L'endpoint privato `/api/value` restituisce esplicitamente il blocco e un elenco vuoto. Non genera percentuali inventate, non classifica le quote estere come opportunità ADM e non è una pipeline attiva di selezione: serviranno un modello idoneo e una fonte verificata prima di collegare candidati reali al motore matematico.

Le schede future prevedono probabilità stimata e implicita, quota corrente ed equa, EV centrale/prudente, campione, validazione e timestamp. Nessuna scheda di esempio viene mostrata in modalità reale. Durante il blocco il Value Tracker non interroga il provider; le quote si caricano aprendo il catalogo. Nessuna nuova migrazione, spesa o scommessa.

Verifica: 168 test in 20 file, TypeScript e build superati. Chromium locale con sessione sintetica verifica l'apertura iniziale del Value Tracker, messaggio di blocco e zero richieste al catalogo. Nessun login di produzione automatizzato.

Pubblicazione Production del commit `e7720d2e7275328526a97f8a598087add2a0cd14`: deployment `dpl_vkwvP9aUrQfCKahDtYG8RuVYRGGU` READY, alias fisso https://ping-pong-ping-pong3.vercel.app confermato. Build 31 secondi; controlli remoti feed, risultati, database/RLS e schemi riusciti. Modello sempre non validato, Google ancora disattivato; nessuna migrazione o acquisto. L'implementazione corrente dell'endpoint segnala soltanto il blocco: il collegamento operativo di candidati reali al motore di ranking è ancora da completare dopo la disponibilità dei requisiti.
