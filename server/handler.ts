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

type Dependencies = { env?: Env; authorize?: typeof authorize; provider?: OddsApi; now?: () => number; feed?: Pick<MoviOddsFeed, 'board'>; history?: typeof readHistory; choices?: Pick<Choices,'list'|'save'|'update'>; analyses?: Pick<Analyses,'analyse'|'results'>; forecasts?: Pick<ForecastStore,'record'|'settle'> };
export function createHandler(deps: Dependencies = {}) {
  const env = deps.env ?? process.env;
  const provider = deps.provider ?? new OddsApi(oddsApiKey(env));
  const checkAuth = deps.authorize ?? authorize;
  const now = deps.now ?? Date.now;
  const feed = deps.feed ?? new MoviOddsFeed();
  const choices = deps.choices ?? new Choices(env);
  const analyses = deps.analyses ?? new Analyses();
  const forecasts = deps.forecasts ?? new ForecastStore(env);
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
    const methods = path === '/api/choices' ? ['GET','POST','PATCH'] : ['/api/analysis','/api/settle'].includes(path)?['POST']:['GET'];
    if (!methods.includes(req.method ?? '')) { res.setHeader('Allow', methods.join(', ')); return send(405, { error: 'Metodo non consentito.' }); }
    if (path === '/api/health') return send(200, { status: 'ok', version: '0.1.0' });
    if (!['/api/connection', '/api/board', '/api/history','/api/choices','/api/analysis','/api/settle','/api/model'].includes(path)) return send(404, { error: 'Endpoint non disponibile.' });
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
    const userId = match ? await checkAuth(match[1], env) : null;
    if (!match || !userId) return send(401, { error: 'Accesso riservato agli utenti autorizzati.' });
    try {
      if(path==='/api/model')return send(200,{version:modelData.version,validated:modelData.validated,generatedAt:modelData.generatedAt,trainingCutoff:modelData.trainingCutoff,validation:modelData.validation,calibration:modelData.calibration,leagues:modelData.leagues,source:'MoviOdds; validazione preliminare su risultati riportati'});
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
      if (path === '/api/board') return send(200, await feed.board());
      if (!cached || now() - cached.at >= 60_000) {
        pending ??= provider.connection();
        try { cached = { at: now(), value: await pending }; } finally { pending = undefined; }
      }
      return send(200, cached.value);
    } catch { res.setHeader('Retry-After', '30'); return send(503, { error: 'Fonte temporaneamente non disponibile. Riprova tra 30 secondi.' }); }
  };
}
