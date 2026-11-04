import { useEffect, useState, type FormEvent } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { COMPETITIONS, type ConnectionReport } from './shared/contracts';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const auth = (() => {
  if (!url || !key) return null;
  try { return createClient(url, key); } catch { return null; }
})();
const sections = ['Dashboard', 'Partite e mercati', 'Value Tracker', 'Statistiche modello', 'Storico pronostici', 'Smart Stake', 'Collegamenti'] as const;
type Section = typeof sections[number];
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [section, setSection] = useState<Section>('Dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [period, setPeriod] = useState('30');
  const [minOdds, setMinOdds] = useState('1.30');
  useEffect(() => {
    if (!auth) return;
    let active = true;
    auth.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data } = auth.auth.onAuthStateChange((_event, value) => {
      if (active) { setSession(value); setReport(null); }
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
      <form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={!auth}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={!auth}/></label><button className="primary" disabled={busy || !auth}>{busy ? 'Accesso in corso…' : 'Accedi →'}</button></form>
      <p role="status">{notice}</p><button className="text-button" onClick={() => { setDemo(true); setNotice(''); }}>Esplora l’anteprima senza dati →</button><p className="fine">L’anteprima non accede alle API e non contiene quote o previsioni.</p>
    </section></main>;
  return <div className="app-shell"><aside><Brand/><span className="eyebrow workspace">WORKSPACE PRIVATO</span><nav aria-label="Navigazione principale">{sections.map((name, i) => <button key={name} className={section === name ? 'nav-item active' : 'nav-item'} onClick={() => { setSection(name); setNotice(''); }}><span aria-hidden="true">{['◫','≋','↗','◷','▤','◎','⚙'][i]}</span>{name}</button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/> {demo ? 'Anteprima' : 'Sessione autenticata'}<small>Modello operativo non attivo</small><button className="text-button" onClick={async () => { if (session) await auth?.auth.signOut(); setDemo(false); setReport(null); setNotice(''); }}>Esci dallo spazio ↗</button></div></aside>
    <main className="workspace-main"><header><div><span className="eyebrow">ANALISI / {section.toUpperCase()}</span><h1>{section}</h1></div><div className="header-actions"><span className="badge">{demo ? 'DEMO · SENZA DATI' : 'MODALITÀ REALE'}</span><button className="text-button" onClick={async () => { if (session) await auth?.auth.signOut(); setDemo(false); setReport(null); setNotice(''); }}>Esci ↗</button></div></header>
      <div className="banner">{demo ? 'Anteprima dell’interfaccia. Nessuna chiamata API, quota o statistica simulata.' : 'Fase 1 · Prima di operare servono copertura tennistavolo, verifica ADM e storico validato.'}</div>
      {notice && <p className="error" role="alert">{notice}</p>}
      {section === 'Dashboard' && <><section className="hero-panel"><div><span className="eyebrow">PRIMA LA QUALITÀ DEL DATO</span><h2>Ogni opportunità<br/>parte da una verifica.</h2><p>Il motore resta in attesa finché dati e copertura non sono confermati.</p><button className="primary" onClick={() => setSection('Collegamenti')}>Controlla i collegamenti ↗</button></div><div className="hero-mark" aria-hidden="true">◎<span>ANALYTICS</span></div></section><div className="metrics">{['Partite disponibili', 'Opportunità valide', 'EV stimato', 'Qualità dei dati'].map(label => <article className="metric" key={label}><span>{label}</span><strong>—</strong><small>In attesa di dati verificati</small></article>)}</div><div className="two-columns"><section className="panel"><h2>Competizioni monitorate</h2><p>La copertura non è ancora confermata.</p><CompetitionList report={report}/></section><section className="panel"><span className="eyebrow">MODELLO STATISTICO</span><h2>Trasparente, fin dall’inizio.</h2><div className="empty-symbol">↗</div><h3>Dati insufficienti</h3><p>Nessuna previsione operativa. Il modello richiede risultati verificabili e validazione temporale fuori campione.</p><button className="text-button" onClick={() => setSection('Statistiche modello')}>Stato della validazione →</button></section></div></>}
      {section === 'Collegamenti' && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">FORNITORE CONFERMATO</span><h2>The Odds API · V4</h2></div><span className="badge">{report?.status === 'connected' ? 'Catalogo ricevuto' : report?.status === 'error' ? 'Errore di connessione' : 'Da configurare / verificare'}</span></div><p>La chiave resta sul server. Il test interroga soltanto il catalogo sport, senza costo in crediti quota. Il risultato è riutilizzato per 60 secondi per istanza server.</p><button className="primary" disabled={busy || demo} onClick={check}>{busy ? 'Verifica in corso…' : 'Verifica connessione'}</button>{demo && <p className="fine">Accedi con un utente autorizzato per eseguire il test.</p>}{report && <div className="report" role="status"><p>{report.message}</p><dl><dt>Ultimo controllo</dt><dd>{new Date(report.checkedAt).toLocaleString('it-IT')}</dd><dt>Sport nel catalogo</dt><dd>{report.status === 'connected' ? report.sports.length : 'Non verificato'}</dd><dt>Tennistavolo</dt><dd>{report.status !== 'connected' ? 'Non verificato' : report.tableTennisKeys.join(', ') || 'Assente dal catalogo ricevuto'}</dd><dt>Crediti rimanenti</dt><dd>{report.quota?.remaining ?? 'Non comunicati'}</dd><dt>Bookmaker ADM / Live</dt><dd>Da verificare</dd></dl></div>}<CompetitionList report={report}/><p className="fine">Il catalogo pubblico non elenca il tennistavolo. Non si presume che il tennis sia equivalente.</p><a href="https://the-odds-api.com/liveapi/guides/v4/" target="_blank" rel="noreferrer">Documentazione ufficiale ↗</a></section>}
      {section === 'Partite e mercati' && <section className="panel"><h2>Esplora le partite</h2><div className="filters"><label>Giocatore<input placeholder="Cerca per nome" type="search"/></label><label>Competizione<select><option>Tutte le competizioni</option>{COMPETITIONS.map(c => <option key={c}>{c}</option>)}</select></label><label>Stato<select><option>Prematch</option><option>Live verificato</option></select></label><label>Mercato<select>{['Tutti i mercati','Vincente partita','Over/Under set','Over/Under punti','Handicap set','Handicap punti','Vincente set','Risultato esatto'].map(m => <option key={m}>{m}</option>)}</select></label><label>Quota minima<input type="number" min="1.01" step="0.01" value={minOdds} onChange={e => setMinOdds(e.target.value)}/></label></div><Empty title="Nessuna partita caricata" text="Il recupero eventi e il confronto quote saranno attivati dopo la verifica del catalogo. Questi filtri non interrogano ancora il fornitore."/></section>}
      {section === 'Value Tracker' && <section className="panel"><h2>Opportunità con dati verificati</h2><Empty title="Nessuna opportunità operativa" text="Servono probabilità calibrate fuori campione, quote recenti e bookmaker ADM verificati. L’EV non viene stimato senza questi requisiti."/><p className="formula">EV = probabilità stimata × quota − 1</p><p className="fine">Quota minima iniziale 1,30 · Nessun limite massimo · Preferenza non vincolante intorno a 2,00.</p></section>}
      {(section === 'Statistiche modello' || section === 'Storico pronostici') && <section className="panel"><div className="panel-heading"><h2>{section === 'Statistiche modello' ? 'Validazione temporale' : 'Previsioni registrate'}</h2><label>Intervallo<select value={period} onChange={e => setPeriod(e.target.value)}>{['5','10','15','30','all'].map(v => <option key={v} value={v}>{v === 'all' ? 'Storico completo' : `Ultimi ${v} giorni`}</option>)}</select></label></div><Empty title="Dati insufficienti" text={section === 'Statistiche modello' ? 'Nessun modello addestrato o validato. Brier Score, Log Loss, calibrazione e profitto teorico non disponibili.' : 'Non sono ancora state registrate previsioni o puntate manuali. Le due categorie saranno mantenute separate.'}/></section>}
      {section === 'Smart Stake' && <section className="panel"><span className="badge">DISATTIVATO</span><h2>Bankroll sotto controllo</h2><Empty title="Modulo non operativo" text="Il calcolo richiede un modello validato e una stima prudente dell’incertezza. La funzione Kelly frazionaria è predisposta e testata, ma non produce indicazioni operative in questa fase."/><p>Limite massimo previsto: 2% del bankroll. Nessun recupero automatico delle perdite e nessuna esecuzione di scommesse.</p></section>}
      <footer>Ping Pong Analytics <span>Fase 1 · Nessuna previsione validata · Nessun rendimento garantito</span></footer>
    </main></div>;
}
function Brand() { return <div className="brand"><span className="brand-icon" aria-hidden="true">↗</span><div>PING PONG<small>ANALYTICS</small></div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><div className="empty-symbol" aria-hidden="true">◎</div><h3>{title}</h3><p>{text}</p></div>; }
function CompetitionList({ report }: { report: ConnectionReport | null }) {
  return <ul className="competition-list">{COMPETITIONS.map(name => { const status = report?.competitions.find(c => c.name === name)?.status; return <li key={name}><span>{name}</span><small>{status === 'not_in_catalog' ? 'Assente dal catalogo' : status === 'catalog_match' ? 'Catalogo: quote da verificare' : 'Da verificare'}</small></li>; })}</ul>;
}
