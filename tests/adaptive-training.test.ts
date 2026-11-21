import {afterEach,describe,it,expect,vi} from 'vitest';
import {adaptiveWindows,splitAdaptiveRows,trainAdaptiveCandidate,adaptiveTrainingEnabled,type AdaptiveTrainingRow} from '../src/domain/adaptive-training';
import {AdaptiveTraining,adaptiveRow} from '../server/adaptive-training';
import {ForecastStore} from '../server/forecast-store';
import {ProspectiveStudy} from '../server/prospective-study';
import {marketStudyProtocol as protocol,type MarketStudyCase} from '../src/domain/market-validation';
import {marketRuntimeVersion} from '../src/domain/market-runtime';
import {marketHash,studyUuid} from '../server/research-integrity';

const DAY=86400000,now=Date.parse('2026-11-12T12:00:00Z'),today=Math.floor(now/DAY)*DAY,owner='synthetic-owner';
const row=(id:string,at:number,y=1):AdaptiveTrainingRow=>({id,at,available:at+3600000,x:[y?.7:-.7,0,0,0,0,0,0,0],y});
const enough=()=>[...Array.from({length:200},(_,i)=>row(`train-${i}`,today-4*DAY+i*1000,i%2)),...Array.from({length:50},(_,i)=>row(`cal-${i}`,today-2*DAY+i*1000,i%2)),...Array.from({length:50},(_,i)=>row(`test-${i}`,today-DAY+i*1000,i%2))];
function source(id='case',at=today-DAY+3600000){
  const forecast={studyId:protocol.id,userId:owner,id,home:'A',away:'B',league:'Synthetic QA',at,kickoff:at+3600000,observedBoard:new Date(at).toISOString(),modelVersion:marketRuntimeVersion,modelHash:protocol.portableModelHash,protocolHash:marketHash(protocol),featuresAvailable:at-1000,x:Array(63).fill(.1),baseline:Array(14).fill(.5),eb:Array(14).fill(.5),p:Array(14).fill(.5),sampleSize:30};
  const c:MarketStudyCase={forecast,forecastHash:marketHash(forecast),outcome:{status:'settled',actualStart:at+3600000,availableAt:new Date(at+7200000).toISOString(),closingHash:'a'.repeat(64),y:Array(14).fill(1)},attempts:1};
  return{id:studyUuid(`${protocol.id}:case:${owner}:${id}`),created_at:new Date(at+1000).toISOString(),parameters:{studyId:protocol.id,userId:owner,case:c}};
}

type DbOptions={sources?:ReturnType<typeof source>[];runs?:unknown[];conflict?:boolean;readError?:boolean};
function mockedDb(options:DbOptions={}){
  const writes:{kind:string;value:Record<string,unknown>}[]=[];
  const db={from:()=>{
    let operation='read',filterName='';
    const q={select:()=>q,contains:()=>q,order:()=>q,range:()=>q,limit:()=>q,eq:(key:string,value:string)=>{if(key==='name')filterName=value;return q;},insert:async(value:Record<string,unknown>)=>{writes.push({kind:'insert',value});return{error:options.conflict?{code:'23505'}:null};},update:(value:Record<string,unknown>)=>{operation='update';writes.push({kind:'update',value});return q;},then:(resolve:(value:unknown)=>unknown)=>resolve(operation==='update'?{data:[{id:'saved'}],error:null}:{data:filterName.startsWith('Market observations')?(options.sources??[]):(options.runs??[]),error:options.readError?{message:'synthetic failure'}:null})};return q;
  }};
  vi.spyOn(ForecastStore.prototype,'db').mockReturnValue(db as unknown as ReturnType<ForecastStore['db']>);
  vi.spyOn(ProspectiveStudy.prototype,'ownerId').mockResolvedValue(owner);
  return writes;
}
afterEach(()=>vi.restoreAllMocks());

