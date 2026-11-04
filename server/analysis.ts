import {createHash}from'node:crypto';
import {z}from'zod';
import modelData from '../models/elo-v1.json' with {type:'json'};
import {calibratedProbability,eloProbability,playerKey,playerStats,type Rating}from'../src/domain/player-model.js';
import {isUpcomingOrLive,quoteStatus,type FeedMatch,type FeedQuote}from'../src/shared/board.js';
import {ResultsFeed,type ResultsArchive}from'./results.js';
import type{Forecast,PlayerAnalysis}from'../src/shared/analysis.js';
export type{Forecast}from'../src/shared/analysis.js';

type ModelArtifact={version:string;validated:boolean;generatedAt:string|null;trainingCutoff:string|null;datasetHash?:string;ratings:Record<string,Rating>;calibration:{a:number;b:number};leagues:Record<string,{eligible:boolean;n:number;brier:number|null;logLoss:number|null;ece:number|null}>};
const ratingKey=(league:string,name:string)=>createHash('sha256').update(playerKey(league,name)).digest('hex');
export function modelForecast(m:FeedMatch,now:number,model:ModelArtifact=modelData):{forecast:Forecast|null;reason:string}{
 const fail=(reason:string)=>({forecast:null,reason});
 if(m.in_play)return fail('Pronostico live non disponibile: il modello non integra ancora il punteggio in corso.');
 if(!isUpcomingOrLive(m,now))return fail('Partita già iniziata o terminata.');
 if(!model.validated||!model.generatedAt||!model.trainingCutoff)return fail('Dati insufficienti: validazione temporale del modello non superata.');
 if(now-Date.parse(model.generatedAt)>7*86400000||Date.parse(model.trainingCutoff)>now)return fail('Validazione da aggiornare prima di produrre un pronostico.');
 const metrics=model.leagues[m.league];
 if(!metrics?.eligible||metrics.brier===null||metrics.logLoss===null||metrics.ece===null)return fail('Dati insufficienti: questa competizione non ha superato i controlli fuori campione.');
 const ratings=model.ratings as Record<string,Rating>,a=ratings[ratingKey(m.league,m.home)],b=ratings[ratingKey(m.league,m.away)];
 if(!a||!b||Math.min(a.count,b.count)<30)return fail('Dati insufficienti: servono almeno 30 risultati utilizzabili per ciascun giocatore nella competizione.');
 const p=calibratedProbability(eloProbability(a.rating,b.rating),model.calibration.a,model.calibration.b);
 const winner=p>=.5?m.home:m.away,probability=Math.max(p,1-p);
 const pair=m.quotes.filter(q=>q.group_id==='920000'&&q.line==='To Win'&&(q.side===m.home||q.side===m.away)&&quoteStatus(m,q,now)==='Letta di recente dalla fonte'&&Date.parse(q.ts)<=now);
 if(pair.filter(q=>q.side===m.home).length!==1||pair.filter(q=>q.side===m.away).length!==1)return fail('Mercato vincente partita incompleto, sospeso o non aggiornato.');
 const quote=pair.find(q=>q.side===winner)!;if(quote.odds_dec<1.3)return fail('La quota del pronostico è inferiore alla soglia iniziale 1,30.');
 const n=Math.min(a.count,b.count,200),lower=Math.max(0,probability-1.96*Math.sqrt(probability*(1-probability)/n)-metrics.ece);
 if(lower<=.5)return fail('Incertezza troppo elevata: il limite prudente della probabilità non supera il 50%.');
 return{reason:'Vincente partita stimato con Elo e calibrazione temporale. Solo prematch; nessuna garanzia di esito o verifica ADM.',forecast:{selection:winner,homeProbability:p,probability,probabilityLower:lower,sampleSize:n,quote,
  modelVersion:`${model.version}-${model.datasetHash?.slice(0,16)??'unavailable'}`,trainingCutoff:model.trainingCutoff,
  validation:{n:metrics.n,brier:metrics.brier,logLoss:metrics.logLoss,ece:metrics.ece},reliability:'Preliminare: fonte aggregata e campione limitato'}};
}
export function buildAnalysis(m:FeedMatch,archive:ResultsArchive,now:number):PlayerAnalysis{
 const home=playerStats(archive.results,m.league,m.home),away=playerStats(archive.results,m.league,m.away);
 const hk=playerKey(m.league,m.home),ak=playerKey(m.league,m.away);
 const h2h=archive.results.filter(r=>(playerKey(r.league,r.home)===hk&&playerKey(r.league,r.away)===ak)||(playerKey(r.league,r.home)===ak&&playerKey(r.league,r.away)===hk));
 const homeWins=h2h.filter(r=>playerKey(r.league,r.home)===hk?r.homeWon:!r.homeWon).length;
 const prediction=archive.source==='postgres'?modelForecast(m,now):{forecast:null,reason:'Archivio temporaneo incompleto: nessuna previsione operativa.'};
 return{eventId:m.id,checkedAt:new Date(now).toISOString(),home,away,h2h:{matches:h2h.length,homeWins,awayWins:h2h.length-homeWins},
  coverage:{from:archive.from,to:archive.to,source:'MoviOdds, risultati riportati; non certificati indipendentemente',rejected:archive.rejected,archive:archive.source},
  identity:'Nomi esatti normalizzati nella stessa competizione, senza abbinamenti approssimativi. Profili anagrafici e ranking non disponibili.',
  model:{version:modelData.version,validated:modelData.validated,trainingCutoff:modelData.trainingCutoff,validation:modelData.validation},...prediction};
}
export class Analyses{
 constructor(readonly results=new ResultsFeed(),private now=Date.now){}
 async analyse(m:FeedMatch){const archive=await this.results.archive();if(archive.results.some(r=>r.id===m.id)||!isUpcomingOrLive(m,this.now()))throw new Error('ANALYSIS_EVENT_FINISHED');return buildAnalysis(m,archive,this.now());}
}
