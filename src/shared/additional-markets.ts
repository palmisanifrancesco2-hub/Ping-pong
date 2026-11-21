import {isUpcomingOrLive, marketIdentity, marketName, quoteIdentity, quoteStatus, type FeedMatch, type FeedQuote} from './board.js';

const marketTitles: Readonly<Record<string,string>> = {
  '240:920065':'Handicap set',
  '920000:920008':'Handicap set',
  '240:920134':'Handicap punti',
  '920009:920009':'Handicap punti',
  '240:920066':'Over/Under punti partita',
  '920000:920014':'Over/Under punti partita',
  '920064:':'Risultato esatto partita',
  '920096:920096':'Vincente primo set',
  '238:920055':'Vincente set',
  '238:920081':'Handicap punti set',
  '238:920056':'Over/Under punti set',
  '920096:920111':'Over/Under punti primo set',
};

export function freshMatchQuote(match:FeedMatch,quote:FeedQuote,now:number) {
  return quote.fixture_id===match.id && (match.in_play ? quote.phase==='inplay' : quote.phase!=='inplay')
    && Number.isFinite(quote.odds_dec) && Date.parse(quote.ts)<=now
    && quoteStatus(match,quote,now)==='Letta di recente dalla fonte';
}

export function hasBestOfFiveMarket(match:FeedMatch,now:number) {
  const scores = match.quotes.filter(q=>q.group_id==='920064'&&q.group_name==='Match Correct Score'&&freshMatchQuote(match,q,now));
  return scores.length>0 && scores.every(q=>/^(?:3-[012]|[012]-3)$/.test(q.line??''));
}

export function otherBookmakerMarkets(match:FeedMatch,now:number) {
  const groups = new Map<string,{title:string;priority:number;quotes:FeedQuote[]}>();
  if (!isUpcomingOrLive(match,now)) return [];
  for (const quote of match.quotes) {
    if (quote.group_id==='920000'&&quote.line==='To Win') continue;
    if (!freshMatchQuote(match,quote,now)) continue;
    // Feed group IDs can be reused across periods and different market names.
    const known = quote.group_id==='238' && quote.market_id==='920055' && quote.handicap
      ? 'Handicap punti set' : marketTitles[`${quote.group_id}:${quote.market_id??''}`];
    const title = known
      ? `${known}${quote.period && !known.includes('primo') ? ` · set ${quote.period}` : ''}`
      : marketName(quote);
    const key = JSON.stringify([marketIdentity(quote),marketName(quote),title]);
    const group = groups.get(key);
    if (group) group.quotes.push(quote);
    else groups.set(key,{title,priority:known ? 0 : 1,quotes:[quote]});
  }
  return [...groups].map(([key,group])=>({key,...group}))
    .sort((a,b)=>a.priority-b.priority||a.title.localeCompare(b.title,'it',{numeric:true}));
}

export function marketPriceKey(quote:FeedQuote) {
  return JSON.stringify([quoteIdentity(quote),quote.group_name,quote.side,quote.line,quote.handicap,quote.odds_dec,quote.ts]);
}

export type MarketEstimateReport={checkedAt:string; estimates:Record<string,number>};

export function bookmakerSelectionLabel(quote:FeedQuote) {
  const label = quote.label?.trim();
  if (label && /^(?:over|under|[ou])\s/i.test(label) && quote.side && !['Over','Under'].includes(quote.side)) {
    return `${quote.side} · ${label.replace(/(\d)\.(\d)/g,'$1,$2')}`;
  }
  const parts = [quote.side,quote.line,quote.handicap].filter((part):part is string=>!!part?.trim())
    .map(part=>part.trim().replace(/^([+-]?\d+)\.(\d+)$/,'$1,$2'));
  const specific = parts.filter(part=>!['Total','Line','To Win'].includes(part));
  return [...new Set(specific)].join(' · ') || label || 'Selezione';
}
