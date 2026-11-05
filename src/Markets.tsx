import { useMemo, useState } from 'react';
import { filterBoard, isFreshLive, marketIdentity, marketName, quoteIdentity, quoteStatus, type Board, type FeedMatch, type FeedQuote } from './shared/board';
import { SaveChoice } from './Choices';
import { dateTime } from './shared/format';
import { PlayerAnalysis } from './PlayerAnalysis';

export function FeedStatus({ board, loading, error, refresh,disabled=false }: {disabled?:boolean; board: Board | null; loading: boolean; error: string; refresh: () => void }) {
  return <section className="panel feed-status"><div className="panel-heading"><div><span className="eyebrow">FONTE GRATUITA · SENZA CHIAVE</span><h2>MoviOdds · bet365 estero</h2></div><button className="primary" disabled={loading||disabled} onClick={refresh}>{loading ? 'Aggiornamento…' : 'Aggiorna quote'}</button></div>
    <p>Quote di bet365.com.au tramite MoviOdds, progetto indipendente. Statistiche e stime sperimentali sono consultabili nei dettagli delle partite.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {board ? <p role="status">{board.matches.length} partite nel feed · {new Set(board.matches.map(m => m.league)).size} campionati · Fonte: {dateTime(board.serverTime)} · {board.warming ? 'Caricamento iniziale del fornitore' : 'Aggiornamento ogni 30 secondi a pagina visibile'}</p> : !error && <p role="status">{loading ? 'Recupero delle quote reali…' : 'Accedi per caricare il feed.'}</p>}
    <p className="fine">Mostriamo solo live confermati e partite con inizio futuro. Eventi oltre orario senza conferma live sono esclusi; le quote possono essere sospese. <a href="https://moviodds.com/bet365-table-tennis-odds-api/" target="_blank" rel="noreferrer">Fonte e documentazione ↗</a></p>
  </section>;
}

