import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorize, type Env } from './auth.js';
import { OddsApi } from './provider.js';
import { oddsApiKey } from './env.js';
import { MoviOddsFeed } from './moviodds.js';

type Dependencies = { env?: Env; authorize?: typeof authorize; provider?: OddsApi; now?: () => number; feed?: Pick<MoviOddsFeed, 'board'> };
export function createHandler(deps: Dependencies = {}) {
  const env = deps.env ?? process.env;
  const provider = deps.provider ?? new OddsApi(oddsApiKey(env));
  const checkAuth = deps.authorize ?? authorize;
  const now = deps.now ?? Date.now;
  const feed = deps.feed ?? new MoviOddsFeed();
  // Single-flight plus shared cache limits upstream usage per warm server instance.
  let cached: { at: number; value: Awaited<ReturnType<OddsApi['connection']>> } | undefined;
  let pending: ReturnType<OddsApi['connection']> | undefined;
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Metodo non consentito.' }); }
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/api/health') return send(200, { status: 'ok', version: '0.1.0' });
    if (path !== '/api/connection' && path !== '/api/board') return send(404, { error: 'Endpoint non disponibile.' });
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
    if (!match || !await checkAuth(match[1], env)) return send(401, { error: 'Accesso riservato agli utenti autorizzati.' });
    try {
      if (path === '/api/board') return send(200, await feed.board());
      if (!cached || now() - cached.at >= 60_000) {
        pending ??= provider.connection();
        try { cached = { at: now(), value: await pending }; } finally { pending = undefined; }
      }
      return send(200, cached.value);
    } catch { res.setHeader('Retry-After', '30'); return send(503, { error: 'Fonte temporaneamente non disponibile. Riprova tra 30 secondi.' }); }
  };
}
