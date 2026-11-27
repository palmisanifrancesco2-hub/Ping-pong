import{describe,it,expect}from'vitest';
import{scoreSignals,scoreValueReport,runtimeModel}from'../server/score-signals';
import{parseResult,type ResultsArchive}from'../server/results';
import type{Board,FeedMatch}from'../src/shared/board';
import{betProfit,betSchema}from'../server/manual-bets';
import{stakeScenario}from'../src/SmartStake';
import{registeredMetrics}from'../src/shared/registered-metrics';
import type{HistoryEntry}from'../src/shared/history';
const now=Date.parse(runtimeModel.generatedAt)+60000;
const rows=Array.from({length:40},(_,i)=>parseResult({fixture_id:`old-${i}`,sport:'table_tennis',home:'A',away:'B',league:'Synthetic',status:'finished',finished_at:new Date(now-86400000-i*60000).toISOString(),final_score:'11-5,11-5,11-5'},now)!).filter(Boolean);
const archive:ResultsArchive={source:'postgres',results:rows,checkedAt:new Date(now).toISOString(),rejected:0,from:rows[0].finishedAt,to:rows[0].finishedAt};
const match:FeedMatch={id:'future',sport:'table_tennis',home:'A',away:'B',league:'Synthetic',in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),group_status:{'920000':{polled_at:new Date(now).toISOString()}},quotes:['A','B'].map((side,i)=>({fixture_id:'future',group_id:'920000',market_id:'920000',sel_id:String(i),side,line:'To Win',odds_dec:i?5:2,ts:new Date(now).toISOString(),suspended:false}))};
describe('functional sections preserve real-data boundaries',()=>{
 it('produces deterministic unvalidated score estimates from past score data',()=>{const a=scoreSignals(match,archive,now),b=scoreSignals(match,archive,now);expect(a).toHaveLength(2);expect(a).toEqual(b);expect(a[0].probability+a[1].probability).toBeCloseTo(1);expect(a.every(f=>f.modelValidated===false&&f.sampleSize===40)).toBe(true);expect(a[0].featuresAvailableAt!<=new Date(now).toISOString()).toBe(true);});
 it('refuses live, finished, short-history, incomplete, stale and future data',()=>{
 expect(scoreSignals({...match,in_play:true},archive,now)).toEqual([]);
 expect(scoreSignals({...match,kickoff_utc:new Date(now-1).toISOString()},archive,now)).toEqual([]);
 expect(scoreSignals(match,{...archive,results:rows.slice(0,29)},now)).toEqual([]);
 expect(scoreSignals({...match,quotes:match.quotes.slice(0,1)},archive,now)).toEqual([]);
 expect(scoreSignals({...match,group_status:{}},archive,now)).toEqual([]);
 expect(scoreSignals(match,{...archive,source:'memory'},now)).toEqual([]);
 expect(scoreSignals(match,archive,now+36*86400000)).toEqual([]);
 });
 it('keeps operative opportunities empty while allowing explicit experimental research signals',()=>{const board:Board={provider:'MoviOdds',bookmakerSite:'bet365.com.au',checkedAt:new Date(now).toISOString(),serverTime:new Date(now).toISOString(),warming:false,matches:[match]};const r=scoreValueReport(board,archive,now);expect(r.opportunities).toEqual([]);expect(r.modelValidated).toBe(false);for(const s of r.experimental??[])expect(s.probabilityLower*s.odds).toBeGreaterThan(1);});
 it('caps manual Kelly scenarios, reduces uncertainty and disables completely',()=>{expect(stakeScenario(false,100,.9,0,2,1,.02)).toBe(0);expect(stakeScenario(true,100,.9,0,2,1,.02)).toBe(2);expect(stakeScenario(true,100,.6,.2,2,.25,.02)).toBe(0);expect(()=>stakeScenario(true,100,.9,0,2,1,.03)).toThrow();});
 it('computes actual manual balances from stake and actual price only',()=>{expect(betProfit(10,2.5,'won')).toBe(15);expect(betProfit(10,2.5,'lost')).toBe(-10);expect(betProfit(10,2.5,'void')).toBe(0);expect(betProfit(10,2.5,'pending')).toBeNull();expect(betSchema.safeParse({stake:10,odds:2,actual_profit:100}).success).toBe(false);});
 it('separates verified and reported model metrics and never invents missing scores',()=>{expect(registeredMetrics([])).toBeNull();const a={probability:.8,odds:2,status:'unverified',reportedStatus:'won'}as HistoryEntry;expect(registeredMetrics([a])).toBeNull();const m=registeredMetrics([a],true)!;expect(m.count).toBe(1);expect(m.brier).toBeCloseTo(.04);expect(m.unitProfit).toBe(1);expect(m.calibration.reduce((n,b)=>n+b.n,0)).toBe(1);});
});
