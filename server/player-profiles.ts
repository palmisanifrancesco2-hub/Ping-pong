import { z } from 'zod';
import type { FeedMatch } from '../src/shared/board.js';
import type { PlayerProfile, PublicProfile } from '../src/shared/profiles.js';

const entitySchema = z.object({ id: z.string().regex(/^Q\d+$/), labels: z.record(z.string(), z.object({ value: z.string() })).optional(), aliases: z.record(z.string(), z.array(z.object({ value: z.string() }))).optional(), claims: z.record(z.string(), z.array(z.unknown())).optional() });
type Entity = z.infer<typeof entitySchema>;
const nameKey = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
function values(e: Entity, property: string): unknown[] {
  return (e.claims?.[property] ?? []).flatMap(claim => {
    const p = z.object({ rank: z.string().optional(), mainsnak: z.object({ snaktype: z.literal('value'), datavalue: z.object({ value: z.unknown() }) }) }).safeParse(claim);
    return p.success && p.data.rank !== 'deprecated' ? [p.data.mainsnak.datavalue.value] : [];
  });
}
const ids = (e: Entity, p: string) => values(e, p).flatMap(v => { const r = z.object({ id: z.string().regex(/^Q\d+$/) }).safeParse(v); return r.success ? [r.data.id] : []; });
export function profileCandidates(payload: unknown, name: string): Entity[] {
  const entities = z.object({ entities: z.record(z.string(), z.unknown()) }).parse(payload).entities;
  return Object.values(entities).flatMap(value => {
    const parsed = entitySchema.safeParse(value); if (!parsed.success) return [];
    const e = parsed.data, names = [...Object.values(e.labels ?? {}).map(l => l.value), ...Object.values(e.aliases ?? {}).flatMap(a => a.map(l => l.value))];
    return names.some(n => nameKey(n) === nameKey(name)) && ids(e, 'P31').includes('Q5')
      && (ids(e, 'P641').includes('Q3930') || ids(e, 'P106').includes('Q13382519')) ? [e] : [];
  });
}
export class PlayerProfiles {
  private cached = new Map<string, { at: number; value: PlayerProfile }>();
  private pending = new Map<string, Promise<PlayerProfile>>();
  private nextRequest = 0;
  constructor(private fetcher: typeof fetch = fetch, private now = Date.now, private interactive = false) {}
  private async request(params: Record<string, string>) {
    const slot = Math.max(this.now(), this.nextRequest); this.nextRequest = slot + 1000;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, slot - this.now())));
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({ ...params, format: 'json', ...(this.interactive?{}:{maxlag:'5'}) }).toString();
    const r = await this.fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': 'PingPongAnalytics/0.1 (https://github.com/palmisanifrancesco2-hub/Ping-pong; private sports dashboard)' } });
    if (!r.ok) throw Error('PROFILE_SOURCE_UNAVAILABLE');
    const text = await r.text(); if (text.length > 1500000) throw Error('PROFILE_RESPONSE_TOO_LARGE');
    const p = JSON.parse(text); if (p.error) throw Error('PROFILE_SOURCE_UNAVAILABLE'); return p;
  }
  async lookup(name: string): Promise<PlayerProfile> {
    const key = nameKey(name), cached = this.cached.get(key);
    if (cached && this.now() - cached.at < (cached.value.status === 'unavailable' ? 30000 : 86400000)) return cached.value;
    const pending = this.pending.get(key); if (pending) return pending;
    // Bound traffic and cache size; never request every player in the feed automatically.
    if (this.nextRequest - this.now() > 20000) return this.empty(name, 'unavailable');
    const request = this.read(name).catch(() => this.empty(name, 'unavailable')).then(value => {
      if (this.cached.size >= 400) this.cached.delete(this.cached.keys().next().value!);
      this.cached.set(key, { at: this.now(), value }); return value;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request); return request;
  }
  private empty(name: string, status: PlayerProfile['status']): PlayerProfile { return { requestedName: name, status, candidates: [], checkedAt: new Date(this.now()).toISOString(), source: 'Wikidata', license: 'CC0' }; }
  private async read(name: string): Promise<PlayerProfile> {
    const search = z.object({ search: z.array(z.object({ id: z.string().regex(/^Q\d+$/) })).max(5) }).parse(await this.request({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '5' }));
    if (!search.search.length) return this.empty(name, 'not_found');
    const response = await this.request({ action: 'wbgetentities', ids: search.search.map(e => e.id).join('|'), props: 'claims|labels|aliases', languages: 'en|it' });
    const candidates = profileCandidates(response, name); if (!candidates.length) return this.empty(name, 'not_found');
    const countryIds = [...new Set(candidates.flatMap(e => ids(e, 'P27')))];
    const labels: Record<string, string> = {};
    if (countryIds.length) {
      const response = z.object({ entities: z.record(z.string(), z.unknown()) }).parse(await this.request({ action: 'wbgetentities', ids: countryIds.slice(0, 20).join('|'), props: 'labels', languages: 'it|en' }));
      for (const [id, raw] of Object.entries(response.entities)) { const e = entitySchema.safeParse(raw); if (e.success) labels[id] = e.data.labels?.it?.value ?? e.data.labels?.en?.value ?? id; }
    }
    const profiles: PublicProfile[] = candidates.map(e => {
      const births = values(e, 'P569').flatMap(value => { const v = z.object({ time: z.string(), precision: z.number(), calendarmodel: z.string() }).safeParse(value); return v.success && v.data.calendarmodel.endsWith('/Q1985727') ? [v.data] : []; });
      const b = births.length === 1 ? births[0] : null;
      const date = b && /^\+\d{4}-/.test(b.time) ? b.precision >= 11 ? b.time.slice(1, 11) : b.precision === 9 ? b.time.slice(1, 5) : null : null;
      return { id: e.id, name: e.labels?.it?.value ?? e.labels?.en?.value ?? name, url: `https://www.wikidata.org/wiki/${e.id}`, birthDate: date, countries: ids(e, 'P27').map(id => labels[id] ?? id) };
    });
    return { ...this.empty(name, profiles.length === 1 ? 'candidate' : 'ambiguous'), candidates: profiles };
  }
  async forEvent(m: Pick<FeedMatch, 'id' | 'home' | 'away'>) { return { eventId: m.id, profiles: await Promise.all([this.lookup(m.home), this.lookup(m.away)]) }; }
}
