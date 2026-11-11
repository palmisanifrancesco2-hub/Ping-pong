import {ForecastStore} from './forecast-store.js';
import {ProspectiveStudy} from './prospective-study.js';
import {assertMarketCase} from './market-study.js';
import {marketHash,studyUuid} from './research-integrity.js';
import {marketStudyProtocol,type MarketStudyCase} from '../src/domain/market-validation.js';
import {adaptiveTrainingProtocol,adaptiveTrainingEnabled,adaptiveWindows,trainAdaptiveCandidate,type AdaptiveTrainingRow,type AdaptiveTrainingSummary} from '../src/domain/adaptive-training.js';
import type {Env} from './auth.js';
export {adaptiveTrainingProtocol,adaptiveTrainingEnabled} from '../src/domain/adaptive-training.js';
const name=`Adaptive candidates ${adaptiveTrainingProtocol.id}`,sourceName=`Market observations ${marketStudyProtocol.id}`;
type Source={id:string;created_at:string;parameters:{studyId:string;userId:string;case:MarketStudyCase}};
type Coverage={registered:number;pending:number;invalid:number;unavailable:number;rejectedByIntegrity:number;eligibleSettled:number;testRegistered:number;testEligibleSettled:number};
type StoredSummary=(AdaptiveTrainingSummary|{status:string;day:string;checkedAt:string;reason:string;automaticPromotion:false;operationallyValidated:false})&{coverage?:Coverage;testCoverage?:number};

function publicSummary(value:StoredSummary):StoredSummary{
  const safe={status:value.status,day:value.day,checkedAt:value.checkedAt,reason:value.reason,automaticPromotion:false as const,operationallyValidated:false as const};
  return{...safe,...('counts' in value?{windows:value.windows,counts:value.counts,minimums:value.minimums,selected:value.selected,candidateMetrics:value.candidateMetrics,test:value.test,baseline:value.baseline,differenceBrier:value.differenceBrier,trainingSeconds:value.trainingSeconds}:{}),coverage:value.coverage,testCoverage:value.testCoverage};
}

export function adaptiveRow(source:Source,owner:string,now:number):AdaptiveTrainingRow|null{
  const c=source.parameters.case;assertMarketCase(c);const f=c.forecast,o=c.outcome;
  if(source.parameters.studyId!==marketStudyProtocol.id||source.parameters.userId!==owner||f.userId!==owner||source.id!==studyUuid(`${marketStudyProtocol.id}:case:${owner}:${f.id}`))throw Error('ADAPTIVE_SOURCE_OWNER_OR_ID');
  const registered=Date.parse(source.created_at);
  if(!Number.isFinite(registered)||registered>now||f.at>now)throw Error('ADAPTIVE_SOURCE_REGISTRATION');
  if(o.status!=='settled')return null;
  const available=Date.parse(o.availableAt??''),actual=o.actualStart;
  if(!Number.isFinite(available)||available>now)return null;
  if(actual===undefined||!Number.isFinite(actual)||actual>now||available<=actual||Math.max(f.at,registered)>=actual-60000||typeof o.closingHash!=='string'||!/^[a-f0-9]{64}$/.test(o.closingHash))throw Error('ADAPTIVE_SOURCE_NOT_PREMATCH');
  if(f.x.slice(0,8).some(v=>Math.abs(v)>1000))throw Error('ADAPTIVE_SOURCE_FEATURES');
  return{id:f.id,at:f.at,available,x:f.x.slice(0,8),y:o.y![0]};
}

