import { lazy, Suspense, useEffect, useState, useRef, type FormEvent } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { FeedStatus, Markets } from './Markets';
import { useBoard } from './useBoard';
import type { HistoryPeriod } from './shared/history';
import { isFreshLive } from './shared/board';
import { GoogleSignIn } from './GoogleSignIn';
import type{BetPrefill}from'./shared/bets';
import type { IndividualSport } from './shared/individual-sports';
import { usePrivateAccess } from './usePrivateAccess';
import { cleanAuthCallbackUrl, googleCallbackError } from './shared/google-auth';

const BestOdds = lazy(() => import('./BestOdds').then(module => ({default:module.BestOdds})));
const IndividualOdds = lazy(() => import('./IndividualOdds').then(module => ({default:module.IndividualOdds})));
const MarketSimulator = lazy(() => import('./MarketSimulator').then(module => ({default:module.MarketSimulator})));
const PredictionHistory = lazy(() => import('./History').then(module => ({default:module.PredictionHistory})));
const PersonalChoices = lazy(() => import('./Choices').then(module => ({default:module.PersonalChoices})));
const ModelStats = lazy(() => import('./ModelStats').then(module => ({default:module.ModelStats})));
const SmartStake = lazy(() => import('./SmartStake').then(module => ({default:module.SmartStake})));
const ConnectionHealth = lazy(() => import('./ConnectionHealth').then(module => ({default:module.ConnectionHealth})));
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const auth = (() => {
  if (!url || !key) return null;
  try { return createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true } }); } catch { return null; }
})();
const primaryNavigation = [
  {section:'Partite e mercati', label:'Partite', icon:'≋'},
  {section:'Quote migliori', label:'Quote', icon:'↑'},
  {section:'Le mie scelte', label:'Scelte', icon:'☆'},
  {section:'Statistiche modello', label:'Studio', icon:'◷'},
] as const;
const toolsNavigation = ['Quote per sport','Storico pronostici','Simulatore mercati','Smart Stake','Dashboard','Collegamenti'] as const;

type Section = typeof primaryNavigation[number]['section'] | typeof toolsNavigation[number];

