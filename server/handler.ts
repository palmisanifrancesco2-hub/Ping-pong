import{AdaptiveTraining}from'./adaptive-training.js';
import{predictionSystemReport}from'./prediction-system.js';
import{strictPredictionPolicy}from'./prediction-policy.js';
import{ensembleSignals,ensembleValueReport}from'./multi-model.js';
import{PlayerProfiles}from'./player-profiles.js';
import{ProspectiveStudy}from'./prospective-study.js';
import{MarketStudy}from'./market-study.js';
import{authorizedStudyCron}from'./cron-auth.js';
import{z}from'zod';
import{ManualBets,betSchema,betUpdateSchema}from'./manual-bets.js';
import{scoreSignals,scoreValueReport,runtimeModel}from'./score-signals.js';
import{userDatabase}from'./supabase.js';
import{googleAvailability}from'../src/shared/google-auth.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorize, type Env } from './auth.js';
import { OddsApi } from './provider.js';
import { oddsApiKey } from './env.js';
import { MoviOddsFeed } from './moviodds.js';
import { parseHistoryQuery, readHistory } from './history.js';
import { Choices, saveChoiceSchema, updateChoiceSchema } from './choices.js';
import { Analyses } from './analysis.js';
import { ForecastStore } from './forecast-store.js';
import modelData from '../models/elo-v1.json' with {type:'json'};
import {researchReport,scoreResearchReport,forwardStudy,modelComparison}from'./research-report.js';

