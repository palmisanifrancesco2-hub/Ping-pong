import {MarketContext,MARKET_TARGETS} from '../src/domain/market-context.js';
import {predictMarkets} from '../src/domain/market-runtime.js';
import {marketStudyProtocol} from '../src/domain/market-validation.js';
import {freshMatchQuote,hasBestOfFiveMarket,marketPriceKey,type MarketEstimateReport} from '../src/shared/additional-markets.js';
import {isUpcomingOrLive,type FeedMatch,type FeedQuote} from '../src/shared/board.js';
import {asOfWindow,withinWindow} from './as-of-window.js';
import type {ResultsArchive} from './results.js';

type Target = typeof MARKET_TARGETS[number];

export function marketTarget(match:FeedMatch,q:FeedQuote):{target:Target;invert:boolean}|undefined {
  const key = `${q.group_id}:${q.market_id??''}`;
  const first = q.period==='1';
  if (first && ['920096:920096','238:920055'].includes(key) && !q.handicap && (!q.line || q.line==='To Win')) {
    if (q.side===match.home || q.side===match.away) return {target:'first-set',invert:q.side===match.away};
    return;
  }
  const lineValue = /^[+-]?\d+\.5$/.test(q.line??'') ? Number(q.line) : undefined;
  const handicapValue = /^[+-]?\d+\.5$/.test(q.handicap??'') ? Number(q.handicap) : undefined;
  if (q.handicap && handicapValue===undefined) return;
  if (lineValue!==undefined && handicapValue!==undefined && lineValue!==handicapValue) return;
  const line = handicapValue??lineValue;
  if (line===undefined) return;

  const matchPeriod = !q.period;
  if (q.side==='Over' || q.side==='Under') {
    if (matchPeriod && (q.group_name==='Total Sets'||q.group_name==='Total Games') && (line===3.5||line===4.5)) {
      return {target:`sets-over-${line}`,invert:q.side==='Under'};
    }
    const target = first && ['238:920056','920096:920111'].includes(key) && line===19.5
      ? 'first-set-points-over-19.5'
      : matchPeriod && ['240:920066','920000:920014'].includes(key) ? `points-over-${line}` : '';
    if (target==='first-set-points-over-19.5' || target==='points-over-74.5' ||
      target==='points-over-79.5' || target==='points-over-84.5') return {target,invert:q.side==='Under'};
    return;
  }
  if (!matchPeriod || (q.side!==match.home && q.side!==match.away)) return;
  const invert = q.side===match.away;
  const homeLine = invert ? -line : line;
  const magnitude = Math.abs(homeLine), sign = homeLine>0 ? 'plus' : 'minus';
  if (magnitude===1.5 && ['240:920065','920000:920008'].includes(key)) {
    return {target:`home-set-handicap-${sign}-1.5`,invert};
  }
  if ((magnitude===5.5 || magnitude===9.5) && ['240:920134','920009:920009'].includes(key)) {
    return {target:`home-point-handicap-${sign}-${magnitude}`,invert};
  }
}

export function marketEstimateSelections(match:FeedMatch,now:number) {
  if (match.in_play || !isUpcomingOrLive(match,now) || !hasBestOfFiveMarket(match,now)) return [];
  return match.quotes.flatMap(q=>{
    if (!freshMatchQuote(match,q,now)) return [];
    const target = marketTarget(match,q);
    return target ? [{key:marketPriceKey(q),...target}] : [];
  });
}

let cached: {archive:ResultsArchive;history:MarketContext;validAfter:number;validThrough:number} | undefined;

export function marketEstimateReport(match:FeedMatch,archive:ResultsArchive|null,now:number):MarketEstimateReport {
  const report:MarketEstimateReport={checkedAt:new Date(now).toISOString(),estimates:{}};
  if (archive?.source!=='postgres' || now<Date.parse(marketStudyProtocol.createdAt)) return report;
  const selected=marketEstimateSelections(match,now);
  if (!selected.length || archive.results.some(r=>r.id===match.id)) return report;

  if (cached?.archive!==archive || !withinWindow(cached,now)) {
    const {eligible,validAfter,validThrough}=asOfWindow(archive.results,now);
    const history=new MarketContext();
    for (const result of eligible) history.update(result);
    cached={archive,history,validAfter,validThrough};
  }
  const features=cached.history.features(match,now,marketStudyProtocol.minimumPlayerHistory);
  if (!features) return report;
  const probabilities=predictMarkets(features);
  report.estimates=Object.fromEntries(selected.map(({key,target,invert})=>{
    const probability=probabilities[MARKET_TARGETS.indexOf(target)];
    return [key,invert ? 1-probability : probability];
  }));
  return report;
}
