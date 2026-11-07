import { createHash } from 'node:crypto';
import artifact from '../models/multi-research-v1.json' with { type: 'json' };
import { ScoreFeatures, predictScore } from '../src/domain/score-model.js';
import { DailyGlicko } from '../src/domain/glicko2.js';
import { scaleProbability } from '../src/domain/model-comparison.js';
import { quoteIdentity, type FeedMatch, type Board } from '../src/shared/board.js';
import type { ResultsArchive } from './results.js';
import { scoreSignals } from './score-signals.js';
import type { Forecast } from '../src/shared/analysis.js';
import type { ValueOpportunity } from '../src/domain/value.js';

export const multiModelVersion = `${artifact.version}-${createHash('sha256').update(JSON.stringify({full:artifact.full,scores:artifact.scores,temperatures:artifact.temperatures,cutoff:artifact.calibrationCutoff,glicko:{tau:.5,period:'UTC-day',symmetricRD:true}})).digest('hex').slice(0,16)}`;
export const multiModelReport = artifact;
let cached: { archive: ResultsArchive; scores: ScoreFeatures; glicko: DailyGlicko } | undefined;
function engine(archive: ResultsArchive, now: number) {
  if (cached?.archive === archive) return cached;
  const past = archive.results.filter(r => Date.parse(r.availableAt) < now).sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id));
  const scores = new ScoreFeatures(); for (const r of past) scores.update(r);
  cached = { archive, scores, glicko: new DailyGlicko(past) }; return cached;
}
export function ensembleSignals(m: FeedMatch, archive: ResultsArchive, now: number): Forecast[] {
  const original = scoreSignals(m, archive, now);
  if (!original.length || now < Date.parse(artifact.generatedAt) || now-Date.parse(artifact.generatedAt)>35*86400000) return [];
  const state = engine(archive, now), features = state.scores.features(m, now, 30); if (!features) return [];
  const glicko=state.glicko.at(m,now);
  const components = [
    { name: 'Logistica completa', probability: predictScore(artifact.full, features.x, artifact.temperatures['full:0.001']) },
    { name: 'Logistica punti e set', probability: predictScore(artifact.scores, features.x, artifact.temperatures['scores:0.01']) },
    { name: 'Glicko-2', probability: scaleProbability(Math.min(1-1e-8,Math.max(1e-8,glicko.p)),artifact.temperatures.glicko2) },
  ];
  const p = components.reduce((n,c)=>n+c.probability/3,0), validation = artifact.ranking.find(r=>r.name==='ensemble-equal')!;
  return original.map(f=>{
    const probability=f.selection===m.home?p:1-p;
    return {...f,probability,homeProbability:p,probabilityLower:Math.max(0,probability-1.96*Math.sqrt(probability*(1-probability)/Math.min(features.sampleSize,200))-validation.ece!),featureEvidence:{featureVector:features.x,components,glickoHome:glicko.home,glickoAway:glicko.away,periodRule:'UTC days closed before prediction'},modelVersion:multiModelVersion,trainingCutoff:artifact.calibrationCutoff,modelValidated:false,modelName:'Ensemble di tre modelli',validation:{n:validation.n,brier:validation.brier!,logLoss:validation.logLoss!,ece:validation.ece!},components,modelParameters:{full:artifact.full,scores:artifact.scores,temperatures:artifact.temperatures,glicko:{tau:.5,period:'UTC-day',symmetricRD:true},weights:[1/3,1/3,1/3],independentValidation:false},reliability:'Sperimentale: media di tre modelli calibrati; superiorità statistica non dimostrata'};
  });
}
export function ensembleValueReport(board: Board, archive: ResultsArchive, now: number) {
  const estimates:ValueOpportunity[]=[];
  for(const m of board.matches) for(const f of ensembleSignals(m,archive,now)){
    const q=f.quote; estimates.push({id:JSON.stringify([m.id,quoteIdentity(q),multiModelVersion]),eventId:m.id,startsAt:m.kickoff_utc,marketReadAt:m.group_status?.[q.group_id]?.polled_at,modelVersion:multiModelVersion,quoteKey:quoteIdentity(q),match:`${m.home} — ${m.away}`,competition:m.league,market:'Vincente partita prematch',selection:f.selection,odds:q.odds_dec,quoteAt:q.ts,probability:f.probability,probabilityLower:f.probabilityLower,sampleSize:f.sampleSize,validationSize:f.validation.n,modelValidated:false,fresh:true,admVerified:false,impliedProbability:1/q.odds_dec,fairOdds:1/f.probability,ev:f.probability*q.odds_dec-1,conservativeEv:f.probabilityLower*q.odds_dec-1,assessment:'Sperimentale',rank:f.probabilityLower*q.odds_dec-1});
  }
  return {modelName:'Ensemble di tre modelli',estimates,experimental:estimates.filter(o=>o.conservativeEv>0),opportunities:[],modelValidated:false};
}
