import { useEffect, useState, useRef, type FormEvent } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { FeedStatus, Markets } from './Markets';
import { MarketSimulator } from './MarketSimulator';
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
const sections = ['Dashboard', 'Partite e mercati', 'Value Tracker', 'Simulatore mercati', 'Statistiche modello', 'Storico pronostici', 'Le mie scelte', 'Smart Stake', 'Collegamenti'] as const;
type Section = typeof sections[number];
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [section, setSection] = useState<Section>('Partite e mercati');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState(() => googleCallbackError(window.location.search, window.location.hash) ?? '');
  const [busy, setBusy] = useState(false);
  const[betPrefill,setBetPrefill]=useState<BetPrefill|undefined>();
  function openBet(p:BetPrefill){setBetPrefill(p);setSection('Smart Stake');}
  const [period, setPeriod] = useState<HistoryPeriod>('30');
  const account=useRef<string|null>(null);
  const access = usePrivateAccess(session?.access_token, !!session);
  const feed = useBoard(session?.access_token, !!session && access.status === 'allowed' && ['Dashboard','Partite e mercati','Collegamenti'].includes(section));
  useEffect(() => {
    if (!auth) return;
    let active = true;
    auth.auth.getSession().then(({ data, error }) => { if (active) { setSession(data.session); if (error) setNotice('Accesso o ripristino della sessione non riuscito. Riprova.'); } }).catch(() => { if (active) setNotice('Sessione non disponibile. Accedi nuovamente.'); }).finally(() => { window.history.replaceState(window.history.state, '', cleanAuthCallbackUrl(window.location.href)); });
    const { data } = auth.auth.onAuthStateChange((_event, value) => {
      if (active) { if(account.current!==value?.user.id){setBetPrefill(undefined);setSection('Partite e mercati');account.current=value?.user.id??null;} setSession(value); }
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
  if (!session) return <main className="login-shell">
    <section className="intro"><Brand/><span className="eyebrow">IL TUO OSSERVATORIO PRIVATO</span><h1>Il gioco cambia.<br/><em>I dati contano.</em></h1><p>Quote verificabili, confronti rigorosi e analisi trasparenti. Un unico spazio dedicato al tennistavolo.</p><div className="court" aria-hidden="true"><span>01</span><i/><b>↗</b></div><p className="fine">Nessuna scommessa automatica. Nessuna promessa di rendimento.</p></section>
    <section className="login-card"><span className="eyebrow">PING PONG ANALYTICS · V0.1</span><h2>Accedi al tuo spazio</h2><p>L’accesso è riservato agli utenti invitati.</p>
      {!auth && <div className="banner">Configurazione iniziale richiesta: Supabase Auth non è ancora collegato. Nessun dato privato è disponibile.</div>}
      <GoogleSignIn auth={auth} url={url} publicKey={key} busy={busy} onBusy={setBusy} onNotice={setNotice}/>
      <form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={!auth}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={!auth}/></label><button className="primary" disabled={busy || !auth}>{busy ? 'Accesso in corso…' : 'Accedi →'}</button></form>
      <p role="status">{notice}</p><p className="fine">Dopo l’accesso gli eventi reali vengono caricati automaticamente.</p>
    </section></main>;
  if (session && access.status !== 'allowed') return <main className="login-shell access-shell"><section className="intro"><Brand/><h1>Il tuo spazio<br/><em>resta privato.</em></h1></section><section className="login-card"><span className="eyebrow">VERIFICA ACCESSO</span><h2>{access.status === 'checking' ? 'Verifica del tuo account…' : access.status === 'denied' ? 'Account non abilitato' : 'Verifica non disponibile'}</h2><p role="status">{access.status === 'checking' ? 'Attendi la verifica dell’accesso privato.' : access.status === 'denied' ? 'La registrazione o l’accesso Google non concedono automaticamente l’accesso ai dati. Usa l’account autorizzato dal proprietario.' : 'Non possiamo verificare l’abilitazione in questo momento. Nessun dato privato è stato caricato.'}</p>{access.status !== 'checking' && <button className="primary" onClick={access.retry}>Riprova verifica</button>}<button className="text-button" onClick={async () => { await auth?.auth.signOut(); setSession(null); setNotice(''); }}>Esci o usa un altro account →</button></section></main>;
  return <div className="app-shell"><aside><Brand/><span className="eyebrow workspace">WORKSPACE PRIVATO</span><nav aria-label="Navigazione principale">{sections.map((name, i) => <button key={name} className={section === name ? 'nav-item active' : 'nav-item'} onClick={() => { setSection(name); setNotice(''); }}><span aria-hidden="true">{['◫','≋','↗','◇','◷','▤','☆','◎','⚙'][i]}</span>{name}</button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/> Sessione autenticata<small>Pronostici soggetti a verifica</small><button className="text-button" onClick={async () => { if (session) await auth?.auth.signOut(); setNotice(''); }}>Esci dallo spazio ↗</button></div></aside>
    <main className="workspace-main"><header><div><span className="eyebrow">ANALISI / {section.toUpperCase()}</span><h1>{section}</h1></div><div className="header-actions"><span className="badge">DATI REALI</span><button className="text-button" onClick={async () => { if (session) await auth?.auth.signOut(); setNotice(''); }}>Esci ↗</button></div></header>
      {!['Partite e mercati','Value Tracker','Simulatore mercati'].includes(section)&&<div className="banner">MoviOdds · Quote bet365 estere. Solo live confermati e partite da iniziare. Pronostici soggetti a dati e validazione; scelte personali separate.</div>}
      {notice && <p className="error" role="alert">{notice}</p>}
      {section === 'Dashboard' && <><section className="hero-panel"><div><span className="eyebrow">PRIMA LA QUALITÀ DEL DATO</span><h2>Ogni opportunità<br/>parte da una verifica.</h2><p>Apri una partita per confrontare i giocatori e verificare se il modello può registrare un pronostico.</p><button className="primary" onClick={() => setSection('Partite e mercati')}>Esplora partite e quote ↗</button></div><div className="hero-mark" aria-hidden="true">◎<span>ANALYTICS</span></div></section><FeedStatus {...feed} disabled={false}/><div className="metrics">{[
        ['Partite nel feed', feed.board ? String(feed.board.matches.length) : '—'],
        ['Campionati nel feed', feed.board ? String(new Set(feed.board.matches.map(m => m.league)).size) : '—'],
        ['Voci quota ricevute', feed.board ? String(feed.board.matches.reduce((n, m) => n + m.quotes.length, 0)) : '—'],
        ['Partite LIVE aggiornate', feed.board ? String(feed.board.matches.filter(m => isFreshLive(m, feed.now)).length) : '—'],
      ].map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>Fonte MoviOdds · bet365.com.au</small></article>)}</div><div className="two-columns"><section className="panel"><h2>Competizioni monitorate</h2><p>Campionati presenti nella risposta MoviOdds, aggiornati con il feed.</p>{feed.board ? <ul className="competition-list">{[...new Set(feed.board.matches.map(m => m.league))].sort().map(name => <li key={name}><span>{name}</span><small>{feed.board!.matches.filter(m => m.league === name).length} partite</small></li>)}</ul> : <p>Catalogo in attesa di caricamento.</p>}</section><section className="panel"><span className="eyebrow">MODELLO STATISTICO</span><h2>Trasparente, fin dall’inizio.</h2><div className="empty-symbol">↗</div><h3>Un controllo per ogni partita</h3><p>Storico dei giocatori, campione e validazione temporale determinano se un pronostico può essere registrato. In caso contrario compare “Dati insufficienti”.</p><button className="text-button" onClick={() => setSection('Statistiche modello')}>Stato della validazione →</button></section></div></>}
      {section === 'Collegamenti' && <><FeedStatus {...feed} disabled={false}/><ConnectionHealth token={session?.access_token} demo={false}/></>}
      {section === 'Partite e mercati' && <><FeedStatus {...feed} compact/><Markets board={feed.board} now={feed.now} token={session.access_token} refreshBoard={feed.refresh} boardLoading={feed.loading}/></>}
      {section === 'Value Tracker' && <ValueTracker token={session?.access_token} demo={false} onMarkets={()=>setSection('Partite e mercati')}/>}
      {section === 'Simulatore mercati' && <MarketSimulator/>}
      {section === 'Le mie scelte' && <PersonalChoices key={`${session.user.id}-${period}`} token={session?.access_token} demo={false} period={period} onPeriod={setPeriod} onBet={openBet}/>}
      {section === 'Storico pronostici' && <PredictionHistory key={`${session.user.id}-${period}`} token={session?.access_token} demo={false} period={period} onPeriod={setPeriod} onBet={openBet}/>}
      {section === 'Statistiche modello' && <ModelStats token={session?.access_token} demo={false} period={period} onPeriod={setPeriod}/>}
      {section === 'Smart Stake' && <SmartStake key={JSON.stringify(betPrefill??null)} token={session?.access_token} demo={false} period={period} onPeriod={setPeriod} prefill={betPrefill}/>}
      <footer>Ping Pong Analytics <span>Quote estere · Stime soggette a verifica · Nessun rendimento garantito</span></footer>
    </main></div>;
}
function Brand() { return <div className="brand"><span className="brand-icon" aria-hidden="true">↗</span><div>PING PONG<small>ANALYTICS</small></div></div>; }
