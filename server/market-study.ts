import {canonical,marketHash,studyUuid as uuid} from './research-integrity.js';
export {canonical,marketHash} from './research-integrity.js';
import {WinnerShadow,winnerCandidates} from './winner-shadow.js';
import {winnerDiagnostic} from '../src/domain/winner-comparison.js';
import {ForecastStore} from './forecast-store.js';
import {ProspectiveStudy} from './prospective-study.js';
import {ResultsFeed,type ResultsArchive} from './results.js';
import {MoviOddsFeed} from './moviodds.js';
import {MarketContext,marketOutcomes} from '../src/domain/market-context.js';
import {predictMarkets,marketRuntimeVersion} from '../src/domain/market-runtime.js';
import {marketStudyProtocol as protocol,marketCheckpoint,marketDescriptive,type MarketStudyCase} from '../src/domain/market-validation.js';
import {playerKey,type MatchResult} from '../src/domain/player-model.js';
import {verifiedStart} from '../src/domain/research-source.js';
import type {Board} from '../src/shared/board.js';
import type {Env} from './auth.js';

export {protocol as marketStudyProtocol};
const protocolHash=marketHash(protocol),caseName=`Market observations ${protocol.id}`,batchName=`Market batches ${protocol.id}`,checkpointName=`Market checkpoints ${protocol.id}`;

export function assertMarketCase(c:MarketStudyCase){
  const f=c.forecast;
  if(f.studyId!==protocol.id||f.modelHash!==protocol.portableModelHash||f.protocolHash!==protocolHash||f.modelVersion!==marketRuntimeVersion||marketHash(f)!==c.forecastHash||f.p.length!==14||f.baseline.length!==14||f.x.length!==63||f.eb.length!==14||![...f.p,...f.baseline,...f.x,...f.eb,f.at,f.kickoff,f.featuresAvailable].every(Number.isFinite)||[...f.p,...f.baseline].some(v=>v<0||v>1)||f.featuresAvailable>=f.at||f.sampleSize<protocol.minimumPlayerHistory||f.at<Date.parse(protocol.createdAt))throw Error('MARKET_STUDY_CORRUPT');
  if(!['pending','settled','invalid'].includes(c.outcome.status)||!Number.isInteger(c.attempts)||c.attempts<0||c.attempts>protocol.settlementMaximumAttempts||(c.outcome.status==='settled'&&(c.outcome.y?.length!==14||c.outcome.y.some(y=>y!==0&&y!==1))))throw Error('MARKET_STUDY_CORRUPT');
}

export function marketCandidates(board:Board,archive:ResultsArchive,owner:string,at:number,seen:Set<string>){
  if(archive.source!=='postgres'||!Number.isFinite(Date.parse(board.checkedAt))||at-Date.parse(board.checkedAt)>30000||Date.parse(board.checkedAt)>at+1000)throw Error('MARKET_STUDY_SOURCE_STALE');
  const context=new MarketContext(),results=archive.results.filter(r=>Date.parse(r.availableAt)<at).sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id));
  for(const r of results)context.update(r);
  return board.matches.filter(m=>!seen.has(m.id)&&!m.in_play&&Date.parse(m.kickoff_utc??'')-at>=protocol.minimumLeadMinutes*60000&&Date.parse(m.kickoff_utc??'')-at<=protocol.maximumLeadHours*3600000)
    .sort((a,b)=>marketHash(`${protocol.id}:${a.id}`).localeCompare(marketHash(`${protocol.id}:${b.id}`)))
    .flatMap(m=>{
      const f=context.features(m,at,protocol.minimumPlayerHistory);if(!f)return[];
      const forecast={studyId:protocol.id,userId:owner,id:m.id,home:m.home,away:m.away,league:m.league,at,kickoff:Date.parse(m.kickoff_utc!),observedBoard:board.checkedAt,modelVersion:marketRuntimeVersion,modelHash:protocol.portableModelHash,protocolHash,featuresAvailable:f.available,x:f.x,baseline:f.baseline,eb:f.eb,p:predictMarkets(f),sampleSize:f.sampleSize};
      return[{forecast,forecastHash:marketHash(forecast),outcome:{status:'pending' as const},attempts:0}];
    });
}

