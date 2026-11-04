# Configurazione privata da browser Android

Procedura preparata per il deploy futuro: nessun servizio già collegato e nessun PC necessario. Non inviare chiavi API, password o service-role key in chat. Nessun acquisto senza consenso.

## Test provider in Codex

Se disponibile nell'interfaccia, aggiungere ai segreti dell'ambiente cloud di questa attività la variabile **THE_ODDS_API_KEY** con la propria chiave. Dopo l'applicazione delle impostazioni, Codex può eseguire il test catalogo. Non inserire il valore in messaggi, file tracciati, URL o comandi.

Se l'interfaccia mobile non offre i segreti ambiente, usare le Environment Variables del backend Vercel dopo il collegamento hosting; non creare un campo pubblico di inserimento chiave.

Il segreto già configurato dal proprietario come `oddsapi` è supportato dal backend come alias di `THE_ODDS_API_KEY`. Il nome documentato ha precedenza se entrambi esistono. Non occorre ricopiare o rivelare il segreto: Vercel non permette di rinominare le variabili Sensitive in posizione.

Il build Vercel esegue anche il test catalogo con un riepilogo sanitizzato nei log, senza stampare la chiave. Il test richiede una chiave valida e può bloccare un nuovo deployment se il provider non è raggiungibile; non interrompe i deployment già attivi. Una risposta riuscita non implica disponibilità tennistavolo.

## Supabase

Percorso più diretto da Android: aprire [Supabase nel Marketplace Vercel](https://vercel.com/marketplace/supabase), installare nel team `ping-pong3` con piano Free e collegare il progetto Vercel `ping-pong`. Il codice riconosce le variabili native `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` e gli alias pubblicabili `NEXT_PUBLIC_SUPABASE_*`; non serve rinominarle o esporre chiavi amministrative. Le chiavi legacy anon rimangono supportate. Il build rifiuta chiavi segrete/service-role nei campi pubblici.

1. Dal dashboard Supabase creare o selezionare un progetto, verificando che il piano non comporti spese.
2. Applicare nel SQL Editor la migrazione del repository. Su database esistenti controllare prima la compatibilità; non applicarla alla cieca su dati reali.
3. In Authentication disabilitare nuove registrazioni pubbliche. Creare soltanto gli utenti privati attraverso la gestione utenti, impostando le password tramite i flussi sicuri del servizio.
4. L'accesso richiede appartenenza a `public.authorized_users`. Il backend verifica questo registro tramite RPC con il token dell'utente, senza chiavi amministrative. `ALLOWED_USER_IDS` è una restrizione UUID aggiuntiva facoltativa, non sostituisce il registro. Il browser dell'app non può autorizzare nuovi utenti.
5. Usare Project URL e anon/publishable key compatibile per il frontend. Mai utilizzare la service-role key come chiave frontend. La sincronizzazione native Vercel è preferibile alla copia manuale.

## Vercel

1. Dal dashboard Vercel importare il repository GitHub e il ramo dell'implementazione. Framework Vite, build `npm run build`, output `dist`, Node 22 o successivo compatibile.
2. Variabili server: `THE_ODDS_API_KEY` (o il Secret esistente `oddsapi`), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (o anon legacy). `ALLOWED_USER_IDS`, se impostata, restringe ulteriormente gli utenti a UUID separati da virgola.
3. Variabili pubblicabili: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Le loro modifiche richiedono una nuova build.
4. Verificare protezioni deployment e antiabuso disponibili senza spese. Non rimuovere l'autorizzazione dell'app per risolvere problemi di configurazione.
5. Configurare gli URL di Auth quando necessari. Verificare login autorizzato, rifiuto utenti estranei, rifiuto endpoint senza token, catalogo, sessioni scadute e logout da telefono.

Un repository pubblico può contenere codice e configurazioni di esempio, mai segreti, report autenticati o storico privato. Il deploy non certifica il funzionamento completo: acquisizione, ADM, risultati ufficiali e modello vanno verificati separatamente.

## Migrazione server e proprietario

`APP_DATABASE_SETUP=1`, solo in Production, abilita `npm run db:bootstrap` durante il build Vercel. Il runner usa `POSTGRES_URL` nativo sul server, verifica corrispondenza con `SUPABASE_URL`, TLS con certificati verificati e schema iniziale vuoto. Non legge né stampa credenziali nel client Codex. Migrazioni transazionali con lock e checksum: un errore annulla la transazione; database sconosciuti o migrazioni applicate e poi modificate vengono rifiutati. L'operazione è idempotente. Le tabelle sportive non ricevono seed fittizi.

La variabile server `APP_OWNER_EMAIL` riserva un indirizzo in una tabella privata. Non crea utenti Auth, non imposta password e non invia messaggi. Un account con quell'email ottiene appartenenza soltanto dopo la verifica dell'indirizzo da parte di Supabase, oppure tramite creazione confermata nell'Auth dashboard amministrativo. Senza account autorizzato l'accesso ai dati resta negato.

Il comando non modifica l'impostazione di registrazione pubblica di Supabase: disabilitarla dall'Auth dashboard resta una verifica separata. Non copiare i segreti del database di Production nelle Preview per completare il setup.

Prima di attivare pronostici occorrono storico sufficiente, validazione temporale fuori campione e calibrazione. Se il provider non offre tennistavolo, l'app deve dichiararlo senza sostituirlo con tennis o quote inventate.
