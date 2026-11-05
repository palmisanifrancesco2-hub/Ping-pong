import {createHash}from'node:crypto';
import{createClient}from'@supabase/supabase-js';
import modelData from'../models/elo-v1.json' with{type:'json'};
import{validateSupabaseClientConfig}from'../src/shared/supabase-config.js';
import{playerKey}from'../src/domain/player-model.js';
import type{FeedMatch}from'../src/shared/board.js';
import type{Forecast}from'./analysis.js';
import type{ResultsArchive}from'./results.js';
import type{Env}from'./auth.js';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function uuid(s:string){const h=hash(s);return`${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export class ForecastStore{
 constructor(private env:Env,private now=Date.now){}
 private db(){const config=validateSupabaseClientConfig(this.env.SUPABASE_URL,this.env.SUPABASE_PUBLISHABLE_KEY||this.env.SUPABASE_ANON_KEY),key=this.env.SUPABASE_SECRET_KEY||this.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!config||!key)throw new Error('FORECAST_STORE_NOT_CONFIGURED');return createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}});}
 async record(userId:string,m:FeedMatch,f:Forecast){
  const db=this.db();const at=new Date(this.now()).toISOString();
  const upsert=async(table:string,value:Record<string,unknown>,conflict:string)=>{const r=await db.from(table).upsert(value,{onConflict:conflict,ignoreDuplicates:true}).select('id');if(r.error)throw new Error('FORECAST_WRITE_FAILED');};
  const leagueId=uuid(`competition:${m.league}`),homeId=uuid(`player:${playerKey(m.league,m.home)}`),awayId=uuid(`player:${playerKey(m.league,m.away)}`),eventId=uuid(`event:${m.id}`),marketId=uuid(`winner:${m.id}`),bookId=uuid('book:bet365.com.au'),modelId=uuid(`model:${f.modelVersion}`),quoteId=uuid(`quote:${marketId}:${f.selection}:${f.quote.ts}`),predictionId=uuid(`prediction:${userId}:${marketId}:${modelId}:${f.selection}`);
  await upsert('competitions',{id:leagueId,source:'MoviOdds',source_id:m.league,name:m.league},'id');
  for(const [id,name]of[[homeId,m.home],[awayId,m.away]])await upsert('players',{id,source:'MoviOdds',source_id:hash(playerKey(m.league,name)),display_name:name},'id');
  await upsert('events',{id:eventId,source:'MoviOdds',source_id:m.id,competition_id:leagueId,home_id:homeId,away_id:awayId,starts_at:m.kickoff_utc,observed_at:at,state:'prematch'},'id');
  const eventCheck=await db.from('events').select('home_id,away_id,starts_at,state').eq('id',eventId).single();
  if(eventCheck.error||eventCheck.data.home_id!==homeId||eventCheck.data.away_id!==awayId||Date.parse(eventCheck.data.starts_at)<=Date.parse(at)||['completed','cancelled'].includes(eventCheck.data.state))throw new Error('FORECAST_EVENT_CONFLICT');
  await upsert('markets',{id:marketId,event_id:eventId,source_key:'match-winner:920000',kind:'winner',unit:'match',period:'match',line:null,settlement_rule:'Completed match winner only; interrupted matches remain unverified'},'id');
  await upsert('bookmakers',{id:bookId,source:'MoviOdds',source_key:'bet365.com.au',name:'bet365.com.au',domain:'bet365.com.au'},'id');
  await upsert('quotes',{id:quoteId,market_id:marketId,bookmaker_id:bookId,selection:f.selection,decimal_odds:f.quote.odds_dec,source:'MoviOdds',source_updated_at:f.quote.ts,received_at:at,suspended:false,mode:'real'},'id');
  const check=await db.from('quotes').select('decimal_odds').eq('id',quoteId).single();if(check.error||Number(check.data.decimal_odds)!==f.quote.odds_dec)throw new Error('FORECAST_QUOTE_CONFLICT');
  await upsert('model_versions',{id:modelId,name:f.modelName??'Elo tennistavolo',version:f.modelVersion,training_cutoff:f.trainingCutoff,parameters:f.modelParameters??{calibration:modelData.calibration,validation:f.validation,source:'MoviOdds',k:20},validated:f.modelValidated===true},'id');
  await upsert('predictions',{id:predictionId,user_id:userId,market_id:marketId,quote_id:quoteId,model_id:modelId,selection:f.selection,probability:f.probability,probability_lower:f.probabilityLower,sample_size:f.sampleSize,
   evidence:{source:'MoviOdds',reliability:f.reliability,validation:f.validation,scope:'Prematch match winner only',modelValidated:f.modelValidated===true},features_available_at:f.featuresAvailableAt??f.trainingCutoff,predicted_at:at,mode:'real'},'id');
  const recorded=await db.from('predictions').select('id,predicted_at,probability,quote:quotes(decimal_odds,source_updated_at)').eq('id',predictionId).eq('user_id',userId).single();
  if(recorded.error)throw new Error('FORECAST_RECORD_READ_FAILED');const r=recorded.data as unknown as {id:string;predicted_at:string;probability:number;quote:{decimal_odds:number}};return{id:r.id,at:r.predicted_at,probability:Number(r.probability),odds:Number(r.quote.decimal_odds)};
 }
 async settle(userId:string,getArchive:()=>Promise<ResultsArchive>){
  const db=this.db();const response=await db.from('predictions').select('id,predicted_at,selection,market:markets(event_id,event:events(source,source_id,home_id,away_id,home:players!events_home_id_fkey(display_name),away:players!events_away_id_fkey(display_name))),outcome:prediction_outcomes(status,result:results(status,available_at)),quote:quotes(decimal_odds)').eq('user_id',userId).eq('mode','real').order('predicted_at',{ascending:false}).limit(1000);
  if(response.error)throw new Error('SETTLEMENT_READ_FAILED');
  type Row={id:string;predicted_at:string;selection:string;market:{event_id:string;event:{source:string;source_id:string;home_id:string;away_id:string;home:{display_name:string};away:{display_name:string}}};outcome:{status:string;result:{status:string;available_at:string}|null}|null;quote:{decimal_odds:number}};
  const pending=(response.data as unknown as Row[]).filter(p=>p.market?.event?.source==='MoviOdds'&&(!p.outcome||p.outcome.status==='pending'||p.outcome.result?.status==='reported'));
  if(!pending.length)return{updated:0,source:'MoviOdds, esiti provvisori da verificare',limit:25};
  const archive=await getArchive();const results=new Map(archive.results.map(r=>[r.id,r]));let updated=0;
  for(const p of pending){
   if(updated>=25)break;const e=p.market.event,r=results.get(e.source_id);
   if(p.outcome?.result?.status==='reported'&&r&&Date.parse(r.availableAt)<=Date.parse(p.outcome.result.available_at))continue;
   if(!r||r.home!==e.home.display_name||r.away!==e.away.display_name||Date.parse(r.finishedAt)<=Date.parse(p.predicted_at))continue;
   const existing=await db.from('results').select('status').eq('event_id',p.market.event_id).maybeSingle();if(existing.error)throw new Error('SETTLEMENT_READ_FAILED');if(existing.data&&existing.data.status!=='reported')continue;
   const saved=await db.from('results').upsert({event_id:p.market.event_id,winner_id:r.homeWon?e.home_id:e.away_id,source:'MoviOdds; risultato riportato, non certificato indipendentemente',status:'reported',score:{sets:r.sets.map(s=>s.join('-'))},available_at:r.availableAt},{onConflict:'event_id'});if(saved.error)throw new Error('SETTLEMENT_RESULT_FAILED');
   const won=p.selection===(r.homeWon?r.home:r.away);const out=await db.from('prediction_outcomes').upsert({prediction_id:p.id,result_event_id:p.market.event_id,status:won?'won':'lost',settled_at:new Date(this.now()).toISOString(),theoretical_profit_per_unit:won?Number(p.quote.decimal_odds)-1:-1},{onConflict:'prediction_id'});if(out.error)throw new Error('SETTLEMENT_OUTCOME_FAILED');updated++;
  }
  return{updated,source:'MoviOdds, esiti provvisori da verificare',limit:25};
 }
}
