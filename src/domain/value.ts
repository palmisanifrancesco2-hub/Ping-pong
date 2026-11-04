import{expectedValue,impliedProbability}from'./analytics';
export type ValueInput={id:string;eventId:string;match:string;competition:string;market:string;selection:string;odds:number;quoteAt:string;probability:number;probabilityLower:number;sampleSize:number;validationSize:number;modelValidated:boolean;fresh:boolean;admVerified:boolean};
export type ValueOpportunity=ValueInput&{impliedProbability:number;fairOdds:number;ev:number;conservativeEv:number;assessment:'Interessante'|'Ottima'|'Sperimentale';rank:number};
/** Thresholds are selection policy, never a probability or promise of profit. */
export function assessValue(input:ValueInput):ValueOpportunity|null{
  if(!input.modelValidated||!input.fresh||input.sampleSize<30||input.validationSize<100)return null;
  if(![input.odds,input.probability,input.probabilityLower].every(Number.isFinite)||input.odds<1.3||input.probability<=0||input.probability>1||input.probabilityLower<0||input.probabilityLower>input.probability)return null;
  const ev=expectedValue(input.probability,input.odds),conservativeEv=expectedValue(input.probabilityLower,input.odds);
  if(ev<=0||conservativeEv<=0)return null;
  const probability=impliedProbability(input.odds);
  return{...input,impliedProbability:probability,fairOdds:1/input.probability,ev,conservativeEv,
    assessment:conservativeEv>=.05&&input.validationSize>=200?'Ottima':'Interessante',
    // Conservative edge dominates; probability and proximity to 2 are transparent tie-breakers.
    rank:conservativeEv};
}
export function rankValues(rows:ValueInput[]){return rows.map(assessValue).filter((r):r is ValueOpportunity=>r!==null).sort((a,b)=>b.conservativeEv-a.conservativeEv||b.probability-a.probability||Math.abs(a.odds-2)-Math.abs(b.odds-2)||a.id.localeCompare(b.id));}
