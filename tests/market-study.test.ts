import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {afterEach,describe,it,expect,vi} from 'vitest';
import parity from '../research/market-runtime-parity.json';
import artifact from '../models/market-v8-runtime.json';
import {predictMarkets} from '../src/domain/market-runtime';
import {marketCheckpoint,marketInterval,marketStudyProtocol as protocol,type MarketStudyCase} from '../src/domain/market-validation';
import {assertMarketCase,marketHash,marketCandidates,settleMarketCase} from '../server/market-study';
import {createHandler} from '../server/handler';
import type {Board} from '../src/shared/board';
import type {MatchResult} from '../src/domain/player-model';

const at=Date.parse(protocol.createdAt)+86400000;
const result=(id:string,finished:number,win=true):MatchResult=>({id,league:'Test',home:'A',away:'B',finishedAt:new Date(finished).toISOString(),availableAt:new Date(finished).toISOString(),homeWon:win,sets:win?[[11,5],[11,5],[11,5]]:[[5,11],[5,11],[5,11]]});
const board=():Board=>({provider:'MoviOdds',bookmakerSite:'bet365.com.au',warming:false,checkedAt:new Date(at).toISOString(),serverTime:new Date(at).toISOString(),matches:[{id:'future',league:'Test',home:'A',away:'B',sport:'table_tennis',in_play:false,kickoff_utc:new Date(at+3600000).toISOString(),quotes:[]}]});
const archive=()=>({source:'postgres' as const,checkedAt:new Date(at).toISOString(),results:Array.from({length:35},(_,i)=>result(String(i),at-(40-i)*3600000,i%3!==0)),rejected:0,from:new Date(at-40*3600000).toISOString(),to:new Date(at-6*3600000).toISOString()});
const make=()=>marketCandidates(board(),archive(),'synthetic-owner',at,new Set())[0];
describe('frozen market runtime and prospective validation',()=>{
  it('reproduces Python probabilities on 22 actual historical feature vectors without labels or player IDs',()=>{
    expect(parity).toHaveLength(22);
    for(const row of parity)predictMarkets(row).forEach((p,j)=>expect(p).toBeCloseTo(row.expected[j],12));
    expect(()=>predictMarkets({...parity[0],x:[NaN]})).toThrow('MARKET_RUNTIME_INPUT');
  });
  it('binds exported weights and feature code to the registered protocol',()=>{
    const digest=(p:string)=>createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex');
    expect(digest('../models/market-v8-runtime.json')).toBe(protocol.portableModelHash);
    expect(digest('../src/domain/market-context.ts')).toBe(artifact.featureCodeHash);
    expect(digest('../src/domain/score-model.ts')).toBe(artifact.scoreFeatureCodeHash);
    expect(protocol.selectionHash).toBe(artifact.selectionHash);
    expect(protocol.checkpoints).toEqual([500,1000,2000,3000]);
    expect(protocol.followupDays).toBeGreaterThanOrEqual(protocol.enrollmentDays+protocol.maximumLeadHours/24+7);
    expect(artifact.validated).toBe(false);
  });
  it('captures future events only with causal sufficient history and no EV or outcome filter',()=>{
    const c=make();expect(c).toBeDefined();expect(c.forecast.featuresAvailable).toBeLessThan(at);expect(c.forecast.p).toHaveLength(14);expect(c.outcome.status).toBe('pending');expect(()=>assertMarketCase(c)).not.toThrow();
    expect(marketCandidates(board(),archive(),'synthetic-owner',at,new Set(['future']))).toHaveLength(0);
    const live=board();live.matches[0].in_play=true;expect(marketCandidates(live,archive(),'synthetic-owner',at,new Set())).toHaveLength(0);
    const late=board();late.matches[0].kickoff_utc=new Date(at+1000).toISOString();expect(marketCandidates(late,archive(),'synthetic-owner',at,new Set())).toHaveLength(0);
    expect(marketCandidates(board(),{...archive(),results:archive().results.slice(0,29)},'synthetic-owner',at,new Set())).toHaveLength(0);
    expect(()=>marketCandidates({...board(),checkedAt:new Date(at-31000).toISOString()},archive(),'synthetic-owner',at,new Set())).toThrow('MARKET_STUDY_SOURCE_STALE');
    const target=result('future',at+7200000,false);
    expect(marketCandidates(board(),{...archive(),results:[...archive().results,target]},'synthetic-owner',at,new Set())[0].forecast).toEqual(c.forecast);
  });
  it('detects forecast tampering after JSONB key reordering',()=>{
    const c=make();const f=Object.fromEntries(Object.entries(c.forecast).reverse());
    expect(marketHash(f)).toBe(c.forecastHash);
    expect(()=>assertMarketCase({...c,forecast:{...c.forecast,p:c.forecast.p.map(()=>.99)}})).toThrow('MARKET_STUDY_CORRUPT');
  });
  it('settles only exact matches with verified kickoff after actual database registration',()=>{
    const c=make(),r=result('future',at+7200000),payload={fixture_id:'future',closed:true,kickoff_known:true,kickoff_estimated:false,kickoff_utc:new Date(at+3600000).toISOString(),selections:[{side:'A'},{side:'B'}]};
    expect(settleMarketCase(c,r,payload,at+8000000,at+1000).outcome.status).toBe('settled');
    expect(settleMarketCase(c,r,{...payload,kickoff_estimated:true},at+8000000,at+1000).outcome.status).toBe('pending');
    expect(settleMarketCase(c,{...r,home:'Other'},payload,at+8000000,at+1000).outcome.status).toBe('pending');
    expect(settleMarketCase(c,r,payload,at+8000000,at+3600000).outcome.status).toBe('invalid');
    expect(settleMarketCase(c,r,payload,at+1000,at).outcome.status).toBe('pending');
    expect(settleMarketCase(c,{...r,sets:[[11,5],[11,5],[11,5],[11,5]]},payload,at+8000000,at).outcome.reason).toBe('not_complete_best_of_five');
  });
  it('cannot declare success from one day, early peeking or a selectively settled subset',()=>{
    const template=make();
    const cases:MarketStudyCase[]=Array.from({length:500},(_,i)=>({...template,forecast:{...template.forecast,id:String(i),at:at+Math.floor(i/35)*86400000,kickoff:at+Math.floor(i/35)*86400000+3600000,p:Array(14).fill(.95),baseline:Array(14).fill(.5)},outcome:{status:'settled',y:Array(14).fill(1)}}));
    const now=at+30*86400000,checked=marketCheckpoint(cases,500,now);
    expect(checked.observedDays).toBe(15);expect(checked.targets.every(t=>t.preliminaryPass)).toBe(true);
    expect(marketCheckpoint(cases,500,at).closed).toBe(false);
    expect(marketCheckpoint(cases.slice(0,499),500,now).targets.some(t=>t.preliminaryPass)).toBe(false);
    const missing=cases.map((c,i)=>i<100?{...c,outcome:{status:'pending' as const}}:c);
    const incomplete=marketCheckpoint(missing,500,now);expect(incomplete.captured).toBe(500);expect(incomplete.settled).toBe(400);expect(incomplete.targets.every(t=>!t.preliminaryPass)).toBe(true);
    const singleDay=cases.map(c=>({...c,forecast:{...c.forecast,at}}));expect(marketCheckpoint(singleDay,500,now).targets.every(t=>!t.preliminaryPass)).toBe(true);
    expect(()=>marketCheckpoint(cases,501,now)).toThrow('MARKET_CHECKPOINT_UNDECLARED');
  });
  it('uses calendar-day blocks, multiple-look correction and deterministic uncertainty',()=>{
    expect(marketInterval([{at,value:-.1}]).upper).toBeNull();
    const rows=Array.from({length:14},(_,i)=>({at:at+i*86400000,value:-.1}));
    const ci=marketInterval(rows,1000);expect(ci.upper).toBeCloseTo(-.1,10);expect(ci).toEqual(marketInterval(rows,1000));
    expect(protocol.familyAlpha/(protocol.targets.length*protocol.checkpoints.length)).toBeLessThan(.001);
  });
});

