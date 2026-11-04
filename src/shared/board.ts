export type FeedQuote = {
  fixture_id: string; group_id: string; group_name?: string; market_id?: string;
  market_key?: string; period?: string; sel_id: string; label?: string; side?: string;
  line?: string; handicap?: string; n2?: string; odds_dec: number; odds_frac?: string;
  ts: string; suspended?: boolean; phase?: 'prematch' | 'inplay';
};
export type FeedMatch = {
  id: string; sport: 'table_tennis'; home: string; away: string; league: string;
  kickoff_utc?: string; in_play: boolean; score?: string; polled_at?: string;
  group_status?: Record<string, { polled_at?: string; stale?: boolean }>;
  quotes: FeedQuote[];
};
export type Board = {
  provider: 'MoviOdds'; bookmakerSite: 'bet365.com.au'; checkedAt: string;
  serverTime: string; warming: boolean; matches: FeedMatch[];
};
export function isFreshLive(match: FeedMatch, now: number): boolean {
  const age = now - Date.parse(match.polled_at ?? '');
  return match.in_play && Number.isFinite(age) && age >= -60_000 && age <= 60_000;
}
export function isUpcomingOrLive(match: FeedMatch, now: number): boolean {
  return isFreshLive(match, now) || (!match.in_play && Number.isFinite(Date.parse(match.kickoff_utc ?? '')) && Date.parse(match.kickoff_utc!) > now);
}
// Preserve provider identity including changing game period and sub-market.
export function marketIdentity(q: FeedQuote): string {
  return JSON.stringify([q.group_id, q.market_key ?? '', q.period ?? '', q.market_id ?? '', q.phase ?? 'prematch']);
}
export function quoteIdentity(q: FeedQuote): string { return JSON.stringify([marketIdentity(q), q.sel_id]); }
export function marketName(q: FeedQuote): string { return q.group_name || `Mercato ${q.group_id}`; }
export function quoteStatus(match: FeedMatch, q: FeedQuote, now: number): string {
  if (q.suspended || q.odds_dec <= 1) return 'Sospesa / non disponibile';
  const status = match.group_status?.[q.group_id];
  const readAt = Date.parse(status?.polled_at ?? '');
  const age = now - readAt;
  if (!Number.isFinite(age) || status?.stale || age < -60_000 || age > (match.in_play ? 60_000 : 120_000)) return 'Aggiornamento non confermato';
  if (match.in_play && q.phase !== 'inplay') return 'Prematch archiviata';
  if (!match.in_play && (!match.kickoff_utc || Date.parse(match.kickoff_utc) <= now)) return 'Stato evento da verificare';
  return 'Letta di recente dalla fonte';
}
export type BoardFilters = { search: string; competition: string; market: string; state: string; minOdds: number; includeUnavailable: boolean };
export function filterBoard(matches: FeedMatch[], f: BoardFilters, now = Date.now()): FeedMatch[] {
  const text = f.search.trim().toLocaleLowerCase('it');
  return matches.filter(m => isUpcomingOrLive(m, now) && (!text || `${m.home} ${m.away}`.toLocaleLowerCase('it').includes(text))
    && (!f.competition || m.league === f.competition)
    && (!f.state || (f.state === 'live' ? m.in_play : !m.in_play)))
    .map(m => ({ ...m, quotes: m.quotes.filter(q => (!f.market || marketName(q) === f.market)
      && ((q.suspended || q.odds_dec <= 1) ? f.includeUnavailable : q.odds_dec >= f.minOdds)) }))
    .filter(m => m.quotes.length > 0);
}
