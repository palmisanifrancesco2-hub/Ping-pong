import { z } from 'zod';
import { COMPETITIONS, type ConnectionReport } from '../src/shared/contracts.js';

const sportSchema = z.object({ key: z.string().min(1), group: z.string(), title: z.string(), active: z.boolean(), description: z.string(), has_outrights: z.boolean() });
const eventSchema = z.object({ id: z.string().min(1), sport_key: z.string().min(1), sport_title: z.string().optional(), commence_time: z.iso.datetime({ offset: true }), home_team: z.string().min(1), away_team: z.string().min(1) });
const outcomeSchema = z.object({ name: z.string(), price: z.number().finite().gt(1), point: z.number().finite().optional(), description: z.string().optional() });
const marketSchema = z.object({ key: z.string(), last_update: z.iso.datetime({ offset: true }).optional(), outcomes: z.array(outcomeSchema) });
export const oddsSchema = eventSchema.extend({ bookmakers: z.array(z.object({ key: z.string(), title: z.string(), last_update: z.iso.datetime({ offset: true }).optional(), markets: z.array(marketSchema) })) });
export type ProviderEvent = z.infer<typeof eventSchema>;
export type ProviderOdds = z.infer<typeof oddsSchema>;
export class ProviderError extends Error {
  constructor(public code: string, message: string, public retryAfterSeconds: number | null = null) { super(message); }
}
type Quota = NonNullable<ConnectionReport['quota']>;
const numberHeader = (h: Headers, key: string) => {
  const value = h.get(key);
  return value !== null && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
};
const pathPart = (value: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new ProviderError('INVALID_FILTER', 'Identificativo non valido.');
  return encodeURIComponent(value);
};
export function isTableTennis(sport: { group: string; title: string; key: string }) {
  return /table[ _-]?tennis|ping[ _-]?pong|tennistavolo/i.test(`${sport.group} ${sport.title} ${sport.key}`);
}

// Only this module constructs credential-bearing URLs. Never log URLs or fetch errors.
export class OddsApi {
  private quota: Quota = { remaining: null, used: null, last: null };
  private blockedUntil = 0;
  constructor(private key: string | undefined, private fetcher: typeof fetch = fetch, private timeoutMs = 8_000) {}
  private async get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    if (!this.key?.trim()) throw new ProviderError('NOT_CONFIGURED', 'Chiave The Odds API non configurata sul server.');
    if (Date.now() < this.blockedUntil) throw new ProviderError('RATE_LIMIT', 'Limite API raggiunto. Attendere prima di riprovare.', Math.ceil((this.blockedUntil - Date.now()) / 1000));
    const url = new URL(`https://api.the-odds-api.com/v4/${path}`);
    url.search = new URLSearchParams({ ...params, apiKey: this.key }).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
      this.quota = { remaining: numberHeader(response.headers, 'x-requests-remaining'), used: numberHeader(response.headers, 'x-requests-used'), last: numberHeader(response.headers, 'x-requests-last') };
      if (!response.ok) {
        const retry = Math.min(3600, Math.max(5, numberHeader(response.headers, 'retry-after') ?? 60));
        if (response.status === 429) this.blockedUntil = Date.now() + retry * 1000;
        const codes: Record<number, [string, string]> = {
          401: ['UNAUTHORIZED', 'Chiave API non valida.'], 403: ['FORBIDDEN', 'Accesso negato: verificare piano e permessi.'],
          404: ['NOT_FOUND', 'Risorsa non disponibile presso il fornitore.'], 422: ['INVALID_FILTER', 'Filtro non supportato dal fornitore.'],
          429: ['RATE_LIMIT', 'Quota o frequenza API superata.'],
        };
        const [code, message] = codes[response.status] ?? ['UPSTREAM_ERROR', 'Il fornitore non è disponibile.'];
        // Never forward the upstream response body: it may contain request URLs or credentials.
        throw new ProviderError(code, message, response.status === 429 ? retry : null);
      }
      let json: unknown;
      try { json = await response.json(); } catch (error) {
        if (controller.signal.aborted) throw error;
        throw new ProviderError('INVALID_RESPONSE', 'Risposta API non JSON.');
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new ProviderError('INVALID_RESPONSE', 'Il formato ricevuto non corrisponde alla documentazione V4.');
      return parsed.data;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR', controller.signal.aborted ? 'Timeout della richiesta API.' : 'Connessione al fornitore non riuscita.');
    } finally { clearTimeout(timer); }
  }
  sports() { return this.get('sports/', { all: 'true' }, z.array(sportSchema)); }
  events(sport: string) { return this.get(`sports/${pathPart(sport)}/events`, { dateFormat: 'iso' }, z.array(eventSchema)); }
  markets(sport: string, eventId: string) {
    const schema = eventSchema.extend({ bookmakers: z.array(z.object({ key: z.string(), title: z.string(), markets: z.array(z.object({ key: z.string(), last_update: z.iso.datetime({ offset: true }).optional() })) })) });
    return this.get(`sports/${pathPart(sport)}/events/${pathPart(eventId)}/markets`, { regions: 'eu', dateFormat: 'iso' }, schema);
  }
  // Not wired to public routes in phase 1: calls consume subscription credits.
  odds(sport: string, eventId: string, markets: string[], bookmakers: string[]) {
    if (!markets.length || !bookmakers.length || markets.length > 8 || bookmakers.length > 10) throw new ProviderError('INVALID_FILTER', 'Specificare mercati e bookmaker verificati.');
    for (const value of [...markets, ...bookmakers]) pathPart(value);
    return this.get(`sports/${pathPart(sport)}/events/${pathPart(eventId)}/odds`, { markets: markets.join(','), bookmakers: bookmakers.join(','), oddsFormat: 'decimal', dateFormat: 'iso' }, oddsSchema);
  }
  usage(): Quota { return { ...this.quota }; }
  async connection(): Promise<ConnectionReport> {
    const base = { provider: 'The Odds API' as const, checkedAt: new Date().toISOString(), sports: [], tableTennisKeys: [], competitions: COMPETITIONS.map(name => ({ name, status: 'unverified' as const })), quota: null, adm: 'unverified' as const, live: 'unverified' as const };
    if (!this.key?.trim()) return { ...base, status: 'not_configured', message: 'Configurare THE_ODDS_API_KEY nelle variabili server. Nessuna richiesta effettuata.' };
    try {
      const sports = await this.sports();
      const tt = sports.filter(isTableTennis);
      return { ...base, status: 'connected', sports: sports.map(({ key, group, title, active }) => ({ key, group, title, active })), tableTennisKeys: tt.map(s => s.key), quota: this.usage(), competitions: COMPETITIONS.map(name => ({ name, status: tt.some(s => s.title.toLowerCase() === name.toLowerCase()) ? 'catalog_match' : 'not_in_catalog' })), message: tt.length ? 'Catalogo ricevuto. La presenza dello sport non conferma quote, live o bookmaker ADM.' : 'Connessione riuscita, ma il catalogo non include tennistavolo. Nessuna copertura operativa.' };
    } catch (error) {
      return { ...base, status: 'error', quota: this.usage(), message: error instanceof ProviderError ? error.message : 'Verifica non riuscita.' };
    }
  }
}