export class AdaptiveTraining{
  private store:ForecastStore;private owner:ProspectiveStudy;
  constructor(private env:Env,private now=Date.now){this.store=new ForecastStore(env,now);this.owner=new ProspectiveStudy(env,now);}
  private async sources(owner:string,deadline:number){
    const rows:Source[]=[];
    for(let offset=0;offset<marketStudyProtocol.maximumCases;offset+=1000){
      if(deadline-this.now()<12000)throw Error('ADAPTIVE_DEADLINE');
      const response=await this.store.db().from('model_versions').select('id,created_at,parameters').eq('name',sourceName).contains('parameters',{studyId:marketStudyProtocol.id,userId:owner}).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);
      if(response.error||!Array.isArray(response.data))throw Error('ADAPTIVE_READ_FAILED');rows.push(...response.data as unknown as Source[]);if(response.data.length<1000)break;
    }
    return rows;
  }
  async report(userId:string){
    if(userId!==await this.owner.ownerId())throw Error('ADAPTIVE_OWNER_ONLY');
    const response=await this.store.db().from('model_versions').select('parameters,created_at').eq('name',name).contains('parameters',{studyId:adaptiveTrainingProtocol.id,userId}).order('created_at',{ascending:false}).limit(30);
    if(response.error)throw Error('ADAPTIVE_REPORT_FAILED');
    const runs=(response.data??[]).map((row):StoredSummary=>{const parameters=row.parameters as unknown as {summary?:StoredSummary;day:string;state:string};return parameters.summary?publicSummary(parameters.summary):{status:parameters.state,day:parameters.day,checkedAt:row.created_at,reason:'Tentativo giornaliero registrato; esito non ancora disponibile.',automaticPromotion:false,operationallyValidated:false};});
    const lastRun:StoredSummary|null=runs.length?runs[0]:null;
    return{protocol:adaptiveTrainingProtocol,enabled:adaptiveTrainingEnabled(this.env),scheduled:adaptiveTrainingEnabled(this.env)&&this.env.VERCEL_ENV==='production'&&!!this.env.CRON_SECRET,automaticPromotion:false,operationallyValidated:false,lastRun,runs,reason:adaptiveTrainingEnabled(this.env)?'Addestramento dei candidati abilitato sul cron gratuito esistente; il modello operativo resta separato.':'Raccolta prospettica disabilitata o APP_ADAPTIVE_TRAINING_DISABLED=1.'};
  }
  async run(userId?:string,deadline=this.now()+90000){
    const now=this.now(),day=new Date(now).toISOString().slice(0,10),base={day,checkedAt:new Date(now).toISOString(),automaticPromotion:false as const,operationallyValidated:false as const};
    let authorizedOwner:string|undefined;
    if(userId){authorizedOwner=await this.owner.ownerId();if(userId!==authorizedOwner)throw Error('ADAPTIVE_OWNER_ONLY');}
    if(!adaptiveTrainingEnabled(this.env))return{...base,status:'disabled',reason:'Addestramento dei candidati disabilitato dalla configurazione.'};
    if(deadline-this.now()<12000)return{...base,status:'deferred_deadline',reason:'Budget residuo inferiore a 12 secondi: nessun tentativo giornaliero consumato.'};
    const owner=authorizedOwner??await this.owner.ownerId();
    const db=this.store.db(),id=studyUuid(`${adaptiveTrainingProtocol.id}:run:${owner}:${day}`),windows=adaptiveWindows(now);
    const claim=await db.from('model_versions').insert({id,name,version:`${adaptiveTrainingProtocol.id}:${owner}:${day}`,training_cutoff:windows.trainingBefore,validated:false,parameters:{studyId:adaptiveTrainingProtocol.id,userId:owner,day,state:'claimed',protocolHash:marketHash(adaptiveTrainingProtocol)}});
    if(claim.error){if(claim.error.code==='23505')return{...base,status:'daily_already_attempted',reason:'Tentativo già registrato oggi; prossimo tentativo nel prossimo giorno UTC.'};throw Error('ADAPTIVE_CLAIM_FAILED');}
    let summary:StoredSummary;
    try{
      const sources=await this.sources(owner,deadline),rows:AdaptiveTrainingRow[]=[],testStart=Date.parse(windows.testFrom),testEnd=Date.parse(windows.testBefore),seen=new Set<string>();
      const coverage:Coverage={registered:sources.length,pending:0,invalid:0,unavailable:0,rejectedByIntegrity:0,eligibleSettled:0,testRegistered:0,testEligibleSettled:0};
      const duplicateIds=new Set<string>();for(const source of sources){const event=source.parameters.case?.forecast?.id;if(seen.has(event))duplicateIds.add(event);seen.add(event);}
      for(const source of sources){
        const c=source.parameters.case,at=c?.forecast?.at;
        if(Number.isFinite(at)&&at>=testStart&&at<testEnd)coverage.testRegistered++;
        if(c?.outcome?.status==='pending')coverage.pending++;else if(c?.outcome?.status==='invalid')coverage.invalid++;
        try{if(duplicateIds.has(c?.forecast?.id))throw Error('ADAPTIVE_DUPLICATE');const row=adaptiveRow(source,owner,now);if(row){rows.push(row);coverage.eligibleSettled++;if(row.at>=testStart&&row.at<testEnd)coverage.testEligibleSettled++;}else if(c.outcome.status==='settled')coverage.unavailable++;}catch{coverage.rejectedByIntegrity++;}
      }
      const result=trainAdaptiveCandidate(rows,now,this.now,deadline);summary={...result.summary,coverage,testCoverage:coverage.testRegistered?coverage.testEligibleSettled/coverage.testRegistered:0};
      const saved=await db.from('model_versions').update({parameters:{studyId:adaptiveTrainingProtocol.id,userId:owner,day,state:summary.status,summary,protocolHash:marketHash(adaptiveTrainingProtocol),inputHash:marketHash(rows),...(result.artifact?{artifact:result.artifact,artifactHash:marketHash(result.artifact)}:{})}}).eq('id',id).eq('parameters->>state','claimed').select('id');
      if(saved.error||saved.data?.length!==1)throw Error('ADAPTIVE_SAVE_FAILED');
    }catch(error){
      summary={...base,status:error instanceof Error&&error.message==='ADAPTIVE_DEADLINE'?'deferred_deadline':'failed',reason:'Tentativo interrotto; nessun modello operativo modificato. Nuovo tentativo nel prossimo giorno UTC.'};
      const saved=await db.from('model_versions').update({parameters:{studyId:adaptiveTrainingProtocol.id,userId:owner,day,state:summary.status,summary,protocolHash:marketHash(adaptiveTrainingProtocol)}}).eq('id',id).eq('parameters->>state','claimed').select('id');
      if(saved.error||saved.data?.length!==1)throw Error('ADAPTIVE_FAILURE_SAVE_FAILED');
    }
    console.info(JSON.stringify({adaptiveTrainingRun:adaptiveTrainingProtocol.id,status:summary.status,day:summary.day,...('counts' in summary?{counts:summary.counts}:{}),coverage:summary.coverage,testCoverage:summary.testCoverage,...('selected' in summary?{selected:summary.selected,test:summary.test,baseline:summary.baseline}:{}),operationallyValidated:false}));return summary;
  }
}
