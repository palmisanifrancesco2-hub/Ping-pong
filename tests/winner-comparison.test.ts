import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import parity from '../research/winner-context-parity.json';
import original from '../research/market-runtime-parity.json';
import v9 from '../research/prospective-markets-v9.json';
import {contextWinner,winnerProbabilities,winnerDiagnostic,winnerCheckpoint,winnerProtocol as protocol,type WinnerCase} from '../src/domain/winner-comparison';
import {marketHash} from '../server/research-integrity';
import {winnerCandidates,assertWinnerCase,settleWinnerCase} from '../server/winner-shadow';
import type {MarketStudyCase} from '../src/domain/market-validation';
import type {Board} from '../src/shared/board';

const at=Date.parse(protocol.createdAt)+3600000;
function source(id='future'):MarketStudyCase{
 const f={studyId:v9.id,userId:'synthetic-owner',id,home:'A',away:'B',league:'Test',at:at-60000,kickoff:at+3600000,observedBoard:new Date(at-60000).toISOString(),modelVersion:'market-v8-frozen-runtime-1',modelHash:v9.portableModelHash,protocolHash:marketHash(v9),featuresAvailable:at-7200000,x:original[0].x,baseline:original[0].baseline,eb:original[0].eb,p:original[0].expected,sampleSize:50};
 return{forecast:f,forecastHash:marketHash(f),outcome:{status:'pending'},attempts:0};
}
const fresh=(s:MarketStudyCase)=>{const forecast={...s.forecast,at,observedBoard:new Date(at).toISOString()};return{...s,forecast,forecastHash:marketHash(forecast)};};
function board():Board{return{provider:'MoviOdds',bookmakerSite:'bet365.com.au',warming:false,checkedAt:new Date(at).toISOString(),serverTime:new Date(at).toISOString(),matches:[{id:'future',home:'A',away:'B',league:'Test',sport:'table_tennis',in_play:false,kickoff_utc:new Date(at+3600000).toISOString(),group_status:{'920000':{polled_at:new Date(at).toISOString()}},quotes:['A','B'].map((side,i)=>({fixture_id:'future',group_id:'920000',market_id:'920000',line:'To Win',side,sel_id:String(i),odds_dec:i?1.9:2.1,ts:new Date(at).toISOString(),suspended:false}))}]};}
const captured=()=>{const s=source();return winnerCandidates([fresh(s)],[{parameters:{case:s}}],board(),new Set(),'synthetic-owner',at)[0];};

