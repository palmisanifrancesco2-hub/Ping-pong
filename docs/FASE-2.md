# Avanzamento Fase 2 — integrazioni e copertura

Rilevazione: 4 novembre 2026. Supabase è collegato a Vercel e le due migrazioni iniziali sono state applicate al database remoto dopo approvazione esplicita. Questa fase non è ancora completa: account di login e feed quote restano da attivare.

## Completato e verificato

- Supporto alle variabili native Vercel/Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, alias `NEXT_PUBLIC_SUPABASE_*` e legacy `VITE_SUPABASE_ANON_KEY`.
- Il build valida la chiave pubblicabile prima di includerla nel frontend. Chiavi `sb_secret_*`, JWT service-role, URL non compatibili e configurazioni parziali vengono rifiutati con errori privi del valore segreto. Il backend continua a verificare token e lista utenti: nessun accesso aperto automaticamente.
- Corretto il trattamento dell'errore di ripristino sessione nel client.
- Comando di audit pubblico `npm run check:coverage`: interroga esclusivamente due endpoint senza chiave di odss-api.com, valida i payload, riporta timestamp della fonte e della verifica, distingue presenza nel catalogo da copertura operativa. Nessuna richiesta a `/odds`, nessuna quota o previsione.
- Suite estesa con test delle migrazioni transazionali, checksum, rollback, registro privato e verifica email proprietario. Audit pubblico eseguito realmente: uscita 0. Migrazione database ancora verificata soltanto su PostgreSQL incorporato.

## Fonti quote alternative: verifica concreta

La chiave attuale è di **The Odds API** e non copre tennistavolo nel catalogo autenticato verificato. Non viene trasferita ad altri fornitori.

### ODSS-API (odss-api.com) — servizio distinto

Fonti pubbliche: [catalogo](https://odss-api.com/api/v1/leagues), [matrice mercati](https://odss-api.com/api/v1/coverage/matrix), [documentazione OpenAPI](https://odss-api.com/openapi.json).

Verifica del 4 novembre 2026, ore 11:56:44 UTC; timestamp matrice 11:53:28 UTC. Il catalogo dichiarava 1.473 eventi tennistavolo. Si tratta di conteggi del fornitore, non di eventi deduplicati e verificati dall'app.

| Competizione | Conteggio dichiarato dal catalogo osservato |
|---|---:|
| Czech Liga Pro | 264 |
| TT Cup | 154 |
| TT Elite Series | 125 |
| Challenger Series | Assente dalla rilevazione |

La matrice riportava `moneyline`, `ou`, `ah` e alcuni marchi italiani. Questo non certifica concessioni ADM, unità set/punti, regole di settlement, prezzi correnti o disponibilità live. Nessun bookmaker viene inserito nel registro ADM dell'app in base al solo nome. La rilevazione può cambiare nel tempo.

I [termini, §5](https://odss-api.com/termini.html) richiedono autorizzazione espressa per usare i dati in piattaforme di value betting. Il piano gratuito standard non viene quindi assunto sufficiente per questo progetto. Restano anche i limiti documentati di identità evento, unità mercati e storico quote. Nessun account creato, abbonamento o connettore quote attivato.

### Odds-API.io — candidato a pagamento, non attivato

La [scheda ufficiale AdmiralBet IT](https://odds-api.io/sportsbooks/admiralbet-it) dichiara tennistavolo prematch/live. È una dichiarazione del provider, non una verifica autenticata della nostra app. La [pagina prezzi](https://odds-api.io/pricing) mostra un ingresso a 59 EUR/mese per due bookmaker; streaming aggiuntivo. Serve controllare contratto, copertura delle singole competizioni, identità dell'operatore italiano e risultati storici prima di scegliere. Nessun acquisto effettuato.

## Supabase: stato effettivo e azione necessaria

Il proprietario ha completato il collegamento Supabase: l'integrazione è presente nel team Vercel `ping-pong3`, e le variabili Postgres/Auth sono disponibili soltanto in Production. Non sono state copiate nelle Preview né lette in chiaro. Gli strumenti amministrativi Supabase diretti non sono disponibili in questa sessione.

Percorso supportato: [Supabase nel Marketplace Vercel](https://vercel.com/marketplace/supabase), **Install**, team `ping-pong3`, piano **Free** e collegamento al progetto Vercel `ping-pong`. Se si possiede già un progetto, verificare l'opzione di collegamento all'account esistente prima di crearne un altro. La [guida ufficiale Supabase](https://supabase.com/docs/guides/integrations/vercel-marketplace) descrive provisioning dal dashboard e sincronizzazione delle variabili.

La presenza delle variabili native è stata verificata senza stamparne i valori. Il runner server di bootstrap è pronto: transazioni, lock, checksum, controllo database vuoto e verifica TLS. La seconda migrazione unifica l'autorizzazione API con il registro RLS e riserva l'email del proprietario in una tabella privata, con appartenenza concessa solo dopo verifica email. Non crea account o password e non invia messaggi.

L'attivazione era stata inizialmente rifiutata dal controllo automatico per assenza di approvazione specifica. Il proprietario ha poi autorizzato esplicitamente le due migrazioni iniziali e la prenotazione dell'email. Il primo tentativo si è fermato prima di modificare il database per `SELF_SIGNED_CERT_IN_CHAIN`; è stata aggiunta la CA pubblica ufficiale Supabase, verificata e fissata per impronta, mantenendo verifica certificati e hostname. La provenienza è in `certs/README.md`.

Il deployment Production del commit `92514b3` ha confermato: due migrazioni applicate, 14 tabelle pubbliche con RLS abilitata su tutte, email proprietario riservata, zero account Auth nuovi collegati. Il flag `APP_DATABASE_SETUP` è stato quindi riportato a `0`. Non sono stati creati account/password, inviati messaggi o eseguite scommesse. L'indirizzo del proprietario non è incluso nel repository.

Deployment: https://ping-pong-3nnu10rr3-ping-pong3.vercel.app — stato Vercel READY. Il fetch HTTP automatico del deployment protetto continua a fallire per risoluzione/accesso nello strumento; questo limite non è stato risolto disattivando la protezione. Il login completo va verificato dopo la creazione dell'account Auth.

Restano da eseguire: creazione dell'utente Auth con password scelta dal proprietario e conferma email, verifica impostazioni registrazioni, test login/RLS con sessione reale, pipeline dati con budget richieste persistente, verifica ADM e disponibilità di una fonte risultati ufficiali. Nessun modello, opportunità o stake operativo attivato.