type Dependencies = { trainer?:Pick<AdaptiveTraining,'run'|'report'>; marketStudy?:Pick<MarketStudy,'run'|'report'>; profiles?:Pick<PlayerProfiles,'forEvent'>; study?:Pick<ProspectiveStudy,'run'|'report'>; bets?:Pick<ManualBets,'list'|'save'|'update'>; env?: Env; authorize?: typeof authorize; provider?: OddsApi; now?: () => number; feed?: Pick<MoviOddsFeed, 'board'>; history?: typeof readHistory; choices?: Pick<Choices,'list'|'save'|'update'>; analyses?: Pick<Analyses,'analyse'|'results'>; forecasts?: Pick<ForecastStore,'record'|'settle'> };
export function createHandler(deps: Dependencies = {}) {
  const env = deps.env ?? process.env;
  const provider = deps.provider ?? new OddsApi(oddsApiKey(env));
  const checkAuth = deps.authorize ?? authorize;
  const now = deps.now ?? Date.now;
  const feed = deps.feed ?? new MoviOddsFeed();
  const choices = deps.choices ?? new Choices(env);
  const analyses = deps.analyses ?? new Analyses();
  const forecasts = deps.forecasts ?? new ForecastStore(env);
  const bets=deps.bets??new ManualBets(env,now);
  const profiles=deps.profiles??new PlayerProfiles(undefined,now,true);
  const study=deps.study??new ProspectiveStudy(env,now,analyses.results,feed as MoviOddsFeed);
  const trainer=deps.trainer??new AdaptiveTraining(env,now);
  const marketStudy=deps.marketStudy??new MarketStudy(env,now,analyses.results,feed);
  // Single-flight plus shared cache limits upstream usage per warm server instance.
  let cached: { at: number; value: Awaited<ReturnType<OddsApi['connection']>> } | undefined;
  let pending: ReturnType<OddsApi['connection']> | undefined;
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const methods = ['/api/study','/api/market-study','/api/training'].includes(path)?['GET','POST']:['/api/choices','/api/bets'].includes(path) ? ['GET','POST','PATCH'] : ['/api/analysis','/api/settle','/api/predictions'].includes(path)?['POST']:['GET'];
    if (!methods.includes(req.method ?? '')) { res.setHeader('Allow', methods.join(', ')); return send(405, { error: 'Metodo non consentito.' }); }
    if (path === '/api/health') return send(200, { status: 'ok', version: '0.1.0' });
    if (!['/api/training','/api/prediction-system','/api/connection', '/api/board', '/api/history','/api/choices','/api/analysis','/api/settle','/api/model','/api/access','/api/value','/api/predictions','/api/bets','/api/status','/api/study','/api/study-run','/api/profiles','/api/market-study'].includes(path)) return send(404, { error: 'Endpoint non disponibile.' });
    if(path==='/api/study-run'){
      if(!authorizedStudyCron(req.headers.authorization,env.CRON_SECRET))return send(401,{error:'Esecuzione non autorizzata.'});
      const deadline=now()+285000;let legacy:unknown,markets:unknown,training:unknown;
      try{legacy=await study.run();}catch{legacy={status:'failed'};console.error(JSON.stringify({apiPath:path,code:'STUDY_FAILED'}));}
      try{markets=await marketStudy.run(undefined,deadline);}catch{markets={status:'failed'};console.error(JSON.stringify({apiPath:path,code:'MARKET_STUDY_FAILED'}));}
      try{training=await trainer.run(undefined,deadline);}catch{training={status:'failed'};console.error('ADAPTIVE_TRAINING_FAILED');}
      return send((legacy as {status?:string})?.status==='failed'||(markets as {status?:string})?.status==='failed'||(training as {status?:string})?.status==='failed'?503:200,{winnerStudy:legacy,marketStudy:markets,adaptiveTraining:training});
    }
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
    const userId = match ? await checkAuth(match[1], env) : null;
    if (!match || !userId) return send(401, { error: 'Accesso riservato agli utenti autorizzati.' });
    try {
      if(path==='/api/market-study'){try{return send(200,req.method==='POST'?await marketStudy.run(userId):await marketStudy.report(userId));}catch(error){if(error instanceof Error&&error.message==='MARKET_STUDY_OWNER_ONLY')return send(403,{error:'Accesso al test riservato al proprietario.'});throw error;}}
      if(path==='/api/study'){try{return send(200,req.method==='POST'?await study.run(userId):await study.report(userId));}catch(error){if(error instanceof Error&&error.message==='STUDY_OWNER_ONLY')return send(403,{error:'Solo il proprietario può aggiornare la raccolta.'});throw error;}}
      if(path==='/api/profiles'){const id=url.searchParams.get('eventId');if(!id||id.length>100)return send(400,{error:'Evento non valido.'});let m=(await feed.board()).matches.find(m=>m.id===id);if(!m){const r=(await analyses.results.archive()).results.find(r=>r.id===id);if(r)m={...r,sport:'table_tennis',in_play:false,quotes:[]};}if(!m)return send(404,{error:'Evento non disponibile per la ricerca dei profili.'});return send(200,await profiles.forEvent(m));}
      if(path==='/api/training'){if(req.method==='POST'&&(Number(req.headers['content-length']??0)>0||req.headers['transfer-encoding']))return send(400,{error:'Non sono consentiti parametri di training dal browser.'});try{return send(200,req.method==='POST'?await trainer.run(userId):await trainer.report(userId));}catch(e){if(e instanceof Error&&e.message==='ADAPTIVE_OWNER_ONLY')return send(403,{error:'Training riservato al proprietario.'});throw e;}}
      if(path==='/api/prediction-system')return send(200,predictionSystemReport(now(),env));
      if(path==='/api/access')return send(200,{authorized:true});
      if(path==='/api/status'){
        const db=await userDatabase(match[1],env).from('manual_bets').select('id').limit(0);
        let google:boolean|null=null;try{google=(await googleAvailability(env.SUPABASE_URL??'',env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'')).enabled;}catch{}
        return send(200,{checkedAt:new Date(now()).toISOString(),database:db.error?'error':'connected',googleEnabled:google,privateAccess:true,recordingConfigured:!!(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY),modelVersion:runtimeModel.version,modelValidated:false});
      }
      if(path==='/api/bets'&&req.method==='GET'){
        let q;try{q=parseHistoryQuery(url.searchParams);}catch{return send(400,{error:'Filtri non validi.'});}
        return send(200,await bets.list(match[1],userId,q.period,q.page));
      }
      if(path==='/api/predictions'||(path==='/api/bets'&&req.method!=='GET')){
        if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'Richiesto JSON.'});
        let payload:unknown;try{const chunks:Buffer[]=[];let size=0;for await(const c of req){const b=Buffer.from(c);size+=b.length;if(size>8192)return send(413,{error:'Richiesta troppo grande.'});chunks.push(b);}payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Richiesta non valida.'});}
        if(path==='/api/bets'){
          if(req.method==='POST'){const p=betSchema.safeParse(payload);if(!p.success)return send(400,{error:'Dati della puntata non validi.'});try{return send(200,await bets.save(match[1],userId,p.data));}catch(e){if(e instanceof Error&&e.message==='BET_IDEMPOTENCY_CONFLICT')return send(409,{error:'La registrazione con questo identificativo esiste già con dati diversi.'});if(e instanceof Error&&e.message==='BET_INVALID_DATE')return send(400,{error:'La data non può essere futura.'});throw e;}}
          const p=betUpdateSchema.safeParse(payload);if(!p.success)return send(400,{error:'Esito non valido.'});return send(200,await bets.update(match[1],userId,p.data));
        }
        const schema=z.object({eventId:z.string().min(1).max(100),selection:z.string().min(1).max(500),expectedProbability:z.number().finite().min(0).max(1),expectedModelVersion:z.string().min(1).max(200),expectedOdds:z.number().finite().gt(1),expectedUpdatedAt:z.iso.datetime({offset:true})}).strict();const p=schema.safeParse(payload);if(!p.success)return send(400,{error:'Previsione non valida.'});
        const[board,archive]=await Promise.all([feed.board(),analyses.results.archive()]);const m=board.matches.find(m=>m.id===p.data.eventId);if(!m)return send(409,{error:'Partita non disponibile.'});
        const f=[...scoreSignals(m,archive,now()),...ensembleSignals(m,archive,now())].find(f=>f.selection===p.data.selection&&f.modelVersion===p.data.expectedModelVersion&&(f.probability*100).toFixed(1)===(p.data.expectedProbability*100).toFixed(1)&&f.quote.odds_dec===p.data.expectedOdds&&f.quote.ts===p.data.expectedUpdatedAt);if(!f)return send(409,{error:'Quota, stima o stato della partita cambiati.'});
        return send(200,await forecasts.record(userId,m,f));
      }

      if(path==='/api/value'){const[board,archive]=await Promise.all([feed.board(url.searchParams.get('refresh')==='1'),analyses.results.archive()]);return send(200,{...strictPredictionPolicy(scoreValueReport(board,archive,now()),board,now()),ensemble:ensembleValueReport(board,archive,now())});}
      if(path==='/api/model')return send(200,{comparison:modelComparison,research:researchReport,scoreResearch:scoreResearchReport,forwardStudy,version:runtimeModel.version,validated:false,generatedAt:runtimeModel.generatedAt,trainingCutoff:runtimeModel.calibrationCutoff,validation:runtimeModel.validation,calibration:{temperature:runtimeModel.temperature},leagues:{},source:'MoviOdds; validazione preliminare su risultati riportati'});
      if(path==='/api/settle')return send(200,await forecasts.settle(userId,()=>analyses.results.archive()));
      if(path==='/api/analysis'){
        const eventId=url.searchParams.get('eventId');if(!eventId||eventId.length>100)return send(400,{error:'Partita non valida.'});
        const board=await feed.board(),m=board.matches.find(m=>m.id===eventId);if(!m)return send(404,{error:'Partita non più disponibile.'});
        const report=await analyses.analyse(m);
        if(report.forecast){try{return send(200,{...report,recorded:await forecasts.record(userId,m,report.forecast)});}catch{return send(200,{...report,forecast:null,reason:'Registrazione del pronostico non riuscita: nessuna previsione operativa. Riprova.'});}}
        return send(200,report);
      }
      if (path === '/api/choices') {
        if (req.method === 'GET') {
          let query; try { query = parseHistoryQuery(url.searchParams); } catch { return send(400,{error:'Filtri non validi.'}); }
          if (query.status === 'unverified') return send(400,{error:'Filtro esito non valido.'});
          return send(200,await choices.list(match[1],userId,query.period,query.page,query.status));
        }
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'Richiesto JSON.'});
        let payload: unknown;
        try { const chunks: Buffer[]=[]; let size=0;
          for await (const chunk of req) { const bytes=Buffer.from(chunk);size+=bytes.length;if(size>8192) return send(413,{error:'Richiesta troppo grande.'});chunks.push(bytes); }
          payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch { return send(400,{error:'Richiesta non valida.'}); }
        if (req.method === 'POST') {
          const input=saveChoiceSchema.safeParse(payload);if(!input.success)return send(400,{error:'Scelta non valida.'});
          try { return send(200,await choices.save(match[1],userId,input.data,await feed.board())); }
          catch(error) { if(error instanceof Error && /^CHOICE_(EVENT|QUOTE)_UNAVAILABLE$/.test(error.message))return send(409,{error:'Partita o quota non più disponibile. Aggiorna le quote e riprova.'});throw error; }
        }
        const input=updateChoiceSchema.safeParse(payload);if(!input.success)return send(400,{error:'Esito personale non valido.'});
        try { return send(200,await choices.update(match[1],userId,input.data)); }
        catch(error) { if(error instanceof Error && error.message==='CHOICE_WATCH_ONLY')return send(400,{error:'Questa partita è solo osservata: salva una selezione per registrare un esito.'});throw error; }
      }
      if (path === '/api/history') {
        let query;
        try { query = parseHistoryQuery(url.searchParams); } catch { return send(400, { error: 'Intervallo, pagina o filtro esito non valido.' }); }
        return send(200, await (deps.history ?? readHistory)({ ...query, token: match[1], userId, env }));
      }
      if (path === '/api/board') return send(200, await feed.board(url.searchParams.get('refresh')==='1'));
      if (!cached || now() - cached.at >= 60_000) {
        pending ??= provider.connection();
        try { cached = { at: now(), value: await pending }; } finally { pending = undefined; }
      }
      return send(200, cached.value);
    } catch(error) { console.error(JSON.stringify({apiPath:path,code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'API_FAILURE'}));res.setHeader('Retry-After', '30'); return send(503, { error: 'Fonte temporaneamente non disponibile. Riprova tra 30 secondi.' }); }
  };
}