export function settleMarketCase(c:MarketStudyCase,r:MatchResult,payload:unknown,now:number,recordedAt:number):MarketStudyCase{
  assertMarketCase(c);const f=c.forecast;
  if(r.id!==f.id||playerKey(r.league,r.home)!==playerKey(f.league,f.home)||playerKey(r.league,r.away)!==playerKey(f.league,f.away)||Date.parse(r.availableAt)>now)return c;
  const at=verifiedStart(payload,r);if(at===null)return c;
  const invalid=(reason:string)=>({...c,outcome:{status:'invalid' as const,reason,actualStart:at+60000,availableAt:r.availableAt}});
  if(!Number.isFinite(recordedAt)||Math.max(f.at,recordedAt)>=at)return invalid('registered_after_actual_start_guard');
  const wins=Math.max(r.sets.filter(s=>s[0]>s[1]).length,r.sets.filter(s=>s[0]<s[1]).length);
  if(wins!==3)return invalid('not_complete_best_of_five');
  if(Date.parse(r.finishedAt)<=Math.max(f.at,recordedAt))return invalid('result_predates_registration');
  return{...c,outcome:{status:'settled',y:marketOutcomes(r),availableAt:r.availableAt,actualStart:at+60000,closingHash:marketHash(payload)}};
}

