import{modelMetrics}from'./player-model.js';
export type StudyCase={id:string;at:number;p:number;baseline:number;odds:number;status:'won'|'lost'|'void'|'pending'|'invalid';modelVersion:string};
export const virtualProfit=(odds:number,status:StudyCase['status'])=>status==='won'?odds-1:status==='lost'?-1:status==='void'?0:null;
/** Moving 3-day block bootstrap; fixed seed only for uncertainty, never predictions. */
export function blockInterval(rows:{at:number;value:number}[],replicates=10000){
 const days=new Map<string,{sum:number;n:number}>();for(const r of rows){const key=new Date(r.at).toISOString().slice(0,10),v=days.get(key)??{sum:0,n:0};v.sum+=r.value;v.n++;days.set(key,v);}
 const groups=[...days.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v),n=groups.reduce((s,g)=>s+g.n,0);
 if(groups.length<7)return{n,days:groups.length,mean:n?groups.reduce((s,g)=>s+g.sum,0)/n:null,lower:null,upper:null};
 let seed=20261105;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};const samples:number[]=[];
 for(let b=0;b<replicates;b++){let sum=0,count=0,used=0;while(used<groups.length){const start=Math.floor(random()*(groups.length-2));for(let j=0;j<3&&used<groups.length;j++,used++){sum+=groups[start+j].sum;count+=groups[start+j].n;}}samples.push(sum/count);}
 samples.sort((a,b)=>a-b);return{n,days:groups.length,mean:groups.reduce((s,g)=>s+g.sum,0)/n,lower:samples[Math.floor(replicates*.0125)],upper:samples[Math.min(replicates-1,Math.floor(replicates*.9875))]};
}
export function studyPhase(rows:StudyCase[],minimum=1000){
 const settled=rows.filter(r=>['won','lost','void'].includes(r.status)),binary=settled.filter(r=>r.status!=='void').map(r=>({...r,y:r.status==='won'?1:0}));
 const model=modelMetrics(binary),market=modelMetrics(binary.map(r=>({p:r.baseline,y:r.y}))),profit=settled.reduce((s,r)=>s+virtualProfit(r.odds,r.status)!,0),roi=settled.length?profit/settled.length:null;
 const roiInterval=blockInterval(settled.map(r=>({at:r.at,value:virtualProfit(r.odds,r.status)!}))),brierDifference=blockInterval(binary.map(r=>({at:r.at,value:(r.p-r.y)**2-(r.baseline-r.y)**2})));
 const invalid=rows.filter(r=>r.status==='invalid').length,pending=rows.length-settled.length-invalid,observedDays=new Set(rows.map(r=>new Date(r.at).toISOString().slice(0,10))).size;
 const checks=[{label:'Almeno 1000 esiti valutabili',passed:settled.length>=minimum},{label:'Osservazioni su 14 giorni',passed:observedDays>=14},{label:'Copertura esiti almeno 95%',passed:rows.length>0&&settled.length/rows.length>=.95},{label:'Nessuna registrazione oltre l’inizio effettivo',passed:invalid===0},{label:'Saldo prudente positivo includendo le osservazioni irrisolte come perdite',passed:rows.length>0&&(profit-pending-invalid)>0},{label:'Rendimento virtuale prudente positivo',passed:roiInterval.lower!==null&&roiInterval.lower>0},{label:'Brier migliore del bookmaker oltre l’incertezza',passed:brierDifference.upper!==null&&brierDifference.upper<0},{label:'Log Loss migliore del bookmaker',passed:model.logLoss!==null&&market.logLoss!==null&&model.logLoss<market.logLoss},{label:'Errore di calibrazione sotto 0,08',passed:model.ece!==null&&model.ece<.08}];
 return{captured:rows.length,settled:settled.length,pending,invalid,observedDays,won:rows.filter(r=>r.status==='won').length,lost:rows.filter(r=>r.status==='lost').length,void:rows.filter(r=>r.status==='void').length,profit:settled.length?profit:null,roi,pessimisticRoi:rows.length?(profit-pending-invalid)/rows.length:null,roiInterval,brierDifference,model,market,checks,preliminaryPass:checks.every(c=>c.passed)};
}
