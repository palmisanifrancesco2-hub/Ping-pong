import artifact from '../../models/score-runtime-v1.json' with {type:'json'};
import type {WinnerCase} from './winner-comparison.js';
import {fairMarketProbability,guardedValue,marketWeight} from '../shared/value-filter.js';
import {modelMetrics} from './player-model.js';
import {quoteIsUsable} from './winner-price-performance.js';

export const valuePolicyStartedAt='2026-11-24T00:00:00Z';
const DAY=86_400_000;
const start=Date.parse(valuePolicyStartedAt);
const ece=artifact.validation.ece;
type Sample={p:number;y:number;h:number;a:number;n:number;at:number};
type Pick={p:number;odds:number;ev:number;exact:boolean};

function lower(p:number,n:number) {
  return Math.max(0,p-1.96*Math.sqrt(p*(1-p)/Math.min(n,200))-ece);
}

function selections(samples:Sample[], guarded:boolean) {
  return samples.flatMap(r=>{
    const options=[{p:r.p,odds:r.h,opposite:r.a,y:1},{p:1-r.p,odds:r.a,opposite:r.h,y:0}]
      .filter(o=>o.odds>=1.3 && lower(o.p,r.n)*o.odds>1+1e-12)
      .flatMap(o=>{
        const corrected=guarded?guardedValue(o.p,lower(o.p,r.n),o.odds,o.opposite):null;
        if(guarded&&!corrected)return [];
        return [{p:corrected?.blended??o.p,odds:o.odds,ev:o.p*o.odds-1,exact:r.y===o.y}];
      }).sort((a,b)=>b.p-a.p);
    return options[0]?[options[0]]:[];
  });
}

function counts(picks:Pick[]) {
  const n=picks.length,exact=picks.filter(pick=>pick.exact).length;
  return {n,exact,wrong:n-exact,accuracy:n?exact/n:null,expected:n?picks.reduce((sum,pick)=>sum+pick.p,0)/n:null,
    averageOdds:n?picks.reduce((sum,pick)=>sum+pick.odds,0)/n:null};
}

export function valueReliability(cases:WinnerCase[],now:number) {
  const dates=new Map<string,number>();
  for(const row of cases) dates.set(row.forecast.id,(dates.get(row.forecast.id)??0)+1);
  const usable=cases.flatMap(row=>{
    const {forecast:f,outcome:o}=row,p=f.probabilities['full-logistic'];
    if(dates.get(f.id)!==1 || o.status!=='settled'||(o.y!==0&&o.y!==1)||!quoteIsUsable(row)
      ||!Number.isFinite(f.at)||f.at>now||!Number.isFinite(p)||p<=0||p>=1||!Number.isFinite(f.sampleSize)||f.sampleSize<30
      ||fairMarketProbability(f.homeOdds,f.awayOdds)===null)return [];
    return [{p,y:o.y,h:f.homeOdds,a:f.awayOdds,n:f.sampleSize,at:f.at}];
  });
  function compare(samples:Sample[]) {
    const baseline=selections(samples,false), guarded=selections(samples,true);
    const paired=samples.map(r=>({p:r.p,y:r.y,market:fairMarketProbability(r.h,r.a)!}));
    const metrics=(name:'p'|'market'|'blend')=>modelMetrics(paired.map(r=>({y:r.y,
      p:name==='blend'?(1-marketWeight)*r.p+marketWeight*r.market:r[name]})));
    const high=baseline.filter(pick=>pick.ev>=.25);
    return {n:samples.length,days:new Set(samples.map(r=>Math.floor(r.at/DAY))).size,
      original:counts(baseline),guarded:counts(guarded),high:counts(high),metrics:{model:metrics('p'),blend:metrics('blend'),market:metrics('market')}};
  }
  return {startedAt:valuePolicyStartedAt,checkedAt:new Date(now).toISOString(),
    historical:compare(usable.filter(row=>row.at<start)),forward:compare(usable.filter(row=>row.at>=start)),
    verifiedForUse:false};
}
export type ValueReliability = ReturnType<typeof valueReliability>;
