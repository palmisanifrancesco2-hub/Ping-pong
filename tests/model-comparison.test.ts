import {describe,it,expect} from 'vitest';
import {splitPeriod,scaleProbability,calibrateTemperature,validateCommonCases,pairedDayBootstrap} from '../src/domain/model-comparison';
import report from '../research/report-v4.json';
describe('fair temporal comparison',()=>{
 it('purges results unavailable at the training and calibration cutoffs',()=>{
 const day=86400000,start=10*day;
 const rows=[{id:'train',at:6*day,available:7*day},{id:'lateTrain',at:6*day,available:8*day},{id:'cal',at:8*day,available:9*day},{id:'lateCal',at:9*day,available:10*day},{id:'test',at:10*day,available:11*day},{id:'after',at:12*day,available:13*day}];
 const s=splitPeriod(rows,start,12*day);expect(s.train.map(r=>r.id)).toEqual(['train']);expect(s.calibration.map(r=>r.id)).toEqual(['cal']);expect(s.test.map(r=>r.id)).toEqual(['test']);
 });
 it('refuses comparing unequal or duplicated event cohorts',()=>{
 expect(()=>validateCommonCases({a:[{id:'1'}],b:[{id:'2'}]})).toThrow('INCOMPARABLE_COHORTS');
 expect(()=>validateCommonCases({a:[{id:'1'},{id:'1'}]})).toThrow('DUPLICATE_TEST_EVENT');
 expect(validateCommonCases({a:[{id:'1'}],b:[{id:'1'}]})).toEqual(['1']);
 });
 it('calibrates only from supplied labels and preserves complementary probabilities',()=>{
 const t=calibrateTemperature([{p:.9,y:0},{p:.1,y:1}],[.25,1,1.5]);expect(t).toBe(.25);
 expect(scaleProbability(.8,t)+scaleProbability(.2,t)).toBeCloseTo(1,12);
 expect(()=>scaleProbability(NaN,1)).toThrow('INVALID_PROBABILITY');
 });
 it('resamples day clusters deterministically, with zero paired difference for identical predictions',()=>{
 const rows=Array.from({length:12},(_,i)=>({at:i*86400000,p:.7,baseline:.7,y:i%2}));
 const a=pairedDayBootstrap(rows,1000);expect(a.mean).toBe(0);expect(a.lowerAdjusted).toBe(0);expect(a.upperAdjusted).toBe(0);expect(a).toEqual(pairedDayBootstrap(rows,1000));
 expect(pairedDayBootstrap(rows.slice(0,1),1000).upper95).toBeNull();
 });
 it('counts every evaluated event exactly once for every model in the published report',()=>{
 expect(report.ranking).toHaveLength(15);expect(report.ranking.every(r=>r.n===report.testCases)).toBe(true);
 expect(report.folds.filter(f=>f.status==='evaluated').reduce((n,f)=>n+f.test,0)).toBe(report.testCases);
 for(const r of report.ranking)expect(r.daily.reduce((n,d)=>n+d.n,0)).toBe(report.testCases);
 expect(report.ranking.map(r=>r.brier)).toEqual([...report.ranking.map(r=>r.brier)].sort((a,b)=>a-b));
 expect(report.productionValidated).toBe(false);expect(report).not.toHaveProperty('predictions');expect(report).not.toHaveProperty('artifacts');
 });
});
