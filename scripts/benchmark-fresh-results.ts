import {createHash} from 'node:crypto';
import protocol from '../research/protocol-expansion-v35.json' with {type:'json'};
import {ScoreFeatures,predictScore} from '../src/domain/score-model.js';
import {runtimeModel,runtimeVersion} from '../server/score-signals.js';
import type {ResultsArchive} from '../server/results.js';

const day=86_400_000;
const dayStart=(timestamp:string)=>Math.floor(Date.parse(timestamp)/day)*day;
type Prediction={p:number;actual:number};

function summarize(rows:Prediction[]) {
  let correct=0,wrong=0,undecided=0,brier=0,logLoss=0;
  for (const {p,actual} of rows) {
    if (p===.5) undecided++;
    else if (Number(p>.5)===actual) correct++;
    else wrong++;
    brier+=(p-actual)**2;
    logLoss-=Math.log(Math.max(1e-9,actual?p:1-p));
  }
  return {n:rows.length,correct,wrong,undecided,brier:rows.length?brier/rows.length:null,
    logLoss:rows.length?logLoss/rows.length:null};
}

export function benchmarkFreshResults(archive:ResultsArchive) {
  const from=Date.parse(protocol.movioddsTestFrom), before=Date.parse(protocol.movioddsTestBefore);
  if (archive.source!=='postgres'||runtimeModel.version!==protocol.movioddsArtifact
    || from<=Date.parse(runtimeModel.generatedAt)||from<=Date.parse(runtimeModel.calibrationCutoff)
    || before>Date.parse(archive.checkedAt)) throw Error('EXPANSION_BENCHMARK_UNAVAILABLE');
  const results=archive.results.filter(row=>Math.max(row.sets.filter(([a,b])=>a>b).length,row.sets.filter(([a,b])=>a<b).length)===3);
  const updates=results.map(r=>({r,at:Math.max(Date.parse(r.availableAt)+1,dayStart(r.finishedAt)+protocol.movioddsHistoryLagDays*day)}))
    .sort((a,b)=>a.at-b.at||a.r.id.localeCompare(b.r.id));
  const test=results.filter(row=>dayStart(row.finishedAt)>=from&&dayStart(row.finishedAt)<before)
    .sort((a,b)=>Date.parse(a.finishedAt)-Date.parse(b.finishedAt)||a.id.localeCompare(b.id));
  if (new Set(test.map(r=>r.id)).size!==test.length) throw Error('EXPANSION_BENCHMARK_DUPLICATE_MATCH');
  const engine=new ScoreFeatures(), leagues=new Map<string,{homeWins:number;n:number}>();
  let position=0, allWins=0;
  const frequency:Prediction[]=[], combined:Prediction[]=[], logistic:Prediction[]=[], elo:Prediction[]=[];
  for (const r of test) {
    const at=dayStart(r.finishedAt);
    while (position<updates.length&&updates[position].at<=at) {
      const past=updates[position++].r;
      engine.update(past);
      const stats=leagues.get(past.league)??{homeWins:0,n:0};
      stats.homeWins+=Number(past.homeWon);
      stats.n++;
      allWins+=Number(past.homeWon);
      leagues.set(past.league,stats);
    }
    const stats=leagues.get(r.league);
    const prior=(allWins+25)/(position+50);
    const p=(Number(stats?.homeWins??0)+50*prior)/((stats?.n??0)+50);
    const actual=Number(r.homeWon);
    const f=engine.features(r,at,30);
    frequency.push({p,actual});
    if (!f) {combined.push({p,actual});continue;}
    const estimate=predictScore(runtimeModel.model,f.x,runtimeModel.temperature);
    logistic.push({p:estimate,actual});
    combined.push({p:estimate,actual});
    elo.push({p:f.elo,actual});
  }
  return {expansionVerification:'success',from:protocol.movioddsTestFrom,before:protocol.movioddsTestBefore,
    archiveResults:archive.results.length,testDays:new Set(test.map(r=>dayStart(r.finishedAt))).size,
    testHash:createHash('sha256').update(JSON.stringify(test)).digest('hex'),modelVersion:runtimeVersion,
    frequency:summarize(frequency),combined:summarize(combined),logistic:summarize(logistic),elo:summarize(elo)};
}
