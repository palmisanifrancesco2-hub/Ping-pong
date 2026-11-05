import{createHash}from'node:crypto';
import artifact from'../models/score-runtime-v1.json'with{type:'json'};
import{ScoreFeatures,predictScore}from'../src/domain/score-model.js';
import{isUpcomingOrLive,quoteStatus,quoteIdentity,type FeedMatch,type Board}from'../src/shared/board.js';
import type{ResultsArchive}from'./results.js';
import type{Forecast}from'../src/shared/analysis.js';
import type{ValueReport}from'../src/shared/value.js';
import type{ValueOpportunity}from'../src/domain/value.js';
export const runtimeModel=artifact;
export const runtimeVersion=`${artifact.version}-${createHash('sha256').update(JSON.stringify({data:artifact.datasetHash,model:artifact.model,temperature:artifact.temperature,cutoff:artifact.calibrationCutoff})).digest('hex').slice(0,16)}`;
let cached:{archive:ResultsArchive;engine:ScoreFeatures;finished:Set<string>;latestAt:string}|undefined;
function engineFor(archive:ResultsArchive,now:number){if(cached?.archive===archive)return cached;const engine=new ScoreFeatures();for(const r of [...archive.results].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id)))if(Date.parse(r.availableAt)<now)engine.update(r);cached={archive,engine,finished:new Set(archive.results.map(r=>r.id)),latestAt:new Date(Math.max(0,...archive.results.filter(r=>Date.parse(r.availableAt)<now).map(r=>Date.parse(r.availableAt)))).toISOString()};return cached;}
export type ScoreArtifact=typeof artifact;
export function scoreModelVersion(model:ScoreArtifact){return `${model.version}-${createHash('sha256').update(JSON.stringify({data:model.datasetHash,model:model.model,temperature:model.temperature,cutoff:model.calibrationCutoff})).digest('hex').slice(0,16)}`;}
export function scoreSignals(m:FeedMatch,archive:ResultsArchive,now:number,model:ScoreArtifact=artifact):Forecast[]{
 if(archive.source!=='postgres'||m.in_play||!isUpcomingOrLive(m,now))return[];
 const generated=Date.parse(model.generatedAt);if(now<generated||now-generated>35*86400000||Date.parse(model.calibrationCutoff)>now)return[];
 const state=engineFor(archive,now);if(state.finished.has(m.id))return[];const f=state.engine.features(m,now,30);if(!f)return[];
 const pair=m.quotes.filter(q=>q.fixture_id===m.id&&q.group_id==='920000'&&q.line==='To Win'&&(q.side===m.home||q.side===m.away)&&q.phase!=='inplay'&&Date.parse(q.ts)<=now&&quoteStatus(m,q,now)==='Letta di recente dalla fonte');
 if(pair.length!==2||new Set(pair.map(q=>q.side)).size!==2||pair[0].market_id!==pair[1].market_id||pair[0].period!==pair[1].period||pair[0].market_key!==pair[1].market_key)return[];
 const p=predictScore(model.model,f.x,model.temperature),n=Math.min(f.sampleSize,200);
 return pair.filter(q=>q.odds_dec>=1.3).map(q=>{const probability=q.side===m.home?p:1-p;return{featuresAvailableAt:state.latestAt,selection:q.side!,homeProbability:p,probability,probabilityLower:Math.max(0,probability-1.96*Math.sqrt(probability*(1-probability)/n)-model.validation.ece),sampleSize:f.sampleSize,quote:q,modelVersion:scoreModelVersion(model),trainingCutoff:model.calibrationCutoff,modelValidated:false,modelName:model.name,modelParameters:{model:model.model,temperature:model.temperature,trainingCutoff:model.trainingCutoff,calibrationCutoff:model.calibrationCutoff,validationScope:'Exploratory historical comparison, not independent validation'},validation:model.validation,reliability:'Sperimentale: modello non validato; limite prudente euristico, non intervallo certificato'};});
}
export function scoreValueReport(board:Board,archive:ResultsArchive,now:number):ValueReport{
 const estimates:ValueOpportunity[]=[];
 for(const m of board.matches)for(const f of scoreSignals(m,archive,now)){
  const q=f.quote;estimates.push({id:JSON.stringify([m.id,quoteIdentity(q)]),eventId:m.id,startsAt:m.kickoff_utc,marketReadAt:m.group_status?.[q.group_id]?.polled_at,modelVersion:f.modelVersion,quoteKey:quoteIdentity(q),match:`${m.home} — ${m.away}`,competition:m.league,market:'Vincente partita prematch',selection:f.selection,odds:q.odds_dec,quoteAt:q.ts,probability:f.probability,probabilityLower:f.probabilityLower,sampleSize:f.sampleSize,validationSize:artifact.validation.n,modelValidated:false,fresh:true,admVerified:false,impliedProbability:1/q.odds_dec,fairOdds:1/f.probability,ev:f.probability*q.odds_dec-1,conservativeEv:f.probabilityLower*q.odds_dec-1,assessment:'Sperimentale',rank:f.probabilityLower*q.odds_dec-1});
 }
 const experimental=estimates.filter(o=>o.conservativeEv>0);
 experimental.sort((a,b)=>b.rank-a.rank||b.probability-a.probability||Math.abs(a.odds-2)-Math.abs(b.odds-2));
 return{checkedAt:new Date(now).toISOString(),status:'experimental',modelValidated:false,admVerified:false,opportunities:[],experimental,estimates,reasons:[`Modello completo: confronto storico su ${artifact.validation.n} casi, Brier ${artifact.validation.brier.toFixed(5)}. Ricerca esplorativa: nessuna validazione indipendente.`,...(experimental.length?[]:['Nessuna quota soddisfa ora storico minimo, freschezza e margine prudente positivo.'])]};
}
