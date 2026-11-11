import type{ValueOpportunity}from'./value.js';
export type EvidenceCandidate=ValueOpportunity&{independentValidation?:boolean;competitionVerified?:boolean;bookmakerSite?:string;admVerifiedUntil?:string};
export type RankingWeights={probability:number;value:number};
export type PredictionRankings={probability:EvidenceCandidate[];value:EvidenceCandidate[];combined:EvidenceCandidate[];weights:RankingWeights;excluded:number;policy:string;reasons:string[]};
export function normalizeWeights(w:RankingWeights):RankingWeights{
 if(!Number.isFinite(w.probability)||!Number.isFinite(w.value)||w.probability<0||w.value<0||w.probability+w.value<=0)throw Error('Pesi non validi');
 const total=w.probability+w.value;return{probability:w.probability/total,value:w.value/total};
}
/** Display policy, not a statistically learned threshold or probability. */
export function combinedOrder(rows:EvidenceCandidate[],weights:RankingWeights){
 const w=normalizeWeights(weights),score=(r:EvidenceCandidate)=>w.probability*r.probabilityLower+w.value*(.5+.5*(r.probability*r.odds-1)/(1+Math.abs(r.probability*r.odds-1)));
 return [...rows].sort((a,b)=>score(b)-score(a)||b.probability-a.probability||a.id.localeCompare(b.id));
}
export function rankPredictions(rows:EvidenceCandidate[],now:number,weights:RankingWeights={probability:.5,value:.5}):PredictionRankings{
 const w=normalizeWeights(weights);if(!Number.isFinite(now))throw Error('Data non valida');const seen=new Set<string>();
 const eligible=rows.filter(r=>{
  const age=now-Date.parse(r.quoteAt),start=Date.parse(r.startsAt??''),expiry=Date.parse(r.admVerifiedUntil??'');
  if(!r.modelValidated||r.independentValidation!==true||r.competitionVerified!==true||!r.admVerified||!r.bookmakerSite||!Number.isFinite(expiry)||expiry<=now||!r.fresh||age<0||age>120000||!Number.isFinite(age)||!Number.isFinite(start)||start<=now)return false;
  if(![r.probability,r.probabilityLower,r.odds].every(Number.isFinite)||r.odds<1.3||r.probability<=0||r.probability>=1||r.probabilityLower<0||r.probabilityLower>r.probability)return false;
  const key=JSON.stringify([r.eventId,r.market,r.selection,r.bookmakerSite]);if(seen.has(key))return false;seen.add(key);return true;
 }).map(r=>({...r,ev:r.probability*r.odds-1,conservativeEv:r.probabilityLower*r.odds-1,impliedProbability:1/r.odds}));
 const probability=[...eligible].sort((a,b)=>b.probability-a.probability||b.probabilityLower-a.probabilityLower||Math.abs(a.odds-2)-Math.abs(b.odds-2)||a.id.localeCompare(b.id));
 const value=eligible.filter(r=>r.ev>0&&r.conservativeEv>0).sort((a,b)=>b.conservativeEv-a.conservativeEv||b.ev-a.ev||b.probability-a.probability||a.id.localeCompare(b.id));
 return{probability,value,combined:combinedOrder(eligible,w),weights:w,excluded:rows.length-eligible.length,policy:'strict-adm-independent-v16',reasons:eligible.length?[]:['Nessun pronostico con affidabilità adeguatamente dimostrata.','Servono validazione indipendente nella competizione e quote fresche di un dominio ADM verificato.']};
}
