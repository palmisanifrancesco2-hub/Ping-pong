import {useEffect,useState} from 'react';
import {SportSelect} from './SportSelect';
import {bookmakerOddsText,dateTime} from './shared/format';
import {individualSports,type AdditionalSport,type IndividualSport,type SportBoard,type SportDetail} from './shared/individual-sports';

export function IndividualOdds({token,sport,onSelect,onTableTennis}:{token:string;sport:IndividualSport;onSelect:(sport:IndividualSport)=>void;onTableTennis:()=>void}) {
  return <>
    <section className="panel"><SportSelect sport={sport} onSelect={onSelect}/></section>
    {sport==='table_tennis' ? <section className="panel"><h2>Quote e modelli di tennistavolo</h2>
      <button className="primary" onClick={onTableTennis}>Apri Partite e mercati</button>
    </section> : <SportOdds key={sport} sport={sport} token={token}/>}
  </>;
}

async function readOdds<T>(token:string,params:URLSearchParams,signal:AbortSignal):Promise<T> {
  const response=await fetch(`/api/sport-odds?${params}`,{headers:{Authorization:`Bearer ${token}`},
    signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),cache:'no-store'});
  const payload=await response.json();
  if (!response.ok) throw Error(payload.error ?? 'Quote non disponibili. Riprova.');
  return payload as T;
}

function SportOdds({token,sport}:{token:string;sport:AdditionalSport}) {
  const [board,setBoard]=useState<SportBoard>();
  const [detail,setDetail]=useState<SportDetail>();
  const [selected,setSelected]=useState<string>();
  const [revision,refresh]=useState(0);
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState('');
  const [detailError,setDetailError]=useState('');
  const [search,setSearch]=useState('');
  const [competition,setCompetition]=useState('');
  const [state,setState]=useState('');
  const [pageSize,setPageSize]=useState(25);

  useEffect(()=>{
    const request=new AbortController();
    setLoading(true);
    setError('');
    readOdds<SportBoard>(token,new URLSearchParams({sport}),request.signal)
      .then(value=>{if(!request.signal.aborted)setBoard(value);})
      .catch(cause=>{if(!request.signal.aborted){setBoard(undefined);setError(cause.message);}})
      .finally(()=>{if(!request.signal.aborted)setLoading(false);});
    return ()=>request.abort();
  },[token,sport,revision]);

  useEffect(()=>{
    if(!selected)return;
    const request=new AbortController();
    setDetailLoading(true);
    setDetailError('');
    readOdds<SportDetail>(token,new URLSearchParams({sport,eventId:selected}),request.signal)
      .then(value=>{if(!request.signal.aborted)setDetail(value);})
      .catch(cause=>{if(!request.signal.aborted){setDetail(undefined);setDetailError(cause.message);}})
      .finally(()=>{if(!request.signal.aborted)setDetailLoading(false);});
    return ()=>request.abort();
  },[token,sport,selected,revision]);

  const normalize=(value:string)=>value.toLocaleLowerCase('it').trim();
  const events=(board?.events??[]).filter(event=>
    (!competition||event.league===competition)&&(!state||event.in_play===(state==='live'))&&
    normalize(`${event.home} ${event.away} ${event.league}`).includes(normalize(search)))
    .sort((a,b)=>Number(b.in_play)-Number(a.in_play) || Date.parse(a.kickoff_utc??'')-Date.parse(b.kickoff_utc??''));
  const leagues=[...new Set(board?.events.map(event=>event.league))].sort((a,b)=>a.localeCompare(b,'it'));
  return <section className="panel">
    <div className="panel-heading"><h2>Quote Bet365 · {individualSports[sport]}</h2>
      <button className="primary" disabled={loading||detailLoading} onClick={()=>refresh(value=>value+1)}>Aggiorna quote</button>
    </div>
    <p className="fine">Fonte MoviOdds · bet365.com.au. {board&&`Rilevazione ${dateTime(board.checkedAt)}.`} {board?.mainLinesOnly&&'Il feed restituisce solo i mercati principali.'}</p>
    <p>Probabilità e quota equa saranno disponibili quando un modello per {individualSports[sport]} sarà validato.</p>
    <div className="filters">
      <label>Cerca incontro<input type="search" value={search} onChange={event=>{setSearch(event.target.value);setPageSize(25);}}/></label>
      <label>Competizione<select value={competition} onChange={event=>{setCompetition(event.target.value);setPageSize(25);}}>
        <option value="">Tutte</option>{leagues.map(league=><option key={league}>{league}</option>)}
      </select></label>
      <label>Stato<select value={state} onChange={event=>{setState(event.target.value);setPageSize(25);}}>
        <option value="">Live e da iniziare</option><option value="live">Live</option><option value="prematch">Da iniziare</option>
      </select></label>
    </div>
    {loading&&<p role="status">Caricamento quote…</p>}
    {error&&<p role="alert" className="error">{error}</p>}
    {board&&<p>{events.length ? `${events.length} incontri disponibili` : board.warming?'Il feed si sta aggiornando.':'Nessun incontro disponibile per questi filtri.'}</p>}
    <div className="prediction-list">{events.slice(0,pageSize).map(event=><article key={event.id} className="prediction-card">
      <div className="panel-heading"><div><small>{event.league} · {dateTime(event.kickoff_utc)}</small>
        <h3>{event.home} — {event.away}</h3></div>{event.in_play&&<span className="live-badge">LIVE {event.score}</span>}</div>
      {event.winnerPrices.length>0&&<ul className="competition-list" aria-label="Quote Bet365 vincente">
        {event.winnerPrices.map((price,index)=><li key={index}><span>{price.label}</span><strong>{bookmakerOddsText(price.odds)}</strong></li>)}
      </ul>}
      <button className="secondary" aria-expanded={selected===event.id} onClick={()=>{
        setDetail(undefined);setDetailError('');setDetailLoading(false);setSelected(selected===event.id?undefined:event.id);
      }}>{selected===event.id?'Chiudi incontro':`Quote e dati dell’incontro (${event.quoteCount} voci)`}</button>
      {selected===event.id&&<>
        {detailLoading&&<p role="status">Aggiornamento dati incontro…</p>}
        {detailError&&<p role="alert" className="error">{detailError}</p>}
        {detail&&<EventOdds key={event.id} detail={detail}/>}
      </>}
    </article>)}</div>
    {events.length>pageSize&&<button className="secondary more-matches" onClick={()=>setPageSize(value=>value+25)}>Mostra altri incontri</button>}
  </section>;
}

