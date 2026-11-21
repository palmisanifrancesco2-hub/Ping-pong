import { z } from 'zod';
import { setTimeout, clearTimeout } from 'node:timers';
import { createClient } from '@supabase/supabase-js';
import type { Board } from '../src/shared/board.js';
import { isUpcomingOrLive, marketName, quoteIdentity, quoteStatus } from '../src/shared/board.js';
import { historyWindow } from '../src/shared/history.js';
import type { ChoiceSnapshot } from '../src/shared/choices.js';
import { userDatabase } from './supabase.js';
import type { Env } from './auth.js';
import { estimateChoice, matchChoiceResult, readComparison, settleSnapshot, signForecast, type StoredChoice } from './choice-forecast.js';
import type { ResultsArchive } from './results.js';

export const saveChoiceSchema = z.object({ eventId: z.string().min(1).max(100), quoteKey: z.string().max(2000).optional(), expectedOdds:z.number().finite().gt(1).optional(),expectedUpdatedAt:z.iso.datetime({offset:true}).optional(),modelChoice:z.enum(['study','ensemble']).optional(), expectedForecast:z.object({selection:z.string().min(1).max(500),probability:z.number().min(0).max(1),model:z.string().min(1).max(200).optional()}).strict().optional(), notes: z.string().max(1000).default('') }).strict().refine(p=>p.quoteKey===undefined?(p.expectedOdds===undefined&&p.expectedUpdatedAt===undefined):(p.expectedOdds!==undefined&&p.expectedUpdatedAt!==undefined));
export const updateChoiceSchema = z.object({ id: z.uuid(), status: z.enum(['won','lost','void','pending']), notes: z.string().max(1000).default('') }).strict();
const columns = 'id,event_source_id,choice_key,snapshot,saved_at,notes,manual_status,manual_settled_at';
export function choiceSnapshot(board: Board, eventId: string, quoteKey: string | undefined, now: number): ChoiceSnapshot {
  const m = board.matches.find(m => m.id === eventId);
  if (!m || !isUpcomingOrLive(m, now)) throw new Error('CHOICE_EVENT_UNAVAILABLE');
  const q = quoteKey === undefined ? null : m.quotes.find(q => quoteIdentity(q) === quoteKey);
  if (quoteKey !== undefined && (!q || quoteStatus(m,q,now) !== 'Letta di recente dalla fonte')) throw new Error('CHOICE_QUOTE_UNAVAILABLE');
  return { source: 'MoviOdds', site: 'bet365.com.au', eventId: m.id, home: m.home, away: m.away, competition: m.league,
    startsAt: m.kickoff_utc ?? null, observedAt: new Date(now).toISOString(), selection: q ? {
      label: q.label || q.side || `Selezione ${q.sel_id}`, market: marketName(q), period: q.period ?? null,
      line: q.line ?? null, handicap: q.handicap ?? null, key: quoteIdentity(q), odds: q.odds_dec, quoteAt: q.ts,
    } : null };
}
export class Choices {
  constructor(private env: Env, private fetcher: typeof fetch = fetch, private now = Date.now,
    private getArchive?: () => Promise<ResultsArchive>) {}

  private get signingKey() { return this.env.SUPABASE_SECRET_KEY || this.env.SUPABASE_SERVICE_ROLE_KEY; }

  private async archive() {
    if (!this.getArchive) return;
    let cancel = () => {};
    try {
      return await Promise.race([
        this.getArchive().catch(()=>undefined),
        new Promise<undefined>(resolve=>{
          const timer=setTimeout(()=>resolve(undefined),9000);
          cancel=()=>clearTimeout(timer);
        }),
      ]);
    } finally { cancel(); }
  }

  private async compare(entries: StoredChoice[], userId: string) {
    const key = this.signingKey;
    const comparisons = entries.map(entry=>key ? readComparison(key,userId,entry) : undefined);
    const waiting = comparisons.some((comparison,index)=>comparison && !comparison.result &&
      (comparison.forecast.phase==='live' || Date.parse(entries[index].snapshot.startsAt ?? '')<=this.now()));
    const archive = waiting ? await this.archive() : undefined;
    const results = new Map(archive?.source==='postgres' ? archive.results.map(result=>[result.id,result]) : []);
    const db = key && this.env.SUPABASE_URL && results.size ? createClient(this.env.SUPABASE_URL,key,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{fetch:(input,init)=>this.fetcher(input,{...init,signal:AbortSignal.timeout(5000)})},
    }) : undefined;

