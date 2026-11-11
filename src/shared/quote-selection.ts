import type { ValueReport } from './value.js';
import type { ValueOpportunity } from '../domain/value.js';
import { isUpcomingOrLive, quoteIdentity, quoteStatus, type FeedMatch } from './board.js';

/** Recompute both margins from the current price; cached EV fields are not authoritative. */
export function hasPositiveValue(o:Pick<ValueOpportunity,'probability'|'probabilityLower'|'odds'>){
  return [o.odds,o.probability,o.probabilityLower].every(Number.isFinite)
    && o.odds>=1.3&&o.probability>0&&o.probability<1&&o.probabilityLower>=0&&o.probabilityLower<=o.probability
    && o.probability*o.odds>1&&o.probabilityLower*o.odds>1;
}

export function probabilityOrder(a: ValueOpportunity, b: ValueOpportunity) {
  return b.probability - a.probability || b.conservativeEv - a.conservativeEv
    || Math.abs(a.odds - 2) - Math.abs(b.odds - 2) || a.id.localeCompare(b.id);
}

/** Display policy only: the frozen prospective enrollment rules stay unchanged. */
export function selectedQuotes(report: ValueReport | null, matches: FeedMatch[], now: number, minOdds = 1.3) {
  if (!report || !Number.isFinite(now) || !Number.isFinite(Date.parse(report.checkedAt)) || now - Date.parse(report.checkedAt) > 120000 || Date.parse(report.checkedAt) > now + 60000) return [];
  const events = new Map(matches.map(m => [m.id, m]));
  const sourceRows=report.policy==='strict-adm-independent-v16'?(report.rankings?.value??[]):[...report.opportunities,...(report.experimental??[])];
  const rows = sourceRows.filter(o => {
    const m = events.get(o.eventId);
    if (!m || m.in_play || !isUpcomingOrLive(m, now) || !o.fresh || o.sampleSize < 30) return false;
    if (!hasPositiveValue(o)||o.odds<Math.max(1.3,minOdds)) return false;
    const q = m.quotes.find(q => quoteIdentity(q) === o.quoteKey);
    return !!q && q.fixture_id === m.id && q.side === o.selection && q.group_id === '920000' && q.line === 'To Win' && q.phase !== 'inplay'
      && q.odds_dec === o.odds && q.ts === o.quoteAt && Date.parse(q.ts) <= now
      && quoteStatus(m, q, now) === 'Letta di recente dalla fonte';
  }).sort(probabilityOrder);
  const seen = new Set<string>();
  return rows.filter(o => { if (seen.has(o.eventId)) return false; seen.add(o.eventId); return true; });
}

export type OpenMatch={match:FeedMatch;index:number;selection:string|null};
/** An open panel stays mounted at the same index, even if its quote loses value. */
export function keepOpenMatch(rows:FeedMatch[],opened:OpenMatch|null,current:FeedMatch[]):FeedMatch[]{
  if(!opened)return rows;
  const latest=current.find(m=>m.id===opened.match.id)??opened.match;
  const rest=rows.filter(m=>m.id!==opened.match.id);rest.splice(Math.min(opened.index,rest.length),0,latest);return rest;
}
export function openQuote(report:ValueReport|null,m:FeedMatch|undefined,selection:string|null,now:number){
  if(!report||!m||!selection||m.in_play||!isUpcomingOrLive(m,now)||!Number.isFinite(Date.parse(report.checkedAt))||now-Date.parse(report.checkedAt)>120000)return undefined;
  const sourceRows=report.policy==='strict-adm-independent-v16'?(report.rankings?.value??[]):[...(report.estimates??[]),...report.opportunities,...(report.experimental??[])];
  return sourceRows.find(o=>{
    if(o.eventId!==m.id||o.selection!==selection||!hasPositiveValue(o))return false;
    const q=m.quotes.find(q=>quoteIdentity(q)===o.quoteKey);
    return !!q&&q.fixture_id===m.id&&q.side===selection&&q.odds_dec===o.odds&&q.ts===o.quoteAt&&q.phase!=='inplay'&&Date.parse(q.ts)<=now&&quoteStatus(m,q,now)==='Letta di recente dalla fonte';
  });
}
