import{PredictionRankings}from'./PredictionRankings';
import { useMemo, useRef, useState } from 'react';
import { isFreshLive, isUpcomingOrLive, startsInNextTwoHours, type Board, type FeedMatch } from './shared/board';
import { SaveChoice } from './Choices';
import { dateTime,fairOddsText,positiveEvText } from './shared/format';
import { PlayerAnalysis } from './PlayerAnalysis';
import { AdditionalMarkets } from './AdditionalMarkets';
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
import { selectedQuotes,keepOpenMatch,openQuote,hasPositiveValue,bookmakerWinnerPrices,eventWinnerEstimate,nearOneFifty,oddsInRange,type OpenMatch } from './shared/quote-selection';
import type { ValueOpportunity } from './domain/value';
import type { WinnerEstimate } from './shared/value';
import { RecordPrediction } from './RecordPrediction';

type Props = { board: Board | null; now: number; token?: string; refreshBoard: () => Promise<void>; boardLoading: boolean; tracker?: boolean };
export function Markets({ board, now, token, refreshBoard, boardLoading, tracker = false }: Props) {
  const values = useValue(token);
  const [modelChoice,setModelChoice]=useState<'study'|'ensemble'>('study');
  const selectionReport=modelChoice==='ensemble'?(values.report?.ensemble?{...values.report,...values.report.ensemble,rankings:undefined}:null):values.report;
  const [search, setSearch] = useState(''), [competition, setCompetition] = useState('');
  const [state, setState] = useState(''), [mode, setMode] = useState<'value' | 'events' | 'markets'>(tracker ? 'value' : 'events');
  const [soon,setSoon] = useState(tracker);
  const [marketFilter,setMarketFilter] = useState<BookmakerMarketFilter>('all');
  const [nearOdds,setNearOdds] = useState(false);
  const [minOdds, setMinOdds] = useState('1.30'), [limit, setLimit] = useState(12);
  const [shown, setShown] = useState(true), [opened, setOpened] = useState<OpenMatch | null>(null);
  const openEvent=opened?.match.id??null;
  const [manualBusy, setManualBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), cards = useRef<HTMLDivElement>(null);
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
  const byEvent = new Map(eligible.map(o => [o.eventId, o]));
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
  const rankedMatches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('it');
    const filtered = (board?.matches ?? []).filter(m => isUpcomingOrLive(m, now) && (!competition || m.league === competition)
      && (!term || `${m.home} ${m.away} ${m.league} ${m.id}`.toLocaleLowerCase('it').includes(term))
      && (!state || (state === 'live' ? m.in_play : !m.in_play))
      && (!soon || startsInNextTwoHours(m,now)));
    if (mode === 'value' || tracker) {
      const events = new Map(filtered.map(m => [m.id, m]));
      return eligible.flatMap(o => events.has(o.eventId) ? [events.get(o.eventId)!] : []);
    }
    const visible = mode === 'markets' ? filtered.filter(match=>filteredMarkets.has(match.id))
      : nearOdds ? filtered.filter(match=>winnerPricesInRange.has(match.id)||filteredMarkets.has(match.id))
      : filtered;
    return visible.sort((a, b) => Number(b.in_play) - Number(a.in_play) || Date.parse(a.kickoff_utc ?? '') - Date.parse(b.kickoff_utc ?? '') || a.id.localeCompare(b.id));
  }, [board, now, competition, search, state, eligible, mode, tracker,filteredMarkets,soon,nearOdds,winnerPricesInRange]);
  const matches=keepOpenMatch(rankedMatches,opened,board?.matches??[]);
  const currentOpen=board?.matches.find(m=>m.id===openEvent);
  const refreshedQuote=openQuote(selectionReport,currentOpen,opened?.selection??(openEvent ? byEvent.get(openEvent)?.selection ?? null : null),now);
  const inspectedQuote=refreshedQuote && oddsInRange(refreshedQuote.odds,minimum,maximum) ? refreshedQuote : undefined;
  const competitions = [...new Set(board?.matches.map(m => m.league) ?? [])].sort();
  function changed() { setLimit(12); setShown(true); }
  function showMode(next: typeof mode, nextSoon=next==='value') {
    if (next!==mode) {
      setMode(next);
      changeTimeWindow(nextSoon);
    } else changed();
  }
  function changeTimeWindow(next: boolean) {
    if (next && state==='live') setState('');
    setSoon(next);setOpened(null);changed();
  }
  function resetMarketFilters() {
    setSearch('');setCompetition('');setState('');setMarketFilter('all');setSoon(false);setNearOdds(false);changed();
  }
  function closeList() { setShown(false); setOpened(null); heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  function closeEvent() {
    const summary = cards.current?.querySelector<HTMLDetailsElement>('details.match-card[open]')?.querySelector('summary');
    setOpened(null); summary?.focus({ preventScroll: true }); summary?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function refresh() {
    if (busy) return;
    setManualBusy(true);
    try { await Promise.all([refreshBoard(), values.refresh()]); } finally { setManualBusy(false); }
  }
  return <><section className="panel quote-workspace">
    <span className="eyebrow">SELEZIONE STATISTICA</span>
    <h2 ref={heading} tabIndex={-1}>Quote selezionate</h2>
    <p>Apri una partita per confrontare la quota Bet365 con la quota equa stimata dal modello. In Quote migliori trovi le selezioni con EV positivo anche nella stima prudente.</p>
    <div className="selection-notice"><span className="badge">Stime sperimentali</span><span>Vincente partita</span></div>
    {!tracker && <div className="quote-tabs" role="group" aria-label="Vista partite"><button className={mode === 'value' ? 'primary' : 'secondary'} aria-pressed={mode === 'value'} onClick={() => showMode('value')}>Quote migliori ({soon ? upcomingMatches.filter(match=>byEvent.has(match.id)).length : eligible.length})</button><button className={mode === 'events' ? 'primary' : 'secondary'} aria-pressed={mode === 'events'} onClick={() => showMode('events')}>Eventi e giocatori</button><button className={mode === 'markets' ? 'primary' : 'secondary'} aria-pressed={mode === 'markets'} onClick={() => showMode('markets')}>Altri mercati ({marketsByEvent.size})</button></div>}
    <div className="quote-toolbar" role="group" aria-label="Orario di inizio">
      <button className={soon?'primary':'secondary'} aria-pressed={soon} onClick={()=>changeTimeWindow(true)}>Prossime 2 ore ({upcomingCount})</button>
      <button className={soon?'secondary':'primary'} aria-pressed={!soon} onClick={()=>changeTimeWindow(false)}>Tutti gli orari</button>
    </div>
    <div className="filters quote-filters">
      <label>Competizione<select aria-label="Competizione" value={competition} onChange={e=>{setCompetition(e.target.value);setOpened(null);changed();}}>
        <option value="">Tutte le competizioni ({competitions.length})</option>
        {competition && !competitions.includes(competition) && <option value={competition}>{competition}</option>}
        {competitions.map(c=><option key={c}>{c}</option>)}
      </select></label>
      <label>Fascia quota<select aria-label="Fascia quota" value={nearOdds?'near':'all'} onChange={e=>{setNearOdds(e.target.value==='near');setOpened(null);changed();}}>
        <option value="all">Qualsiasi fascia</option>
        <option value="near">Intorno a 1,50 (1,40–1,60)</option>
      </select></label>
    </div>
    {mode==='markets' && <label className="model-choice">Mercato Bet365<select value={marketFilter} onChange={e=>{
      setMarketFilter(e.target.value as BookmakerMarketFilter);setOpened(null);changed();
    }}><option value="all">Tutti i mercati</option><option value="totals">Over/Under</option><option value="handicap">Handicap</option><option value="sets">Set</option><option value="exact">Risultato esatto</option></select></label>}
    {mode!=='markets' && <label className="model-choice">Modello per le quote<select aria-label="Modello per le quote" value={modelChoice} onChange={e=>{setModelChoice(e.target.value as 'study'|'ensemble');setOpened(null);changed();}}><option value="study">Modello del test in corso</option><option value="ensemble">Ensemble di tre modelli · sperimentale</option></select></label>}<div className="quote-search"><label>Cerca eventi<input type="search" value={search} placeholder="Giocatore, campionato o ID evento" onChange={e => { setSearch(e.target.value); changed(); }}/></label></div><details className="quote-filter-details"><summary>Stato e quota minima</summary><div className="filters quote-filters"><label>Stato<select aria-label="Stato" value={state} onChange={e => { setState(e.target.value); if (e.target.value==='live') setSoon(false); changed(); }}><option value="">Live e da iniziare</option><option value="prematch">Da iniziare</option><option value="live">Live confermate</option></select></label><label>Quota minima<input disabled={nearOdds} type="number" min="1.3" step="0.01" value={minOdds} onChange={e => { setMinOdds(e.target.value); changed(); }}/></label></div></details>
    {(!shown || matches.length === 0) && <div className="quote-toolbar"><button className="primary" disabled={busy} onClick={refresh}>{busy ? 'Aggiornamento…' : '↻ Aggiorna quote ora'}</button><button className="secondary" onClick={() => shown ? closeList() : setShown(true)}>{shown ? 'Chiudi lista quote' : 'Mostra lista quote'}</button></div>}
    <p className="fine" role="status">{rankedMatches.length} {mode === 'value' || tracker ? 'partite con quota selezionata · ordine: probabilità decrescente, poi EV prudente' : mode==='markets' ? 'partite con altri mercati Bet365 disponibili' : 'eventi disponibili · live prima, poi orario'}. {values.report ? `Verifica: ${dateTime(values.report.checkedAt)}` : 'Analisi delle quote in corso…'}</p>
    {values.error && <p role="alert" className="error">{values.error}</p>}
    {!board && !opened ? <p role="status">{boardLoading ? 'Recupero eventi reali…' : 'Feed non disponibile. Aggiorna per riprovare.'}</p> : shown && <>
      {!matches.length && nearOdds && (mode==='value'||tracker) ? <div className="empty">
        <h3>{values.loading ? 'Analisi delle quote…' : 'Nessuna opportunità selezionata tra 1,40 e 1,60'}</h3>
        {!tracker && <button className="text-button" onClick={()=>showMode('events',soon)}>Vedi i prezzi Bet365 in questa fascia →</button>}
      </div> : !matches.length && soon && (mode==='value'||tracker) ? <div className="empty">
        <h3>{values.loading ? 'Analisi delle partite in arrivo…' : !selectionReport ? 'Analisi delle quote indisponibile'
          : upcomingCount ? 'Nessuna quota selezionata nelle prossime 2 ore' : 'Nessuna partita nelle prossime 2 ore'}</h3>
        {upcomingCount>0 && <p>Partite in programma nel feed: {upcomingCount}. La lista delle quote migliori applica i filtri di EV prudente e i filtri attivi.</p>}
        {upcomingCount>0 && !tracker && <button className="text-button" onClick={()=>showMode('events',true)}>Vedi le partite delle prossime 2 ore →</button>}
      </div> : !matches.length && mode==='events' ? <div className="empty">
        <h3>{nearOdds ? 'Nessuna quota Bet365 tra 1,40 e 1,60 per questi filtri' : soon ? 'Nessuna partita corrispondente nelle prossime 2 ore' : 'Nessuna partita corrispondente'}</h3>
        {soon && <button className="secondary" onClick={()=>changeTimeWindow(false)}>Vedi tutti gli orari</button>}
      </div> : !matches.length && mode==='markets' ? <div className="empty">
        <h3>{boardLoading ? 'Aggiornamento mercati…' : 'Nessun mercato disponibile con questi filtri'}</h3>
        {marketsByEvent.size>0 && <button className="secondary" onClick={resetMarketFilters}>Azzera filtri</button>}
      </div> : !matches.length ? <div className="empty"><h3>{values.loading ? 'Analisi statistica in corso…' : 'Nessuna selezione soddisfa i filtri'}</h3><p>Quote migliori seleziona le opportunità prematch con storico sufficiente, prezzo aggiornato ed EV prudente positivo. Le stime live disponibili compaiono nei dettagli della partita.</p>{!tracker && <button className="text-button" onClick={() => showMode('events')}>Consulta eventi e giocatori →</button>}</div> : <div ref={cards} className="match-list">{matches.slice(0, limit).map(m => <SelectedMatch key={m.id} match={m} estimate={board?.matches.some(current=>current.id===m.id) ? eventWinnerEstimate(selectionReport,m,now) : undefined} estimating={values.loading} quote={openEvent===m.id?inspectedQuote:byEvent.get(m.id)} current={!!board?.matches.some(current=>current.id===m.id)} retained={openEvent===m.id&&!rankedMatches.some(row=>row.id===m.id)} token={token} now={now} open={openEvent === m.id} onToggle={() => setOpened(previous=>previous?.match.id===m.id?null:{match:m,index:matches.findIndex(row=>row.id===m.id),selection:byEvent.get(m.id)?.selection??null})} onClose={closeEvent} onRefresh={refresh} busy={busy} boardCheckedAt={board?.checkedAt} marketGroups={filteredMarkets.get(m.id)} showMarketsFirst={mode==='markets'} nearOdds={nearOdds} winnerPricesInRange={winnerPricesInRange.get(m.id)}/>)}</div>}
      {matches.length > limit && <div className="quote-toolbar">
        <button className="primary" onClick={() => setLimit(n => n + 12)}>Mostra altre {Math.min(12,matches.length-limit)} partite</button>
        <button className="secondary" onClick={() => setLimit(Number.POSITIVE_INFINITY)}>Mostra tutte ({matches.length})</button>
      </div>}
    </>}
    {shown && matches.length > 0 && <div className="quote-dock" role="group" aria-label="Comandi rapidi quote"><button className="primary" disabled={busy} onClick={refresh}>{busy ? 'Aggiornamento…' : openEvent ? '↻ Aggiorna quota' : '↻ Aggiorna quote'}</button><button className="secondary" onClick={openEvent ? closeEvent : closeList}>{openEvent ? '✕ Chiudi quote' : '✕ Chiudi lista'}</button></div>}
    <details className="selection-method"><summary>Come scegliamo e ordiniamo le quote</summary><p>Quota equa = 1 ÷ probabilità stimata. Probabilità implicita = 1 ÷ quota Bet365. EV = probabilità stimata × quota − 1. Per comparire serve anche EV positivo sul limite prudente euristico, almeno 30 precedenti per giocatore e una coppia coerente di quote fresche. Una selezione per partita, ordinata per probabilità decrescente; a parità, EV prudente e vicinanza a quota 2. Minimo 1,30, nessun massimo.</p><p>Percentuali sperimentali, non garanzie. Il test statistico prosegue separatamente.</p></details>
  </section><PredictionRankings report={values.report?.rankings} checkedAt={values.report?.checkedAt}/></>;
}
function SelectedMatch({ match: m, estimate, estimating, quote, current,retained,token, now, open, onToggle, onClose, onRefresh, busy,boardCheckedAt,marketGroups=[],showMarketsFirst,nearOdds,winnerPricesInRange }: { match: FeedMatch; nearOdds: boolean; winnerPricesInRange?: ReturnType<typeof bookmakerWinnerPrices>; boardCheckedAt?: string; marketGroups?: BookmakerMarkets; showMarketsFirst: boolean; estimate?: WinnerEstimate; estimating: boolean; quote?: ValueOpportunity;current:boolean;retained:boolean; token?: string; now: number; open: boolean; onToggle: () => void; onClose: () => void; onRefresh: () => void; busy: boolean }) {
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
  const prices = open && usable ? nearOdds ? winnerPricesInRange ?? [] : bookmakerWinnerPrices(m, now) : [];
  return <details className={`match-card selected-match${live ? ' match-live' : ''}`} data-event-id={m.id} open={open} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <summary onClick={e => { e.preventDefault(); onToggle(); }}><span><small>{m.league} · {dateTime(m.kickoff_utc)}</small><strong>{m.home} — {m.away}</strong>{quote ? <span>Vincente partita · {quote.selection}</span> : <span>{!current?'Evento non più nel feed · dati mantenuti aperti':estimate ? (favorite ? `Favorito del modello · ${favorite.name} · ${percent(favorite.probability)}` : 'Modello senza preferenza · 50%–50%') : estimateStatus}</span>}</span><span className="match-badges">{live && <span className="live-badge"><i aria-hidden="true"/>LIVE</span>}{live && m.score && <span className="score-badge">{m.score}</span>}{quote && <span className="summary-price"><b>{(quote.probability * 100).toFixed(1)}%</b><small>Quota equa {fairOddsText(quote.probability)}</small><strong>Bet365 {quote.odds.toFixed(2)}</strong></span>}{nearOdds && !quote && !!winnerPricesInRange?.length && <span className="badge">Bet365 {winnerPricesInRange.map(price=>price.odds_dec.toFixed(2).replace('.',',')).join(' · ')}</span>}{marketGroups.length>0 && <span className="badge">{marketGroups.length} mercati Bet365</span>}<span className="badge">{open ? 'Chiudi ↑' : 'Apri ↓'}</span></span></summary>
    {open && <div className="match-content"><div className="match-actions"><button className="primary" disabled={busy} onClick={onRefresh}>{busy ? 'Aggiornamento…' : '↻ Aggiorna quota'}</button><button className="secondary" onClick={onClose}>✕ Chiudi quote</button></div>
      {retained&&<p className="banner" role="status">{!usable?'Evento non più disponibile tra le partite attive. Le statistiche già aperte restano consultabili.':'Partita mantenuta aperta durante gli aggiornamenti.'}</p>}
      <AdditionalMarkets match={m} groups={marketGroups} now={now} available={usable} boardCheckedAt={boardCheckedAt} token={token} initiallyOpen={showMarketsFirst||(nearOdds&&!prices.length)}/>
      {usable && <section aria-label="Pronostico del modello">
        <h3>Pronostico del modello · {live ? 'Vincente live' : 'Vincente prematch'}</h3>
        {estimate && homePercent !== undefined ? <>
          <p><strong>{favorite ? `Favorito: ${favorite.name}` : 'Nessuna preferenza tra i due giocatori'}</strong> · Stima sperimentale</p>
          <ul className="competition-list">
            {[{name:m.home,probability:estimate.homeProbability,displayPercent:homePercent},
              {name:m.away,probability:1-estimate.homeProbability,displayPercent:100-homePercent}].map(side=>{
              const price = prices.find(item=>item.side===side.name);
              return <li key={side.name}>
                <span><strong>{side.name}</strong>
                  <small>{price ? `Bet365 ${price.odds_dec.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:3})} · ${dateTime(price.ts)}` : nearOdds ? 'Nessuna quota Bet365 in fascia' : 'Quota Bet365 aggiornata indisponibile'}</small>
                </span>
                <span><strong>{percent(side.displayPercent)}</strong><small>Quota equa {fairOddsText(side.probability)}</small></span>
              </li>;
            })}
          </ul>
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
  return <article className="selected-quote" aria-label={`Quota selezionata: ${o.selection}`}><div className="panel-heading"><div><span className="eyebrow">VINCENTE PARTITA · PREMATCH</span><h3>{o.selection}</h3></div><span className="badge">{eligible?(o.modelValidated?'Verificata':'Opportunità sperimentale'):'Fuori selezione'}</span></div><div className="quote-highlights" aria-live="polite" aria-atomic="true"><div><strong>{(o.probability * 100).toFixed(1)}%</strong><span>Probabilità stimata</span></div><div><strong>{o.odds.toFixed(2)}</strong><span>Quota Bet365</span></div><div><strong>{fairOddsText(o.probability)}</strong><span>Quota equa stimata</span></div><div><strong>{positiveEvText(o.probability * o.odds - 1)}</strong><span>Valore atteso (EV)</span></div></div><p className="fine">Quota modificata: {dateTime(o.quoteAt)} · Mercato letto: {dateTime(o.marketReadAt)} · {o.sampleSize} precedenti nel campione minimo.</p><details className="quote-explanation"><summary>Perché è stata selezionata?</summary><dl><dt>Probabilità implicita nella quota</dt><dd>{(100 / o.odds).toFixed(1)}%</dd><dt>Calcolo della quota equa</dt><dd>1 ÷ probabilità stimata</dd><dt>Limite prudente euristico</dt><dd>{(o.probabilityLower * 100).toFixed(1)}%</dd><dt>EV prudente</dt><dd>{positiveEvText(o.probabilityLower * o.odds - 1)}</dd></dl><p className="fine">{eligible?'Il prezzo supera la quota equa stimata anche usando il limite prudente.':'La quota non supera più il filtro di convenienza prudente.'} L’affidabilità del modello è ancora in verifica.</p></details><div className="selection-buttons"><RecordPrediction key={`${o.modelVersion}:${o.selection}:${o.quoteAt}:${o.odds}:${o.probability}`} token={token} eventId={o.eventId} selection={o.selection} odds={o.odds} quoteAt={o.quoteAt} probability={o.probability} modelVersion={o.modelVersion ?? ''}/>{o.quoteKey && <SaveChoice key={`${o.quoteAt}:${o.odds}`} token={token} eventId={o.eventId} quoteKey={o.quoteKey} expectedOdds={o.odds} expectedUpdatedAt={o.quoteAt}/>}</div></article>;
}
