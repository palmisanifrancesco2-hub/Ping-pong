import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Env } from './auth.js';
import { validateSupabaseClientConfig } from '../src/shared/supabase-config.js';
import { historyWindow, summarizeHistory, type HistoryEntry, type HistoryReport, type OutcomeStatus } from '../src/shared/history.js';

const number = z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)]).transform(Number).pipe(z.number().finite());
const outcome = z.object({ status: z.enum(['won', 'lost', 'void', 'pending']), settled_at: z.string().nullable(), result_event_id: z.string(),
  result: z.object({ status: z.enum(['official', 'reported', 'cancelled', 'void']), score: z.unknown(), source: z.string() }).nullable() });
const rowSchema = z.object({
  id: z.string(), user_id: z.string(), mode: z.literal('real'), predicted_at: z.iso.datetime({ offset: true }),
  selection: z.string(), probability: number.pipe(z.number().min(0).max(1)), sample_size: z.number().int().positive(),
  market: z.object({ event_id: z.string(), kind: z.string(), unit: z.string(), period: z.string(), line: number.nullable(),
    event: z.object({ home: z.object({ display_name: z.string() }), away: z.object({ display_name: z.string() }), competition: z.object({ name: z.string() }) }) }),
  quote: z.object({ decimal_odds: number.pipe(z.number().gt(1)), source_updated_at: z.string(), bookmaker: z.object({ name: z.string() }) }),
  model: z.object({ name: z.string(), version: z.string(), validated: z.boolean() }),
  outcome: z.union([outcome.nullable(), z.array(outcome).max(1)]).transform(v => Array.isArray(v) ? v[0] ?? null : v),
});
export const HISTORY_SELECT = 'id,user_id,mode,predicted_at,selection,probability,sample_size,market:markets(event_id,kind,unit,period,line,event:events(home:players!events_home_id_fkey(display_name),away:players!events_away_id_fkey(display_name),competition:competitions(name))),quote:quotes(decimal_odds,source_updated_at,bookmaker:bookmakers(name)),model:model_versions(name,version,validated),outcome:prediction_outcomes(status,settled_at,result_event_id,result:results(status,score,source))';
export function historyEntry(payload: unknown, userId: string, now = Date.now()): HistoryEntry {
  const p = rowSchema.parse(payload);
  if (p.user_id !== userId) throw new Error('HISTORY_OWNER_MISMATCH');
  let status: OutcomeStatus = p.outcome?.status ?? 'pending';
  let reportedStatus: 'won' | 'lost' | null = null;
  if (p.outcome && status !== 'pending') {
    const settledAt = Date.parse(p.outcome.settled_at ?? '');
    const result = p.outcome.result;
    if (result?.status === 'reported' && (status === 'won' || status === 'lost') && p.outcome.result_event_id === p.market.event_id
      && Number.isFinite(settledAt) && settledAt >= Date.parse(p.predicted_at) && settledAt <= now) reportedStatus=status;
    if (p.outcome.result_event_id !== p.market.event_id || !Number.isFinite(settledAt) || settledAt < Date.parse(p.predicted_at) || settledAt > now
      || !result || (status !== 'void' && result.status !== 'official')) status = 'unverified';
  }
  const profit = status === 'won' ? p.quote.decimal_odds - 1 : status === 'lost' ? -1 : status === 'void' ? 0 : null;
  return { id: p.id, predictedAt: p.predicted_at, match: `${p.market.event.home.display_name} — ${p.market.event.away.display_name}`,
    competition: p.market.event.competition.name,
    market: `${p.market.kind} · ${p.market.unit} · ${p.market.period}${p.market.line === null ? '' : ` · ${p.market.line}`}`,
    selection: p.selection, odds: p.quote.decimal_odds, probability: p.probability, sampleSize: p.sample_size,
    model: `${p.model.name} ${p.model.version}`, modelValidated: p.model.validated,
    bookmaker: p.quote.bookmaker.name, quoteUpdatedAt: p.quote.source_updated_at,
    status, reportedStatus, settledAt: status === 'unverified' && !reportedStatus ? null : p.outcome?.settled_at ?? null,
    result: status === 'pending' || (status === 'unverified' && !reportedStatus) || p.outcome?.result?.score == null ? null : JSON.stringify(p.outcome.result.score).slice(0, 300),
    resultSource: p.outcome?.result?.source ?? null, theoreticalProfit: profit };
}
export function parseHistoryQuery(params: URLSearchParams) {
  const period = params.get('period') ?? '30'; historyWindow(period, Date.now());
  const pageText = params.get('page') ?? '1';
  if (!/^[1-9]\d{0,4}$/.test(pageText)) throw new Error('INVALID_HISTORY_PAGE');
  const status = params.get('status') ?? 'all';
  if (!['all', 'won', 'lost', 'void', 'pending', 'unverified'].includes(status)) throw new Error('INVALID_HISTORY_STATUS');
  return { period, page: Number(pageText), status: status as OutcomeStatus | 'all' };
}
export type HistoryRequest = ReturnType<typeof parseHistoryQuery> & { token: string; userId: string; env: Env };
export async function readHistory(input: HistoryRequest, fetcher: typeof fetch = fetch, now = Date.now()): Promise<HistoryReport> {
  const window = historyWindow(input.period, now);
  const config = validateSupabaseClientConfig(input.env.SUPABASE_URL, input.env.SUPABASE_PUBLISHABLE_KEY || input.env.SUPABASE_ANON_KEY);
  if (!config) throw new Error('HISTORY_NOT_CONFIGURED');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${input.token}` }, fetch: (url, init) => fetcher(url, { ...init,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) }) } });
    const entries: HistoryEntry[] = []; let total = 0;
    // RLS uses the caller's JWT, with an additional owner predicate; no admin credentials.
    // Bound work on free infrastructure and report any partial analysis explicitly.
    for (let offset = 0; offset < 10_000; offset += 1000) {
      let query = client.from('predictions').select(HISTORY_SELECT, { count: 'exact' }).eq('user_id', input.userId).eq('mode', 'real')
        .lte('predicted_at', window.to).order('predicted_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 999);
      if (window.from) query = query.gte('predicted_at', window.from);
      const result = await query;
      if (result.error || !Array.isArray(result.data) || result.count === null) throw new Error('HISTORY_QUERY_FAILED');
      total = result.count;
      entries.push(...result.data.map(row => historyEntry(row, input.userId, now)));
      if (entries.length >= total) break;
      if (!result.data.length) throw new Error('HISTORY_INCOMPLETE_QUERY');
    }
    const filtered = input.status === 'all' ? entries : entries.filter(e => e.status === input.status);
    const start = (input.page - 1) * 50;
    return { checkedAt: new Date(now).toISOString(), ...window, page: input.page, pageSize: 50, totalRecorded: total,
      analyzed: entries.length, partial: entries.length < total, filteredCount: filtered.length,
      summary: summarizeHistory(entries),sourceSummary:(()=>{const won=entries.filter(e=>e.reportedStatus==='won').length,lost=entries.filter(e=>e.reportedStatus==='lost').length;return{won,lost,hitRate:won+lost?won/(won+lost):null};})(), entries: filtered.slice(start, start + 50) };
  } catch { throw new Error('HISTORY_UNAVAILABLE'); }
  finally { clearTimeout(timeout); controller.abort(); }
}
