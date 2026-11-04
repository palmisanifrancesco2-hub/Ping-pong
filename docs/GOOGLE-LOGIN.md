# Accesso Google

Aggiunto “Continua con Google” tramite Supabase Auth. Usa PKCE, ritorno alla radice dell'indirizzo fisso e solo gli scope `openid email profile`. Il browser non riceve alcun Google Client Secret. Email e password restano disponibili.

Il pulsante legge la disponibilità effettiva del provider tramite l'endpoint pubblico Auth settings. Se Google è spento o non verificabile, è disabilitato con un messaggio esplicito; “Ricontrolla Google” rileva l'attivazione senza nuova pubblicazione. La sola presenza del pulsante non certifica un collegamento Google funzionante.

## Attivazione nel proprio account, da telefono

Secondo la [guida ufficiale Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google):

1. In [Google Auth Platform](https://console.cloud.google.com/auth/clients), selezionare o creare un progetto e un client OAuth di tipo **Web application**. Non servono piani o API a pagamento.
2. Origine JavaScript autorizzata: `https://ping-pong-ping-pong3.vercel.app`.
3. Redirect URI: copiare il callback esatto mostrato in [Supabase → Authentication → Google](https://supabase.com/dashboard/project/_/auth/providers?provider=Google), nel formato `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Incollare **Client ID** e **Client Secret** Google direttamente nel provider Supabase e abilitarlo. Non inviarli in chat e non inserirli nelle variabili `VITE_*`.
5. In Auth → URL Configuration impostare Site URL e redirect consentito a `https://ping-pong-ping-pong3.vercel.app/`. Se Google è in modalità Testing, aggiungere il proprio account tra i test user.
6. Tornare nell'app, premere “Ricontrolla Google”, poi “Continua con Google”. Usare l'account già autorizzato.

La configurazione del provider Google e dei suoi segreti richiede accesso amministrativo ai rispettivi account; l'integrazione Vercel/Supabase disponibile non fornisce controllo del client OAuth Google. Nessuna credenziale privata viene richiesta in chat.

## Privacy e registrazione

La piattaforma resta privata. Autenticazione Google e autorizzazione sono distinte: un nuovo account non riceve membership. L'API verifica token con Supabase e registro privato; il client verifica `/api/access` prima di montare dashboard o caricare feed. Un non membro vede “Account non abilitato”. La precedente protezione Vercel resta attiva prima della pagina dell'app: non è stata aperta l'app a visitatori pubblici.

La creazione di nuovi account dipende anche dalle impostazioni signup di Supabase. Se disabilitata, Google serve per gli account già esistenti; il codice non modifica questa impostazione né il registro privato. Per concedere accesso ad altre persone serve abilitazione amministrativa, non basta registrarsi con Google.

Il callback è gestito dall'SDK ufficiale in PKCE. Nessuno scambio manuale duplicato, nessun redirect arbitrario dal parametro `next`. Codice ed errori vengono rimossi dall'URL dopo l'inizializzazione e le descrizioni non attendibili non sono mostrate. Su URL di versione/preview il pulsante porta prima alla versione fissa, evitando di spostare il verificatore PKCE tra origini diverse.

## Verifiche

162 test in 19 file, TypeScript e build superati. Nuovi test: parametri e PKCE prodotti dall'SDK, redirect estranei negati, scope minimi, provider spento/mancante, chiavi private rifiutate nel client, callback ripulito, accesso negato ai nuovi utenti Google senza membership.

Chromium locale, 393×851 e 1440×1000: ritorno OAuth simulato con PKCE e scambio codice; membro entra e carica feed; non membro non carica alcun feed; annullamento senza sessione; provider disabilitato e successiva rilettura; nessun errore JS o overflow. Questi test usano esclusivamente sessioni sintetiche locali e non effettuano un vero login Google, né creano utenti remoti.

Il build Production esegue un controllo in sola lettura delle impostazioni pubbliche Supabase, riportando flag Google/signup e callback pubblico, senza chiavi. Lo stato reale verrà riportato dopo quel controllo; nessuna migrazione o modifica di utenti è necessaria per il codice.

## Stato Production verificato

Deployment `dpl_A3uwzeHWCiUwqxMyHndzUgLUMnH1`, commit applicativo `b914c8164472fd151f456de994f28b18c8733db8`, build completato in 29 secondi. Il controllo reale sul server Supabase conferma `googleEnabled=false`, `signupEnabled=true`. Google non è pertanto attivo: il pulsante lo segnala e resta disabilitato fino alla configurazione del provider. Il callback effettivo va copiato dalla pagina Google di Supabase; l'output del connettore lo oscura e non viene ricostruito aggirando la protezione.

Feed, risultati giocatori, verifica accesso database e query storico/scelte sono riusciti. Entrambi i runner migrazione risultano non richiesti; nessuna modifica al database, agli account Auth o all'autorizzazione. URL fisso https://ping-pong-ping-pong3.vercel.app. Nessun login Google reale è stato eseguito; creazione client OAuth e configurazione richiedono il proprietario.

## Conferma successiva del proprietario

Il 4 novembre 2026 il proprietario ha completato il client OAuth Web Google, impostato origine e callback Supabase, inserito Client ID e Client Secret direttamente nel provider Supabase e confermato in chat: «Fatto funziona». L'accesso Google sul suo account è pertanto confermato dal test manuale dell'utente. Non è stato eseguito un login automatizzato con il suo account e nessun segreto è stato richiesto o registrato in chat. Il precedente `googleEnabled=false` descrive la configurazione al momento del vecchio build, prima di questa attivazione.
