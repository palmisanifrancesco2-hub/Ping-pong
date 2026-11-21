import { z } from 'zod';
import type { Board } from '../src/shared/board.js';
import { isUpcomingOrLive, marketName, quoteIdentity, quoteStatus } from '../src/shared/board.js';
import { historyWindow } from '../src/shared/history.js';
import type { ChoiceSnapshot, PersonalChoice } from '../src/shared/choices.js';
import { userDatabase } from './supabase.js';
import type { Env } from './auth.js';

export const saveChoiceSchema = z.object({ eventId: z.string().min(1).max(100), quoteKey: z.string().max(2000).optional(), expectedOdds:z.number().finite().gt(1).optional(),expectedUpdatedAt:z.iso.datetime({offset:true}).optional(),notes: z.string().max(1000).default('') }).strict().refine(p=>p.quoteKey===undefined?(p.expectedOdds===undefined&&p.expectedUpdatedAt===undefined):(p.expectedOdds!==undefined&&p.expectedUpdatedAt!==undefined));
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
  constructor(private env: Env, private fetcher: typeof fetch = fetch, private now = Date.now) {}
  async list(token: string, userId: string, period: string, page: number, status: string) {
    const window = historyWindow(period, this.now());
    let query = userDatabase(token,this.env,this.fetcher).from('personal_choices').select(columns,{count:'exact'})
      .eq('user_id',userId).lte('saved_at',window.to).order('saved_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*50,page*50-1);
    if (window.from) query = query.gte('saved_at',window.from);
    if (status !== 'all') query = query.eq('manual_status',status);
    const result = await query;
    if (result.error || !Array.isArray(result.data) || result.count === null) throw new Error('CHOICES_UNAVAILABLE');
    return { entries: result.data as unknown as PersonalChoice[],total: result.count,...window,page,pageSize:50 };
  }
  async save(token: string, userId: string, payload: z.infer<typeof saveChoiceSchema>, board: Board) {
    const snapshot = choiceSnapshot(board,payload.eventId,payload.quoteKey,this.now());
    if(snapshot.selection&&(snapshot.selection.odds!==payload.expectedOdds||snapshot.selection.quoteAt!==payload.expectedUpdatedAt))throw new Error('CHOICE_QUOTE_UNAVAILABLE');
    const db = userDatabase(token,this.env,this.fetcher);
    const choiceKey = payload.quoteKey ?? 'event';
    const result = await db.from('personal_choices').insert({ user_id:userId,event_source_id:payload.eventId,choice_key:choiceKey,snapshot,notes:payload.notes }).select(columns).single();
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
