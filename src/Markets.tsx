import{PredictionRankings}from'./PredictionRankings';
import { useMemo, useRef, useState } from 'react';
import { isFreshLive, isUpcomingOrLive, startsInNextTwoHours, matchesStartWindow, type StartWindow, type Board, type FeedMatch } from './shared/board';
import { SaveChoice } from './Choices';
import { dateTime,positiveEvText } from './shared/format';
import { PlayerAnalysis } from './PlayerAnalysis';
import { AdditionalMarkets } from './AdditionalMarkets';
import { QuoteComparison } from './QuoteComparison';
import { filterBookmakerMarkets, otherBookmakerMarkets, type BookmakerMarkets, type BookmakerMarketFilter } from './shared/additional-markets';

export function FeedStatus({ board, loading, error, refresh,disabled=false,compact=false }: {compact?:boolean;disabled?:boolean; board: Board | null; loading: boolean; error: string; refresh: () => void }) {
  if(compact)return <section className="feed-compact" aria-label="Stato fonte quote"><span><strong>MoviOdds · bet365.com.au</strong><small>{board?`${board.matches.length} eventi · fonte ${dateTime(board.serverTime)}`:loading?'Recupero eventi…':'Feed non disponibile'}</small></span><span className="badge" aria-label="Aggiornamento automatico ogni 30 secondi">30 s</span>{error&&<p role="alert" className="error">{error}</p>}</section>;
  return <section className="panel feed-status"><div className="panel-heading"><div><span className="eyebrow">FONTE GRATUITA · SENZA CHIAVE</span><h2>MoviOdds · bet365 estero</h2></div><button className="primary" disabled={loading||disabled} onClick={refresh}>{loading ? 'Aggiornamento…' : 'Aggiorna quote'}</button></div>
    <p>Quote di bet365.com.au tramite MoviOdds, progetto indipendente. Statistiche e stime sperimentali sono consultabili nei dettagli delle partite.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {board ? <p role="status">{board.matches.length} partite nel feed · {new Set(board.matches.map(m => m.league)).size} campionati · Fonte: {dateTime(board.serverTime)} · {board.warming ? 'Caricamento iniziale del fornitore' : 'Aggiornamento ogni 30 secondi a pagina visibile'}</p> : !error && <p role="status">{loading ? 'Recupero delle quote reali…' : 'Accedi per caricare il feed.'}</p>}
    <p className="fine">Mostriamo solo live confermati e partite con inizio futuro. Eventi oltre orario senza conferma live sono esclusi; le quote possono essere sospese. <a href="https://moviodds.com/bet365-table-tennis-odds-api/" target="_blank" rel="noreferrer">Fonte e documentazione ↗</a></p>
  </section>;
}


import { useValue } from './useValue';
import { selectedQuotes,keepOpenMatch,openQuote,hasPositiveValue,bookmakerWinnerPrices,matchModelAssessment,nearOneFifty,oddsInRange,type OpenMatch } from './shared/quote-selection';
import type { ValueOpportunity } from './domain/value';
import { RecordPrediction } from './RecordPrediction';