describe('winner alternatives without changing the original trial',()=>{
 it('reproduces the already-fitted contextual logistic and preserves all frozen artifact hashes',()=>{
  expect(parity).toHaveLength(22);for(const row of parity)expect(contextWinner(row.x,row.baseline)).toBeCloseTo(row.expected,12);
  for(const [file,hash]of Object.entries(protocol.hashes))expect(createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex')).toBe(hash);
  const p=winnerProbabilities({x:original[0].x,p:original[0].expected,baseline:original[0].baseline});
  expect(Object.keys(p)).toEqual(protocol.candidates);expect(p['current-eb']).toBe(original[0].expected[0]);expect(Object.values(p).every(p=>p>0&&p<1)).toBe(true);
  expect(()=>contextWinner([NaN],.5)).toThrow('WINNER_FEATURES_INVALID');
 });
 it('keeps the known diagnostic cohort separate and never rewrites its probabilities',()=>{
  const s=source(),cutoff=Date.parse(protocol.diagnosticCutoff),y=Number(s.forecast.p[0]>.5);
  const row=(id:string,outcome:number,stamp:number):MarketStudyCase=>({...s,forecast:{...s.forecast,id},lastAttempt:stamp,outcome:{status:'settled',y:[outcome,...Array(13).fill(0)]}});
  const rows=[row('known-1',y,cutoff-1000),row('known-2',1-y,cutoff-500),row('later',y,cutoff+1000),s],snapshot=JSON.stringify(rows);
  const r=winnerDiagnostic(rows);expect(r.n).toBe(2);expect(r.exploratory).toBe(true);expect(r.validated).toBe(false);expect(r.models[0].correct).toBe(1);expect(r.models[0].wrong).toBe(1);expect(r.models.every(m=>m.n===2)).toBe(true);expect(JSON.stringify(rows)).toBe(snapshot);
 });
 it('records every candidate at one causal instant with a coherent actual price benchmark',()=>{
  const c=captured();expect(c).toBeDefined();expect(c.forecast.at).toBe(at);expect(c.forecast.featuresAvailable).toBeLessThan(at);expect(c.forecast.sourceHash).toBe(source().forecastHash);expect(c.forecast.bookmakerProbability).toBeCloseTo(.475,12);expect(()=>assertWinnerCase(c)).not.toThrow();
  const s=source(),pool=[{parameters:{case:s}}],f=fresh(s),b=board();
  expect(winnerCandidates([f],pool,b,new Set(['future']),'synthetic-owner',at)).toEqual([]);
  expect(winnerCandidates([f],[{parameters:{case:{...s,outcome:{status:'settled',y:Array(14).fill(1)}}}}],b,new Set(),'synthetic-owner',at)).toEqual([]);
  expect(winnerCandidates([f],[],b,new Set(),'synthetic-owner',at)).toEqual([]);
  const mismatched=board();mismatched.matches[0].quotes[1].market_id='other';expect(winnerCandidates([f],pool,mismatched,new Set(),'synthetic-owner',at)).toEqual([]);
  const stale=board();stale.checkedAt=new Date(at-31000).toISOString();expect(winnerCandidates([f],pool,stale,new Set(),'synthetic-owner',at)).toEqual([]);
  expect(winnerCandidates([f],pool,b,new Set(),'synthetic-owner',Date.parse(protocol.createdAt)-1)).toEqual([]);
 });
 it('requires shadow registration before verified actual start, exact source identity, and available results',()=>{
  const c=captured(),s=source(),done={...s,outcome:{status:'settled' as const,y:Array(14).fill(1),actualStart:at+3600000,availableAt:new Date(at+7200000).toISOString()}},now=at+8000000;
  expect(settleWinnerCase(c,done,at+1000,now).outcome.status).toBe('settled');
  expect(settleWinnerCase(c,done,at+3600000,now).outcome.status).toBe('invalid');
  expect(settleWinnerCase(c,{...done,forecastHash:'wrong'},at,now)).toBe(c);
  expect(settleWinnerCase(c,done,at,at+1000).outcome.status).toBe('pending');
  expect(settleWinnerCase(c,{...s,outcome:{status:'invalid',reason:'source_revised'}},at,now).outcome.status).toBe('invalid');
  expect(()=>assertWinnerCase({...c,forecast:{...c.forecast,homeOdds:100}})).toThrow('WINNER_SHADOW_CORRUPT');
 });
 it('requires fixed future checkpoints and improvement versus three references, not the best replay accuracy',()=>{
  const base=captured();
  const rows:WinnerCase[]=Array.from({length:500},(_,i)=>({...base,forecast:{...base.forecast,id:String(i),at:at+Math.floor(i/35)*86400000,kickoff:at+Math.floor(i/35)*86400000+3600000,leagueProbability:.5,bookmakerProbability:.5,probabilities:{'current-eb':.5,'full-logistic':.95,'scores-logistic':.95,'context-logistic':.95}},outcome:{status:'settled',y:1}}));
  const now=at+40*86400000,result=winnerCheckpoint(rows,500,now);expect(result.challengers.every(c=>c.preliminaryPass)).toBe(true);expect(result.challengers[0].comparisons).toHaveLength(3);expect(protocol.familyComparisons).toBe(protocol.challengers.length*3*protocol.checkpoints.length);
  expect(winnerCheckpoint(rows,500,at).challengers.some(c=>c.preliminaryPass)).toBe(false);
  const missing=rows.map((c,i)=>i<30?{...c,outcome:{status:'pending' as const}}:c);const m=winnerCheckpoint(missing,500,now);expect(m.summary.captured).toBe(500);expect(m.summary.settled).toBe(470);expect(m.challengers.every(c=>!c.preliminaryPass)).toBe(true);
  expect(()=>winnerCheckpoint(rows,501,now)).toThrow('WINNER_CHECKPOINT_INVALID');
 });
});