function Navigation({section,onNavigate}:{section:Section;onNavigate:(section:Section)=>void}) {
  const more=useRef<HTMLDetailsElement>(null);
  const moreButton=useRef<HTMLElement>(null);
  function navigate(next:Section) {
    if(more.current)more.current.open=false;
    onNavigate(next);
  }
  return <nav className="workspace-nav" aria-label="Navigazione principale">
    {primaryNavigation.map(item=><button key={item.section} className={section===item.section?'nav-item active':'nav-item'}
      aria-current={section===item.section?'page':undefined} onClick={()=>navigate(item.section)}>
      <span aria-hidden="true">{item.icon}</span>{item.label}
    </button>)}
    <details className="workspace-more" ref={more} onKeyDown={event=>{
      if(event.key==='Escape'&&more.current?.open){more.current.open=false;moreButton.current?.focus();}
    }}>
      <summary ref={moreButton} className={toolsNavigation.some(item=>item===section)?'nav-item active':'nav-item'}>
        <span aria-hidden="true">•••</span>Altro
      </summary>
      <div className="workspace-more-links" role="group" aria-label="Altre sezioni">
        {toolsNavigation.map(name=><button key={name} className={name===section?'nav-item active':'nav-item'}
          aria-current={name===section?'page':undefined} onClick={()=>navigate(name)}>{name}</button>)}
      </div>
    </details>
  </nav>;
}
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [section, setSection] = useState<Section>('Partite e mercati');
  const [oddsSport,setOddsSport]=useState<IndividualSport>('tennis');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState(() => googleCallbackError(window.location.search, window.location.hash) ?? '');
  const [busy, setBusy] = useState(false);
  const pageHeading=useRef<HTMLHeadingElement>(null);
  function navigate(next:Section) {
    setSection(next);setNotice('');
    window.scrollTo(0,0);
    requestAnimationFrame(()=>pageHeading.current?.focus({preventScroll:true}));
  }
  const[betPrefill,setBetPrefill]=useState<BetPrefill|undefined>();
  function openBet(p:BetPrefill){setBetPrefill(p);navigate('Smart Stake');}
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
  if (!session) return <main className="login-shell login-simple">
    <section className="intro"><Brand/></section>
    <section className="login-card"><h1>Accedi</h1><p>L’accesso è riservato agli utenti invitati.</p>
      {!auth && <div className="banner">Configurazione iniziale richiesta: Supabase Auth non è ancora collegato. Nessun dato privato è disponibile.</div>}
      <GoogleSignIn auth={auth} url={url} publicKey={key} busy={busy} onBusy={setBusy} onNotice={setNotice}/>
      <form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={!auth}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={!auth}/></label><button className="primary" disabled={busy || !auth}>{busy ? 'Accesso in corso…' : 'Accedi →'}</button></form>
      {notice&&<p role="status">{notice}</p>}
    </section></main>;
  if (session && access.status !== 'allowed') return <main className="login-shell access-shell"><section className="intro"><Brand/><h1>Il tuo spazio<br/><em>resta privato.</em></h1></section><section className="login-card"><span className="eyebrow">VERIFICA ACCESSO</span><h2>{access.status === 'checking' ? 'Verifica del tuo account…' : access.status === 'denied' ? 'Account non abilitato' : 'Verifica non disponibile'}</h2><p role="status">{access.status === 'checking' ? 'Attendi la verifica dell’accesso privato.' : access.status === 'denied' ? 'La registrazione o l’accesso Google non concedono automaticamente l’accesso ai dati. Usa l’account autorizzato dal proprietario.' : 'Non possiamo verificare l’abilitazione in questo momento. Nessun dato privato è stato caricato.'}</p>{access.status !== 'checking' && <button className="primary" onClick={access.retry}>Riprova verifica</button>}<button className="text-button" onClick={async () => { await auth?.auth.signOut(); setSession(null); setNotice(''); }}>Esci o usa un altro account →</button></section></main>;
  return <div className="app-shell"><aside><Brand/><Navigation section={section} onNavigate={navigate}/></aside>
    <main className="workspace-main"><header className="workspace-header"><h1 ref={pageHeading} tabIndex={-1}>{section}</h1>
      <button className="text-button workspace-logout" onClick={async () => { await auth?.auth.signOut(); setNotice(''); }}>Esci</button></header>
      {notice && <p className="error" role="alert">{notice}</p>}
      {section === 'Dashboard' && <><section className="hero-panel"><div><span className="eyebrow">PRIMA LA QUALITÀ DEL DATO</span><h2>Ogni opportunità<br/>parte da una verifica.</h2><p>Apri una partita per confrontare i giocatori e verificare se il modello può registrare un pronostico.</p><button className="primary" onClick={() => navigate('Partite e mercati')}>Esplora partite e quote ↗</button></div><div className="hero-mark" aria-hidden="true">◎<span>ANALYTICS</span></div></section><FeedStatus {...feed} disabled={false}/><div className="metrics">{[
        ['Partite nel feed', feed.board ? String(feed.board.matches.length) : '—'],
        ['Campionati nel feed', feed.board ? String(new Set(feed.board.matches.map(m => m.league)).size) : '—'],
        ['Voci quota ricevute', feed.board ? String(feed.board.matches.reduce((n, m) => n + m.quotes.length, 0)) : '—'],
        ['Partite LIVE aggiornate', feed.board ? String(feed.board.matches.filter(m => isFreshLive(m, feed.now)).length) : '—'],
      ].map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>Fonte MoviOdds · bet365.com.au</small></article>)}</div><div className="two-columns"><section className="panel"><h2>Competizioni monitorate</h2><p>Campionati presenti nella risposta MoviOdds, aggiornati con il feed.</p>{feed.board ? <ul className="competition-list">{[...new Set(feed.board.matches.map(m => m.league))].sort().map(name => <li key={name}><span>{name}</span><small>{feed.board!.matches.filter(m => m.league === name).length} partite</small></li>)}</ul> : <p>Catalogo in attesa di caricamento.</p>}</section><section className="panel"><span className="eyebrow">MODELLO STATISTICO</span><h2>Trasparente, fin dall’inizio.</h2><div className="empty-symbol">↗</div><h3>Un controllo per ogni partita</h3><p>Storico dei giocatori, campione e validazione temporale determinano se un pronostico può essere registrato. In caso contrario compare “Dati insufficienti”.</p><button className="text-button" onClick={() => navigate('Statistiche modello')}>Stato della validazione →</button></section></div></>}
      {section === 'Partite e mercati' && <><FeedStatus {...feed} compact/><Markets board={feed.board} now={feed.now} token={session.access_token} refreshBoard={feed.refresh} boardLoading={feed.loading}/></>}
      <Suspense fallback={<p role="status">Caricamento…</p>}>
      {section === 'Collegamenti' && <><FeedStatus {...feed} disabled={false}/><ConnectionHealth token={session?.access_token} demo={false}/></>}
      {section === 'Quote per sport' && <IndividualOdds token={session.access_token} sport={oddsSport} onSelect={setOddsSport} onTableTennis={()=>navigate('Partite e mercati')}/>}
      {section === 'Quote migliori' && <BestOdds token={session.access_token} onMarkets={()=>navigate('Partite e mercati')} onSportPrices={sport=>{setOddsSport(sport);navigate('Quote per sport');}}/>}
      {section === 'Simulatore mercati' && <MarketSimulator/>}
      {section === 'Le mie scelte' && <PersonalChoices key={`${session.user.id}-${period}`} token={session?.access_token} demo={false} period={period} onPeriod={setPeriod} onBet={openBet}/>}
      {section === 'Storico pronostici' && <PredictionHistory key={`${session.user.id}-${period}`} token={session?.access_token} demo={false} period={period} onPeriod={setPeriod} onBet={openBet}/>}
      {section === 'Statistiche modello' && <ModelStats token={session?.access_token} demo={false} period={period} onPeriod={setPeriod}/>}
      {section === 'Smart Stake' && <SmartStake key={JSON.stringify(betPrefill??null)} token={session?.access_token} demo={false} period={period} onPeriod={setPeriod} prefill={betPrefill}/>}
      </Suspense>
    </main></div>;
}
function Brand() { return <div className="brand"><span className="brand-icon" aria-hidden="true">↗</span><div>PING PONG<small>ANALYTICS</small></div></div>; }