type Props = { board: Board | null; now: number; token?: string; refreshBoard: () => Promise<void>; boardLoading: boolean; tracker?: boolean };
export function Markets({ board, now, token, refreshBoard, boardLoading, tracker = false }: Props) {
  const values = useValue(token);
  const [modelChoice,setModelChoice]=useState<'study'|'ensemble'>('study');
  const selectionReport=modelChoice==='ensemble'?(values.report?.ensemble?{...values.report,...values.report.ensemble,rankings:undefined}:null):values.report;
  const [search, setSearch] = useState(''), [selectedCompetitions,setSelectedCompetitions] = useState<string[]>([]);
  const [state, setState] = useState(''), [mode, setMode] = useState<'value' | 'events' | 'markets'>(tracker ? 'value' : 'events');
  const [chosenWindow,setChosenWindow] = useState<StartWindow|null>(null);
  const [showCustomWindow,setShowCustomWindow] = useState(false);
  const [fromText,setFromText] = useState(''), [untilText,setUntilText] = useState('');
  const [timeError,setTimeError] = useState('');
  const activeWindow: StartWindow = chosenWindow ?? {kind:mode==='value'||tracker ? 'soon' : 'all'};
  const custom = activeWindow.kind==='custom' ? activeWindow : null;
  const windowKind = activeWindow.kind;
  const soon = windowKind==='soon';
  const from = custom?.from ?? -Infinity, until = custom?.until ?? Infinity;
  const [marketFilter,setMarketFilter] = useState<BookmakerMarketFilter>('all');
  const [nearOdds,setNearOdds] = useState(false);
  const [minOdds, setMinOdds] = useState('1.30'), [limit, setLimit] = useState(12);
  const [shown, setShown] = useState(true), [opened, setOpened] = useState<OpenMatch | null>(null);
  const openEvent=opened?.match.id??null;
  const [manualBusy, setManualBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), bestHeading = useRef<HTMLHeadingElement>(null), cards = useRef<HTMLDivElement>(null);
  const busy = boardLoading || values.loading || manualBusy;
  const minimum = nearOdds ? nearOneFifty.minimum : Number(minOdds) || 1.3;
  const maximum = nearOdds ? nearOneFifty.maximum : Infinity;
  const eligible = useMemo(() => selectedQuotes(selectionReport, board?.matches ?? [], now, minimum, maximum), [selectionReport, board, now, minimum, maximum]);
  const winnerPricesInRange = useMemo(()=>{
    const byMatch = new Map<string,ReturnType<typeof bookmakerWinnerPrices>>();
    if (nearOdds) for (const match of board?.matches ?? []) {
      const prices = bookmakerWinnerPrices(match,now).filter(quote=>oddsInRange(quote.odds_dec,minimum,maximum));
      if (prices.length) byMatch.set(match.id,prices);
    }
    return byMatch;
  },[board,now,nearOdds,minimum,maximum]);
  const upcomingMatches = board?.matches.filter(m=>startsInNextTwoHours(m,now)) ?? [];
  const upcomingCount = upcomingMatches.length;
  const marketsByEvent = useMemo(()=>{
    const groups = new Map<string,BookmakerMarkets>();
    for (const match of board?.matches ?? []) {
      const available = otherBookmakerMarkets(match,now);
      if (available.length) groups.set(match.id,available);
    }
    return groups;
  },[board,now]);
  const filteredMarkets = useMemo(()=>{
    if (!nearOdds && (mode !== 'markets' || marketFilter === 'all')) return marketsByEvent;
    const filtered = new Map<string,BookmakerMarkets>();
    for (const [id,groups] of marketsByEvent) {
      const categories = mode==='markets' ? filterBookmakerMarkets(groups,marketFilter) : groups;
      const subset = nearOdds ? categories.flatMap(group=>{
        const quotes = group.quotes.filter(quote=>oddsInRange(quote.odds_dec,minimum,maximum));
        return quotes.length ? [{...group,quotes}] : [];
      }) : categories;
      if (subset.length) filtered.set(id,subset);
    }
    return filtered;
  },[marketFilter,marketsByEvent,mode,nearOdds,minimum,maximum]);
  const matchingEvents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('it');
    const enabledCompetitions = new Set(selectedCompetitions);
    const startWindow:StartWindow = windowKind==='custom' ? {kind:'custom',from,until} : {kind:windowKind};
    return (board?.matches ?? []).filter(m => (enabledCompetitions.size===0 || enabledCompetitions.has(m.league))
      && (!term || `${m.home} ${m.away} ${m.league} ${m.id}`.toLocaleLowerCase('it').includes(term))
      && (!state || (state === 'live' ? m.in_play : !m.in_play))
      && matchesStartWindow(m,startWindow,now));
  }, [board,now,selectedCompetitions,search,state,windowKind,from,until]);
  const visibleEvents = new Map(matchingEvents.map(match=>[match.id,match]));
  const opportunities = eligible.filter(quote=>visibleEvents.has(quote.eventId));
  const byEvent = new Map(opportunities.map(quote=>[quote.eventId,quote]));
  const rankedMatches = mode==='value'||tracker ? opportunities.map(quote=>visibleEvents.get(quote.eventId)!)
    : matchingEvents.filter(match=>mode==='markets' ? filteredMarkets.has(match.id)
      : !nearOdds||winnerPricesInRange.has(match.id)||filteredMarkets.has(match.id))
      .sort((a,b)=>Number(b.in_play)-Number(a.in_play)||Date.parse(a.kickoff_utc??'')-Date.parse(b.kickoff_utc??'')||a.id.localeCompare(b.id));
  const matches=keepOpenMatch(rankedMatches,opened,board?.matches??[]);
  const currentOpen=board?.matches.find(m=>m.id===openEvent);
  const refreshedQuote=openQuote(selectionReport,currentOpen,opened?.selection??(openEvent ? byEvent.get(openEvent)?.selection ?? null : null),now);
  const inspectedQuote=refreshedQuote && oddsInRange(refreshedQuote.odds,minimum,maximum) ? refreshedQuote : undefined;
  const competitions = [...new Set([...(board?.matches.map(m=>m.league) ?? []),...selectedCompetitions])].sort((a,b)=>a.localeCompare(b,'it'));
  const visibleMatches = mode==='events' ? matches : matches.slice(0,limit);
  const boardIds = new Set(board?.matches.map(match=>match.id));
  const rankedIds = new Set(rankedMatches.map(match=>match.id));
  const windowLabel = soon ? 'Prossime 2 ore' : custom ? 'Intervallo personalizzato' : 'Tutti gli orari';
  function changed() { setLimit(12); setShown(true); }
  function showMode(next: typeof mode, forcedWindow?:StartWindow) {
    if (next!==mode) { setMode(next);setOpened(null); }
    if (forcedWindow) changeTimeWindow(forcedWindow);
    else changed();
  }
  function changeTimeWindow(next: StartWindow) {
    if (next.kind!=='all' && state==='live') setState('');
    setChosenWindow(next);setShowCustomWindow(next.kind==='custom');setTimeError('');setOpened(null);changed();
  }
  function applyTimeWindow() {
    const start = fromText ? Date.parse(fromText) : -Infinity;
    const end = untilText ? Date.parse(untilText) : Infinity;
    if ((!fromText&&!untilText) || Number.isNaN(start) || Number.isNaN(end) || start>end) {
      setTimeError('Imposta una data di inizio o fine valida. La fine deve seguire l’inizio.');
      return;
    }
    changeTimeWindow({kind:'custom',from:start,until:end});
  }
  function toggleCompetition(league:string) {
    setSelectedCompetitions(previous=>previous.includes(league) ? previous.filter(name=>name!==league) : [...previous,league]);
    setOpened(null);changed();
  }
  function resetMarketFilters() {
    setSearch('');setSelectedCompetitions([]);setState('');setMarketFilter('all');setNearOdds(false);
    setFromText('');setUntilText('');changeTimeWindow({kind:'all'});
  }
  function closeList() { setShown(false); setOpened(null); heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  function closeEvent() {
    const summary = cards.current?.querySelector<HTMLDetailsElement>('details.match-card[open]')?.querySelector('summary');
    setOpened(null); summary?.focus({ preventScroll: true }); summary?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function openOpportunity(quote: ValueOpportunity) {
    const match=visibleEvents.get(quote.eventId);
    const index=opportunities.findIndex(row=>row.id===quote.id);
    if (!match||index<0) return;
    setMode('value');setChosenWindow(activeWindow);setShown(true);setLimit(Math.max(12,index+1));
    setOpened({match,index,selection:quote.selection});
    requestAnimationFrame(()=>{
      const summary=cards.current?.querySelector<HTMLElement>('details.match-card[open] > summary');
      summary?.focus({preventScroll:true});summary?.scrollIntoView({block:'start'});
    });
  }
  function showBestQuotes() {
    bestHeading.current?.focus({preventScroll:true});
    bestHeading.current?.scrollIntoView({block:'start'});
  }
  async function refresh() {
    if (busy) return;
    setManualBusy(true);
    try { await Promise.all([refreshBoard(), values.refresh()]); } finally { setManualBusy(false); }
  }
  return <><section className="panel quote-workspace">
    <span className="eyebrow">SELEZIONE STATISTICA</span>
    <h2 ref={heading} tabIndex={-1}>Quote selezionate</h2>
    <section className="best-quotes" aria-labelledby="best-quotes-heading">
      <h3 id="best-quotes-heading" ref={bestHeading} tabIndex={-1}>Quote migliori</h3>
      <p className="fine">Vincente prematch · {windowLabel} · EV prudente positivo</p>
      {opportunities.length ? <ul className="best-quotes-list">{opportunities.slice(0,3).map(quote=>
        <li key={quote.id}><button className="secondary best-quote" onClick={()=>openOpportunity(quote)}>
          <span><strong>{quote.selection}</strong><small>{quote.match} · {dateTime(quote.startsAt)}</small></span>
          <span><QuoteComparison odds={quote.odds} probability={quote.probability}/><small>{probabilityText(quote.probability)} · EV prudente {positiveEvText(quote.probabilityLower*quote.odds-1)}</small></span>
        </button></li>
      )}</ul> : <p role="status">{values.loading ? 'Aggiornamento quote…' : !selectionReport ? 'Analisi delle quote non disponibile' : 'Nessuna quota supera i criteri con i filtri attivi.'}</p>}
    </section>
    <div className="selection-notice"><span className="badge">Stime sperimentali</span><span>Vincente partita</span></div>
    {!tracker && <div className="quote-tabs" role="group" aria-label="Vista partite"><button className={mode === 'value' ? 'primary' : 'secondary'} aria-pressed={mode === 'value'} onClick={() => showMode('value')}>Quote migliori ({opportunities.length})</button><button className={mode === 'events' ? 'primary' : 'secondary'} aria-pressed={mode === 'events'} onClick={() => showMode('events')}>Eventi e giocatori</button><button className={mode === 'markets' ? 'primary' : 'secondary'} aria-pressed={mode === 'markets'} onClick={() => showMode('markets')}>Altri mercati ({marketsByEvent.size})</button></div>}
    <div className="quote-toolbar" role="group" aria-label="Orario di inizio">
      <button className={soon?'primary':'secondary'} aria-pressed={soon} onClick={()=>changeTimeWindow({kind:'soon'})}>Prossime 2 ore ({upcomingCount})</button>
      <button className={windowKind==='all'?'primary':'secondary'} aria-pressed={windowKind==='all'} onClick={()=>changeTimeWindow({kind:'all'})}>Tutti gli orari</button>
      <button className={custom?'primary':'secondary'} aria-expanded={showCustomWindow} aria-controls="custom-start-window" onClick={()=>setShowCustomWindow(value=>!value)}>Scegli orario</button>
    </div>
    {showCustomWindow && <div id="custom-start-window" className="filters custom-start-window">
      <label>Da <input aria-label="Da data e ora" type="datetime-local" value={fromText} onChange={e=>setFromText(e.target.value)}/></label>
      <label>A <input aria-label="A data e ora" type="datetime-local" value={untilText} onChange={e=>setUntilText(e.target.value)}/></label>
      <button className="primary" onClick={applyTimeWindow}>Applica orario</button>
      {timeError && <p className="error" role="alert">{timeError}</p>}
    </div>}
    {custom && <p className="fine">Orario del dispositivo · {Number.isFinite(from)?`Da ${dateTime(new Date(from).toISOString())}`:'Da ora'} · {Number.isFinite(until)?`Fino a ${dateTime(new Date(until).toISOString())}`:'Senza ora finale'}</p>}
    <div className="filters quote-filters">
      <details className="competition-filter">
        <summary>{selectedCompetitions.length ? `Competizioni (${selectedCompetitions.length} selezionate)` : `Tutte le competizioni (${competitions.length})`}</summary>
        <fieldset>
          <legend>Scegli le competizioni</legend>
          {competitions.map(league=><label key={league}><input type="checkbox" checked={selectedCompetitions.includes(league)} onChange={()=>toggleCompetition(league)}/>{league}</label>)}
          {selectedCompetitions.length>0 && <button className="secondary" onClick={()=>{setSelectedCompetitions([]);setOpened(null);changed();}}>Tutte le competizioni</button>}
        </fieldset>
      </details>
      <label>Fascia quota<select aria-label="Fascia quota" value={nearOdds?'near':'all'} onChange={e=>{setNearOdds(e.target.value==='near');setOpened(null);changed();}}>
        <option value="all">Qualsiasi fascia</option>
        <option value="near">Intorno a 1,50 (1,40–1,60)</option>
      </select></label>
    </div>
    {mode==='markets' && <label className="model-choice">Mercato Bet365<select value={marketFilter} onChange={e=>{
      setMarketFilter(e.target.value as BookmakerMarketFilter);setOpened(null);changed();
    }}><option value="all">Tutti i mercati</option><option value="totals">Over/Under</option><option value="handicap">Handicap</option><option value="sets">Set</option><option value="exact">Risultato esatto</option></select></label>}
    {mode!=='markets' && <label className="model-choice">Modello per le quote<select aria-label="Modello per le quote" value={modelChoice} onChange={e=>{setModelChoice(e.target.value as 'study'|'ensemble');setOpened(null);changed();}}><option value="study">Modello del test in corso</option><option value="ensemble">Ensemble di tre modelli · sperimentale</option></select></label>}<div className="quote-search"><label>Cerca eventi<input type="search" value={search} placeholder="Giocatore, campionato o ID evento" onChange={e => { setSearch(e.target.value); changed(); }}/></label></div><details className="quote-filter-details"><summary>Stato e quota minima</summary><div className="filters quote-filters"><label>Stato<select aria-label="Stato" value={state} onChange={e => { setState(e.target.value); if (e.target.value==='live') changeTimeWindow({kind:'all'}); changed(); }}><option value="">Live e da iniziare</option><option value="prematch">Da iniziare</option><option value="live">Live confermate</option></select></label><label>Quota minima<input disabled={nearOdds} type="number" min="1.3" step="0.01" value={minOdds} onChange={e => { setMinOdds(e.target.value); changed(); }}/></label></div></details>
    {(!shown || matches.length === 0) && <div className="quote-toolbar"><button className="primary" disabled={busy} onClick={refresh}>{busy ? 'Aggiornamento…' : '↻ Aggiorna quote ora'}</button><button className="secondary" onClick={() => shown ? closeList() : setShown(true)}>{shown ? 'Chiudi lista quote' : 'Mostra lista quote'}</button></div>}
    <p className="fine" role="status">{rankedMatches.length} {mode === 'value' || tracker ? 'partite con quota selezionata · ordine: probabilità decrescente, poi EV prudente' : mode==='markets' ? 'partite con altri mercati Bet365 disponibili' : 'eventi disponibili · live prima, poi orario'}. {values.report ? `Verifica: ${dateTime(values.report.checkedAt)}` : 'Analisi delle quote in corso…'}</p>
    {values.error && <p role="alert" className="error">{values.error}</p>}
    {!board && !opened ? <p role="status">{boardLoading ? 'Recupero eventi reali…' : 'Feed non disponibile. Aggiorna per riprovare.'}</p> : shown && <>
      {!matches.length && nearOdds && (mode==='value'||tracker) ? <div className="empty">
        <h3>{values.loading ? 'Analisi delle quote…' : 'Nessuna opportunità selezionata tra 1,40 e 1,60'}</h3>
        {!tracker && <button className="text-button" onClick={()=>showMode('events',activeWindow)}>Vedi i prezzi Bet365 in questa fascia →</button>}
      </div> : !matches.length && soon && (mode==='value'||tracker) ? <div className="empty">
        <h3>{values.loading ? 'Analisi delle partite in arrivo…' : !selectionReport ? 'Analisi delle quote indisponibile'
          : upcomingCount ? 'Nessuna quota selezionata nelle prossime 2 ore' : 'Nessuna partita nelle prossime 2 ore'}</h3>
        {upcomingCount>0 && <p>Partite in programma nel feed: {upcomingCount}. La lista delle quote migliori applica i filtri di EV prudente e i filtri attivi.</p>}
        {upcomingCount>0 && !tracker && <button className="text-button" onClick={()=>showMode('events',{kind:'soon'})}>Vedi le partite delle prossime 2 ore →</button>}
      </div> : !matches.length && mode==='events' ? <div className="empty">
        <h3>{nearOdds ? 'Nessuna quota Bet365 tra 1,40 e 1,60 per questi filtri' : soon ? 'Nessuna partita corrispondente nelle prossime 2 ore' : 'Nessuna partita corrispondente'}</h3>
        {soon && <button className="secondary" onClick={()=>changeTimeWindow({kind:'all'})}>Vedi tutti gli orari</button>}
      </div> : !matches.length && mode==='markets' ? <div className="empty">
        <h3>{boardLoading ? 'Aggiornamento mercati…' : 'Nessun mercato disponibile con questi filtri'}</h3>
        {marketsByEvent.size>0 && <button className="secondary" onClick={resetMarketFilters}>Azzera filtri</button>}
      </div> : !matches.length ? <div className="empty"><h3>{values.loading ? 'Analisi statistica in corso…' : 'Nessuna selezione soddisfa i filtri'}</h3><p>Quote migliori seleziona le opportunità prematch con storico sufficiente, prezzo aggiornato ed EV prudente positivo. Le stime live disponibili compaiono nei dettagli della partita.</p>{!tracker && <button className="text-button" onClick={() => showMode('events')}>Consulta eventi e giocatori →</button>}</div> : <div ref={cards} className="match-list">{visibleMatches.map((m,index) => <SelectedMatch key={m.id} match={m} assessment={matchModelAssessment(boardIds.has(m.id) ? values.report : null,m,now,modelChoice==='ensemble')} estimating={values.loading} quote={openEvent===m.id?inspectedQuote:byEvent.get(m.id)} current={boardIds.has(m.id)} retained={openEvent===m.id&&!rankedIds.has(m.id)} token={token} now={now} open={openEvent === m.id} onToggle={() => setOpened(previous=>previous?.match.id===m.id?null:{match:m,index,selection:byEvent.get(m.id)?.selection??null})} onClose={closeEvent} onRefresh={refresh} busy={busy} boardCheckedAt={board?.checkedAt} marketGroups={filteredMarkets.get(m.id)} showMarketsFirst={mode==='markets'} nearOdds={nearOdds} winnerPricesInRange={winnerPricesInRange.get(m.id)}/>)}</div>}
      {mode!=='events' && matches.length > limit && <div className="quote-toolbar">
        <button className="primary" onClick={() => setLimit(n => n + 12)}>Mostra altre {Math.min(12,matches.length-limit)} partite</button>
        <button className="secondary" onClick={() => setLimit(Number.POSITIVE_INFINITY)}>Mostra tutte ({matches.length})</button>
      </div>}
    </>}
    {shown && matches.length > 0 && <div className="quote-dock" role="group" aria-label="Comandi rapidi quote"><button className="secondary" onClick={showBestQuotes}>Quote migliori · {opportunities.length}</button><button className="primary" disabled={busy} onClick={refresh}>{busy ? 'Aggiornamento…' : openEvent ? '↻ Aggiorna quota' : '↻ Aggiorna quote'}</button><button className="secondary" onClick={openEvent ? closeEvent : closeList}>{openEvent ? '✕ Chiudi quote' : '✕ Chiudi lista'}</button></div>}
    <details className="selection-method"><summary>Come scegliamo e ordiniamo le quote</summary><p>Quota equa = 1 ÷ probabilità stimata. Probabilità implicita = 1 ÷ quota Bet365. EV = probabilità stimata × quota − 1. Per comparire serve anche EV positivo sul limite prudente euristico, almeno 30 precedenti per giocatore e una coppia coerente di quote fresche. Una selezione per partita, ordinata per probabilità decrescente; a parità, EV prudente e vicinanza a quota 2. Minimo 1,30, nessun massimo.</p><p>Percentuali sperimentali, non garanzie. Il test statistico prosegue separatamente.</p></details>
  </section><PredictionRankings report={values.report?.rankings} checkedAt={values.report?.checkedAt}/></>;
}
function probabilityText(probability:number) {
  return probability.toLocaleString('it-IT',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1});
}
function SelectedMatch({ match: m, assessment, estimating, quote, current,retained,token, now, open, onToggle, onClose, onRefresh, busy,boardCheckedAt,marketGroups=[],showMarketsFirst,nearOdds,winnerPricesInRange }: { match: FeedMatch; nearOdds: boolean; winnerPricesInRange?: ReturnType<typeof bookmakerWinnerPrices>; boardCheckedAt?: string; marketGroups?: BookmakerMarkets; showMarketsFirst: boolean; assessment: ReturnType<typeof matchModelAssessment>; estimating: boolean; quote?: ValueOpportunity;current:boolean;retained:boolean; token?: string; now: number; open: boolean; onToggle: () => void; onClose: () => void; onRefresh: () => void; busy: boolean }) {
  const {estimate,models,agreement} = assessment;
  const live = current&&isFreshLive(m, now);
  const usable=current&&isUpcomingOrLive(m,now);
  const value=!!quote&&hasPositiveValue(quote);
  const homePercent = estimate ? Math.round(estimate.homeProbability * 1000) / 10 : undefined;
  const percent = (value: number) => value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  const favorite = homePercent === undefined || homePercent === 50 ? null : {
    name: homePercent > 50 ? m.home : m.away,
    probability: Math.max(homePercent, 100-homePercent),
  };
  const estimateStatus = !current ? 'Evento non più disponibile' : live ? 'Stima live non disponibile'
    : estimating ? 'Pronostico in caricamento…' : 'Stima non disponibile';
  const agreementText = agreement==='same' ? 'Modelli concordi' : agreement==='different' ? 'Modelli senza un favorito comune'
    : agreement==='tie' ? 'Entrambi senza preferenza' : null;
  const prices = open && usable ? nearOdds ? winnerPricesInRange ?? [] : bookmakerWinnerPrices(m, now) : [];
  return <details className={`match-card selected-match${live ? ' match-live' : ''}`} data-event-id={m.id} open={open} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <summary onClick={e => { e.preventDefault(); onToggle(); }}><span><small>{m.league} · {dateTime(m.kickoff_utc)}</small><strong>{m.home} — {m.away}</strong><span>{!current?'Evento non più nel feed · dati mantenuti aperti':estimate ? (favorite ? `Favorito del modello · ${favorite.name} · ${percent(favorite.probability)}` : 'Modello senza preferenza · 50%–50%') : estimateStatus}</span>{agreementText && <small>{agreementText}</small>}{quote && <small>Quota selezionata · {quote.selection}</small>}</span><span className="match-badges">{live && <span className="live-badge"><i aria-hidden="true"/>LIVE</span>}{live && m.score && <span className="score-badge">{m.score}</span>}{quote && <span className="summary-price"><b>{(quote.probability * 100).toFixed(1)}%</b><QuoteComparison odds={quote.odds} probability={quote.probability}/></span>}{nearOdds && !quote && !!winnerPricesInRange?.length && <span className="badge">Bet365 {winnerPricesInRange.map(price=>price.odds_dec.toFixed(2).replace('.',',')).join(' · ')}</span>}{marketGroups.length>0 && <span className="badge">{marketGroups.length} mercati Bet365</span>}<span className="badge">{open ? 'Chiudi ↑' : 'Apri ↓'}</span></span></summary>
    {open && <div className="match-content"><div className="match-actions"><button className="primary" disabled={busy} onClick={onRefresh}>{busy ? 'Aggiornamento…' : '↻ Aggiorna quota'}</button><button className="secondary" onClick={onClose}>✕ Chiudi quote</button></div>
      {retained&&<p className="banner" role="status">{!usable?'Evento non più disponibile tra le partite attive. Le statistiche già aperte restano consultabili.':'Partita mantenuta aperta durante gli aggiornamenti.'}</p>}
      <AdditionalMarkets match={m} groups={marketGroups} now={now} available={usable} boardCheckedAt={boardCheckedAt} token={token} initiallyOpen={showMarketsFirst||(nearOdds&&!prices.length)}/>
      {usable && <section aria-label="Pronostico del modello">
        <h3>Valutazione della partita · {live ? 'Vincente live' : 'Vincente prematch'}</h3>
        {estimate && homePercent !== undefined ? <>
          <p><strong>{favorite ? `Favorito: ${favorite.name}` : 'Nessuna preferenza tra i due giocatori'}</strong> · Stima sperimentale</p>
          <ul className="competition-list">
            {[{name:m.home,probability:estimate.homeProbability,displayPercent:homePercent},
              {name:m.away,probability:1-estimate.homeProbability,displayPercent:100-homePercent}].map(side=>{
              const price = prices.find(item=>item.side===side.name);
              return <li key={side.name}>
                <span><strong>{side.name}</strong>
                  <small>{percent(side.displayPercent)} · {price ? dateTime(price.ts) : nearOdds ? 'Bet365 fuori fascia o indisponibile' : 'Quota Bet365 aggiornata indisponibile'}</small>
                </span>
                <QuoteComparison odds={price?.odds_dec} probability={side.probability}/>
              </li>;
            })}
          </ul>
          {models.length===2 && <div className="match-model-comparison">
            <p><strong>{agreementText}</strong></p>
            <ul className="competition-list">{models.map(model=><li key={model.modelName}>
              <span>{model.modelName}</span>
              <small>{m.home} {probabilityText(model.homeProbability)} · {m.away} {probabilityText(1-model.homeProbability)}</small>
            </li>)}</ul>
          </div>}
          <p className="fine">{estimate.modelName} · {estimate.liveScore !== undefined
            ? `Set completati ${estimate.completedSetScore}. Stima riferita all’ultimo set concluso.`
            : `${estimate.sampleSize} precedenti nel campione minimo dei due giocatori.`}</p>
        </> : <p role="status">{estimateStatus}. {live
          ? 'Servono il formato al meglio di cinque e almeno un set completato nel feed aggiornato.'
          : 'Servono almeno 30 risultati per giocatore nella stessa competizione.'}</p>}
      </section>}
      {quote&&value ? <SelectedQuote quote={quote} token={token} eligible={value}/> : usable&&!live&&<p role="status">Nessuna quota supera al momento il filtro EV prudente.</p>}
      {usable && !estimate && <section aria-label="Quote Bet365 del vincente">
        <h3>Quote Bet365 · Vincente partita</h3>
        {prices.length ? <ul className="competition-list">{prices.map(price => <li key={price.sel_id}>
          <span><strong>{price.side}</strong><small>bet365.com.au · {dateTime(price.ts)}</small></span>
          <strong>{price.odds_dec.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</strong>
        </li>)}</ul> : <p role="status">{nearOdds ? 'Nessuna quota vincente in questa fascia.' : 'Quote vincente aggiornate al momento indisponibili.'}</p>}
      </section>}
      <SaveChoice token={usable?token:undefined} eventId={m.id}/><PlayerAnalysis token={token} eventId={m.id} showEstimates={false}/>
      <button className="secondary close-bottom" onClick={onClose}>✕ Chiudi questa partita</button>
    </div>}
  </details>;
}
function SelectedQuote({ quote: o, token,eligible }: { quote: ValueOpportunity; token?: string;eligible:boolean }) {
  return <article className="selected-quote" aria-label={`Quota selezionata: ${o.selection}`}><div className="panel-heading"><div><span className="eyebrow">VINCENTE PARTITA · PREMATCH</span><h3>{o.selection}</h3></div><span className="badge">{eligible?(o.modelValidated?'Verificata':'Opportunità sperimentale'):'Fuori selezione'}</span></div><div className="quote-highlights" aria-live="polite" aria-atomic="true"><QuoteComparison odds={o.odds} probability={o.probability}/><div><strong>{(o.probability * 100).toFixed(1)}%</strong><span>Probabilità stimata</span></div><div><strong>{positiveEvText(o.probability * o.odds - 1)}</strong><span>Valore atteso (EV)</span></div></div><p className="fine">Quota modificata: {dateTime(o.quoteAt)} · Mercato letto: {dateTime(o.marketReadAt)} · {o.sampleSize} precedenti nel campione minimo.</p><details className="quote-explanation"><summary>Perché è stata selezionata?</summary><dl><dt>Probabilità implicita nella quota</dt><dd>{(100 / o.odds).toFixed(1)}%</dd><dt>Calcolo della quota equa</dt><dd>1 ÷ probabilità stimata</dd><dt>Limite prudente euristico</dt><dd>{(o.probabilityLower * 100).toFixed(1)}%</dd><dt>EV prudente</dt><dd>{positiveEvText(o.probabilityLower * o.odds - 1)}</dd></dl><p className="fine">{eligible?'Il prezzo supera la quota equa stimata anche usando il limite prudente.':'La quota non supera più il filtro di convenienza prudente.'} L’affidabilità del modello è ancora in verifica.</p></details><div className="selection-buttons"><RecordPrediction key={`${o.modelVersion}:${o.selection}:${o.quoteAt}:${o.odds}:${o.probability}`} token={token} eventId={o.eventId} selection={o.selection} odds={o.odds} quoteAt={o.quoteAt} probability={o.probability} modelVersion={o.modelVersion ?? ''}/>{o.quoteKey && <SaveChoice key={`${o.quoteAt}:${o.odds}`} token={token} eventId={o.eventId} quoteKey={o.quoteKey} expectedOdds={o.odds} expectedUpdatedAt={o.quoteAt}/>}</div></article>;
}