export function Markets({ board, now, token }: { board: Board | null; now: number; token?: string }) {
  const [search, setSearch] = useState(''); const [competition, setCompetition] = useState('');
  const [state, setState] = useState(''); const [market, setMarket] = useState('');
  const [minOdds, setMinOdds] = useState('1.30'); const [includeUnavailable, setIncludeUnavailable] = useState(true);
  const [limit, setLimit] = useState(25);
  const competitions = useMemo(() => [...new Set(board?.matches.map(m => m.league) ?? [])].sort(), [board]);
  const markets = useMemo(() => [...new Set(board?.matches.flatMap(m => m.quotes.map(marketName)) ?? [])].sort(), [board]);
  const matches = useMemo(() => filterBoard(board?.matches ?? [], { search, competition, state, market,
    minOdds: Math.max(1, Number(minOdds) || 1), includeUnavailable }, now), [board, search, competition, state, market, minOdds, includeUnavailable, now]);
  const changed = () => setLimit(25);
  return <section className="panel"><h2>Tutti i campionati e mercati del feed</h2><p>Nomi e linee originali della fonte. Nessuna selezione viene convertita in un pronostico o abbinata a mercati diversi.</p>
    <div className="history-controls"><button className={state === 'live' ? 'primary' : 'text-button'} onClick={() => { setState(state === 'live' ? '' : 'live'); changed(); }}>● {state === 'live' ? 'Mostra tutte le partite' : `Solo LIVE (${board?.matches.filter(m => isFreshLive(m, now)).length ?? 0} aggiornate)`}</button></div>
    <div className="filters"><label>Cerca eventi<input type="search" value={search} placeholder="Giocatore, campionato o ID evento" onChange={e => { setSearch(e.target.value); changed(); }}/></label>
      <label>Campionato<select aria-label="Campionato" value={competition} onChange={e => { setCompetition(e.target.value); changed(); }}><option value="">Tutti ({competitions.length})</option>{competitions.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Stato<select aria-label="Stato" value={state} onChange={e => { setState(e.target.value); changed(); }}><option value="">Live e da iniziare</option><option value="prematch">Da iniziare</option><option value="live">Live confermate</option></select></label>
      <label>Mercato<select aria-label="Mercato" value={market} onChange={e => { setMarket(e.target.value); changed(); }}><option value="">Tutti ({markets.length})</option>{markets.map(m => <option key={m}>{m}</option>)}</select></label>
      <label>Quota minima<input type="number" min="1" step="0.01" value={minOdds} onChange={e => { setMinOdds(e.target.value); changed(); }}/></label>
    </div><label className="check-label"><input type="checkbox" checked={includeUnavailable} onChange={e => { setIncludeUnavailable(e.target.checked); changed(); }}/> Mostra anche voci sospese o non disponibili, indipendentemente dalla quota minima</label>
    <p className="fine">Quota minima iniziale 1,30; imposta 1 per vedere tutti i prezzi. Nessun limite massimo. {matches.length} partite corrispondono ai filtri.</p>
    {!board ? <p>Nessun feed caricato.</p> : !matches.length ? <p>Nessuna partita corrisponde ai filtri; il catalogo può essere vuoto o in caricamento.</p> : <div className="match-list">{matches.slice(0, limit).map(m => <Match key={m.id} match={m} now={now} token={token}/>)}</div>}
    {matches.length > limit && <button className="primary more-matches" onClick={() => setLimit(v => v + 25)}>Mostra altre 25 partite ({matches.length - limit} rimanenti)</button>}
  </section>;
}
function Match({ match: m, now, token }: { match: FeedMatch; now: number; token?: string }) {
  const groups = new Map<string, FeedQuote[]>();
  for (const q of m.quotes) { const id = marketIdentity(q); const group = groups.get(id) ?? []; group.push(q); groups.set(id, group); }
  const liveFresh = isFreshLive(m, now);
  const state = m.in_play ? (liveFresh ? 'Live · fonte aggiornata' : 'Live segnalato · aggiornamento non confermato')
    : m.kickoff_utc && Date.parse(m.kickoff_utc) > now ? 'Prematch' : 'Orario superato / stato da verificare';
  return <details className={liveFresh ? 'match-card match-live' : 'match-card'}><summary><span><small>{m.league}</small><strong>{m.home} — {m.away}</strong><span>{dateTime(m.kickoff_utc)} · {state}</span></span><span className="match-badges">{m.in_play && <span className={liveFresh ? 'live-badge' : 'live-badge live-uncertain'}><i aria-hidden="true"/>{liveFresh ? 'LIVE' : 'LIVE NON CONFERMATO'}</span>}{m.in_play && m.score && <span className="score-badge" aria-label={`Punteggio dalla fonte: ${m.score}`}>{m.score}</span>}<span className="badge">{m.quotes.length} voci quota · Apri</span></span></summary>
    <div className="match-content"><p className="fine">Bet365.com.au · ID evento {m.id} · Ultima lettura evento: {dateTime(m.polled_at)}{m.score ? ` · Punteggio riportato dalla fonte: ${m.score}` : ''}</p>
      <SaveChoice token={token} eventId={m.id}/>
      <PlayerAnalysis token={token} eventId={m.id}/>
      {[...groups].map(([id, quotes]) => <section className="market-group" key={id}><h3>{marketName(quotes[0])}</h3><p className="fine">Periodo: {quotes[0].period ?? 'Non specificato'} · Gruppo {quotes[0].group_id} · Sottomercato {quotes[0].market_id ?? 'Non specificato'} · Fase {quotes[0].phase ?? 'prematch'}</p>
        <div className="quote-grid">{quotes.map(q => <article className="quote" key={quoteIdentity(q)}><strong>{q.label || q.side || 'Selezione senza etichetta'}</strong>
          {q.side && q.side !== q.label && <span>Lato: {q.side}</span>}{q.line !== undefined && <span>Linea: {q.line}</span>}{q.handicap !== undefined && <span>Handicap: {q.handicap}</span>}{q.n2 && <span>Partecipante: {q.n2}</span>}
          <b>{q.suspended || q.odds_dec <= 1 ? '—' : q.odds_dec.toLocaleString('it-IT', { maximumFractionDigits: 4 })}</b>
          <small>{quoteStatus(m, q, now)}</small><small>Prezzo modificato: {dateTime(q.ts)}</small><small>Mercato letto: {dateTime(m.group_status?.[q.group_id]?.polled_at)}</small><small>ID selezione: {q.sel_id}</small>
          {quoteStatus(m,q,now)==='Letta di recente dalla fonte'&&<SaveChoice token={token} eventId={m.id} quoteKey={quoteIdentity(q)} expectedOdds={q.odds_dec} expectedUpdatedAt={q.ts}/>}
        </article>)}</div></section>)}
    </div></details>;
}