    return Promise.all(entries.map(async (entry,index)=>{
      let comparison = comparisons[index];
      const {modelForecast,forecastSignature,modelResult,resultSignature,...snapshot} = entry.snapshot;
      if (key && db && comparison && !comparison.result) {
        const result = matchChoiceResult(snapshot,results.get(entry.event_source_id),this.now());
        if (result) {
          const settled = settleSnapshot(key,userId,entry,comparison.forecast,result);
          await db.from('personal_choices').update({snapshot:settled}).eq('id',entry.id).eq('user_id',userId)
            .eq('snapshot->>forecastSignature',forecastSignature!);
          comparison = {...comparison,result};
        }
      }
      return {...entry,snapshot,comparison};
    }));
  }
  async list(token: string, userId: string, period: string, page: number, status: string) {
    const window = historyWindow(period, this.now());
    let query = userDatabase(token,this.env,this.fetcher).from('personal_choices').select(columns,{count:'exact'})
      .eq('user_id',userId).lte('saved_at',window.to).order('saved_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*50,page*50-1);
    if (window.from) query = query.gte('saved_at',window.from);
    if (status !== 'all') query = query.eq('manual_status',status);
    const result = await query;
    if (result.error || !Array.isArray(result.data) || result.count === null) throw new Error('CHOICES_UNAVAILABLE');
    return { entries: await this.compare(result.data as unknown as StoredChoice[],userId),total: result.count,...window,page,pageSize:50 };
  }
  async save(token: string, userId: string, payload: z.infer<typeof saveChoiceSchema>, board: Board) {
    const snapshot = choiceSnapshot(board,payload.eventId,payload.quoteKey,this.now());
    if(snapshot.selection&&(snapshot.selection.odds!==payload.expectedOdds||snapshot.selection.quoteAt!==payload.expectedUpdatedAt))throw new Error('CHOICE_QUOTE_UNAVAILABLE');
    const db = userDatabase(token,this.env,this.fetcher);
    const choiceKey = payload.quoteKey ?? 'event';
    const key = this.signingKey;
    const stored: StoredChoice['snapshot'] = snapshot;
    if (payload.expectedForecast) {
      const match = board.matches.find(m=>m.id===payload.eventId)!;
      const archive = await this.archive();
      const initialTime = Date.parse(snapshot.observedAt);
      const forecast = key && isUpcomingOrLive(match,this.now())
        ? estimateChoice(match,snapshot,archive,payload.modelChoice==='ensemble',initialTime) : undefined;
      const expected = payload.expectedForecast;
      if (!forecast || forecast.selection!==expected.selection || (expected.model!==undefined && forecast.model!==expected.model) ||
        Math.round(forecast.probability*1000)!==Math.round(expected.probability*1000)) throw new Error('CHOICE_FORECAST_UNAVAILABLE');
      stored.modelForecast=forecast;
      stored.forecastSignature=signForecast(key!,userId,choiceKey,snapshot,forecast);
    }
    const result = await db.from('personal_choices').insert({ user_id:userId,event_source_id:payload.eventId,choice_key:choiceKey,snapshot:stored,notes:payload.notes }).select(columns).single();
    if (!result.error) return result.data;
    if (result.error.code !== '23505') throw new Error('CHOICES_SAVE_FAILED');
    // Preserve the first saved price and time on repeat clicks.
    const existing = await db.from('personal_choices').select(columns).eq('user_id',userId).eq('event_source_id',payload.eventId).eq('choice_key',choiceKey).single();
    if (existing.error) throw new Error('CHOICES_SAVE_FAILED');
    return existing.data;
  }
  async update(token: string, userId: string, payload: z.infer<typeof updateChoiceSchema>) {
    const db = userDatabase(token,this.env,this.fetcher);
    const existing = await db.from('personal_choices').select('snapshot').eq('user_id',userId).eq('id',payload.id).single();
    if (existing.error || !existing.data) throw new Error('CHOICE_NOT_FOUND');
    const snapshot = existing.data.snapshot as unknown as ChoiceSnapshot;
    if (!snapshot.selection && payload.status !== 'pending') throw new Error('CHOICE_WATCH_ONLY');
    const result = await db.from('personal_choices').update({ notes:payload.notes,manual_status:payload.status,
      manual_settled_at:payload.status==='pending'?null:new Date(this.now()).toISOString() }).eq('user_id',userId).eq('id',payload.id).select(columns).single();
    if (result.error) throw new Error('CHOICES_UPDATE_FAILED');
    return result.data;
  }
}
