import {expect,it} from 'vitest';
import artifact from '../models/multi-research-v1.json';
import {ensembleSignals,multiModelVersion} from '../server/multi-model';
import {scoreSignals} from '../server/score-signals';
import type {FeedMatch} from '../src/shared/board';
import type {ResultsArchive} from '../server/results';
const now=Date.parse(artifact.generatedAt)+60000;
const m:FeedMatch={id:'future',home:'A',away:'B',league:'Synthetic',sport:'table_tennis',in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),group_status:{'920000':{polled_at:new Date(now).toISOString()}},quotes:['A','B'].map((side,i)=>({fixture_id:'future',group_id:'920000',market_id:'920000',sel_id:String(i),side,line:'To Win',odds_dec:2,ts:new Date(now).toISOString()}))};
const archive:ResultsArchive={source:'postgres',checkedAt:new Date(now).toISOString(),rejected:0,from:null,to:null,results:Array.from({length:40},(_,i)=>({id:String(i),home:'A',away:'B',league:'Synthetic',homeWon:i%3!==0,finishedAt:new Date(now-86400000-i*60000).toISOString(),availableAt:new Date(now-86400000-i*60000).toISOString(),sets:(i%3!==0?[[11,6],[11,7],[11,8]]:[[6,11],[7,11],[8,11]])as[number,number][]}))};
it('combines three reproducible probabilities while preserving the frozen main forecast',()=>{
 const main=scoreSignals(m,archive,now),a=ensembleSignals(m,archive,now);expect(a).toHaveLength(2);expect(a).toEqual(ensembleSignals(m,archive,now));expect(scoreSignals(m,archive,now)).toEqual(main);
 expect(a[0].probability+a[1].probability).toBeCloseTo(1);expect(a[0].modelVersion).toBe(multiModelVersion);expect(a[0].modelVersion).not.toBe(main[0].modelVersion);expect(a[0].modelValidated).toBe(false);
 const components=a[0].components!;expect(components).toHaveLength(3);expect(a[0].homeProbability).toBeCloseTo(components.reduce((n,c)=>n+c.probability/3,0));expect(a[0].featureEvidence?.featureVector).toHaveLength(8);
 expect(ensembleSignals({...m,in_play:true},archive,now)).toEqual([]);expect(ensembleSignals(m,{...archive,results:archive.results.slice(0,29)},now)).toEqual([]);
});
