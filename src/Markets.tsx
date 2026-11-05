import { useMemo, useRef, useState } from 'react';
import { isFreshLive, isUpcomingOrLive, type Board, type FeedMatch } from './shared/board';
import { SaveChoice } from './Choices';
import { dateTime } from './shared/format';
import { PlayerAnalysis } from './PlayerAnalysis';

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
import { selectedQuotes,keepOpenMatch,openQuote,type OpenMatch } from './shared/quote-selection';
import type { ValueOpportunity } from './domain/value';
import { RecordPrediction } from './RecordPrediction';

type Props = { board: Board | null; now: number; token?: string; refreshBoard: () => Promise<void>; boardLoading: boolean; tracker?: boolean };
export function Markets({ board, now, token, refreshBoard, boardLoading, tracker = false }: Props) {
  const values = useValue(token);
  const [modelChoice,setModelChoice]=useState<'study'|'ensemble'>('study');
  const selectionReport=modelChoice==='ensemble'?(values.report?.ensemble?{...values.report,...values.report.ensemble}:null):values.report;
  const [search, setSearch] = useState(''), [competition, setCompetition] = useState('');
  const [state, setState] = useState(''), [mode, setMode] = useState<'value' | 'events'>('value');
  const [minOdds, setMinOdds] = useState('1.30'), [limit, setLimit] = useState(12);
  const [shown, setShown] = useState(true), [opened, setOpened] = useState<OpenMatch | null>(null);
  const openEvent=opened?.match.id??null;
  const [manualBusy, setManualBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), cards = useRef<HTMLDivElement>(null);
  const busy = boardLoading || values.loading || manualBusy;
  const eligible = useMemo(() => selectedQuotes(selectionReport, board?.matches ?? [], now, Number(minOdds) || 1.3), [selectionReport, board, now, minOdds]);
  const byEvent = new Map(eligible.map(o => [o.eventId, o]));
  const rankedMatches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('it');
    const filtered = (board?.matches ?? []).filter(m => isUpcomingOrLive(m, now) && (!competition || m.league === competition)
      && (!term || `${m.home} ${m.away} ${m.league} ${m.id}`.toLocaleLowerCase('it').includes(term))
      && (!state || (state === 'live' ? m.in_play : !m.in_play)));
    if (mode === 'value' || tracker) {
      const events = new Map(filtered.map(m => [m.id, m]));
      return eligible.flatMap(o => events.has(o.eventId) ? [events.get(o.eventId)!] : []);
    }
    return filtered.sort((a, b) => Number(b.in_play) - Number(a.in_play) || Date.parse(a.kickoff_utc ?? '') - Date.parse(b.kickoff_utc ?? '') || a.id.localeCompare(b.id));
  }, [board, now, competition, search, state, eligible, mode, tracker]);
  const matches=keepOpenMatch(rankedMatches,opened,board?.matches??[]);
  const currentOpen=board?.matches.find(m=>m.id===openEvent);
  const inspectedQuote=openQuote(selectionReport,currentOpen,opened?.selection??null,now);
  const competitions = [...new Set(board?.matches.map(m => m.league) ?? [])].sort();
  function changed() { setLimit(12); setShown(true); }
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
  return <section className="panel quote-workspace">
    <span className="eyebrow">SELEZIONE STATISTICA</span>
    <h2 ref={heading} tabIndex={-1}>Quote selezionate</h2>
    <p>Solo margini statistici positivi, dalla probabilità stimata più alta.</p>
    <div className="selection-notice"><span className="badge">Stime sperimentali</span><span>Solo vincente prematch</span></div>
    {!tracker && <div className="quote-tabs" role="group" aria-label="Vista partite"><button className={mode === 'value' ? 'primary' : 'secondary'} aria-pressed={mode === 'value'} onClick={() => { setMode('value'); changed(); }}>Quote migliori ({eligible.length})</button><button className={mode === 'events' ? 'primary' : 'secondary'} aria-pressed={mode === 'events'} onClick={() => { setMode('events'); changed(); }}>Eventi e giocatori</button></div>}
    <label className="model-choice">Modello per le quote<select aria-label="Modello per le quote" value={modelChoice} onChange={e=>{setModelChoice(e.target.value as 'study'|'ensemble');setOpened(null);changed();}}><option value="study">Modello del test in corso</option><option value="ensemble">Ensemble di tre modelli · sperimentale</option></select></label><div className="quote-search"><label>Cerca eventi<input type="search" value={search} placeholder="Giocatore, campionato o ID evento" onChange={e => { setSearch(e.target.value); changed(); }}/></label></div><details className="quote-filter-details"><summary>Filtri per campionato, stato e quota</summary><div className="filters quote-filters"><label>Campionato<select aria-label="Campionato" value={competition} onChange={e => { setCompetition(e.target.value); changed(); }}><option value="">Tutti ({competitions.length})</option>{competitions.map(c => <option key={c}>{c}</option>)}</select></label><label>Stato<select aria-label="Stato" value={state} onChange={e => { setState(e.target.value); changed(); }}><option value="">Live e da iniziare</option><option value="prematch">Da iniziare</option><option value="live">Live confermate</option></select></label><label>Quota minima<input type="number" min="1.3" step="0.01" value={minOdds} onChange={e => { setMinOdds(e.target.value); changed(); }}/></label></div></details>
    {(!shown || matches.length === 0) && <div className="quote-toolbar"><button className="primary" disabled={busy} onClick={refresh}>{busy ? 'Aggiornamento…' : '↻ Aggiorna quote ora'}</button><button className="secondary" onClick={() => shown ? closeList() : setShown(true)}>{shown ? 'Chiudi lista quote' : 'Mostra lista quote'}</button></div>}
    <p className="fine" role="status">{rankedMatches.length} {mode === 'value' || tracker ? 'partite con quota selezionata · ordine: probabilità decrescente, poi EV prudente' : 'eventi disponibili · live prima, poi orario'}. {values.report ? `Verifica: ${dateTime(values.report.checkedAt)}` : 'Analisi delle quote in corso…'}</p>
    {values.error && <p role="alert" className="error">{values.error}</p>}
    {!board && !opened ? <p role="status">{boardLoading ? 'Recupero eventi reali…' : 'Feed non disponibile. Aggiorna per riprovare.'}</p> : shown && <>
      {!matches.length ? <div className="empty"><h3>{values.loading ? 'Analisi statistica in corso…' : 'Nessuna selezione soddisfa i filtri'}</h3><p>Mostriamo una quota solo con storico sufficiente, prezzo fresco e margine prudente positivo. Per il live non è disponibile un modello di probabilità: puoi consultare gli eventi e le statistiche dei giocatori.</p>{!tracker && <button className="text-button" onClick={() => { setMode('events'); changed(); }}>Consulta eventi e giocatori →</button>}</div> : <div ref={cards} className="match-list">{matches.slice(0, limit).map(m => <SelectedMatch key={m.id} match={m} quote={openEvent===m.id?inspectedQuote:byEvent.get(m.id)} current={!!board?.matches.some(current=>current.id===m.id)} retained={openEvent===m.id&&!rankedMatches.some(row=>row.id===m.id)} token={token} now={now} open={openEvent === m.id} onToggle={() => setOpened(previous=>previous?.match.id===m.id?null:{match:m,index:matches.findIndex(row=>row.id===m.id),selection:byEvent.get(m.id)?.selection??null})} onClose={closeEvent} onRefresh={refresh} busy={busy}/>)}</div>}
      {matches.length > limit && <button className="primary more-matches" onClick={() => setLimit(n => n + 12)}>Mostra altre 12 partite ({matches.length - limit} rimanenti)</button>}
    </>}
    {shown && matches.length > 0 && <div className="quote-dock" role="group" aria-label="Comandi rapidi quote"><button className="primary" disabled={busy} onClick={refresh}>{busy ? 'Aggiornamento…' : openEvent ? '↻ Aggiorna quota' : '↻ Aggiorna quote'}</button><button className="secondary" onClick={openEvent ? closeEvent : closeList}>{openEvent ? '✕ Chiudi quote' : '✕ Chiudi lista'}</button></div>}
    <details className="selection-method"><summary>Come scegliamo e ordiniamo le quote</summary><p>Probabilità implicita = 1 ÷ quota. EV = probabilità stimata × quota − 1. Per comparire serve anche EV positivo sul limite prudente euristico, almeno 30 precedenti per giocatore e una coppia coerente di quote fresche. Una selezione per partita, ordinata per probabilità decrescente; a parità, EV prudente e vicinanza a quota 2. Minimo 1,30, nessun massimo.</p><p>Percentuali sperimentali, non garanzie. Il test statistico prosegue separatamente.</p></details>
  </section>;
}
function SelectedMatch({ match: m, quote, current,retained,token, now, open, onToggle, onClose, onRefresh, busy }: { match: FeedMatch; quote?: ValueOpportunity;current:boolean;retained:boolean; token?: string; now: number; open: boolean; onToggle: () => void; onClose: () => void; onRefresh: () => void; busy: boolean }) {
  const live = current&&isFreshLive(m, now);
  const usable=current&&isUpcomingOrLive(m,now);
  const value=!!quote&&quote.conservativeEv>0;
  return <details className={`match-card selected-match${live ? ' match-live' : ''}`} data-event-id={m.id} open={open} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <summary onClick={e => { e.preventDefault(); onToggle(); }}><span><small>{m.league} · {dateTime(m.kickoff_utc)}</small><strong>{m.home} — {m.away}</strong>{quote ? <span>Vincente partita · {quote.selection}</span> : <span>{!current?'Evento non più nel feed · dati mantenuti aperti':live?'Live · statistiche disponibili':'Nessuna quota selezionata attualmente'}</span>}</span><span className="match-badges">{live && <span className="live-badge"><i aria-hidden="true"/>LIVE</span>}{live && m.score && <span className="score-badge">{m.score}</span>}{quote && <span className="summary-price"><b>{(quote.probability * 100).toFixed(1)}%</b><small>Stima modello</small><strong>Quota {quote.odds.toFixed(2)}</strong></span>}<span className="badge">{open ? 'Chiudi ↑' : 'Apri ↓'}</span></span></summary>
    {open && <div className="match-content"><div className="match-actions"><button className="primary" disabled={busy} onClick={onRefresh}>{busy ? 'Aggiornamento…' : '↻ Aggiorna quota'}</button><button className="secondary" onClick={onClose}>✕ Chiudi quote</button></div>
      {retained&&<p className="banner" role="status">{!usable?'Evento non più disponibile tra le partite attive. Le statistiche già aperte restano consultabili.':'Partita mantenuta aperta durante gli aggiornamenti. Manteniamo consultabili i dati; quota e stima compaiono solo quando aggiornate e coerenti.'}</p>}{quote ? <SelectedQuote quote={quote} token={value?token:undefined} eligible={value}/> : <p role="status">Quota o stima attuale non disponibili. Il pannello e le statistiche restano aperti.</p>}
      <SaveChoice token={usable?token:undefined} eventId={m.id}/><PlayerAnalysis token={token} eventId={m.id} showEstimates={false}/>
      <button className="secondary close-bottom" onClick={onClose}>✕ Chiudi questa partita</button>
    </div>}
  </details>;
}
function SelectedQuote({ quote: o, token,eligible }: { quote: ValueOpportunity; token?: string;eligible:boolean }) {
  return <article className="selected-quote" aria-label={`Quota selezionata: ${o.selection}`}><div className="panel-heading"><div><span className="eyebrow">VINCENTE PARTITA · PREMATCH</span><h3>{o.selection}</h3></div><span className="badge">{eligible?'Sperimentale':'Fuori selezione'}</span></div><div className="quote-highlights" aria-live="polite" aria-atomic="true"><div><strong>{(o.probability * 100).toFixed(1)}%</strong><span>Probabilità stimata</span></div><div><strong>{o.odds.toFixed(2)}</strong><span>Quota bet365</span></div><div><strong>{o.ev>=0?'+':''}{((o.probability * o.odds - 1) * 100).toFixed(1)}%</strong><span>Valore atteso (EV)</span></div></div><p className="fine">Quota modificata: {dateTime(o.quoteAt)} · Mercato letto: {dateTime(o.marketReadAt)} · {o.sampleSize} precedenti nel campione minimo.</p><details className="quote-explanation"><summary>Perché è stata selezionata?</summary><dl><dt>Probabilità implicita nella quota</dt><dd>{(100 / o.odds).toFixed(1)}%</dd><dt>Quota equa stimata</dt><dd>{(1 / o.probability).toFixed(2)}</dd><dt>Limite prudente euristico</dt><dd>{(o.probabilityLower * 100).toFixed(1)}%</dd><dt>EV prudente</dt><dd>{o.conservativeEv>=0?'+':''}{((o.probabilityLower * o.odds - 1) * 100).toFixed(1)}%</dd></dl><p className="fine">{eligible?'Il prezzo supera la quota equa stimata anche usando il limite prudente.':'La quota non supera più il filtro di convenienza prudente.'} L’affidabilità del modello è ancora in verifica.</p></details><div className="selection-buttons"><RecordPrediction key={`${o.modelVersion}:${o.selection}:${o.quoteAt}:${o.odds}:${o.probability}`} token={token} eventId={o.eventId} selection={o.selection} odds={o.odds} quoteAt={o.quoteAt} probability={o.probability} modelVersion={o.modelVersion ?? ''}/>{o.quoteKey && <SaveChoice key={`${o.quoteAt}:${o.odds}`} token={token} eventId={o.eventId} quoteKey={o.quoteKey} expectedOdds={o.odds} expectedUpdatedAt={o.quoteAt}/>}</div></article>;
}
