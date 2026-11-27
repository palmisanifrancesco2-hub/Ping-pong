import {fairMarketProbability} from '../shared/value-filter.js';

export type CalibrationCase = {
  homeOdds:number;awayOdds:number;homeProbability:number;candidate?:number;homeWon:boolean;
};
type PriceBand={label:string;contains:(odds:number)=>boolean};
const priceBands:PriceBand[]=[
  {label:'2,00–2,50',contains:odds=>odds>=2&&odds<=2.5},
  {label:'Oltre 2,50 e sotto 3,65',contains:odds=>odds>2.5&&odds<3.65},
  {label:'Da 3,65',contains:odds=>odds>=3.65},
];
const thresholds=[0,.5,.6] as const;

type Outcome={won:boolean;odds:number;model:number;market:number;candidate?:number};
type PredictionKey='model'|'market'|'candidate';

function score(rows:Outcome[],key:PredictionKey) {
  const samples=rows.flatMap(row=>{
    const p=row[key];
    return p===undefined?[]:[{p,won:row.won,odds:row.odds}];
  });
  const n=samples.length;
  if(!n)return null;
  return {
    mean:samples.reduce((total,row)=>total+row.p,0)/n,
    brier:samples.reduce((total,row)=>total+(row.p-Number(row.won))**2,0)/n,
    wins:samples.filter(row=>row.won).length,
    ev:thresholds.map(minimum=>{
      const selected=samples.filter(row=>row.p*row.odds-1>minimum+1e-12);
      const wins=selected.filter(row=>row.won).length;
      return {minimum,selected:selected.length,wins,losses:selected.length-wins};
    }),
  };
}

export function oddsCalibration(cases:CalibrationCase[]){
  return priceBands.map(band=>{
    const rows:Outcome[]=[], prospective:Outcome[]=[];
    let matches=0, prospectiveMatches=0;
    for(const match of cases){
      const market=fairMarketProbability(match.homeOdds,match.awayOdds);
      if(market===null||!Number.isFinite(match.homeProbability)||match.homeProbability<=0||match.homeProbability>=1)continue;
      const sides=[{won:match.homeWon,odds:match.homeOdds,model:match.homeProbability,market,candidate:match.candidate},
        {won:!match.homeWon,odds:match.awayOdds,model:1-match.homeProbability,market:1-market,
          candidate:match.candidate===undefined?undefined:1-match.candidate}].filter(row=>band.contains(row.odds));
      if(!sides.length)continue;
      matches++;
      rows.push(...sides);
      if(match.candidate===undefined||!Number.isFinite(match.candidate)||match.candidate<=0||match.candidate>=1)continue;
      prospectiveMatches++;
      prospective.push(...sides);
    }
    return {label:band.label,matches,n:rows.length,model:score(rows,'model'),market:score(rows,'market'),
      prospective:{matches:prospectiveMatches,n:prospective.length,model:score(prospective,'model'),
        market:score(prospective,'market'),candidate:score(prospective,'candidate')}};
  });
}
