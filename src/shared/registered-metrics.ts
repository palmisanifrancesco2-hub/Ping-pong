import{binaryMetrics}from'../domain/analytics';import type{HistoryEntry}from'./history';
export function registeredMetrics(rows:HistoryEntry[],reported=false){
 const settled=rows.flatMap(e=>{const s=reported?e.reportedStatus:e.status;return s==='won'||s==='lost'?[{...e,outcome:s==='won'?1 as const:0 as const}]:[];});
 if(!settled.length)return null;
 const won=settled.filter(r=>r.outcome===1),lost=settled.filter(r=>r.outcome===0),mean=(r:HistoryEntry[])=>r.length?r.reduce((n,e)=>n+e.odds,0)/r.length:null;
 return{...binaryMetrics(settled.map(e=>({probability:e.probability,outcome:e.outcome})))!,hitRate:won.length/settled.length,averageWonOdds:mean(won),averageLostOdds:mean(lost),unitProfit:settled.reduce((n,e)=>n+(e.outcome?e.odds-1:-1),0),calibration:Array.from({length:5},(_,i)=>{const bin=settled.filter(r=>Math.min(4,Math.floor(r.probability*5))===i);return{from:i*.2,to:(i+1)*.2,n:bin.length,predicted:bin.length?bin.reduce((s,r)=>s+r.probability,0)/bin.length:null,observed:bin.length?bin.reduce((s,r)=>s+r.outcome,0)/bin.length:null};})};
}
