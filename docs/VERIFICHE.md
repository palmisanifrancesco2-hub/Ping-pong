# Verifiche Fase 1

Eseguite il 4 novembre 2026 in ambiente Codex.

| Controllo | Risultato | Limiti |
|---|---|---|
| Vitest | 60 test superati in 5 file | Payload provider sintetici confinati ai test |
| Endpoint HTTP | Health, auth, metodo, percorso e cache verificati su localhost | Token/provider sostituiti nei test HTTP; nessun login remoto certificato |
| Auth Supabase | Gate di autorizzazione e gestione errori testati | Risposte Auth simulate, nessuna credenziale remota configurata |
| PostgreSQL/RLS | Migrazione eseguita su PGlite; isolamento, letture e scritture verificati | Nessuna migrazione sul progetto Supabase del proprietario |
| TypeScript | Controllo superato | Non sostituisce prove del provider reale |
| Build Vite | Build produzione superata | Nessun URL pubblicato |
| Dipendenze produzione | `npm audit --omit=dev`: zero vulnerabilità segnalate | Fotografia delle segnalazioni disponibili, non garanzia generale |
| Test CLI connessione | Stato `not_configured`, uscita 1 attesa | Nessuna richiesta autenticata effettuata |
| Raggiungibilità provider | Endpoint sport ufficiale restituisce HTTP 401 senza chiave | Non prova copertura né validità chiave |
| Browser Android/PC | Non eseguito | Strumento browser QA non disponibile; CSS responsive predisposto |
| Modello statistico | Non eseguito | Nessun modello o dataset: nessuna previsione operativa |
| Salvataggio GitHub | Bloccato: HTTP 403 | Push Git e creazione ramo tramite integrazione entrambi negati; nessuna pull request creata |

I test degli endpoint richiedono apertura di socket locali. Nell'ambiente Codex è stato necessario eseguirli fuori dal vincolo di rete locale della sandbox; nessun servizio pubblico è stato avviato. La suite CI richiede Node 22 e ripete `npm run check`.

Controllo credenziali: `.env` ignorato; `.env.example` contiene solo valori vuoti. Il provider usa esclusivamente variabili server; nessuna API key reale disponibile o inserita nel repository. Il bundle frontend non importa i moduli server.

Il codice è conservato nel ramo locale `feat/phase-1-foundation` e fornito anche come archivio sorgenti e bundle Git. La lettura del repository pubblico funziona; la scrittura richiede correzione dei permessi della connessione. I metadati che indicavano permessi di scrittura non sono confermati dalla prova effettiva, fallita con `Resource not accessible by integration`.