function EventOdds({detail}:{detail:SportDetail}) {
  const [market,setMarket]=useState('');
  const group=detail.groups.find(row=>row.key===market)??detail.groups[0];
  return <>
    {detail.context.length>0&&<p>{detail.context.map(field=>`${field.label} ${field.value}`).join(' · ')}</p>}
    {detail.stats.length>0&&<details><summary>Statistiche live</summary><p>{detail.event.home} · {detail.event.away}</p>
      <dl>{detail.stats.map(stat=><div key={stat.label}><dt>{stat.label}</dt><dd>{stat.first} · {stat.second}</dd></div>)}</dl>
    </details>}
    {group ? <>
      <label>Mercato<select aria-label="Mercato" value={group.key} onChange={event=>setMarket(event.target.value)}>
        {detail.groups.map(({key,name,period})=><option key={key} value={key}>{name}{period&&` · ${period}`}</option>)}
      </select></label>
      <ul className="competition-list">{group.quotes.map(({quote,status})=><li key={quote.sel_id}>
        <span>{[...new Set([quote.label??quote.side??`Selezione ${quote.sel_id}`,quote.line,quote.handicap].filter(Boolean))].join(' · ')}
          <small>{status} · {dateTime(quote.ts)}</small></span>
        <strong>{quote.suspended ? '—' : bookmakerOddsText(quote.odds_dec)}</strong>
      </li>)}</ul>
      <p className="fine">Dati rilevati il {dateTime(detail.checkedAt)}</p>
    </> : <p>Il feed non ha pubblicato quote per questo incontro.</p>}
    {!detail.stats.length&&<p className="fine">Statistiche live non fornite per questo incontro.</p>}
  </>;
}
