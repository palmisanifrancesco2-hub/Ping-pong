# Verifiche Fase 1

Eseguite il 4 novembre 2026 in ambiente Codex.

| Controllo | Risultato | Limiti |
|---|---|---|
| Vitest | 129 test superati in 14 file | Include migrazioni transazionali, rollback, checksum, appartenenza, CA e verifica accesso in sola lettura |
| Endpoint HTTP | Health, auth, metodo, percorso e cache verificati su localhost | Token/provider sostituiti nei test HTTP; nessun login remoto certificato |
| Auth Supabase | Gate di autorizzazione e gestione errori testati | Test unitari Auth con risposte simulate; account e appartenenza verificati anche sul database remoto |
| PostgreSQL/RLS | Due migrazioni remote e 14 tabelle RLS; successivo controllo remoto READ ONLY conferma proprietario verificato/autorizzato, profilo isolato e rifiuto estranei/anonimi | Il proprietario ha confermato di riuscire a entrare dal telefono; verifica manuale riferita, non automatizzata |
| Supabase su Vercel | Integrazione e variabili Production verificate; bootstrap riuscito con CA ufficiale e flag disattivato dopo l'esecuzione | Nessun segreto copiato nelle Preview |
| TypeScript | Controllo superato | Non sostituisce prove del provider reale |
| Build Vite / Vercel | Deployment Production `e4f68ce` READY, verifica server database riuscita; HEAD URL risponde 302 verso autenticazione Vercel | Fetch autenticato dello strumento non riuscito; accesso browser confermato dal proprietario |
| Dipendenze produzione | `npm audit --omit=dev`: zero vulnerabilità segnalate | Fotografia delle segnalazioni disponibili, non garanzia generale |
| Test connessione sul server Vercel | Connessione autenticata riuscita | Catalogo senza tennistavolo; nessuna chiamata quote |
| Raggiungibilità provider | Endpoint sport ufficiale restituisce HTTP 401 senza chiave | Non prova copertura né validità chiave |
| Browser Android/PC | Accesso dal telefono confermato dal proprietario | Verifica manuale riferita; interazioni complete, layout e PC non verificati automaticamente |
| Modello statistico | Non eseguito | Nessun modello o dataset: nessuna previsione operativa |
| Salvataggio GitHub | Riuscito dopo aggiornamento autorizzazione | Ramo `feat/phase-1-foundation` caricato; il precedente errore 403 è risolto |

I test degli endpoint richiedono apertura di socket locali. Nell'ambiente Codex è stato necessario eseguirli fuori dal vincolo di rete locale della sandbox; nessun servizio pubblico è stato avviato. La suite CI richiede Node 22 e ripete `npm run check`.

Controllo credenziali: `.env` ignorato; `.env.example` contiene solo valori vuoti. Il provider usa esclusivamente variabili server; nessuna API key reale disponibile o inserita nel repository. Il bundle frontend non importa i moduli server.

Il codice è salvato su GitHub nel ramo `feat/phase-1-foundation`. Il primo tentativo di scrittura era fallito con HTTP 403; dopo l'aggiornamento dell'autorizzazione da parte del proprietario, il push è riuscito. Chiave API configurata come Secret server `oddsapi`; nessuna copia locale o lettura del suo valore. Supabase configurato in Production; account proprietario e isolamento RLS verificati sul server.

Preview del commit `9b27cc5`: https://ping-pong-5nfa5733j-ping-pong3.vercel.app — Vercel segnala READY e i log confermano il test catalogo riuscito. Lo strumento di fetch protetto restituisce errore di risoluzione/accesso al deployment; il fallback CLI non ha credenziali disponibili. Nessuna protezione disattivata, nessuna certificazione del flusso HTTP end-to-end.

Verifica successiva dopo creazione dell'account da parte del proprietario: deployment Production `e4f68ce`, https://ping-pong-oscdwxx87-ping-pong3.vercel.app. Il controllo server ha eseguito una transazione `READ ONLY`, verificando account, email confermata, registro privato, visibilità del profilo proprietario, rifiuto di un'identità estranea e dei privilegi anonimi. Rollback finale della transazione; nessuna modifica a utenti/schema/dati. Il build conferma che il bootstrap non è richiesto: flag migrazione a `0`. Nessuna password del proprietario usata o acquisita.

Vincolo economico confermato dal proprietario: soltanto servizi gratuiti. Diagnostica OddsPapi testata con fixture sintetiche: massimo due richieste, opt-in esplicito, nessun retry, errori senza chiave, nessuna esecuzione automatica durante build. Connessione reale OddsPapi non eseguita: manca una chiave distinta del piano gratuito.

MoviOdds: chiamate pubbliche reali senza chiave riuscite via curl; payload reale validato dal parser. Anche il comando HTTP completo è riuscito usando `NODE_USE_ENV_PROXY=1` per rispettare il proxy configurato. Feed bet365.com.au, prezzi italiani e ADM non verificati. Nuovi test coprono timestamp obsoleti/futuri, schema, identità duplicate, quote di altro evento, HTTP 429 e separazione fonte estera/ADM. Nessuna attivazione nella dashboard.

Integrazione UI MoviOdds: vedere [Fase 3](FASE-3.md). Connettore completo verificato sul feed reale. Chromium locale con auth sintetica e API reale conferma mobile/desktop, quote/mercati, filtri, paginazione, logout/demo e rifiuto senza token. Nessun bypass Auth nel codice distribuito. Risultati storici delle righe precedenti non sostituiscono questa verifica più recente.
