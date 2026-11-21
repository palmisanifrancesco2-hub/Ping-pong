import {useEffect,useState} from 'react';
import {bookmakerSelectionLabel,marketPriceKey,otherBookmakerMarkets,type MarketEstimateReport} from './shared/additional-markets';
import type {FeedMatch,FeedQuote} from './shared/board';
import {dateTime,fairOddsText} from './shared/format';

type Props = {match:FeedMatch;now:number;available:boolean;boardCheckedAt?:string;token?:string};

export function AdditionalMarkets({match,now,available,boardCheckedAt,token}:Props) {
  const [expanded,setExpanded] = useState(false);
  const [report,setReport] = useState<MarketEstimateReport|null>(null);
  const [error,setError] = useState(false);
  const eligible = expanded && available && !match.in_play;
  const eventId = match.id;

  useEffect(()=>{
    if (!eligible || !token) return;
    const controller = new AbortController();
    setError(false);
    void (async()=>{
      try {
        const response = await fetch(`/api/market-estimates?${new URLSearchParams({eventId})}`,{
          headers:{Authorization:`Bearer ${token}`},cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25_000)]),
        });
        if (!response.ok) throw Error('Stime indisponibili');
        const data = await response.json() as MarketEstimateReport;
        if (!controller.signal.aborted) setReport(data);
      } catch {
        if (!controller.signal.aborted) { setReport(null);setError(true); }
      }
    })();
    return ()=>controller.abort();
  },[eligible,eventId,token,boardCheckedAt]);

  const groups = expanded && available ? otherBookmakerMarkets(match,now) : [];
  const age = now-Date.parse(report?.checkedAt??'');
  const estimates = eligible && age>=-60_000 && age<=120_000 ? report?.estimates : undefined;
  const canShowEstimates = estimates && Object.keys(estimates).length>0;
  return <details className="selection-method additional-markets" open={expanded} onToggle={event=>{
    if (event.target===event.currentTarget) setExpanded(event.currentTarget.open);
  }}>
    <summary>Altri mercati Bet365</summary>
    {expanded && <>
      {groups.length===0 ? <p role="status">Altre quote aggiornate al momento indisponibili.</p> : <>
        {error ? <p role="status">Stime del modello temporaneamente indisponibili.</p> :
          canShowEstimates ? <p className="fine">Le percentuali e le quote eque indicate sono stime sperimentali del modello prematch.</p> :
            <p className="fine">{match.in_play ? 'Prezzi live di Bet365.' : 'Le stime richiedono una linea studiata, dati storici e il formato della partita confermato.'}</p>}
        {groups.map(group=><MarketPrices key={group.key} title={group.title} quotes={group.quotes} estimates={estimates}/>)}
      </>}
    </>}
  </details>;
}

function MarketPrices({title,quotes,estimates}:{title:string;quotes:FeedQuote[];estimates?:MarketEstimateReport['estimates']}) {
  const [expanded,setExpanded]=useState(false);
  return <details open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
    <summary>{title} · {quotes.length}</summary>
    {expanded && <ul className="competition-list">{quotes.map(quote=>{
      const key=marketPriceKey(quote), probability=estimates?.[key];
      return <li key={key}>
        <span><strong>{bookmakerSelectionLabel(quote)}</strong>
          <small>Bet365 · {dateTime(quote.ts)}</small>
          {probability!==undefined && <small>{probability.toLocaleString('it-IT',{style:'percent',maximumFractionDigits:1})} stimata · Quota equa {fairOddsText(probability)}</small>}
        </span>
        <strong>{quote.odds_dec.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:3})}</strong>
      </li>;
    })}</ul>}
  </details>;
}
