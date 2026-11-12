import { impliedProbability } from './analytics.js';
export type Quote = {
  source: string; eventId: string; startsAt: string; homeId: string; awayId: string;
  market: 'winner' | 'total' | 'handicap' | 'exact_score';
  period: string; unit: 'match' | 'sets' | 'points'; selection: string; line: number | null;
  settlementRule: string; bookmaker: string; odds: number; updatedAt: string;
  admVerifiedUntil: string | null; suspended: boolean | null; mode: 'real' | 'demo';
};
// Display/search normalization only. NEVER join identities using this function.
export const normalizeDisplay = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');
export function comparisonKey(q: Quote) {
  if (![q.source, q.eventId, q.homeId, q.awayId, q.period, q.selection, q.settlementRule].every(s => s.trim())) return null;
  if (!Number.isFinite(Date.parse(q.startsAt)) || q.homeId === q.awayId) return null;
  if ((q.market === 'total' || q.market === 'handicap') && (q.line === null || !Number.isFinite(q.line))) return null;
  if ((q.market === 'winner' || q.market === 'exact_score') && q.line !== null) return null;
  return JSON.stringify([q.source, q.eventId, new Date(q.startsAt).toISOString(), q.homeId, q.awayId, q.market, q.period, q.unit, q.selection, q.line, q.settlementRule, q.mode]);
}
export function bestQuotes(quotes: Quote[], now: number, minOdds = 1.3, maxAgeSeconds = 300, options:{requireAdm?:boolean}={}) {
  if (!Number.isFinite(now) || !Number.isFinite(minOdds) || minOdds <= 1 || !Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) throw new Error('Filtri non validi');
  const best = new Map<string, Quote>();
  for (const q of quotes) {
    const key = comparisonKey(q);
    const age = now - Date.parse(q.updatedAt);
    if (!key || q.mode !== 'real' || q.suspended !== false || (options.requireAdm===true&&(!q.admVerifiedUntil||Date.parse(q.admVerifiedUntil)<=now||!Number.isFinite(Date.parse(q.admVerifiedUntil)))) || !Number.isFinite(age) || age < 0 || age > maxAgeSeconds * 1000 || !Number.isFinite(q.odds) || q.odds < minOdds) continue;
    impliedProbability(q.odds);
    if (!best.has(key) || best.get(key)!.odds < q.odds) best.set(key, q);
  }
  return [...best.values()];
}
