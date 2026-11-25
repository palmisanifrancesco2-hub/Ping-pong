import {fairMarketProbability} from '../shared/value-filter.js';

export const disagreementStartAt=Date.parse('2026-11-25T13:00:00Z');
export const disagreementBands=[
  {minimum:1.30,maximum:2}, {minimum:2,maximum:2.5},
  {minimum:2.5,maximum:3.65}, {minimum:3.65,maximum:null},
] as const;

type Case={at:number;homeOdds:number;awayOdds:number;homeProbability:number;peerHomeProbability?:number;homeWon:boolean};
const validProbability=(p:number|undefined):p is number=>typeof p==='number'&&p>0&&p<1;
export function disagreementReport(cases:Case[],start=disagreementStartAt){
  const cohorts=[cases.filter(c=>c.at<start),cases.filter(c=>c.at>=start)];
  const [earlier,forward]=cohorts.map(cohort=>{
    const paired=cohort.flatMap(c=>{
      const market=fairMarketProbability(c.homeOdds,c.awayOdds);
      if(market===null||c.homeOdds===c.awayOdds||!validProbability(c.homeProbability))return [];
      const homeUnderdog=c.homeOdds>c.awayOdds;
      return [{at:c.at,odds:homeUnderdog?c.homeOdds:c.awayOdds,
        probability:homeUnderdog?c.homeProbability:1-c.homeProbability,market:homeUnderdog?market:1-market,
        peer:validProbability(c.peerHomeProbability)?(homeUnderdog?c.peerHomeProbability:1-c.peerHomeProbability):null,
        exact:c.homeWon===homeUnderdog}];
    });
    return disagreementBands.map(band=>{
      const available=paired.filter(c=>c.odds>=band.minimum&&(band.maximum===null||c.odds<band.maximum));
      const selected=available.filter(c=>c.probability>.5&&c.probability*c.odds>1+1e-12);
      const n=selected.length,exact=selected.filter(c=>c.exact).length;
      const comparable=selected.filter(c=>c.peer!==null);
      const consensus=comparable.filter(c=>c.peer!>.5&&c.peer!*c.odds>1+1e-12);
      const consensusExact=consensus.filter(c=>c.exact).length;
      return {...band,available:available.length,n,exact,wrong:n-exact,
        days:new Set(selected.map(c=>Math.floor(c.at/86_400_000))).size,
        roi:n?selected.reduce((sum,c)=>sum+(c.exact?c.odds-1:-1),0)/n:null,
        consensus:{available:comparable.length,n:consensus.length,exact:consensusExact,wrong:consensus.length-consensusExact,
          roi:consensus.length?consensus.reduce((sum,c)=>sum+(c.exact?c.odds-1:-1),0)/consensus.length:null},
        brier:n?selected.reduce((sum,c)=>sum+(c.probability-Number(c.exact))**2,0)/n:null,
        marketBrier:n?selected.reduce((sum,c)=>sum+(c.market-Number(c.exact))**2,0)/n:null};
    });
  });
  return {startsAt:new Date(start).toISOString(),earlier,forward};
}
