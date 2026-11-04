# Verifiche Fase 1

Eseguite il 4 novembre 2026 in ambiente Codex.

| Controllo | Risultato | Limiti |
|---|---|---|
| Vitest | 106 test superati in 11 file | Include migrazioni transazionali, rollback, checksum, appartenenza, CA e verifica accesso in sola lettura |
| Endpoint HTTP | Health, auth, metodo, percorso e cache verificati su localhost | Token/provider sostituiti nei test HTTP; nessun login remoto certificato |
| Auth Supabase | Gate di autorizzazione e gestione errori testati | Risposte Auth simulate, nessuna credenziale remota configurata |
| PostgreSQL/RLS | Due migrazioni remote e 14 tabelle RLS; successivo controllo remoto READ ONLY conferma proprietario verificato/autorizzato, profilo isolato e rifiuto estranei/anonimi | Login con password nel browser ancora da provare dal proprietario |
| Supabase su Vercel | Integrazione e variabili Production verificate; bootstrap riuscito con CA ufficiale e flag disattivato dopo l'esecuzione | Nessun segreto copiato nelle Preview |
| TypeScript | Controllo superato | Non sostituisce prove del provider reale |
| Build Vite / Vercel | Deployment Production `e4f68ce` READY, verifica server database riuscita; HEAD URL risponde 302 verso autenticazione Vercel | Fetch autenticato dello strumento e login browser non verificati |
| Dipendenze produzione | `npm audit --omit=dev`: zero vulnerabilità segnalate | Fotografia delle segnalazioni disponibili, non garanzia generale |
| Test connessione sul server Vercel | Connessione autenticata riuscita | Catalogo senza tennistavolo; nessuna chiamata quote |
| Raggiungibilità provider | Endpoint sport ufficiale restituisce HTTP 401 senza chiave | Non prova copertura né validità chiave |
| Browser Android/PC | Non eseguito | Strumento browser QA non disponibile; CSS responsive predisposto |
| Modello statistico | Non eseguito | Nessun modello o dataset: nessuna previsione operativa |
| Salvataggio GitHub | Riuscito dopo aggiornamento autorizzazione | Ramo `feat/phase-1-foundation` caricato; il precedente errore 403 è risolto |

I test degli endpoint richiedono apertura di socket locali. Nell'ambiente Codex è stato necessario eseguirli fuori dal vincolo di rete locale della sandbox; nessun servizio pubblico è stato avviato. La suite CI richiede Node 22 e ripete `npm run check`.

Controllo credenziali: `.env` ignorato; `.env.example` contiene solo valori vuoti. Il provider usa esclusivamente variabili server; nessuna API key reale disponibile o inserita nel repository. Il bundle frontend non importa i moduli server.

Il codice è salvato su GitHub nel ramo `feat/phase-1-foundation`. Il primo tentativo di scrittura era fallito con HTTP 403; dopo l'aggiornamento dell'autorizzazione da parte del proprietario, il push è riuscito. Chiave API configurata come Secret server `oddsapi`; nessuna copia locale o lettura del suo valore. Supabase resta da configurare.

Preview del commit `9b27cc5`: https://ping-pong-5nfa5733j-ping-pong3.vercel.app — Vercel segnala READY e i log confermano il test catalogo riuscito. Lo strumento di fetch protetto restituisce errore di risoluzione/accesso al deployment; il fallback CLI non ha credenziali disponibili. Nessuna protezione disattivata, nessuna certificazione del flusso HTTP end-to-end.

Verifica successiva dopo creazione dell'account da parte del proprietario: deployment Production `e4f68ce`, https://ping-pong-oscdwxx87-ping-pong3.vercel.app. Il controllo server ha eseguito una transazione `READ ONLY`, verificando account, email confermata, registro privato, visibilità del profilo proprietario, rifiuto di un'identità estranea e dei privilegi anonimi. Rollback finale della transazione; nessuna modifica a utenti/schema/dati. Il build conferma che il bootstrap non è richiesto: flag migrazione a `0`. Nessuna password del proprietario usata o acquisita.
