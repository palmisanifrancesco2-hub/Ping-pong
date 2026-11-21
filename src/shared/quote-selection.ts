import type { ValueReport } from './value.js';
import type { ValueOpportunity } from '../domain/value.js';
import { isUpcomingOrLive, marketIdentity, quoteIdentity, quoteStatus, type FeedMatch } from './board.js';

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

function freshReport(report: ValueReport | null, now: number): report is ValueReport {
  const age = now - Date.parse(report?.checkedAt ?? '');
  return !!report && Number.isFinite(age) && age >= -60_000 && age <= 120_000;
}

function displayedCandidates(report: ValueReport) {
  return [...(report.rankings?.value ?? report.opportunities), ...(report.experimental ?? [])];
}

export function eventWinnerEstimate(report: ValueReport | null, match: FeedMatch, now: number) {
  if (!freshReport(report, now) || !isUpcomingOrLive(match, now)) return;
  if (!report.winnerEstimates || !Object.hasOwn(report.winnerEstimates, match.id)) return;
  const estimate = report.winnerEstimates[match.id];
  if (match.in_play) {
    const age = now - Date.parse(report.checkedAt);
    if (!estimate.liveScore || estimate.liveScore !== match.score || age > 60_000) return;
  } else if (estimate.liveScore) return;
  return estimate;
}

/** Display policy only: the frozen prospective enrollment rules stay unchanged. */
export function selectedQuotes(report: ValueReport | null, matches: FeedMatch[], now: number, minOdds = 1.3) {
  if (!freshReport(report, now)) return [];
  const events = new Map(matches.map(m => [m.id, m]));
  const sourceRows = displayedCandidates(report);
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

export function bookmakerWinnerPrices(match: FeedMatch, now: number) {
  if (!isUpcomingOrLive(match, now)) return [];
  const prices = match.quotes.filter(q =>
    q.fixture_id === match.id && q.group_id === '920000' && q.line === 'To Win'
    && (q.side === match.home || q.side === match.away)
    && (match.in_play ? q.phase === 'inplay' : q.phase !== 'inplay')
    && Number.isFinite(q.odds_dec) && Date.parse(q.ts) <= now
    && quoteStatus(match, q, now) === 'Letta di recente dalla fonte',
  );
  if (new Set(prices.map(marketIdentity)).size > 1 || new Set(prices.map(q => q.side)).size !== prices.length) return [];
  return [...prices].sort((a, b) => Number(b.side === match.home) - Number(a.side === match.home));
}

export type OpenMatch={match:FeedMatch;index:number;selection:string|null};
/** An open panel stays mounted at the same index, even if its quote loses value. */
export function keepOpenMatch(rows:FeedMatch[],opened:OpenMatch|null,current:FeedMatch[]):FeedMatch[]{
  if(!opened)return rows;
  const latest=current.find(m=>m.id===opened.match.id)??opened.match;
  const rest=rows.filter(m=>m.id!==opened.match.id);rest.splice(Math.min(opened.index,rest.length),0,latest);return rest;
}
export function openQuote(report:ValueReport|null,m:FeedMatch|undefined,selection:string|null,now:number){
  if(!freshReport(report,now)||!m||!selection||m.in_play||!isUpcomingOrLive(m,now))return undefined;
  const sourceRows = [...displayedCandidates(report),...(report.estimates??[])];
  return sourceRows.find(o=>{
    if(o.eventId!==m.id||o.selection!==selection||!o.fresh||o.sampleSize<30||!hasPositiveValue(o))return false;
    const q=m.quotes.find(q=>quoteIdentity(q)===o.quoteKey);
    return !!q&&q.fixture_id===m.id&&q.side===selection&&q.group_id==='920000'&&q.line==='To Win'&&q.odds_dec===o.odds&&q.ts===o.quoteAt&&q.phase!=='inplay'&&Date.parse(q.ts)<=now&&quoteStatus(m,q,now)==='Letta di recente dalla fonte';
  });
}