type Stored={id:string;created_at:string;parameters:{studyId:string;userId:string;case:MarketStudyCase}};
export class MarketStudy{
  private store:ForecastStore;private owner:ProspectiveStudy;private pending?:Promise<unknown>;private shadow:WinnerShadow;
  constructor(private env:Env,private now=Date.now,private results=new ResultsFeed(),private feed:Pick<MoviOddsFeed,'board'>=new MoviOddsFeed()){
    this.store=new ForecastStore(env,now);this.owner=new ProspectiveStudy(env,now,results,feed as MoviOddsFeed);
    this.shadow=new WinnerShadow(env,now);
  }
  private async cases(owner:string){
    const all:Stored[]=[];
    for(let offset=0;offset<protocol.maximumCases;offset+=1000){
      const r=await this.store.db().from('model_versions').select('id,created_at,parameters').eq('name',caseName).contains('parameters',{studyId:protocol.id,userId:owner}).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);
      if(r.error||!Array.isArray(r.data))throw Error('MARKET_STUDY_READ_FAILED');all.push(...r.data as unknown as Stored[]);if(r.data.length<1000)break;
    }
    for(const row of all){assertMarketCase(row.parameters.case);if(row.parameters.case.forecast.userId!==owner)throw Error('MARKET_STUDY_OWNER_MISMATCH');}
    return all;
  }
  private async metadata(name:string,owner:string){const r=await this.store.db().from('model_versions').select('version,parameters,created_at').eq('name',name).contains('parameters',{studyId:protocol.id,userId:owner}).order('created_at',{ascending:false}).limit(100);if(r.error)throw Error('MARKET_STUDY_READ_FAILED');return r.data??[];}
  async report(userId:string){
    const owner=await this.owner.ownerId();if(owner!==userId)throw Error('MARKET_STUDY_OWNER_ONLY');
    const rows=await this.cases(owner),cases=rows.map(r=>r.parameters.case),batches=await this.metadata(batchName,owner),checkpoints=await this.metadata(checkpointName,owner);
    const ordered=[...cases].sort((a,b)=>a.forecast.at-b.forecast.at||a.forecast.id.localeCompare(b.forecast.id));
    const sealed=checkpoints.map(row=>{const p=row.parameters as {size:number;prefixHash:string;result:ReturnType<typeof marketCheckpoint>};return{size:p.size,result:p.result,consistent:p.prefixHash===marketHash(ordered.slice(0,p.size)),sealedAt:row.created_at};});
    const report={checkedAt:new Date(this.now()).toISOString(),protocol,enabled:this.env.APP_FORWARD_STUDY_ENABLED==='1',scheduled:this.env.VERCEL_ENV==='production'&&!!this.env.CRON_SECRET&&this.env.APP_FORWARD_STUDY_ENABLED==='1',captured:cases.length,settled:cases.filter(c=>c.outcome.status==='settled').length,pending:cases.filter(c=>c.outcome.status==='pending').length,invalid:cases.filter(c=>c.outcome.status==='invalid').length,observedDays:new Set(cases.map(c=>new Date(c.forecast.at).toISOString().slice(0,10))).size,descriptive:marketDescriptive(cases),batches,checkpoints:sealed,operationallyValidated:false,canRun:true};
    // Private hosting logs contain aggregates only, never event IDs, player names,
    // user IDs, individual probabilities, credentials or personal wagers.
    console.info(JSON.stringify({marketStudyStatus:protocol.id,checkedAt:report.checkedAt,captured:report.captured,settled:report.settled,pending:report.pending,invalid:report.invalid,observedDays:report.observedDays,targets:report.descriptive.map(({target,n,correct,wrong,undecided,accuracy})=>({target,n,correct,wrong,undecided,accuracy}))}));
    const extra:{winnerReview?:ReturnType<typeof winnerDiagnostic>;winnerShadow?:Awaited<ReturnType<WinnerShadow['report']>>;winnerReviewError?:string}={};
    try{
      extra.winnerReview=winnerDiagnostic(cases);extra.winnerShadow=await this.shadow.report(owner);
      const s=extra.winnerShadow,r=extra.winnerReview;
      const compact=(m:typeof r.models[number])=>({id:m.id,n:m.n,correct:m.correct,wrong:m.wrong,undecided:m.undecided,brier:m.brier,logLoss:m.logLoss,ece:m.ece});
      console.info(JSON.stringify({winnerReviewStatus:s.protocol.id,cutoff:r.cutoff,expected:r.expected,n:r.n,models:r.models.map(compact),reference:r.reference,validated:false}));
      console.info(JSON.stringify({winnerReviewSlices:s.protocol.id,leagues:r.leagues.map(g=>({league:g.league,n:g.n,correct:g.correct,wrong:g.wrong,brier:g.brier})),confidence:r.confidence.map(g=>({from:g.from,to:g.to,n:g.n,correct:g.correct,wrong:g.wrong,brier:g.brier}))}));
      console.info(JSON.stringify({winnerShadowStatus:s.protocol.id,captured:s.captured,settled:s.settled,pending:s.pending,invalid:s.invalid,observedDays:s.observedDays,models:s.models.map(compact),league:s.league,bookmaker:s.bookmaker,checkpoints:s.checkpoints.map(c=>({size:c.size,consistent:c.consistent,passed:c.result.challengers.filter(x=>x.preliminaryPass).length})),validated:false}));
    }catch{extra.winnerReviewError='Confronto dei candidati temporaneamente non disponibile.';console.error('WINNER_REVIEW_UNAVAILABLE');}
    return{...report,...extra};
  }
  async run(userId?:string,deadline=this.now()+240000){
    if(this.env.APP_FORWARD_STUDY_ENABLED!=='1')return{status:'disabled',captured:0,settled:0};
    const owner=await this.owner.ownerId();if(userId&&userId!==owner)throw Error('MARKET_STUDY_OWNER_ONLY');
    if(this.pending)return this.pending;
    this.pending=this.execute(owner,deadline);try{return await this.pending;}finally{this.pending=undefined;}
  }
  private async execute(owner:string,deadline:number){
    if(deadline-this.now()<15000)return{status:'deferred_deadline',captured:0,settled:0};
    const start=Date.parse(protocol.createdAt),now=this.now();
    if(now<start||now>start+protocol.followupDays*86400000)return{status:'window_closed',captured:0,settled:0};
    const db=this.store.db(),cooldownId=uuid(`${protocol.id}:cooldown:${owner}`);
    const cooldown=await db.from('model_versions').select('parameters').eq('id',cooldownId).maybeSingle();if(cooldown.error)throw Error('MARKET_STUDY_READ_FAILED');
    if(Number((cooldown.data?.parameters as {until?:number}|undefined)?.until??0)>this.now())return{status:'cooldown',captured:0,settled:0};
    const runSlot=Math.floor(now/(protocol.runCooldownMinutes*60000)),runId=uuid(`${protocol.id}:run:${owner}:${runSlot}`);
    const claimRun=await db.from('model_versions').insert({id:runId,name:`Market runs ${protocol.id}`,version:`${protocol.id}:run:${runSlot}`,validated:false,training_cutoff:'2026-11-05T00:00:00Z',parameters:{studyId:protocol.id,userId:owner,slot:runSlot}});
    if(claimRun.error){if(claimRun.error.code==='23505')return{status:'recent_run',captured:0,settled:0};throw Error('MARKET_STUDY_CLAIM_FAILED');}
    const rows=await this.cases(owner),archive=await this.results.archive();if(archive.source!=='postgres')throw Error('MARKET_STUDY_ARCHIVE_INCOMPLETE');
    const day=new Date(now).toISOString().slice(0,10),batchId=uuid(`${protocol.id}:batch:${day}:${owner}`);let captured=0,settled=0,attempted=0,sourceErrors=0;
    const saveMeta=(id:string,name:string,version:string,parameters:Record<string,unknown>,insert=false)=>{
      const row={id,name,version,training_cutoff:'2026-11-05T00:00:00Z',validated:false,parameters:{studyId:protocol.id,userId:owner,...parameters}};
      return insert?db.from('model_versions').insert(row):db.from('model_versions').upsert(row,{onConflict:'id'});
    };
    if(now<start+protocol.enrollmentDays*86400000&&rows.length<protocol.maximumCases){
      const claim=await saveMeta(batchId,batchName,`${protocol.id}:batch:${day}`,{state:'running',day,at:new Date(now).toISOString(),captured:0},true);
      if(claim.error&&claim.error.code!=='23505')throw Error('MARKET_STUDY_CLAIM_FAILED');
      if(!claim.error){
        try{
          const board=await this.feed.board(),at=this.now(),selected=marketCandidates(board,archive,owner,at,new Set(rows.map(r=>r.parameters.case.forecast.id))).slice(0,Math.min(protocol.maximumPerDay,protocol.maximumCases-rows.length));
          if(this.now()-at>30000||deadline-this.now()<12000)throw Error('MARKET_STUDY_CAPTURE_DEADLINE');
          if(selected.length){
            // The existing unique(name,version) also reserves bounded cohort slots
            // across concurrent day-boundary batches; a collision aborts the insert.
            const data=selected.map((c,i)=>({id:uuid(`${protocol.id}:case:${owner}:${c.forecast.id}`),name:caseName,version:`${protocol.id}:case-slot:${rows.length+i}`,training_cutoff:'2026-11-05T00:00:00Z',validated:false,parameters:{studyId:protocol.id,userId:owner,case:c}}));
            const saved=await db.from('model_versions').upsert(data,{onConflict:'id',ignoreDuplicates:true}).select('id,created_at,parameters');
            if(saved.error)throw Error('MARKET_STUDY_CAPTURE_FAILED');captured=saved.data?.length??0;rows.push(...(saved.data??[]) as unknown as Stored[]);
          }
          const saved=await saveMeta(batchId,batchName,`${protocol.id}:batch:${day}`,{state:'captured',day,checkedAt:new Date(this.now()).toISOString(),captured});if(saved.error)throw Error('MARKET_STUDY_BATCH_WRITE_FAILED');
        }catch{
          await saveMeta(batchId,batchName,`${protocol.id}:batch:${day}`,{state:'partial',day,checkedAt:new Date(this.now()).toISOString(),captured});throw Error('MARKET_STUDY_CAPTURE_INCOMPLETE');
        }
      }
    }
    if(deadline-this.now()>30000){
      try{const board=await this.feed.board(),at=this.now(),candidates=marketCandidates(board,archive,owner,at,new Set());await this.shadow.capture(owner,winnerCandidates(candidates,rows,board,new Set(archive.results.map(r=>r.id)),owner,at),deadline);}catch{console.error('WINNER_SHADOW_CAPTURE_UNAVAILABLE');}
    }
    const byId=new Map(archive.results.map(r=>[r.id,r]));let next=0;
    // Bounded work, persisted between invocations; no process left running after response.
    for(const row of rows){
      if(attempted>=100||deadline-this.now()<15000)break;
      let c=row.parameters.case;const r=byId.get(c.forecast.id);if(!r)continue;
      if(c.outcome.status==='settled'){
        const wins=Math.max(r.sets.filter(s=>s[0]>s[1]).length,r.sets.filter(s=>s[0]<s[1]).length);
        if(wins!==3||JSON.stringify(c.outcome.y)!==JSON.stringify(marketOutcomes(r)))c={...c,outcome:{status:'invalid',reason:'source_result_revised'}};
        else continue;
      }else if(c.outcome.status==='invalid'||c.attempts>=protocol.settlementMaximumAttempts||(c.lastAttempt&&this.now()-c.lastAttempt<protocol.settlementCooldownHours*3600000))continue;
      if(c.outcome.status==='pending'){
        const slot=Math.max(this.now(),next);next=slot+750;await new Promise(resolve=>setTimeout(resolve,Math.max(0,slot-this.now())));attempted++;
        let payload:unknown=null;
        try{
          const response=await fetch(`https://moviodds.com/closing?fi=${encodeURIComponent(r.id)}`,{signal:AbortSignal.timeout(6000),redirect:'error'});
          if(response.status===429||response.status===503){
            sourceErrors++;const retry=response.headers.get('retry-after'),numeric=Number(retry),until=retry&&Number.isFinite(numeric)?this.now()+numeric*1000:Date.parse(retry??'');
            const saved=await saveMeta(cooldownId,`Market cooldown ${protocol.id}`,`${protocol.id}:cooldown`,{until:Math.max(this.now()+15*60000,Number.isFinite(until)?until:0)});if(saved.error)throw Error('MARKET_STUDY_COOLDOWN_FAILED');break;
          }
          if(response.ok)payload=await response.json();else sourceErrors++;
        }catch(error){if(error instanceof Error&&error.message==='MARKET_STUDY_COOLDOWN_FAILED')throw error;sourceErrors++;}
        c={...c,attempts:c.attempts+1,lastAttempt:this.now()};c=settleMarketCase(c,r,payload,this.now(),Date.parse(row.created_at));
      }
      const saved=await db.from('model_versions').update({parameters:{studyId:protocol.id,userId:owner,case:c}}).eq('id',row.id).eq('parameters->case->>forecastHash',row.parameters.case.forecastHash).eq('parameters->case->>attempts',row.parameters.case.attempts).eq('parameters->case->outcome->>status',row.parameters.case.outcome.status).select('id');
      if(saved.error)throw Error('MARKET_STUDY_SETTLEMENT_WRITE_FAILED');if(!saved.data?.length)continue;row.parameters.case=c;if(c.outcome.status==='settled')settled++;
    }
    const previous=await this.metadata(checkpointName,owner),existing=new Set(previous.map(r=>Number((r.parameters as Record<string,unknown>).size))),checkpointRows=rows.length>=protocol.checkpoints[0]?await this.cases(owner):rows;
    for(const size of protocol.checkpoints){
      if(rows.length<size||existing.has(size)||deadline-this.now()<15000)continue;
      const result=marketCheckpoint(checkpointRows.map(r=>r.parameters.case),size,this.now());if(!result.closed)continue;
      const prefix=checkpointRows.map(r=>r.parameters.case).sort((a,b)=>a.forecast.at-b.forecast.at||a.forecast.id.localeCompare(b.forecast.id)).slice(0,size);
      const saved=await saveMeta(uuid(`${protocol.id}:checkpoint:${owner}:${size}`),checkpointName,`${protocol.id}:checkpoint:${size}`,{size,closedAt:new Date(this.now()).toISOString(),prefixHash:marketHash(prefix),result},true);
      if(saved.error&&saved.error.code!=='23505')throw Error('MARKET_STUDY_CHECKPOINT_WRITE_FAILED');
    }
    if(deadline-this.now()>15000){try{await this.shadow.settle(owner,rows,deadline);}catch{console.error('WINNER_SHADOW_SETTLEMENT_UNAVAILABLE');}}
    const summary={status:'completed',captured,settled,attempted,sourceErrors,total:rows.length,checkedAt:new Date(this.now()).toISOString()};
    const savedRun=await saveMeta(runId,`Market runs ${protocol.id}`,`${protocol.id}:run:${runSlot}`,summary);if(savedRun.error)throw Error('MARKET_STUDY_RUN_WRITE_FAILED');
    console.info(JSON.stringify({marketStudyRun:protocol.id,...summary}));return summary;
  }
}
