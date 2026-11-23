import {guardedValue} from './value-filter.js';
import type { ValueReport, WinnerEstimate } from './value.js';
import type { ValueOpportunity } from '../domain/value.js';
import { isUpcomingOrLive, marketIdentity, quoteIdentity, quoteStatus, type FeedMatch } from './board.js';

export const nearOneFifty = { minimum: 1.4, maximum: 1.6 };

export function oddsInRange(odds: number, minimum: number, maximum = Infinity) {
  return Number.isFinite(odds) && odds >= minimum && odds <= maximum;
}

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

function freshReport<T extends Pick<ValueReport,'checkedAt'>>(report: T | null, now: number): report is T {
  const age = now - Date.parse(report?.checkedAt ?? '');
  return !!report && Number.isFinite(age) && age >= -60_000 && age <= 120_000;
}

function displayedCandidates(report: ValueReport) {
  return [...(report.rankings?.value ?? report.opportunities), ...(report.experimental ?? [])];
}

export function eventWinnerEstimate(report: Pick<ValueReport,'checkedAt'|'winnerEstimates'> | null, match: FeedMatch, now: number) {
  if (!freshReport(report, now) || !isUpcomingOrLive(match, now)) return;
  if (!report.winnerEstimates || !Object.hasOwn(report.winnerEstimates, match.id)) return;
  const estimate = report.winnerEstimates[match.id];
  if (match.in_play) {
    const age = now - Date.parse(report.checkedAt);
    if (!estimate.liveScore || estimate.liveScore !== match.score || age > 60_000) return;
  } else if (estimate.liveScore) return;
  return estimate;
}

function preferredSide(estimate: WinnerEstimate) {
  const percent = Math.round(estimate.homeProbability * 1000);
  return percent===500 ? null : percent>500 ? 'home' : 'away';
}

export function matchModelAssessment(report:ValueReport|null, match:FeedMatch, now:number, preferEnsemble=false) {
  const score = eventWinnerEstimate(report,match,now);
  const ensemble = !match.in_play && report?.ensemble
    ? eventWinnerEstimate({checkedAt:report.checkedAt,winnerEstimates:report.ensemble.winnerEstimates},match,now)
    : undefined;
  const estimate = preferEnsemble ? ensemble??score : score??ensemble;
  const models = [score,ensemble].filter((row):row is WinnerEstimate=>!!row);
  const sides = models.map(preferredSide);
  const agreement = models.length!==2 ? null : sides[0]===sides[1]
    ? sides[0] ? 'same' : 'tie' : 'different';
  return {estimate,models,agreement};
}

/** Display policy only: the frozen prospective enrollment rules stay unchanged. */
export function selectedQuotes(report: ValueReport | null, matches: FeedMatch[], now: number, minOdds = 1.3, maxOdds = Infinity, guard = false) {
  if (!freshReport(report, now)) return [];
  const events = new Map(matches.map(m => [m.id, m]));
  const sourceRows = displayedCandidates(report);
  const rows = sourceRows.filter(o => {
    const m = events.get(o.eventId);
    if (!m || m.in_play || !isUpcomingOrLive(m, now) || !o.fresh || o.sampleSize < 30) return false;
    if (!hasPositiveValue(o)||(guard&&!o.modelValidated&&!quoteGuard(o,m,now))||!oddsInRange(o.odds,Math.max(1.3,minOdds),maxOdds)) return false;
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

export function quoteGuard(o:ValueOpportunity,m:FeedMatch,now:number) {
  const pair=bookmakerWinnerPrices(m,now);
  const own=pair.find(quote=>quote.side===o.selection);
  const opposite=pair.find(quote=>quote.side!==o.selection);
  if(!own||!opposite||own.odds_dec!==o.odds||quoteIdentity(own)!==o.quoteKey)return null;
  return guardedValue(o.probability,o.probabilityLower,o.odds,opposite.odds_dec);
}

export type OpenMatch={match:FeedMatch;index:number;selection:string|null};
/** An open panel stays mounted at the same index, even if its quote loses value. */
export function keepOpenMatch(rows:FeedMatch[],opened:OpenMatch|null,current:FeedMatch[]):FeedMatch[]{
  if(!opened)return rows;
  const latest=current.find(m=>m.id===opened.match.id)??opened.match;
  const rest=rows.filter(m=>m.id!==opened.match.id);rest.splice(Math.min(opened.index,rest.length),0,latest);return rest;
}
export function openQuote(report:ValueReport|null,m:FeedMatch|undefined,selection:string|null,now:number,guard=false){
  if(!freshReport(report,now)||!m||!selection||m.in_play||!isUpcomingOrLive(m,now))return undefined;
  const sourceRows = [...displayedCandidates(report),...(report.estimates??[])];
  return sourceRows.find(o=>{
    if(o.eventId!==m.id||o.selection!==selection||!o.fresh||o.sampleSize<30||!hasPositiveValue(o)||(guard&&!o.modelValidated&&!quoteGuard(o,m,now)))return false;
    const q=m.quotes.find(q=>quoteIdentity(q)===o.quoteKey);
    return !!q&&q.fixture_id===m.id&&q.side===selection&&q.group_id==='920000'&&q.line==='To Win'&&q.odds_dec===o.odds&&q.ts===o.quoteAt&&q.phase!=='inplay'&&Date.parse(q.ts)<=now&&quoteStatus(m,q,now)==='Letta di recente dalla fonte';
  });
}