describe('bounded adaptive candidate training',()=>{
  it('uses whole UTC days and excludes outcomes unavailable before train/calibration boundaries',()=>{
    expect(adaptiveWindows(now)).toEqual({trainingBefore:'2026-11-10T00:00:00.000Z',calibrationFrom:'2026-11-10T00:00:00.000Z',calibrationBefore:'2026-11-11T00:00:00.000Z',testFrom:'2026-11-11T00:00:00.000Z',testBefore:'2026-11-12T00:00:00.000Z'});
    const lateTrain={...row('late-train',today-3*DAY),available:today-2*DAY},lateCal={...row('late-cal',today-2*DAY),available:today-DAY};
    const split=splitAdaptiveRows([...enough(),lateTrain,lateCal,row('today',today)],now);
    expect(split.counts).toMatchObject({train:200,calibration:50,test:50,lateTraining:1,lateCalibration:1,outsideWindows:1});
    expect(split.train.some(r=>r.id===lateTrain.id)).toBe(false);expect(split.calibration.some(r=>r.id===lateCal.id)).toBe(false);
    const capped=splitAdaptiveRows(Array.from({length:1100},(_,i)=>row(String(i),today-(20-Math.floor(i/100))*DAY)),now);
    expect(capped.train).toHaveLength(1000);expect(new Set(capped.train.map(r=>Math.floor(r.at/DAY))).size).toBe(10);
  });
  it('rejects duplicate IDs, invalid features and future labels without inventing rows',()=>{
    const r=row('a',today-3*DAY);expect(()=>splitAdaptiveRows([r,r],now)).toThrow('ADAPTIVE_ROW_INVALID');
    expect(()=>splitAdaptiveRows([{...r,available:now+1}],now)).toThrow('ADAPTIVE_ROW_INVALID');
    expect(()=>splitAdaptiveRows([{...r,x:[NaN]}],now)).toThrow('ADAPTIVE_ROW_INVALID');
    const result=trainAdaptiveCandidate(enough().slice(0,100),now,()=>now,now+90000);expect(result.summary.status).toBe('insufficient_data');expect(result.artifact).toBeUndefined();
  });
  it('trains actual fixed candidates and selects model/temperature without reading test outcomes',()=>{
    const rows=enough(),first=trainAdaptiveCandidate(rows,now,()=>now,now+90000);
    const changed=rows.map(r=>r.id.startsWith('test-')?{...r,y:1-r.y}:r),second=trainAdaptiveCandidate(changed,now,()=>now,now+90000);
    expect(first.summary.status).toBe('trained');expect(first.artifact).toEqual(second.artifact);expect(first.summary.candidateMetrics).toEqual(second.summary.candidateMetrics);
    expect(first.summary.test?.brier).not.toBe(second.summary.test?.brier);expect(first.summary.test?.n).toBe(50);expect(first.summary.baseline?.n).toBe(50);expect(first.summary.operationallyValidated).toBe(false);expect(first.artifact?.validated).toBe(false);
    expect(JSON.stringify(first.summary)).not.toContain('weights');expect(JSON.stringify(first.summary)).not.toContain('test-');
    expect(trainAdaptiveCandidate(rows,now,()=>now,now+11999).summary.status).toBe('deferred_deadline');
  });
  it('only consumes hash-bound owner cases registered strictly before actual prematch guard',()=>{
    const good=source();expect(adaptiveRow(good,owner,now)?.x).toHaveLength(8);
    const tampered=structuredClone(good);tampered.parameters.case.forecast.x[0]=.9;expect(()=>adaptiveRow(tampered,owner,now)).toThrow('MARKET_STUDY_CORRUPT');
    expect(()=>adaptiveRow({...good,created_at:new Date(good.parameters.case.outcome.actualStart!-60000).toISOString()},owner,now)).toThrow('ADAPTIVE_SOURCE_NOT_PREMATCH');
    expect(()=>adaptiveRow({...good,id:'forged'},owner,now)).toThrow('ADAPTIVE_SOURCE_OWNER_OR_ID');
    const late=structuredClone(good);late.parameters.case.outcome.availableAt=new Date(now+1).toISOString();expect(adaptiveRow(late,owner,now)).toBeNull();
    const pending=structuredClone(good);pending.parameters.case.outcome={status:'pending'};expect(adaptiveRow(pending,owner,now)).toBeNull();
  });
  it('claims one daily attempt, retains insufficient coverage and never exposes stored weights in reports',async()=>{
    const writes=mockedDb({sources:[source()],runs:[{created_at:new Date(now).toISOString(),parameters:{day:'2026-11-12',state:'trained',summary:{status:'trained',day:'2026-11-12',checkedAt:new Date(now).toISOString(),reason:'synthetic',artifact:{weights:['private']},inputIds:['private'],automaticPromotion:false,operationallyValidated:false},artifact:{weights:['private']}}}]});
    const training=new AdaptiveTraining({APP_FORWARD_STUDY_ENABLED:'1',VERCEL_ENV:'production',CRON_SECRET:'synthetic'},()=>now),result=await training.run(owner);
    expect(result.status).toBe('insufficient_data');expect('coverage' in result&&result.coverage).toMatchObject({registered:1,eligibleSettled:1,testRegistered:1,testEligibleSettled:1});expect(writes.filter(r=>r.kind==='insert')).toHaveLength(1);expect(writes.filter(r=>r.kind==='update')).toHaveLength(1);
    const report=await training.report(owner);expect(report.enabled).toBe(true);expect(report.scheduled).toBe(true);expect(JSON.stringify(report)).not.toContain('private');expect(JSON.stringify(report)).not.toContain('weights');
    expect(writes[0].value).toMatchObject({validated:false,name:'Adaptive candidates adaptive-candidates-v17'});expect(writes[0].value.id).toBe(studyUuid(`adaptive-candidates-v17:run:${owner}:2026-11-12`));
  });
  it('does not duplicate a claimed day or consume a day without sufficient deadline',async()=>{
    const writes=mockedDb({conflict:true});const training=new AdaptiveTraining({APP_FORWARD_STUDY_ENABLED:'1'},()=>now);
    expect((await training.run(owner,now+11000)).status).toBe('deferred_deadline');expect(writes).toHaveLength(0);
    expect((await training.run(owner)).status).toBe('daily_already_attempted');expect(writes.filter(r=>r.kind==='insert')).toHaveLength(1);expect(writes.some(r=>r.kind==='update')).toBe(false);
    await expect(training.run('wrong-owner')).rejects.toThrow('ADAPTIVE_OWNER_ONLY');
    await expect(new AdaptiveTraining({},()=>now).run('wrong-owner',now+1000)).rejects.toThrow('ADAPTIVE_OWNER_ONLY');
    expect(adaptiveTrainingEnabled({APP_FORWARD_STUDY_ENABLED:'1',APP_ADAPTIVE_TRAINING_DISABLED:'1'})).toBe(false);
  });
  it('retains read failures as failed daily attempts and counts pending, invalid and rejected records',async()=>{
    const writes=mockedDb({readError:true});const training=new AdaptiveTraining({APP_FORWARD_STUDY_ENABLED:'1'},()=>now);expect((await training.run(owner)).status).toBe('failed');expect(writes.at(-1)?.value.parameters).toMatchObject({state:'failed'});
    vi.restoreAllMocks();const pending=source('pending');pending.parameters.case.outcome={status:'pending'};const invalid=source('invalid');invalid.parameters.case.outcome={status:'invalid',reason:'synthetic'};const corrupt=source('corrupt');corrupt.parameters.case.forecastHash='broken';mockedDb({sources:[source(),pending,invalid,corrupt]});
    const result=await new AdaptiveTraining({APP_FORWARD_STUDY_ENABLED:'1'},()=>now).run(owner);expect('coverage' in result&&result.coverage).toMatchObject({registered:4,pending:1,invalid:1,rejectedByIntegrity:1,eligibleSettled:1,testRegistered:4,testEligibleSettled:1});expect('testCoverage' in result&&result.testCoverage).toBe(.25);
  });
  it('persists actual trained weights only in the private daily artifact without promoting them',async()=>{
    const sources=enough().map(r=>{const s=source(r.id,r.at);s.parameters.case.forecast.x=[...r.x,...Array(55).fill(.1)];s.parameters.case.forecastHash=marketHash(s.parameters.case.forecast);s.parameters.case.outcome.y=Array(14).fill(r.y);return s;});
    const writes=mockedDb({sources}),result=await new AdaptiveTraining({APP_FORWARD_STUDY_ENABLED:'1'},()=>now).run(owner);
    expect(result.status).toBe('trained');expect(JSON.stringify(result)).not.toContain('weights');expect(result.operationallyValidated).toBe(false);
    const saved=writes.at(-1)?.value.parameters as {artifact:{model:{weights:number[]};validated:boolean};summary:{testCoverage:number}};
    expect(saved.artifact.model.weights.length).toBeGreaterThan(0);expect(saved.artifact.model.weights.every(Number.isFinite)).toBe(true);expect(saved.artifact.validated).toBe(false);expect(saved.summary.testCoverage).toBe(1);
    expect(writes).toHaveLength(2);expect(writes[0].value.name).toBe('Adaptive candidates adaptive-candidates-v17');
  });
});
