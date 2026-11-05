import { useEffect, useState, useRef, type FormEvent } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { COMPETITIONS, type ConnectionReport } from './shared/contracts';
import { FeedStatus, Markets } from './Markets';
import { useBoard } from './useBoard';
import { PredictionHistory } from './History';
import type { HistoryPeriod } from './shared/history';
import { isFreshLive } from './shared/board';
import { PersonalChoices } from './Choices';
import { ModelStats } from './ModelStats';
import { GoogleSignIn } from './GoogleSignIn';
import{SmartStake}from'./SmartStake';
import{ConnectionHealth}from'./ConnectionHealth';
import type{BetPrefill}from'./shared/bets';
import { ValueTracker } from './ValueTracker';
import { usePrivateAccess } from './usePrivateAccess';
import { cleanAuthCallbackUrl, googleCallbackError } from './shared/google-auth';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const auth = (() => {
  if (!url || !key) return null;
  try { return createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true } }); } catch { return null; }
})();
const sections = ['Dashboard', 'Partite e mercati', 'Value Tracker', 'Statistiche modello', 'Storico pronostici', 'Le mie scelte', 'Smart Stake', 'Collegamenti'] as const;
type Section = typeof sections[number];
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [section, setSection] = useState<Section>('Value Tracker');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState(() => googleCallbackError(window.location.search, window.location.hash) ?? '');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const[betPrefill,setBetPrefill]=useState<BetPrefill|undefined>();
  function openBet(p:BetPrefill){setBetPrefill(p);setSection('Smart Stake');}
  const [period, setPeriod] = useState<HistoryPeriod>('30');
  const account=useRef<string|null>(null);
  const access = usePrivateAccess(session?.access_token, !!session && !demo);
  const feed = useBoard(session?.access_token, !!session && !demo && access.status === 'allowed' && ['Dashboard','Partite e mercati','Collegamenti'].includes(section));
  useEffect(() => {
    if (!auth) return;
    let active = true;
    auth.auth.getSession().then(({ data, error }) => { if (active) { setSession(data.session); if (error) setNotice('Accesso o ripristino della sessione non riuscito. Riprova.'); } }).catch(() => { if (active) setNotice('Sessione non disponibile. Accedi nuovamente.'); }).finally(() => { window.history.replaceState(window.history.state, '', cleanAuthCallbackUrl(window.location.href)); });
    const { data } = auth.auth.onAuthStateChange((_event, value) => {
      if (active) { if(account.current!==value?.user.id){setBetPrefill(undefined);account.current=value?.user.id??null;} setSession(value); setReport(null); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  async function login(e: FormEvent) {
    e.preventDefault(); if (!auth) return;
    setBusy(true); setNotice('');
    try {
      const { error } = await auth.auth.signInWithPassword({ email, password });
      setPassword('');
      if (error) setNotice('Accesso non riuscito. Verifica credenziali e invito.');
    } catch { setNotice('Servizio di autenticazione non raggiungibile.'); }
    finally { setBusy(false); }
  }
  async function check() {
    if (!session || demo) return;
    setBusy(true); setNotice('');
    try {
      const { data, error } = await auth!.auth.getSession();
      if (error || !data.session) throw new Error('Sessione scaduta. Accedi nuovamente.');
      const response = await fetch('/api/connection', { headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Utente non autorizzato: verificare invito e lista di accesso server.' : 'Verifica non disponibile. Riprova più tardi.');
      const result = await response.json() as ConnectionReport;
      setReport(result);
    } catch (error) { setNotice(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'La verifica ha superato il tempo massimo.'); }
    finally { setBusy(false); }
  }
  if (!session && !demo) return <main className="login-shell">
    <section className="intro"><Brand/><span className="eyebrow">IL TUO OSSERVATORIO PRIVATO</span><h1>Il gioco cambia.<br/><em>I dati contano.</em></h1><p>Quote verificabili, confronti rigorosi e analisi trasparenti. Un unico spazio dedicato al tennistavolo.</p><div className="court" aria-hidden="true"><span>01</span><i/><b>↗</b></div><p className="fine">Nessuna scommessa automatica. Nessuna promessa di rendimento.</p></section>
    <section className="login-card"><span className="eyebrow">PING PONG ANALYTICS · V0.1</span><h2>Accedi al tuo spazio</h2><p>L’accesso è riservato agli utenti invitati.</p>
      {!auth && <div className="banner">Configurazione iniziale richiesta: Supabase Auth non è ancora collegato. Nessun dato privato è disponibile.</div>}
      <GoogleSignIn auth={auth} url={url} publicKey={key} busy={busy} onBusy={setBusy} onNotice={setNotice}/>
      <form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={!auth}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={!auth}/></label><button className="primary" disabled={busy || !auth}>{busy ? 'Accesso in corso…' : 'Accedi →'}</button></form>
      <p role="status">{notice}</p><button className="text-button" onClick={() => { setDemo(true); setNotice(''); }}>Esplora l’anteprima senza dati →</button><p className="fine">L’anteprima non accede alle API e non contiene quote o previsioni.</p>
    </section></main>;
  if (session && !demo && access.status !== 'allowed') return <main className="login-shell access-shell"><section className="intro"><Brand/><h1>Il tuo spazio<br/><em>resta privato.</em></h1></section><section className="login-card"><span className="eyebrow">VERIFICA ACCESSO</span><h2>{access.status === 'checking' ? 'Verifica del tuo account…' : access.status === 'denied' ? 'Account non abilitato' : 'Verifica non disponibile'}</h2><p role="status">{access.status === 'checking' ? 'Attendi la verifica dell’accesso privato.' : access.status === 'denied' ? 'La registrazione o l’accesso Google non concedono automaticamente l’accesso ai dati. Usa l’account autorizzato dal proprietario.' : 'Non possiamo verificare l’abilitazione in questo momento. Nessun dato privato è stato caricato.'}</p>{access.status !== 'checking' && <button className="primary" onClick={access.retry}>Riprova verifica</button>}<button className="text-button" onClick={async () => { await auth?.auth.signOut(); setSession(null); setNotice(''); }}>Esci o usa un altro account →</button></section></main>;
  return <div className="app-shell"><aside><Brand/><span className="eyebrow workspace">WORKSPACE PRIVATO</span><nav aria-label="Navigazione principale">{sections.map((name, i) => <button key={name} className={section === name ? 'nav-item active' : 'nav-item'} onClick={() => { setSection(name); setNotice(''); }}><span aria-hidden="true">{['◫','≋','↗','◷','▤','☆','◎','⚙'][i]}</span>{name}</button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/> {demo ? 'Anteprima' : 'Sessione autenticata'}<small>Pronostici soggetti a verifica</small><button className="text-button" onClick={async () => { if (session) await auth?.auth.signOut(); setDemo(false); setReport(null); setNotice(''); }}>Esci dallo spazio ↗</button></div></aside>
    <main className="workspace-main"><header><div><span className="eyebrow">ANALISI / {section.toUpperCase()}</span><h1>{section}</h1></div><div className="header-actions"><span className="badge">{demo ? 'DEMO · SENZA DATI' : 'MODALITÀ REALE'}</span><button className="text-button" onClick={async () => { if (session) await auth?.auth.signOut(); setDemo(false); setReport(null); setNotice(''); }}>Esci ↗</button></div></header>
      <div className="banner">{demo ? 'Anteprima dell’interfaccia. Nessuna chiamata API, quota o statistica simulata.' : 'MoviOdds · Quote bet365 estere. Solo live confermati e partite da iniziare. Pronostici soggetti a dati e validazione; scelte personali separate.'}</div>
      {notice && <p className="error" role="alert">{notice}</p>}
      {section === 'Dashboard' && <><section className="hero-panel"><div><span className="eyebrow">PRIMA LA QUALITÀ DEL DATO</span><h2>Ogni opportunità<br/>parte da una verifica.</h2><p>Apri una partita per confrontare i giocatori e verificare se il modello può registrare un pronostico.</p><button className="primary" onClick={() => setSection('Partite e mercati')}>Esplora partite e quote ↗</button></div><div className="hero-mark" aria-hidden="true">◎<span>ANALYTICS</span></div></section><FeedStatus {...feed} disabled={demo}/><div className="metrics">{[
        ['Partite nel feed', feed.board ? String(feed.board.matches.length) : '—'],
        ['Campionati nel feed', feed.board ? String(new Set(feed.board.matches.map(m => m.league)).size) : '—'],
        ['Voci quota ricevute', feed.board ? String(feed.board.matches.reduce((n, m) => n + m.quotes.length, 0)) : '—'],
        ['Partite LIVE aggiornate', feed.board ? String(feed.board.matches.filter(m => isFreshLive(m, feed.now)).length) : '—'],
      ].map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>Fonte MoviOdds · bet365.com.au</small></article>)}</div><div className="two-columns"><section className="panel"><h2>Competizioni monitorate</h2><p>Campionati presenti nella risposta MoviOdds, aggiornati con il feed.</p>{feed.board ? <ul className="competition-list">{[...new Set(feed.board.matches.map(m => m.league))].sort().map(name => <li key={name}><span>{name}</span><small>{feed.board!.matches.filter(m => m.league === name).length} partite</small></li>)}</ul> : <p>Catalogo in attesa di caricamento.</p>}</section><section className="panel"><span className="eyebrow">MODELLO STATISTICO</span><h2>Trasparente, fin dall’inizio.</h2><div className="empty-symbol">↗</div><h3>Un controllo per ogni partita</h3><p>Storico dei giocatori, campione e validazione temporale determinano se un pronostico può essere registrato. In caso contrario compare “Dati insufficienti”.</p><button className="text-button" onClick={() => setSection('Statistiche modello')}>Stato della validazione →</button></section></div></>}
      {section === 'Collegamenti' && <><FeedStatus {...feed} disabled={demo}/><ConnectionHealth token={session?.access_token} demo={demo}/></>}
      {section === 'Collegamenti' && <details className="panel"><summary>Fonte opzionale: The Odds API</summary><section><div className="panel-heading"><div><span className="eyebrow">FONTE OPZIONALE · NON NECESSARIA PER MOVIODDS</span><h2>The Odds API · V4</h2></div><span className="badge">{report?.status === 'connected' ? 'Catalogo ricevuto' : report?.status === 'error' ? 'Errore di connessione' : 'Da configurare / verificare'}</span></div><p>La chiave resta sul server. Il test interroga soltanto il catalogo sport, senza costo in crediti quota. Il risultato è riutilizzato per 60 secondi per istanza server.</p><button className="primary" disabled={busy || demo} onClick={check}>{busy ? 'Verifica in corso…' : 'Verifica connessione'}</button>{demo && <p className="fine">Accedi con un utente autorizzato per eseguire il test.</p>}{report && <div className="report" role="status"><p>{report.message}</p><dl><dt>Ultimo controllo</dt><dd>{new Date(report.checkedAt).toLocaleString('it-IT')}</dd><dt>Sport nel catalogo</dt><dd>{report.status === 'connected' ? report.sports.length : 'Non verificato'}</dd><dt>Tennistavolo</dt><dd>{report.status !== 'connected' ? 'Non verificato' : report.tableTennisKeys.join(', ') || 'Assente dal catalogo ricevuto'}</dd><dt>Crediti rimanenti</dt><dd>{report.quota?.remaining ?? 'Non comunicati'}</dd><dt>Bookmaker ADM / Live</dt><dd>Da verificare</dd></dl></div>}<CompetitionList report={report}/><p className="fine">Il catalogo pubblico non elenca il tennistavolo. Non si presume che il tennis sia equivalente.</p><a href="https://the-odds-api.com/liveapi/guides/v4/" target="_blank" rel="noreferrer">Documentazione ufficiale ↗</a></section></details>}
      {section === 'Partite e mercati' && <><FeedStatus {...feed} disabled={demo}/><Markets board={feed.board} now={feed.now} token={demo?undefined:session?.access_token}/></>}
      {section === 'Value Tracker' && <ValueTracker token={session?.access_token} demo={demo} onMarkets={()=>setSection('Partite e mercati')}/>}
      {section === 'Le mie scelte' && <PersonalChoices key={`${demo?'demo':session?.user.id}-${period}`} token={session?.access_token} demo={demo} period={period} onPeriod={setPeriod} onBet={openBet}/>}
      {section === 'Storico pronostici' && <PredictionHistory key={`${demo ? 'demo' : session?.user.id}-${period}`} token={session?.access_token} demo={demo} period={period} onPeriod={setPeriod} onBet={openBet}/>}
      {section === 'Statistiche modello' && <ModelStats token={session?.access_token} demo={demo} period={period} onPeriod={setPeriod}/>}
      {section === 'Smart Stake' && <SmartStake key={JSON.stringify(betPrefill??null)} token={session?.access_token} demo={demo} period={period} onPeriod={setPeriod} prefill={betPrefill}/>}
      <footer>Ping Pong Analytics <span>Quote estere · Stime soggette a verifica · Nessun rendimento garantito</span></footer>
    </main></div>;
}
function Brand() { return <div className="brand"><span className="brand-icon" aria-hidden="true">↗</span><div>PING PONG<small>ANALYTICS</small></div></div>; }
function CompetitionList({ report }: { report: ConnectionReport | null }) {
  return <ul className="competition-list">{COMPETITIONS.map(name => { const status = report?.competitions.find(c => c.name === name)?.status; return <li key={name}><span>{name}</span><small>{status === 'not_in_catalog' ? 'Assente dal catalogo' : status === 'catalog_match' ? 'Catalogo: quote da verificare' : 'Da verificare'}</small></li>; })}</ul>;
}