const servers:Server[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>new Promise<void>(resolve=>s.close(()=>resolve()))));});
it('protects market study reads/writes and isolates the two cron studies on failure',async()=>{
  const marketStudy={run:vi.fn(async(user?:string)=>{if(user==='outsider')throw Error('MARKET_STUDY_OWNER_ONLY');return{captured:1};}),report:vi.fn(async()=>({checkedAt:new Date(at).toISOString(),protocol,enabled:true,scheduled:true,captured:1,settled:0,pending:1,invalid:0,observedDays:1,descriptive:[],batches:[],checkpoints:[],operationallyValidated:false,canRun:true}))};
  const study={run:vi.fn(async()=>{throw Error('SYNTHETIC_FAILURE');}),report:vi.fn()};
  const secret='synthetic-only-cron-secret-of-sufficient-length';
  const server=createServer(createHandler({env:{CRON_SECRET:secret},study,marketStudy,authorize:async t=>t==='owner'?'owner':t==='outsider'?'outsider':null}));servers.push(server);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();if(!addr||typeof addr==='string')throw Error();const base=`http://127.0.0.1:${addr.port}`;
  expect((await fetch(base+'/api/market-study')).status).toBe(401);expect(marketStudy.report).not.toHaveBeenCalled();
  expect((await fetch(base+'/api/market-study',{headers:{Authorization:'Bearer owner'}})).status).toBe(200);
  expect((await fetch(base+'/api/market-study',{method:'POST',headers:{Authorization:'Bearer outsider'}})).status).toBe(403);
  expect((await fetch(base+'/api/market-study',{method:'PATCH',headers:{Authorization:'Bearer owner'}})).status).toBe(405);
  const cron=await fetch(base+'/api/study-run',{headers:{Authorization:`Bearer ${secret}`}});expect(cron.status).toBe(503);expect(marketStudy.run).toHaveBeenCalledWith(undefined,expect.any(Number));
});
